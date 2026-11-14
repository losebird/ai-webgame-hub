# 即玩

网页游戏发现与社区站点。正式运行目标是 **Cloudflare Workers + D1**：一个 Worker 同源提供静态页面和 API，会话 Cookie 才能在 `SameSite=Lax` 下可靠工作。不要把站点与 API 拆到两个域名。

当前默认分支上的 Node 版（`server/`，本机 `http` + `node:sqlite`）仍可对照运行，但验收与将来部署以 Workers 为准。

演示账号默认密码是文档里已有的 `jiwan`（含站务 `admin` / 审核员 `林澄`）。**密码算法是演示级** `sha256("jiwan:" + pass)`，不是正式环境方案；上线前应换成更强的哈希，并收紧 `/auth/reset`。不要把明文密码写进新文件。

## 本地启动（不需要 Cloudflare 账号）

需要 Node.js ≥ 22.5。

```bash
npm install
npm run import:local          # 把 server/data/jiwan.db 导入本地 D1（已清登录会话）
npm run dev                   # wrangler dev --local ，默认 http://127.0.0.1:8787
```

浏览器打开 <http://127.0.0.1:8787>。不要用 `file://`，也不要混用 `localhost` 与 `127.0.0.1`（会被当成跨站，Cookie 失效）。

从干净演示基线重建：

```bash
npm run import:local:seed     # 导入 server/data/seed.db（潮汐回廊仍为 pending，无试玩增量）
npm run dev
```

`import:local` 会先跑 `migrations/`（幂等），再执行 `data/sql/*.sql`。SQL 快照由 `npm run dump:sql` 从两个 `.db` 重新导出。导入默认写到项目下的 `.wrangler/`（已 gitignore）。指定目录：

```bash
node scripts/import-local-d1.mjs seed --persist-to /tmp/jiwan-seed
npx wrangler dev --local --persist-to /tmp/jiwan-seed
```

跑验收（会再启两个本地 dev 端口，不碰你正在看的那份库）：

```bash
npm test
```

## 将来正式部署（本轮不要执行）

需要你先提供 Cloudflare 账号，并决定：用 `*.workers.dev` 还是以后再绑自己的域名（例如候选过的 `jiwan.space`）；线上初始数据用 `jiwan.db` 还是 `seed.db`。

1. 安装并登录 Wrangler（`wrangler login`，需你本人操作）。
2. 创建 D1：`npx wrangler d1 create jiwan`，把返回的 `database_id` 填进 `wrangler.toml`，替换占位符 `00000000-0000-0000-0000-000000000000`。
3. 执行迁移：`npx wrangler d1 migrations apply jiwan --remote`。
4. 导入数据：`npx wrangler d1 execute jiwan --remote --file=data/sql/jiwan.sql`（或 `data/sql/seed.sql`）。
5. 部署：`npx wrangler deploy`。静态资源和 API 会在同一个 Worker 域名下。
6. 若要绑自定义域名，在 Cloudflare 控制台给这个 Worker 加上路由，并完成 DNS。免费套餐即可，不必上付费产品。

免费套餐硬限制（以[官方定价](https://developers.cloudflare.com/workers/platform/pricing/)为准）：Workers 每天 10 万次请求、**每次最多 10ms CPU**；D1 每天 500 万行读、10 万行写、总共 5GB、最多 10 个库。超出当天额度会失败，不会自动扣费。查询已加索引；偏重接口的本地耗时见 `REPORT-cf.md` 与 `evidence-cf/`。

## 架构

- `worker/index.js`：入口。API 路径先由 Worker 处理，其余交给静态资源绑定（`public/` 是对根目录 HTML 与 `assets/` 的符号链接；`html_handling` 为 none，以免 `/admin.html` 被改写成 `/admin` 撞上管理 API）。HTML 会注入 `window.JIWAN_API_BASE=''`，前端用相对路径请求。
- `src/api.js` / `src/store.js`：与 `server/` 相同的业务语义，改为异步以适应 D1。
- `migrations/0001_init.sql`：表结构（与 `server/db.js` 对齐）和读路径索引。
- `assets/jiwan-api.js`：前端封装。同源时空 BASE 即可；写操作带 `X-CSRF-Token`（双提交 Cookie `jiwan_csrf`）。会话 Cookie `jiwan_sid` 为 HttpOnly + SameSite=Lax，HTTPS 下加 Secure。
- 工坊包仍不上传 zip，`playUrl` 只透传。本轮不引入 R2。

## Node 对照版

见 `server/README.md`。`node server/index.js` 与 `node server/static.js` 仍是双端口开发方式，静态站会把 API BASE 写成 `http://127.0.0.1:8787`。Workers 验收不要走这条路径。
