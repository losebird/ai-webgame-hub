# 2048 灰帧根因与 58 款嵌入复查

复查时间：2026-11-14 17:22–17:40（Asia/Shanghai）

## 根因

`https://gabrielecirulli.github.io/2048/` HTTP 返回 200，并非 301/302。
页面脚本检查主机名后执行 `window.location.replace("https://play2048.co/")`。
`play2048.co` 返回：

```
Content-Security-Policy: frame-ancestors 'self' https://next.play2048.co https://play2048.co https://play2048-co.translate.goog;
```

不允许 jiwan.space 当祖先，所以 Chrome iframe 导航到 `chrome-error://chromewebdata/`，显示 “play2048.co refused to connect”。
不是 src 拼错，也不是 box 到 github.io 不通。只查 HTTP 重定向/初始页头会漏掉这个脚本跳转。

## 修复

- `2048` 的 src → `/vendor/2048/`，embed 保持 1。自托管作者 MIT 开源 `master` 原版，保留 LICENSE.txt、作者及灵感来源署名，NOTICE.md 记录上游 commit 和唯一 HTML 文案修改。游戏逻辑与样式未改。
- `cookie-clicker` 的 embed → 0，src 不变。HTTP 工具偶尔拿到 200，但真实 Chrome iframe 拿到 403 Cloudflare 验证页，其 `X-Frame-Options: SAMEORIGIN` 拦截嵌入。改「去原页玩 ↗」，避免用户卡在人机验证灰帧。
- 相对 src 的 host 显示按当前站点解析；自托管页明确标注「即玩自托管」。同源 iframe 能读到实际文档内容时不再弹白屏提示。
- `check-src.mjs` 增加字面量跨域 JS/meta 跳转检查，忽略 HTML 注释里的废弃跳转，并认识站内相对路径。它仍是静态辅助检查，不是浏览器/完整 JS 引擎。

## 扫描范围与结果

取线上 `/games/index` 的 58 个 `src && embed=1`：对每项跟随 HTTP 重定向检查响应头及 HTML 跳转提示，再用 Chrome 在 jiwan.space 祖先页 iframe 内观察导航链与文档。包括 12 个 github.io 地址。

- 唯一 github.io 拦嵌同类：2048。
- ironvale：meta refresh → 同域 `/ironvale/ironvale.html`，实际文档正常，未改。
- breach：脚本 → 同域 `/?play=fps`，实际文档正常，未改。
- watermelon：wesane → `https://g.regogame.com/game/210`，浏览器能进入资源加载页，未遇 frame-ancestors/XFO 拦截，未改；本次没有完成整局试玩。HTML 中注释掉的微信公众号跳转不能当作实际导航。
- 其余 github.io 没发现跨域重定向拦嵌。becario 的 DOM 节点少是 canvas 游戏，截图有完整开始界面，不是空页。
- cookie-clicker：额外发现真实浏览器验证页拦嵌，按上文降级。

这不是全部游戏的完整试玩或资源可用性保证。fable52 的 8 个 sandbox 保持原样。

## 验证

- 本地 wrangler：2048 iframe 显示真实棋盘；键盘移动后由 2 个方块变成 6 个，分数 16；无失败层/白屏提示，无 pageerror。
- 部署后真实 Chrome 打开 `https://jiwan.space/play.html?id=2048`：iframe 地址 `https://jiwan.space/vendor/2048/`，按方向键后方块变化、分数 16；无失败层/提示，无 pageerror。
- cookie-clicker 详情 CTA 是新窗口「去原页玩 ↗」，游戏页不再创建 iframe。
- LICENSE.txt、游戏 js 和游戏 HTML 线上 HTTP 200。
- `npm test` ALL PASS 57/12/8/11/7；`npm run test:node` ALL PASS。
- remote SELECT 回读 73 条游戏的 src/embed/demo/about/about_en，对比本地库 0 差异；用户 41、reviews 86。API 含工坊包后 75 项：embed 57 / link 10 / sample 3 / info 5。
- `check-src` 还会提示 cookie-clicker 和 password-game 的 403（两者都已是 link），这是需人工看而非错误地判成可嵌。

备份：`/workspace/jiwan-d1-backup-20261114-2048-before.sql`（600），在远程 UPDATE 前导出。
