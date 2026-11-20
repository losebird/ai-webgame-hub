-- 2026-11-20：Incremancer 原作在第三方 iframe 中会跳离（不能站内嵌），改为 link。
-- 只改本日新插入的这一行，不改其他游戏或用户数据。

UPDATE games
SET embed = 0,
    about = '由 jamesmgittins 制作，并在 incremancer.gti.nz 公开发布，源码公开在 GitHub。原页托管在 incremancer.gti.nz，不是即玩的作品。原作在站内嵌入时会跳离，所以请去原页玩。开玩不用登录。',
    about_en = 'Made by jamesmgittins and published at incremancer.gti.nz, with source available on GitHub. Hosted at incremancer.gti.nz; it is not a Jiwan original. The original page leaves when embedded, so it opens on the original site. No account needed.'
WHERE id = 'incremancer';
