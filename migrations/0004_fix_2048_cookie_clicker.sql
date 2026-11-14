-- 2048：作者 gh-pages 版会用脚本跳到 play2048.co，后者 frame-ancestors 只放自家域名 → 即玩里白屏。
--       改用即玩自托管的 MIT 开源原版（public/vendor/2048/，含 LICENSE 与署名）。
-- cookie-clicker：orteil.dashnet.org 对部分浏览器先给 Cloudflare 人机验证页（X-Frame-Options: SAMEORIGIN），
--       嵌在 iframe 里过不了验证 → 改为「去原页玩 ↗」。
UPDATE games SET src = '/vendor/2048/', embed = 1,
  about = '在 4×4 格子里把数字合成 2048。这是 Gabriele Cirulli 开源（MIT）的原版，由即玩自托管，直接在这里玩；官方版在 play2048.co。',
  about_en = 'Slide tiles on a 4×4 grid until you make 2048. This is Gabriele Cirulli''s open-source (MIT) original, self-hosted by Jiwan so it plays right here; the official site is play2048.co.'
  WHERE id = '2048';
UPDATE games SET embed = 0,
  about = '从一块饼干开始，点出烤箱、工厂和宇宙。原作托管在 orteil.dashnet.org，无法嵌进即玩，点「去原页玩 ↗」在新窗口打开。',
  about_en = 'Start with one cookie. Click out ovens, factories, a universe. The original lives at orteil.dashnet.org and cannot be embedded here. Use “Play on original ↗” to open it in a new tab.'
  WHERE id = 'cookie-clicker';
