# 即玩：Cloudflare Workers + D1 改写报告

- 分支：`cf/workers-d1`（从 `main@1e21550cc33deefa329ad3dbd5ce3486e91aac7b` 拉出）
- draft PR：https://github.com/losebird/ai-webgame-hub/pull/3
- head SHA：见本 PR 最新提交
- base：`main`（`1e21550`）
- 所用模型：Grok Bot（Ace 派出的工程执行者，在 box 上直接改写；未使用 Cursor cloud agent，也未交给本机 Grok Build）

以下是**作者自测**记录。用户本轮明确不用验证官；作者自测**不能当作最终 verdict**。

## 本轮（2026-11-14，Asia/Shanghai）按用户决定补上的事项

1. 换掉演示级密码方案和公开口令。
2. 正式域名按 `jiwan.space` / `*.jiwan.space` 写入配置与文档。
3. 线上初始数据定为清理过会话的 `jiwan.db`（`data/sql/jiwan.sql`）。
4. 不合并、不把 draft 改成 ready，不登录或部署 Cloudflare，不购买域名。

## 密码方案

- 格式：`pbkdf2$sha256$<iters>$<salt_hex>$<dk_hex>`。每用户独立 16 字节盐，派生 32 字节，算法 PBKDF2-SHA256（Workers 用 Web Crypto，Node 对照版用 `crypto.pbkdf2Sync`，同一盐与迭代下输出一致）。
- 迭代次数：**10000**。本机 Web Crypto 约 1.5ms，Node `pbkdf2Sync` 约 1.2ms。比旧的 `sha256("jiwan:" + pass)` 明显更强（独立盐 + 多次迭代），同时尽量不把登录 CPU 顶破免费套餐每次约 10ms 的预算。OWASP 现行建议远高于此，这是免费套餐下的取舍，已在此说明。
- 没有仓库内 pepper，也没有把验证绑死在 wrangler secret 上，因此已提交的 SQL 在线上可直接验证。
- 旧哈希一律视为无效：登录时不升级旧哈希。比较使用常量时间。畸形或超迭代上限的存储值会先做一次哑运算再拒绝，避免按格式提前返回。
- 新注册、改密、站务重置的最短密码长度为 **10**。
- `/auth/reset` 不再接受无验证重置，固定返回 `403 forbidden / reset_disabled`。已登录用户改自己的密码走已有的 `POST /me/password`；站务重置走 `POST /admin/users/:id/password`。`reset.html` 改为说明文案，不再提供「只要用户名就能重设」的表单。

### 口令轮换（明文不在仓库）

- 特权账号（`admin` / 站务，`lincheng` / 林澄）生成高熵随机初始口令，写入新哈希。
- 其余 39 个种子/调试用户（含何予等作者）写入不可用的随机哈希，旧口令无法登录；帖子、评价等作者身份保留。
- 明文只写在仓库外：`/workspace/jiwan-initial-passwords.txt`（权限 600）。这是上线初始口令，请用户保管并尽快自行修改。仓库 `.gitignore` 已加入 `.secrets/` 与 `jiwan-initial-passwords.txt`。
- 测试不依赖生产口令：`npm test` 在导入之后、跑用例前，把测试库里的账号改写成测试专用口令的新哈希。测试口令只留在测试代码里，不是文档中的公开默认口令。另有用例：在未注入的生产库上 `verifyPass('jiwan')` 失败，以及注入后用旧口令 `jiwan` 登录 admin / 林澄必须失败。

## 域名配置

- `wrangler.toml` 项目名仍为 `jiwan`，`workers_dev = true` 先保留作域名尚未生效时的退路。
- `jiwan.space/*` 与 `*.jiwan.space/*` 的完整路由以注释形式写好，并注明 `zone_name = "jiwan.space"`。域名尚未购买，启用活路由块会在未绑定 zone 时让 `wrangler deploy` 失败，故保持注释。
- 允许的 Origin：请求自身的 site origin（覆盖本地 `http://127.0.0.1:8787` 与将来的 `*.workers.dev`），以及正式站点 `https://jiwan.space`、`https://www.jiwan.space`、`https://*.jiwan.space`。伪造 Origin（含 `jiwan.space.evil.example` 这类后缀）仍拒绝。本轮未给 Cookie 加 `Domain=.jiwan.space`（跨子域共享会话留待域名生效后再定）。

## 线上库选择

线上导入使用 `data/sql/jiwan.sql`（由已清会话的 `server/data/jiwan.db` 导出）：保留试玩增量与已过审工坊包。`data/sql/seed.sql` 仍可作为干净基线本地重建，但不是本轮线上初始数据。

## 作者自测结果

`npm test`（Workers）**95 项全部通过**：smoke 57、client 12、security (seed) 8、data (jiwan) 11、journey 7。完整输出：`evidence-cf/unit-tests.txt`。主路径见 `evidence-cf/main-path.txt`。

对照版 `npm run test:node` 亦通过（smoke 57、client 11），验收仍以 Workers 为准。

环境：`evidence-cf/env.txt`（Node v22.23.2，wrangler 4.162.0，Linux 验收机）。采集时间约 2026-11-14 15:37（Asia/Shanghai）。

### 登录等接口本地墙钟

证据：`evidence-cf/timings.json`。测的是本地 `X-Jiwan-Elapsed-Ms`（墙钟，含本地 D1 I/O 与 isolate 开销），**不是**生产环境只计 CPU 的 10ms。

| 接口 | min | median | max |
|---|---:|---:|---:|
| GET /games/index | 7ms | 7ms | 8ms |
| GET /rankings | 6ms | 6ms | 9ms |
| POST /auth/login | 10ms | 10ms | 11ms |
| POST /plays | 9ms | 10ms | 12ms |

与改哈希前相比，登录墙钟仍在约 10–12ms 这一档（此前中位约 11ms）。10k 次 PBKDF2 本身约 1.5ms，其余仍是本地 I/O。不能据此断言生产 CPU 一定低于 10ms。

## 先前 Workers 改写的架构（仍适用）

- 一个 Worker（`worker/index.js`）同源提供静态页和 API。`[assets]` 指向 `public/`，`run_worker_first = true`，`html_handling = none`。
- HTML 注入 `window.JIWAN_API_BASE=window.JIWAN_API_BASE||''`。
- D1 经 `src/d1.js` 适配；业务在 `src/api.js` / `src/store.js`。Node 对照版保留，并已同步哈希与重置逻辑，以免导入新库后对照版登不进去。
- 迁移与导入方式未变：`migrations/0001_init.sql`，`scripts/dump-sql.mjs` / `import-local-d1.mjs`。
- 工坊 zip 仍不上传，`playUrl` 只透传。未引入 R2。

## 合并前风险与未做的事

- 域名尚未购买，Cloudflare 账号未登录，`database_id` 仍是占位符。本轮未执行 `wrangler login` / `wrangler deploy`，也未对 remote D1 执行任何命令。
- 10000 次 PBKDF2 是免费套餐下的取舍，弱于常见离线加固建议。若以后升级套餐或确认生产 CPU 有余量，可再提高迭代次数（需同时重哈希已有口令）。
- 没有邮件验证的忘记密码流程。用户忘记口令需站务重置。
- 特权初始口令在仓库外的文件里，需要用户保管并尽快修改；其余种子用户目前无法登录，若要用需站务重置。
- 跨子域 Cookie 尚未配置。
- 工坊包不存储 zip，没有 R2。
- 排行仍是启发式权重。
- 证据在 Linux 验收机上采集，见 `evidence-cf/env.txt`。
- 作者自测通过，不作为最终验收结论。

## 部署前还需要用户本人完成（本轮不执行）

1. 购买 `jiwan.space` 并接入 Cloudflare。
2. 由用户本人 `wrangler login`。
3. `npx wrangler d1 create jiwan`，把真实 `database_id` 填进 `wrangler.toml`。
4. 远程 apply migrations，并导入 `data/sql/jiwan.sql`。
5. 取消注释路由后 `wrangler deploy`，完成 DNS（含通配）。
6. 用仓库外的初始口令登录特权账号，并尽快自行修改。
