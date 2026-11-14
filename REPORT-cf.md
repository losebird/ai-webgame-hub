# 即玩：Cloudflare Workers + D1 改写报告

- 分支：`cf/workers-d1`（从 `main@1e21550cc33deefa329ad3dbd5ce3486e91aac7b` 拉出）
- draft PR：见本分支在 GitHub 上对 `main` 打开的 draft（完整 URL 以推送后的 PR 页为准）
- head SHA：见本 PR 最新提交
- base：`main`（`1e21550`）
- 所用模型：Grok Bot（Ace 派出的工程执行者，在 box 上直接改写；未使用 Cursor cloud agent，也未交给本机 Grok Build）

作者自测记录如下，**最终 verdict 由验证官给，作者不自判通过**。

## ACCEPTANCE

1. 新分支 + draft PR，base 为 `main`，head 基于 `1e21550` 之后的提交。**PASS**（推送并开 draft 后可见）。
2. 本地只需 `wrangler dev --local` 与本地 D1，不需要 Cloudflare 账号。**PASS**。启动见 README：`npm install && npm run import:local && npm run dev`，浏览器打开 <http://127.0.0.1:8787>。证据：`evidence-cf/env.txt`（wrangler 4.162.0，Node v22.23.2）。
3. 主路径走通（首页可见目录与已上架工坊包、详情、游玩计数、注册登录后 Cookie 仍有效、收藏、发帖/评价、审核员进后台；中英字段保留）。**PASS**。证据：`evidence-cf/main-path.txt`、`evidence-cf/unit-tests.txt` 中 journey 段。
4. 原 `server/smoke.js` 与 `server/client-test.js` 语义保留，并新增同源空 `JIWAN_API_BASE`、伪造 Origin 拒绝、Cookie HttpOnly。**PASS**。共 87 项：smoke 57、client 12、security 4、jiwan 数据 3 + security 4、journey 7，全部 ALL PASS。完整输出：`evidence-cf/unit-tests.txt`。
5. 从 `jiwan.db` 导入后：`games` 表 73 行；已过审的潮汐回廊（`pack-seed-tide`）与灯塔守夜人（`pack-mwfbgncbfpoc`）为 `listed` 并出现在可见列表；`plays` 13 条，其中 evensong=11，与源库一致。sessions 在导入时为空。另可用 `npm run import:local:seed` 从 `seed.db` 重建。**PASS**。证据：unit-tests.txt 的 data (jiwan) 段。
6. README 写清将来部署步骤，本轮未执行 `wrangler login` / `wrangler deploy`。**PASS**。
7. 产品名是「即玩」，未混入已关闭 PR 的 WebGame 货架代码。**PASS**（检索无产品名 WebGame；`label.webgame` 仍是「网页游戏」翻译键）。

## 架构

- 一个 Worker（`worker/index.js`）同源提供静态页和 API。`wrangler.toml` 的 `[assets]` 指向 `public/`（对根目录 HTML 与 `assets/` 的符号链接），`run_worker_first = true`。API 前缀（`/home`、`/games`、`/auth`、`/admin` 等）由 Worker 处理，其余交给 ASSETS。`html_handling` 设为 `none`，避免 `/admin.html` 被重写成 `/admin` 而撞上需要登录的管理 API。
- HTML 响应注入 `window.JIWAN_API_BASE=window.JIWAN_API_BASE||''`。前端 `assets/jiwan-api.js` 把空字符串当作同源相对路径，不再因未配置 BASE 而报错。
- D1 经 `src/d1.js` 适配为 `all/get/run`。业务在 `src/api.js` / `src/store.js`，语义对齐 `server/api.js`，全部改为异步。Node 对照版（`server/`）保留，未改其双端口行为。
- 迁移：`migrations/0001_init.sql`（幂等 `CREATE IF NOT EXISTS`，并补 reviews/history/packs 等读路径索引）。数据：`scripts/dump-sql.mjs` 从 `server/data/{jiwan,seed}.db` 导出 `data/sql/*.sql`；`scripts/import-local-d1.mjs` 先 apply migrations 再导入。不需要 Cloudflare 账号。
- 安全：写操作要求 `Origin` 等于本站 origin，并校验双提交 CSRF（`jiwan_csrf` 非 HttpOnly + `X-CSRF-Token`）。会话 `jiwan_sid` 为 HttpOnly + SameSite=Lax，HTTPS 下加 Secure。密码比较为常量时间；哈希仍是演示级 `sha256("jiwan:" + pass)`，README 已标明。未把 token 或明文密码写入页面或证据。
- 工坊 zip 仍不上传，`playUrl` 只透传。本轮未引入 R2。

## 免费套餐评估

证据：`evidence-cf/timings.json`。测的是本地 `X-Jiwan-Elapsed-Ms`（墙钟，含本地 D1 I/O 与 isolate 开销），**不是**生产环境只计 CPU 的 10ms。

| 接口 | min | median | max |
|---|---:|---:|---:|
| GET /games/index | 6ms | 7ms | 9ms |
| GET /rankings | 6ms | 7ms | 7ms |
| POST /auth/login | 10ms | 11ms | 11ms |
| POST /plays | 12ms | 12ms | 13ms |

读路径本地墙钟低于 10ms。两条写路径略高于 10ms 墙钟。已做的优化：补索引、按语言缓存 `buildWorld`（写入会失效）、试玩计数改为就地更新缓存以免每次重建世界。若上线后生产 CPU 仍贴线，可再考虑：索引接口不装载详情大字段、把首页/索引做成短 TTL 的内存快照、或把试玩计数改成异步累加。本轮不假设走付费套餐。免费额度每天 10 万请求、D1 500 万读 / 10 万写，刚上线通常够用。

## 本地如何启动

```bash
npm install
npm run import:local          # 导入清理过会话的 jiwan.db
npm run dev                   # wrangler dev --local，默认 http://127.0.0.1:8787
npm test                      # 再启临时端口跑 87 项验收，不污染你正在看的库
npm run import:local:seed     # 如需干净基线
```

不需要 Cloudflare 账号。不要混用 `localhost` 与 `127.0.0.1`。

## 合并前风险与未做的事

- 密码仍是演示级哈希；`/auth/reset` 仍存在。正式环境需要更强哈希并收紧重置流程。演示账号默认口令仍是文档里的 `jiwan`，未新增大范围默认口令。
- 本轮没有登录 Cloudflare，也没有部署。`wrangler.toml` 里的 `database_id` 是占位符。
- 工坊包不存储 zip，没有 R2。
- 排行仍是启发式权重，与改写前一致。
- 证据在 Linux 验收机上采集（Node v22.23.2，wrangler 4.162.0）。brief 要求记录 macOS 版本，本机不是 macOS，见 `evidence-cf/env.txt`。
- Node 对照版没有同步加上 Origin / CSRF 校验（仍是本机双端口开发用）。验收以 Workers 为准。
- 作者自测通过，不作为最终验收结论。

## 部署前需要用户提供或决定（不执行）

1. Cloudflare 账号，并由用户本人 `wrangler login`。
2. D1 与 Worker 项目名（默认建议 `jiwan`）。
3. 先用 `*.workers.dev` 还是以后再绑自定义域名（例如候选过的 `jiwan.space`）。
4. 线上初始数据用 `data/sql/jiwan.sql`（含试玩与已过审工坊包）还是 `data/sql/seed.sql`（干净基线）。
5. 是否在部署前更换密码方案（建议正式环境不要继续用演示哈希）。
