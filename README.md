# Ace Shelf

Ace Shelf（艾斯架）是一个免费的网页游戏架。作者上传一个 HTML 文件，或一个带 `index.html` 的 zip，并填写模型和提示词。访客不登录就能在沙箱里玩。点赞和上传需要一个本站账号。站点不生成游戏，不放广告，不收款。

界面语言目前是英文。中英切换还没做。

## 在本机跑起来

需要 Node.js 22。这次验证用的是 Node 22.23。

```bash
npm install
npm test
npm start
```

`npm start` 默认只听 `127.0.0.1:8787`。终端应出现：

```text
Ace Shelf listening on http://127.0.0.1:8787
```

打开该地址。首页应有两款示例游戏（Lantern Dodge、Paper Bird）和 16 张外链卡片。空的数据库会自动做这件事。示例作者的用户名是 `shelf`，密码是随机的，不能用来登录。要上传或点赞，自己在页面上注册。

`ADMIN_TOKEN` 为空时，`/admin` 和 `/admin/metrics` 返回 503。要看举报队列，先设令牌再启动：

```bash
ADMIN_TOKEN=replace-me npm start
```

打开 `/admin`，填入同一个令牌。下架把游戏标成 removed，页面不再提供文件。指标在 `/admin/metrics`，请求头是 `x-admin-token`。

可选环境变量见 `.env.example`。不要把真的 `ADMIN_TOKEN` 写进仓库。

## 从 Claude 里导出再上传

上传的是文件，不是别人的在线地址。站点不会去抓 artifact 页面，也不会把外链游戏放进 iframe。

从 Claude 网页里的 Artifact 导出：

1. 打开那次对话，展开作品面板。
2. 如果面板能下载 HTML，保存成一个 `.html` 文件。
3. 如果作品是多个文件，把它们打成 zip。`index.html` 放在 zip 根目录，或者放在唯一的一层顶层文件夹里。
4. 在 Ace Shelf 注册，打开 Upload，填写标题、一句话简介、模型名（可以填 `Fable 5.2`）和提示词。公开提示词默认勾选。
5. 选中文件，点 Publish。成功后进入这款游戏自己的地址。

从 Claude Code 导出：

1. 让它把游戏写成单个 HTML，或一个含 `index.html` 的目录。脚本和样式用相对路径。
2. 下载那个 HTML，或把目录打成 zip。不要把 `node_modules`、密钥或绝对路径打进去。
3. 用上面的 Upload 表单发布。

游戏页会把本地的脚本、样式和图片内联进 HTML，再放进 iframe。iframe 的 sandbox 只有 `allow-scripts` 和 `allow-pointer-lock`。游戏自己的 CSP 不允许连网，也不允许再套 iframe。指向外站的脚本不会执行。

zip 上限是压缩后 32 MB、解压后 64 MB、200 个文件。路径穿越、绝对路径、符号链接、加密包和解压比过高的包会被拒绝，页面上有一句可读的原因，磁盘上不会留下这个包。

## 导入外链卡片

外链卡片和上传的游戏是两张表。卡片只链到作者原来的帖子和游玩地址，不复制代码，不嵌页面，不用作者的封面图。封面是本站按标题生成的色块。

启动时空库会导入 `data/seed/seed-games.json`。`homepage` 的 16 条出现在首页。`alternates` 的 6 条写入数据库，但 `placement` 是 `alternate`，首页不显示。

再次导入是按 `post_url` 更新，不会重复插行：

```bash
npm run import:links -- data/seed/seed-games.json
```

成功时标准输出类似：

```text
imported 22 (homepage 16, hidden 6)
```

缺字段、空字段，或 `post_url` / `play_url` 不是 https 的条目不会被补写。它们打印到标准错误，进程以 1 退出，这一行不会入库。例如：

```text
rejected homepage[1] Broken: not https: post_url
```

`fixtures/external-links.placeholder.json` 是占位例子，地址是 example.com，用户名是虚构的。启动时不会读它。不要把它和种子导入到同一个库，否则那两张例子卡片会和真实卡片出现在同一首页。

卡片上的赞数是外部平台在 2026-11-13 03:00 CST 的互动，文案写明「不是本站游玩数」。它不计入 `/admin/metrics` 的播放数。`external_engagement_counted_in_plays` 固定为 false。

## 浏览器证据

本机有 Google Chrome 时，可以重跑整条路径和安全探针。脚本会另起一个临时数据库，不改你的 `data/`。

```bash
npx tsx scripts/evidence.ts
```

截图和 `evidence/security-record.md` 会写进 `evidence/`。同目录的 `.sha` 文件是该记录文件本身的 sha256。

## 公开部署

这次没有公开地址。状态是待托管。

已验证的运行方式是本机 Node 进程、一个 sqlite 文件和 `data/blobs` 里的游戏文件。代码使用 `node:sqlite` 和本地磁盘，不能直接放到 Cloudflare Workers 上。不要对这个目录执行 `wrangler deploy`。

若你已经有一台中国大陆以外的机器，并且能把流量反代到 Node：

```bash
npm install
HOST=0.0.0.0 PORT=8787 DATA_DIR=/var/lib/ace-shelf ADMIN_TOKEN=你的令牌 npm start
```

`DATA_DIR` 必须落在持久磁盘上。不设 `HOST` 时进程只听 127.0.0.1，机器外面访问不到。还需要你自己的 TLS 反代。这次没有创建任何云账号，也没有写入模型 API 密钥。

如果以后改成 Workers，2026-11-12 的 Cloudflare 文档写着这些免费额度。Workers 每天 10 万次请求，每次 10 毫秒 CPU。D1 每天 500 万行读、10 万行写，存储合计 5 GB。R2 每月 10 GB-月，Class A 100 万次，Class B 1000 万次，出站流量不收费。一次游戏页还会请求封面、样式和播放计数，所以 10 万次请求不等于 10 万次游玩。这个额度够一次小范围试用，不能当成已经验证的流量结果。移植还不存在，所以上面的命令不能在 Workers 上执行。
