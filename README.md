# 即玩

AI 网页游戏分享站。前端是静态页面，后端是 Node（≥ 22.5）+ SQLite，本地开发用法见 [server/README.md](server/README.md)。

```bash
node server/index.js        # API  http://127.0.0.1:8787
node server/static.js       # 站点 http://127.0.0.1:5500
cd server && npm test
```

运行库默认是 `server/data/jiwan.db`（已去掉登录会话的调试数据）。干净的演示基线在 `server/data/seed.db`。演示账号默认密码是 `jiwan`，包括站务管理员，请勿直接当正式环境使用。
