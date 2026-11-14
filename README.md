# 即玩

网页游戏发现与社区站点。正式运行目标是 **Cloudflare Workers + D1**：一个 Worker 同源提供静态页面和 API，会话 Cookie 才能在 `SameSite=Lax` 下可靠工作。不要把站点与 API 拆到两个域名。

当前默认分支上的 Node 版（`server/`，本机 `http` + `node:sqlite`）仍可对照运行，但验收与将来部署以 Workers 为准。

密码存储为每用户独立盐的 PBKDF2-SHA256（格式 `pbkdf2$sha256$<iters>$<salt>$<hash>`，当前 10000 次迭代）。旧的演示哈希 `sha256("jiwan:" + pass)` 已无法验证。无验证的 `/auth/reset` 已关闭；已登录用户走 `/me/password`，站务重置走管理接口。新注册密码至少 10 位。初始特权口令不在仓库或文档里，由部署者另行保管并尽快自行修改。

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

## 正式部署

正式域名是 `jiwan.space`（含 `*.jiwan.space`）。Worker 已部署在免费套餐上，预览地址：<https://jiwan.playjiwan.workers.dev>。`wrangler.toml` 已写入线上 D1 `jiwan` 的 `database_id`；阿里云域名服务器已改为 Cloudflare 的 `cruz/mitch.ns.cloudflare.com`，zone 已生效；`jiwan.space/*` 与 `*.jiwan.space/*` 路由已启用（DNS 为代理的 AAAA `100::` 占位记录）。`workers_dev = true` 保留作备用入口。

线上初始数据来自清理过会话的 `data/sql/jiwan.sql`（导出自 `server/data/jiwan.db`）。对 remote D1 执行该文件前，必须去掉 dump 里的 `PRAGMA` / `BEGIN TRANSACTION` / `COMMIT`（远程执行不接受事务语句）；迁移用 `npx wrangler d1 migrations apply jiwan --remote`。环境里若已有不匹配的 `CLOUDFLARE_API_TOKEN`，登录与部署请用 `env -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_API_KEY` 以免盖掉 OAuth 会话。

免费套餐硬限制（以[官方定价](https://developers.cloudflare.com/workers/platform/pricing/)为准）：Workers 每天 10 万次请求、**每次最多 10ms CPU**；D1 每天 500 万行读、10 万行写、总共 5GB、最多 10 个库。超出当天额度会失败，不会自动扣费。查询已加索引；偏重接口的本地耗时见 `REPORT-cf.md` 与 `evidence-cf/`。

## 架构

- `worker/index.js`：入口。API 路径先由 Worker 处理，其余交给静态资源绑定（`public/` 是对根目录 HTML 与 `assets/` 的符号链接；`html_handling` 为 none，以免 `/admin.html` 被改写成 `/admin` 撞上管理 API）。HTML 会注入 `window.JIWAN_API_BASE=''`，前端用相对路径请求。
- `src/api.js` / `src/store.js`：与 `server/` 相同的业务语义，改为异步以适应 D1。
- `migrations/0001_init.sql`：表结构（与 `server/db.js` 对齐）和读路径索引；`0002`/`0003` 见下。
- `assets/jiwan-api.js`：前端封装。同源时空 BASE 即可；写操作带 `X-CSRF-Token`（双提交 Cookie `jiwan_csrf`）。会话 Cookie `jiwan_sid` 为 HttpOnly + SameSite=Lax，HTTPS 下加 Secure。
- 工坊包仍不上传 zip，`playUrl` 只透传。本轮不引入 R2。
- 打开方式（`playMode`，见 `assets/jiwan-catalog.js`）：有 `src` 且 `games.embed=1` → 站内 iframe（load 失败或 12 秒超时叠层「去原页玩 ↗」）；`embed=0` → 不嵌入，只给「去原页玩 ↗」；无 `src` 的工坊示例（`demo=1`）→ 站内示例；其余 → 仅介绍。`migrations/0002` 加列，`migrations/0003` 按 2026-11 可玩性审计回填地址与文案。
- `node scripts/check-src.mjs [--base https://jiwan.space]`：只读巡检每个 `src` 的 XFO / `frame-ancestors`，标出 `embed` 与实际不符的条目（退出码 1）。部分站点对脚本返回 403（如 orteil、neal.fun），需人工确认。

## Node 对照版

见 `server/README.md`。`node server/index.js` 与 `node server/static.js` 仍是双端口开发方式，静态站会把 API BASE 写成 `http://127.0.0.1:8787`。Workers 验收不要走这条路径。
