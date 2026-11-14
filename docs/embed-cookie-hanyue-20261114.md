# hanyue.io 两款嵌入后卡在取昵称页（breach / hextech-aram）

复查时间：2026-11-14 17:44 起（Asia/Shanghai）。

## 现象

在 jiwan.space 站内游戏页打开 `breach`（https://cf.hanyue.io/）或 `hextech-aram`（https://lol.hanyue.io/），点「进入大厅」或「自动进入游戏」后出现红字：

> 请允许本站保存 Cookie，才能同步 CF 与 LOL 昵称

页面停在取昵称页，进不了游戏。

## 根因（读对方脚本 + 真实 Chrome 复现）

对方的昵称模块 `shared-game-nickname-*.js` 用 `document.cookie` 写：

```
hanyue-game-nickname-v1=<昵称>; Path=/; Max-Age=31536000; SameSite=Lax; Secure; Domain=.hanyue.io
```

写完立即读回。在 `*.hanyue.io` 主机上 `required = true`，读不到时 `shared = false`。
提交处理里 `if (result.required && !result.shared) { setError('请允许本站保存 Cookie…'); return; }` 直接 return，是**阻断**，不是警告。

在 jiwan.space 里，hanyue.io 是跨站 iframe。**SameSite=Lax 的 Cookie 在第三方上下文中写不进去、也不会发送**，跟用户有没有放行第三方 Cookie无关。
对方全部脚本里没有 `requestStorageAccess` / `hasStorageAccess`，也没用 `SameSite=None` 或 `Partitioned`（CHIPS）。

真实 Chrome 复现结果：

| 打开方式 | 点击后 | document.cookie |
|---|---|---|
| jiwan.space 的 play.html iframe | 出现红字，停在取昵称页（两款都一样） | 空 |
| 顶层直接打开 cf / lol.hanyue.io | 进入大厅 / 游戏 | 有 `hanyue-game-nickname-v1=…` |

同一轮 Cookie 写入监控中，diep.io 的 `SameSite=None; Secure` Cookie 能写进去，没带 None 的写不进。这说明问题出在 SameSite 属性，不是 iframe 的 sandbox。

## 修法评估

1. 我们给 iframe 加 `allow="storage-access"` 之类属性：**无效**。对方不调用 Storage Access API；就算调用，它也只放行 `SameSite=None` 的 Cookie，而对方写的是 Lax。
2. 点「自动进入游戏 / 进入大厅」：**阻断**，见上。
3. 采用：这两款 `embed = 0`，改「去原页玩 ↗」新窗口打开（迁移 `0005_hanyue_link_only.sql`），介绍文案同步说明原因。

要让它们重新站内可玩，只能由对方改：昵称 Cookie 改为 `SameSite=None; Secure; Partitioned`，或在 iframe 里不强制同步，或调用 Storage Access API。

## 其他嵌入条目扫描

用真实 Chrome 在 jiwan.space iframe 里打开其余 57 款 embed 条目，监控 `document.cookie` 写入是否被丢弃。

- 被丢的基本是 GA / 广告 / 同意弹窗 Cookie（a-dark-room、alchemy-2、paperclips、lost-transmission、diep-io）。它们不会阻断游戏。
- krunker 的 `__FRVR_auth_*` 登录 Cookie 也写不进，可能导致**站内登录状态不保留**，但游客能直接玩，未改。
- 只有 hanyue.io 这两款是“写不进就不让进游戏”。

localStorage 在跨站 iframe 里是按顶层站点分区的，能用，只是和原站顶层的数据不共享。
