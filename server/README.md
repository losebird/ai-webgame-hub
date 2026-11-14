# 即玩空间后端

正式部署与本地验收请看仓库根目录的 README.md（Cloudflare Workers + D1，同源）。下面是 Node 对照版。

零依赖：`node:http` + `node:sqlite`（Node ≥ 22.5）。

**数据只有一份，在 SQLite 里。** 静态目录（`assets/jiwan-catalog.js` 里的 GAMES/POSTS/AUTHORS/TOPICS/英文表）已经清空，运行时不再读取任何静态数据文件；前端也不再带 mock。

## 运行

```bash
node server/index.js        # API  http://127.0.0.1:8787
node server/static.js       # 站点 http://127.0.0.1:5500（自动注入 JIWAN_API_BASE）
cd server && npm test       # 45 + 11 项验收（在 seed.db 的临时快照上跑，不污染主库）
```

环境变量：`JIWAN_PORT`(8787) `JIWAN_HOST` `JIWAN_WEB_PORT`(5500) `JIWAN_DB`(默认 `server/data/jiwan.db`)。

**必须用静态服务打开站点，不要 `file://`**。`127.0.0.1:5500` 与 `127.0.0.1:8787` 同站点（端口不参与 SameSite 判定），所以 `SameSite=Lax` 的 Cookie 能随 `credentials:'include'` 发送；`localhost` 与 `127.0.0.1` 混用会变跨站，Cookie 直接失效。

## 文件

| 文件 | 职责 |
|---|---|
| `db.js` | 建表（games / topics / users / posts / reviews / packs / plays / history / notifs / reports / hidden / meta）+ 连接 |
| `store.js` | 游戏数据访问层：读 `games` 表，并在服务端重写筛选 / 排序 / 榜单权重 / 搜索匹配 / 拼音与在玩数计算 |
| `api.js` | 全部路由，语义与旧 mock 一致 |
| `index.js` | HTTP、CORS（回显 Origin + credentials）、Cookie 会话；`games` 表为空时直接报错提示先导入 |
| `static.js` | 开发静态站，只在响应里注入一行 API BASE，不改源文件 |
| `migrate.js` | 一次性导入工具：把历史目录文件写进库（`node server/migrate.js server/legacy/jiwan-catalog.js`） |
| `catalog.js` | 只被 `migrate.js` 使用的 `vm` 加载器，本身不含数据 |
| `data/seed.db` | **干净的演示基线**（迁移产物：73 游戏 / 4 专题 / 40 账号 / 19 帖 / 86 条种子评价 / 1 个 pending 包）。测试从它取快照；dev 库被手动试玩改脏也不会影响验收 |
| `legacy/jiwan-catalog.js` | 迁移输入存档，**运行时完全不读**。只用于从零重建 seed.db；不需要可删，删了也能用 seed.db 直接复制重建 |
| `smoke.js` / `client-test.js` | 验收脚本（54 + 11 项） |

## 数据模型

一次请求的世界 = `games` 表（克隆）→ 并入 `listed + public` 的工坊包 → 叠 `reviews`（用户评价 + 种子评价，`seed=1`）→ 叠 `plays` 增量 → 打下架标记。

- `games`：73 部作品，含 `title/title_en/blurb/blurb_en/about/about_en/banner_en/pinyin`（i18n 与拼音搜索）、`poster/shots/shotSize/dist`（JSON）、`hot/neu/featured/pick/fable/demo/wide/duration/cat/tags` 等排序与展示字段、`ord`（目录顺序）。
- 署名拆成三列，不再用一个字段混装：
  - `author`：真实个人/团队署名，可为空。
  - `maker`：谁生成的（目前只有 `Fable 5.2`）。
  - `source`：来源（`fable52.games` / `X` / `Claude Gaming` / `腾讯（IP）` / `字节 CDN`）。
  前端 `authorLabel(g)` 的显示规则：有 `author` 显示作者；否则 `maker + ' 生成'`；再否则 `来源 + source`；都没有显示「未署名」。未署名条目**不会**给出作者主页链接。
- 种子账号：`admin / jiwan`（显示名「站务」，`role=admin`）、`林澄 / jiwan`（`role=reviewer`）、`何予 / jiwan`；有署名的作者默认密码都是 `jiwan`。平台名（`fable52.games`）不再是账号。
- 角色三档，`admin ⊃ reviewer ⊃ user`：

  | role | 能做什么 |
  |---|---|
  | `''`（普通用户） | 发帖 / 评论 / 评价 / 收藏 / 关注 / 投稿工坊 |
  | `reviewer` | 上面全部 + 举报台、工坊过审拒稿、藏帖、下架游戏、看后台概览 |
  | `admin` | 上面全部 + 用户管理（改角色、禁用、重置密码）、恢复已藏帖 / 已下架游戏 |

  `users.disabled` 一旦置 1：全部会话立即失效，再登录返回 `403 forbidden / message=disabled`。管理员不能改自己，也不能把最后一个管理员降级（`forbidden / last_admin`）。

## 后台

页面 `admin.html`，导航里只有 `admin` / `reviewer` 会看到「管理」入口。页签按身份裁剪：

| 页签 | 谁能用 | 接口 |
|---|---|---|
| 概览 | reviewer+ | `GET /admin/stats` |
| 举报 | reviewer+ | `GET /reports[?all=1]`、`POST /reports/:id/dismiss` |
| 工坊 | reviewer+ | `GET /workshop/queue`、`POST /workshop/packs/:id/review` |
| 帖子 | reviewer+ | `GET /admin/posts`、`POST /posts/:id/hide`、`POST /admin/posts/:id/restore|delete` |
| 游戏 | reviewer+ | `GET /admin/games`、`POST /games/:id/takedown`、`POST /admin/games/:id/restore` |
| 用户 | **仅 admin** | `GET /admin/users`、`POST /admin/users/:id`（`{role,disabled}`）、`POST /admin/users/:id/password` |

后台界面是中文（内部工具），导航与页脚仍跟随语言开关。

## 前端如何拿数据

- `assets/jiwan-api.js`：只剩 fetch 封装 + 会话/点赞/收藏/关注/未读的本地镜像，**没有 mock**。任何一次 API 调用之前会先拉 `GET /games/index`（73 条展示字段 + `people`），把结果交给 `JIWAN.setIndex()`，`byId()` 就是在这张索引上同步查。
- 排行升降：`/home`、`/rankings`、`/games?from=rank` 都会带 `prev: { period, map: { gameId: 名次 } }`，客户端 `rankIndexMap()` 读这份缓存，不再在浏览器里重算整张榜。
- 语言：`gameTitle/blurb/about/banner` 直接读行内的 `*_en` 字段，浏览器不再持有第二张语言表。

## 已知限制

- 密码是 `sha256('jiwan:'+pass)`，演示级；正式环境换 argon2 + 邮件验证，并删掉 `/auth/reset`。
- 排行升降、相关推荐仍是启发式权重（`store.rankWeight`），只喂了真实播放数。
- `index.html` 心形首帧读的是 `api.likes()` 同步集合，登录后第一次进首页可能晚一帧。
- 后台改了别人的角色后，对方浏览器里的 `jiwan-session.role` 是旧值，导航入口要刷新一次才更新（接口鉴权永远以服务端为准）。
- 390px 宽下导航区仍有约 40px 横向溢出，是早期布局遗留，与后台无关。
- 工坊包 `zip` 不上传，`playUrl` 只做透传。
- 详情类接口的空 id（`/posts/`、`/games/`、`/users/`）在服务端会被路由收敛成集合路径，所以客户端 `req()` 直接判 `not_found`、不发请求；页面各自落到「找不到」态。重建库用 `node server/migrate.js server/legacy/jiwan-catalog.js`，或直接把 `data/seed.db` 复制成 `data/jiwan.db`。
