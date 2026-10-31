# dms-p3 — Persona 3 Reload 风格的 DMS 改造

和 `dms-p5` 并列的独立补丁包，基线是系统里的 DMS 2.0.0（dux-shell）。和 dms-p5 只能启用其中一个。

**现状：浏览器原型 + 接入逻辑已写全，QML 移植还没开始，暂时不能安装。** 不要在系统里启用或修改任何东西。

- 已完成：界面原型；`backend.js` 里每个系统操作的完整逻辑（状态、异步结果、错误、事件订阅），每个操作都标了对应的 DMS 2.0 Service / IPC 调用，或标为缺口；`INTEGRATION.md` 里的映射表、缺口表、新 IPC、包结构和接入顺序。
- 未完成：`overlay/` 里的 QML、`patches/`、`build.sh` / `enable.sh`。也就是说 `P3Sys` 目前还是 mock，接入时要把它换成 QML 里对 DMS Service 的真实调用。

## 内容

| 路径 | 说明 |
|---|---|
| `prototype/menu-x.html` | 全屏菜单：APPS / STATUS / CALENDAR / SYSTEM（含 MORE 二级）/ POWER |
| `prototype/island-b.html` | 顶栏灵动岛（BUBBLES）：SDF 气泡串 + 通知中心 |
| `prototype/pages/*.js` | 菜单的每个页面一个文件 |
| `prototype/shared/menu.js`、`menu.css` | 菜单框架，页面 API 写在 `menu.js` 文件头 |
| `prototype/shared/backend.js` | `window.P3Sys`：所有数据和系统操作的唯一入口（mock 实现，每个操作注明对应的 DMS 2.0 调用或缺口） |
| `prototype/shared/tokens.css`、`data.js`、`icons/`、`fonts/`、`desk.jpg`、`miku-bg.png` | 配色字体、初始快照、图标、假桌面、菜单背景 |
| `prototype/INTEGRATION.md` | 接入 DMS 2.0 的映射表、缺口、新 IPC、灵动岛对应关系、包结构和接入顺序 |
| `prototype/archive/` | 未选中的灵动岛方案 A / C 和早期方案文档 `PLAN.md`（路径写的是旧位置） |

## 查看原型

> **仓库不上传图片。** `.gitignore` 排除了本目录下所有 png/jpg/webp/gif，只有字体和 svg 图标进仓库。新 clone 缺图时页面照常运行：假桌面和菜单背景不显示，png 图标显示为空。要还原：`p5-reference/p3-miku/bg.png` 复制成 `prototype/shared/miku-bg.png`；任意 16:9 壁纸复制成 `prototype/shared/desk.jpg`；png 图标从系统图标主题（`/usr/share/icons`、`/usr/share/pixmaps`）按 `shared/data.js` / `backend.js` 里的文件名复制到 `prototype/shared/icons/`。新增截图也不要提交。

浏览器直接打开 `file://…/prototype/menu-x.html` 或 `island-b.html`。

- `?static=1` 静态截图，`?page=ID` 直达菜单页；灵动岛 `?state=N`、`?w=1706`、`?demo=1`。
- mock 后端：`?lat=ms` 延迟，`?fail=net.connect,bt.connect,…` 让指定操作失败。

## 设计约定

- 只有 P3 蓝一套色板，不做淡紫主题。除菜单的水下背景外不用渐变，不做 hover 效果，只响应点击。
- 灵动岛颜色 `#14306e`，通知中心是平铺的行。菜单焦点是元素左上角一个脉动的天蓝光点。

## 同系列

`p3-kits/p3-lyrics/`（桌面歌词）、`wallpaper/`（P3 壁纸切换），以及 `p5-reference/` 里还没移过来的 P3 原型：`p3-lock`（锁屏）、`p3-miku`（菜单背景原型）、`phone`。
