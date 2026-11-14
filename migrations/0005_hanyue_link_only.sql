-- breach（cf.hanyue.io）/ hextech-aram（lol.hanyue.io）：取昵称时用 document.cookie 写
-- `hanyue-game-nickname-v1=…; SameSite=Lax; Secure; Domain=.hanyue.io`，写完读回，读不到就报
-- 「请允许本站保存 Cookie，才能同步 CF 与 LOL 昵称」并 return，进不了大厅。
-- 嵌在 jiwan.space 里是跨站 iframe，SameSite=Lax 的 Cookie 在第三方上下文一律写不进去（与浏览器
-- 是否放行第三方 Cookie 无关）；对方也没调用 Storage Access API，我们加 iframe 属性无效 → 改去原页玩。
UPDATE games SET embed = 0,
  about = 'hanyue.io 托管的穿越火线网页联机局，原页是 BREACH 大厅。原作要在 hanyue.io 自己的页面里保存昵称 Cookie，嵌在即玩里进不了大厅，点「去原页玩 ↗」在新窗口打开。',
  about_en = 'A CrossFire web lobby hosted at cf.hanyue.io (BREACH). It needs to save a nickname cookie on its own page, so it cannot get past the lobby when embedded here. Use “Play on original ↗” to open it in a new tab.'
  WHERE id = 'breach';
UPDATE games SET embed = 0,
  about = '英雄联盟海克斯大乱斗网页局，原页托管在 lol.hanyue.io。原作要在 hanyue.io 自己的页面里保存昵称 Cookie，嵌在即玩里进不了游戏，点「去原页玩 ↗」在新窗口打开。',
  about_en = 'A Hextech ARAM web brawl hosted at lol.hanyue.io. It needs to save a nickname cookie on its own page, so it cannot start when embedded here. Use “Play on original ↗” to open it in a new tab.'
  WHERE id = 'hextech-aram';
