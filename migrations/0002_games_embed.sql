-- games.embed：src 能否嵌进即玩的 iframe。1 = 站内打开；0 = 对方禁止嵌入（XFO / frame-ancestors / 仅 http），只给「去原页玩 ↗」。
ALTER TABLE games ADD COLUMN embed INTEGER NOT NULL DEFAULT 1;
