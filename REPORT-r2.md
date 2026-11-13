# WebGame 第二轮报告

分支：`r2/i18n-layout-workers`  
draft PR：https://github.com/losebird/ai-webgame-hub/pull/2  
base：`cursor/webgame-hub-mvp-aaa5`（PR #1，不往该分支推）  
head SHA：`07a7e1903d133d8f7683de47e4a8ff1cac843131`（本报告提交后会再有一个 docs commit）  
所用模型：Grok 4.6（委托要求 grok-4.7，本会话不可用）

本轮不部署、不 `wrangler login`、不标 ready、不合 main。

## 验收

| 项 | 结果 | 证据 |
| --- | --- | --- |
| `npm test` 全绿，原有行为保留并补 D1–D6 / i18n / 外链 | PASS | `evidence-r2/unit-tests.txt`（31 pass, 0 fail） |
| 主站 `/run` 404；游戏 CSP 含 sandbox、不含 allow-same-origin；游戏 origin 无 Set-Cookie、无 `/api` | PASS | `test/security.test.ts` D1；`evidence-r2/security-record.md` |
| 伪造 IP 头刷不动游玩数；作者本人游玩不计入可见游玩数 | PASS | `test/security.test.ts` D2 |
| 私有提示词父作 remix 返回 bad_parent | PASS | `test/security.test.ts` D3 |
| 下架后 R2 对象删除 | PASS | `test/security.test.ts` D4。做法是直接删除 `games/<id>/` 与 `shots/<id>/`，不是隔离前缀 |
| 改名成 .html 的 zip 被拒，错误码 `not_html` | PASS | `src/publish/gate.test.ts`、`test/security.test.ts` D5 |
| 页面 HTML 无 ADMIN_TOKEN；Origin/CSRF 不对返回 403；常量时间比较 | PASS | `test/security.test.ts` D6；`src/crypto-util.ts` `compareSecrets` |
| 中英词典 key 对齐 | PASS | `src/i18n/keys.test.ts` |
| 外链卡片规则 | PASS | `src/links/validate.test.ts`、`test/app.test.ts`、`test/security.test.ts` |
| wrangler 双 origin evidence：浏览、游玩、注册、HTML/ZIP、点赞、remix、举报路径、恶意 zip | PASS | `evidence-r2/security-record.md`、截图 01–15 |
| D1 探针：iframe 一次，顶层一次 | PASS（见 D1 说明） | iframe：cookie/parent 为 SecurityError，顶层导航被挡。顶层直接打开：cookie 抛 SecurityError，弹窗为 null，跳到 example.com 未完成。`location.origin` 在 Chromium 顶层仍显示游戏 URL，见下 |
| 游戏 origin fetch 主站 `/api` 被挡 | PASS | Origin=游戏 origin 时 403 |
| 中英 1440/390 首页和详情，语言切换对比 | PASS | `evidence-r2/01-04`、`16-21` |
| 无 TapTap 商标或品牌色；站名为 WebGame；改配置会变 | PASS | 配色是深底+琥珀，不是 TapTap 绿。`22-sitename-arcadebay.png` 标题为 `Games · ArcadeBay` |
| 无 Cloudflare 账号可在 Mac 本地跑 | PASS | README 两个端口命令；本次 evidence 用 wrangler 4.160.1 miniflare |

作者自测不是最终 verdict。

## D1–D6

### D1 高危：游戏与主站同源、无 CSP sandbox
根因：上一轮 `/run` 挂在主站 origin，CSP 没有 `sandbox`，直接打开游戏页可以读非 HttpOnly cookie、`window.open` 主站、改 `top.location`。
修法：主站所有 `/run` 返回 404。独立游戏 Worker 只服务 `/run/<id>/`，CSP 为 `default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; frame-ancestors <SITE_ORIGIN>; sandbox allow-scripts allow-pointer-lock`。详情页 iframe `src` 指向 `GAME_ORIGIN`，iframe 仍是 `sandbox="allow-scripts allow-pointer-lock"`。游戏 origin 不 Set-Cookie，不提供 `/api`。
测试：`test/security.test.ts` D1、`test/app.test.ts`。
探针：iframe 内 cookie/parent 读写均为 `SecurityError`；`allow-top-navigation` 缺失，父页 URL 不变。顶层打开游戏 URL 时 `document.cookie` 抛 `SecurityError`，`window.open` 返回 `null`，把 `top.location` 指到 example.com 后地址仍留在游戏 origin。Chromium 对顶层文档的 CSP sandbox 仍把 `location.origin` 显示成游戏 URL 字符串，而不是 `"null"`；隔离靠 cookie 拒绝和 iframe sandbox。记录在 `evidence-r2/d1-direct.json`。

### D2 中：信任客户端 IP 头
根因：服务端读 `X-Ace-IP`。
修法：只认 `CF-Connecting-IP`。本地 wrangler 不注入该头时用固定值 `127.0.0.1`，代码有注释。去重仍是同一 IP 哈希 + 同一游戏 + 时间窗。作者登录后玩自己的游戏不增加 `games.plays`。
测试：伪造 `X-Ace-IP` / `X-Forwarded-For` 不计第二次；换 `CF-Connecting-IP` 才计；作者自己玩 `counted=false` 且 plays 仍为 0。

### D3 低：remix 父作提示词未校验公开
根因：只检查父作已发布。
修法：`parent_id` 必须对应已发布且 `prompt_public=1` 的游戏，否则 `bad_parent`。

### D4 低：下架留文件
根因：只改 D1 状态。
修法：**直接删除** R2 前缀 `games/<id>/` 和 `shots/<id>/`，不是隔离前缀。下架后 `/g`、游戏 origin `/run`、封面都 404。

### D5 低：.html 上传不嗅探
根因：按扩展名当 HTML。
修法：魔数 `PK\x03\x04` 或明显二进制 → `not_html`。

### D6：ADMIN_TOKEN 进页面、比较非恒定时间、无 CSRF
根因：管理表单 hidden token；字符串 `!==`；POST 无 Origin/CSRF。
修法：管理登录后发 `aid` HttpOnly + SameSite=Strict 会话 cookie。页面不再出现 token。指标用 `Authorization: Bearer`。`compareSecrets` 按字节 xor。所有改状态的 POST 要求 Origin 等于主站 origin，并校验 CSRF（cookie + 表单字段或 `x-csrf-token`）。会话 `sid` 为 HttpOnly + SameSite=Lax。本地 http 不加 Secure；https 时加。

## 移植

- `wrangler.hub.toml` / `wrangler.game.toml`：D1 `database_id = 00000000-0000-0000-0000-000000000001`，R2 `bucket_name = webgame-games`，都是占位符。
- 启动见 README。`--persist-to` 必须相同。inspector 端口必须不同（9230 / 9231），否则第二个 wrangler 会报 Address already in use。
- 本地持久化：`.wrangler/state`（开发）或 evidence 用的 `.wrangler/state-evidence`。
- 单元测试用 `node:sqlite` + 内存 R2 适配器，不经过 wrangler。验收浏览路径以 wrangler 为准。
- 解压：闸门仍是压缩 32MB、声明解压 64MB、200 文件、压缩比 100。Workers 上 `fflate.inflateSync` 是同步的；免费档 CPU 10ms 可能撑不住接近上限的包。本次样本 zip（纸鸟，数 KB）在本地 wrangler 正常。没有用接近 64MB 的包去打满 CPU。若线上解压打满 CPU，备选：1) 把解压上限降到 8–16MB；2) 上传时在闸门只根据 central directory 的声明大小拒绝，实际 inflate 改成分片并设墙钟；3) 用独立的非 Worker 清洗队列（超出本轮范围）。
- 密码哈希改为 PBKDF2-SHA256，10000 次迭代，Workers 上没有 scrypt。

## i18n

- URL：`/en/…` 与 `/zh/…`。`/` 按 cookie 再按 Accept-Language 302 到带前缀的首页。
- 记住语言：主站 cookie `lang=en|zh`，SameSite=Lax。游戏 origin 不写 cookie。
- 文案全部走词典。游戏标题/简介有 `title_en` / `title_zh` / `summary_en` / `summary_zh`，缺则回退 `en` → `zh` → 原文。数字用 `Intl.NumberFormat`。
- 外链卡片正文保持源语言（那是作者站点的标题和摘要，不是本站 UI）。

## 布局与站名

- 首页：顶栏、精选横滑、分类 tab、卡片网格，真实 plays/likes。移动端单列。
- 详情：大封面、游玩 iframe 高度改为 `min(56vw, 420px)`（上一轮 70vh 过高），截图区、说明、Remix 链。作者可上传 PNG/JPEG/WebP，≤2MB、边长 ≤4096。
- 品牌色：深底 `#0e1116` + 琥珀 `#ffb703`。没有 TapTap logo、绿、文案。
- `SITE_NAME` 进 title、header、OG、页脚。仓库里不再写死 Ace Shelf。

## 合并前风险

- 顶层直接打开游戏页时 Chromium 的 `location.origin` 不是 `"null"` 字符串。iframe 隔离是主路径。若验证官把顶层 `origin==="null"` 当作硬条件，需要再议是否改用独立的完全不透明 origin（例如专门的 `null` iframe 文档或额外的 origin 试验）。
- 同一 `--persist-to` 下两个 wrangler 必须错开 inspector 端口。
- D1 `exec()` 对多行 SQL 会截断；schema 用逐条 `prepare().run()`。wrangler 的 migrations 目录仍保留，部署时用 `wrangler d1 migrations apply`。
- 管理 token 在 wrangler 模板里是 `dev-admin`，只供本地。
- Node 版 HTTP 监听已去掉，`src/main.ts` 只打印 wrangler 命令。

## 还没做 / 限制

- 没有真实 Cloudflare 部署。
- 没有对 64MB 解压包做 Workers CPU 压测（见上，避免打满本地 CPU 空转）。
- 截图上传只在详情页给作者，没有独立管理 UI。
- 旧 `evidence/` 与 `REPORT.md` 属于 PR #1，未删。

## 部署前需要你提供或决定（不执行）

- Cloudflare 账号
- 两个主机名（主站 + 游戏，例如 `webgame.example` 与 `play.webgame.example`）
- 创建 D1、填入真实 `database_id`
- 创建 R2 bucket、填入真实绑定
- 生产 `ADMIN_TOKEN`、`IP_SALT`、`SITE_NAME`
- 是否把 cookie 加上 `Secure`（https 下代码会自动加）

## 提交

代码与证据分提交。本报告随分支推送。
