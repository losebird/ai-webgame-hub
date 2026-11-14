# 2048（即玩自托管副本）

- 作者：Gabriele Cirulli — https://github.com/gabrielecirulli/2048
- 许可：MIT，原文见同目录 `LICENSE.txt`（未改动）
- 来源：上游 `master` 分支 478b6ec346e3787f589e4af751378d06ded4cbbc
- 原因：作者的 gh-pages 版会用脚本跳转到 play2048.co，而 play2048.co 用 `frame-ancestors` 禁止被第三方嵌入，导致即玩里 iframe 白屏。
- 改动：仅把 `index.html` 底部 “This site is the official version…” 一句改为说明这是即玩托管的副本并链接官方 play2048.co；删掉了 `style/*.scss` 源文件（运行时只用 `main.css`）。游戏逻辑、样式、字体未改。
