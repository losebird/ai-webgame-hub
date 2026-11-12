# Ace Shelf 试用切片报告

公开地址：待托管。

仓库：`losebird/ai-webgame-hub`，分支 `cursor/webgame-hub-mvp-aaa5`。本报告随该分支提交。PR 链接和 head SHA 在分支推送后写在 PR 说明里。这次写作时的运行模型是 Grok 4.7。

这次不申请把日历延到 14 天，也不停下等确认。沙箱、上传、游玩计数、点赞和 remix 谱系已经在本机跑通。中英文界面和更完整的视觉排版按委托方 2026-11-12 的范围说明，留到这个垂直切片之后。公开 URL 仍然没有。缺的是境外托管，不是再写一轮功能。这次不能注册云账号，所以没有自行部署。

## 验收

| 项 | 结果 | 证据 |
| --- | --- | --- |
| 不登录即可浏览，并在 iframe 里玩 | 通过 | `evidence/03-game-1440.png`，`evidence/05-playing-1440.png` |
| iframe sandbox 不含 `allow-same-origin`、`allow-popups`、`allow-top-navigation` | 通过 | `evidence/security-record.md` 的 sandbox 行 |
| 游戏响应有严格 CSP，且不 Set-Cookie | 通过 | 同一记录里的 `set-cookie=absent` 和 CSP 行 |
| 游戏内读 cookie、读 `parent.location`、改顶层地址被挡住 | 通过 | 记录中的 probe JSON 与浏览器控制台 |
| 登录后发布单文件 HTML，模型可填 Fable 5.2 | 通过 | `evidence/07-uploaded-html.png` |
| 登录后发布多文件 zip，页面内脚本能跑 | 通过 | `evidence/08-uploaded-zip.png`，记录中 `zip marker=zip-ran` |
| 无 index、路径穿越、超限、符号链接的 zip 被拒绝，不落任意文件 | 通过 | `evidence/14-bad-zip.png`，`evidence/15-traversal.png`，`evidence/unit-tests.txt` |
| Remix 预填公开提示词和 `parent_id`，父页列出子作，子页链回父作 | 通过 | `evidence/10-remix-form.png`，`evidence/11-child.png`，`evidence/12-parent-remixes.png` |
| 游玩数和点赞刷新后还在 | 通过 | `evidence/09-liked.png`，记录中 `likes after reload=1` |
| 举报后可用 `ADMIN_TOKEN` 下架，下架后 404 | 通过 | `test/app.test.ts`。这一步没有单独的浏览器截图 |
| 两款原创示例，一款单文件，一款 zip | 通过 | `sample-games/dodge/`，`sample-games/zip-bird/` |
| 外链只作卡片。`homepage` 16 条上首页，`alternates` 6 条不在首页 | 通过 | `evidence/01-home-1440.png`，`src/links/validate.test.ts` |
| 有许可声明的条目也不复制代码、不放进 iframe | 通过 | 首页 HTML 无 iframe。许可只显示成文字 |
| 不抓取、不热链作者封面 | 通过 | 封面路由 `/cover/game/:id.svg` 与 `/cover/link/:id.svg` |
| 站外互动数不计入 §5.4 | 通过 | 指标字段 `external_engagement_counted_in_plays` 为 false |
| 导入前拒绝缺字段和非 https，并列出，不补编 | 通过 | `evidence/unit-tests.txt` 中 import 命令那一条 |
| 占位例子不与种子混在同一文件 | 通过 | `fixtures/external-links.placeholder.json` 与 `data/seed/seed-games.json` 分开。启动只读种子 |
| 站点在境外有公开 URL | 待托管 | 未部署 |
| 无广告、无支付、无统计信标 | 通过 | 仓库中没有这些脚本。这不是一次外部审计 |
| 中英界面、词典键一致、两种语言的截图 | 未做 | 委托方允许在垂直切片之后补 |
| 首页和详情在 1440 与 390 的截图 | 通过（当前英文界面） | `evidence/01-home-1440.png`，`evidence/02-home-390.png`，`evidence/03-game-1440.png`，`evidence/04-game-390.png` |
| 对照参考画廊做完视觉打磨 | 未做 | 已有顶栏、精选条、标签、卡片和详情。配色和文案是 Ace Shelf 自己的 |

`evidence/security-record.md.sha` 和 `evidence/unit-tests.txt.sha` 分别是这两个记录文件自己的 sha256。

## §5.4 快照

下面是空库启动之后、没有任何访客时的 `/admin/metrics`。示例作者 `shelf` 算 1 名作者。两款示例都带公开提示词。外链卡片不计入作者、可玩游戏或播放。

```json
{"authors":1,"playable_games":2,"public_prompts":2,"non_author_plays":0,"remixes":0,"homepage_links":16,"hidden_links":6,"external_engagement_counted_in_plays":false}
```

| 问题 | 继续阈值 | 这次的数 | 是否碰到 |
| --- | --- | --- | --- |
| 作者愿不愿发 | 至少 8 名独立作者，至少 15 款可玩，其中至少 5 款有公开提示词 | 作者 1，可玩 2，公开提示词 2 | 否 |
| 路人愿不愿玩 | 至少 5 款各有 20 次非作者播放，或全站非作者播放至少 200 | 非作者播放 0 | 否 |
| 有没有人 remix | 至少 3 次真实 remix，或至少 2 条被第三方玩过的父子谱系 | remix 0 | 否 |

浏览器证据里的注册、上传、点赞和 remix 发生在临时库，玩家是测试脚本，不是公开流量。那些次数不能拿来填这张表。假设没有被验证。

## 安全记录

浏览器是本机 Google Chrome，经 Playwright 打开临时服务器。原始输出在 `evidence/security-record.md`。

- sandbox 实际值是 `allow-scripts allow-pointer-lock`。
- 探针页读 `document.cookie`、读 `parent.location`、写入 `parent.location`，三处都是 `throw:SecurityError`。
- 点击 `target="_top"` 之后，父页面地址没有变。控制台写明缺少 `allow-top-navigation`。
- 游戏响应 200，没有 `set-cookie`。CSP 为 `default-src 'none'`，脚本只允许 `unsafe-inline`，`connect-src 'none'`，`frame-src 'none'`，`frame-ancestors 'self'`。
- 无 `index.html` 的 zip，以及含 `../` 的 zip，都停在上传页并说明什么都没保存。
- 符号链接、声明体积过大的压缩包、文件数过多，由 `npm test` 覆盖，输出在 `evidence/unit-tests.txt`。

游戏 CSP 允许 `unsafe-inline`，因为沙箱不能带 `allow-same-origin`，相对路径的脚本必须先内联。没有 `unsafe-eval`。

## 已知缺陷

- 没有公开 URL。进程默认只绑定 127.0.0.1。
- 界面只有英文。没有词典，也没有语言切换。
- 详情页的游玩区很高，示例游戏的画布不铺满这块区域。
- 没有截图上传。封面是生成的色块。
- 作者自己玩自己的游戏时，页面上的播放数仍会加。`non_author_plays` 不计这一笔。
- 同一 IP 哈希 30 分钟内对同一款游戏只记一次播放。可见计数在第一次之后不再加，直到窗口过去。
- 示例用户 `shelf` 不能登录。
- `node:sqlite` 在 Node 22 仍标为实验特性。
- 站外互动若是字符串，会整段显示并标明不是本站游玩数。种子里的 impressions 不显示。
- 下架只改状态。磁盘上的文件还在，但路由不再读它。

## 下一步

继续，方向不变。先把这个 Node 进程放到中国大陆以外、你已经拥有的主机上，或单另做 Workers 移植。移植完成之前不要宣称免费额度已经够用。部署之后再补中英文和视觉，不要在没有公开游玩之前加发现、推荐或支付。若两周公开流量仍接近这张表里的 0，应停下来改获取方式，而不是加功能。

## 托管

已验证命令：

```bash
npm install
npm test
npm start
```

监听 `http://127.0.0.1:8787`。数据在 `DATA_DIR`（默认 `data/`）的 `hub.sqlite` 和 `blobs/`。

你已有境外机器时：

```bash
HOST=0.0.0.0 PORT=8787 DATA_DIR=/var/lib/ace-shelf ADMIN_TOKEN=你的令牌 npm start
```

前面还要有你自己的 TLS 反代。不要把 `ADMIN_TOKEN` 提交进 git。不需要模型 API 密钥。

Cloudflare Workers、D1 和 R2 是以后的免费托管形状，不是现在的运行方式。2026-11-12 查阅的免费额度是 Workers 每天 10 万请求、每次 10 毫秒 CPU，D1 每天 500 万行读和 10 万行写、合计 5 GB，R2 每月 10 GB-月。一次打开游戏页还会请求封面和播放接口，所以请求数大于游玩数。此代码不能 `wrangler deploy`。
