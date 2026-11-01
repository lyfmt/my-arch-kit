# dms-p3 — Persona 3 Reload 风格的 DMS 改造

和 `dms-p5` 并列的独立补丁包，基线是系统里的 DMS 2.0.0（`dux-shell`，`/usr/bin/dms` 内置 UI）。和 dms-p5 只能启用其中一个。

**现状：QML 移植完成，可以安装。** 全屏菜单（APPS / STATUS / CALENDAR / SYSTEM / POWER）和顶栏灵动岛（BUBBLES 气泡串 + 通知中心）都已移植，`overlay/P3Sys/` 接的是 DMS 2.0 的真实 Service。`enable.sh` / `disable.sh` 会重启 DMS、改 niri 配置，只在用户要求启用或停用时运行。

## 依赖

| 包 | 用途 |
|---|---|
| `dux-shell` 2.0.0（`dms`） | 上游 UI 的来源（`build.sh` 从 `/usr/bin/dms` 解出）和运行时；升级后要先按新版本重新适配 `patches/` |
| `quickshell-git`、`niri` | 运行；`Mod+Z` 绑定和输出信息来自 niri |
| `python3`、`patch` | `build.sh` / `enable.sh` / `disable.sh` |
| 可选：`fcitx5`、`khal`（或 dankcal）、Clash Verge（mihomo） | 输入法、日历事件、代理。缺了对应的行显示未连接 |
| 自测：`sway`、`grim` | `scripts/qmlcheck.sh` 的无头会话和截图 |

## 构建、启用、停用

```sh
./build.sh                 # 上游 UI + patches/ + overlay/ → ~/.local/share/dms-p3/shell
./build.sh --check         # 只检查补丁能否干净应用
./build.sh --dest /tmp/x   # 装到别处（测试用）
./build.sh --extract       # 升级 dms 后从 /usr/bin/dms 重新解出上游缓存（VERSION 必须等于 patches/BASE_VERSION）
./enable.sh                # 构建 → 改 niri 启动行 → 加 Mod+Z → 重启 DMS（--no-build / --no-restart）
./disable.sh               # 还原启动行和设置 → 按原来的启动行重启 DMS（--no-restart）
```

`enable.sh` 做的事：

1. 第一次启用时把 `~/.config/DankMaterialShell/settings.json` 原样存到 `~/.local/share/dms-p3/prev-settings.json`。DMS 2.0 的 UI 启动时会把它迁移成新格式（`configVersion` 18 → 42，改写 `barConfigs`、删掉旧键），迁移后 1.6.3 的 UI（dms-p5）读不对，所以要留一份迁移前的。
2. `config.kdl` 先备份成 `config.kdl.bak-dms-p3`（已有就不覆盖）；原来的 `spawn-at-startup "dms" "run" …` 整行存到 `~/.local/share/dms-p3/prev-spawn`，换成 `dms run -c ~/.local/share/dms-p3/shell`。
3. 复制 `niri/dms-p3.kdl`（`Mod+Z` → `dms ipc call p3menu toggle`）并 include。其它 `.kdl` 里原来绑在 `Mod+Z` 上的节点（例如 DMS 的启动器）用 KDL 的 `/-` 整个注释掉，上一行加 `// dms-p3: Mod+Z 让给 P3 菜单（disable.sh 还原）`。`niri validate` 不过就还原改过的文件并退出。
4. 停掉 `dms` 进程（只停它自己，看板、音乐卡片等独立 qs 实例不受影响），以 dms-p3 重新拉起。

`disable.sh` 反过来：启动行写回 `prev-spawn` 里的那一行（例如 dms-p5），去掉 include，按标记恢复原来的 `Mod+Z` 绑定，停掉 DMS 之后把 `prev-settings.json` 写回 `settings.json`（dms-p3 期间的设置另存为 `settings.json.dms-p3-<时间>`），再按原来的启动行重启。设置必须在 DMS 停下后写回：在跑的 2.0 UI 监视着这个文件，会立刻再迁移一次。`--no-restart` 时不写回设置，会提示手动命令。

### 启用后

- 菜单：`Mod+Z`，或 `dms ipc call p3menu toggle | open <apps|status|calendar|system|power> | close | status`。
- 灵动岛：顶栏横放、独立岛（不是竖栏、不是 free / dot / notch / 嵌入模式）时画成 P3 气泡串，只响应点击、不悬停展开。调试：`dms ipc call island status`、`island open notificationcenter`、`island show media`、`island close`。
- 只要岛、不要两侧的卫星胶囊：DMS 设置 → 顶栏外观里关掉 island satellites，即 `settings.json` 的 `barConfigs` 中 id 为 `default` 的那一项设 `"islandSatellitesEnabled": false`。`enable.sh` 不改这个设置；手改文件要在 DMS 停下时改。
- 只重启 dms-p3：`scripts/dev.sh restart`，或带锚定路径的 `pkill -f '[q]s -p .*/dms-p3/shell'`。不要用宽泛的 `pkill qs`。

## 验证

```sh
./build.sh --check
./build.sh --dest /tmp/p3build
P3_STILL=1 P3_CHECK_DIR=/tmp/p3check-status P3_IPC="p3menu open status" P3_SHOT=/tmp/p3shots/status.png scripts/qmlcheck.sh /tmp/p3build 10
P3_CHECK_DIR=/tmp/p3check-isl P3_IPC="island open notificationcenter" P3_SHOT=/tmp/p3shots/island-nc.png scripts/qmlcheck.sh /tmp/p3build 10
```

`qmlcheck.sh` 在无头 sway 里跑（虚拟输出 HEADLESS-1，1920×1080），独立 dbus 会话、临时 XDG 目录，不碰在跑的 DMS，也不在桌面上开窗口；不要为测试启动嵌套 niri。输出里 P3 文件和打过补丁的文件不能有警告；壁纸、缓存文件、`TrayMenuManager`、portal 这几类上游警告是沙箱造成的。子层截图用的环境变量（`P3_SYSTEM_VIEW`、`P3_POWER_*`、`P3_CAL_DAY` 等）见 `docs/PAGE_CONTRACT.md` 第 6 节。截图只存 `/tmp`。

## 文件

| 路径 | 说明 |
|---|---|
| `build.sh`、`enable.sh`、`disable.sh` | 构建、启用、停用（见上） |
| `patches/` | 对上游文件的补丁，`BASE_VERSION` = v2.0.0。`DMSShell.qml.patch` 让 `P3Menu` 单例和 `p3menu` IPC 启动时就绪；`island_DIslandSurface.qml.patch`、`island_IslandController.qml.patch` 把横向独立岛换成 P3 气泡串 |
| `overlay/Modules/P3/` | 菜单框架和控件：`P3`（令牌）、`P3Menu`（单例 + IPC）、`P3MenuWindow`（窗口、焦点引擎、页面切换）、`P3MenuItem`、`P3Page`、`P3Water` / `P3Bubbles`（水下背景）、`P3Tide` / `P3Wedge`（焦点指示）、`P3Text` `P3Row` `P3Toggle` `P3Slider` `P3Hold` `P3Button` … |
| `overlay/Modules/P3/pages/` | 五个页面 `<Name>Page.qml`，各自的组件在 `apps/` `calendar/` `status/` `system/` `power/` 子目录 |
| `overlay/Modules/P3/Island/` | 灵动岛：`P3IslandLayer`（气泡内容、点击区）、`P3IslandShape` + `shaders/p3island.frag`（SDF 平滑并集）、`P3IslandSprings`（弹簧）、`P3IslandLayout.js`（几何，控制器和内容层共用）、`P3IslandCenter`（通知中心）… |
| `overlay/Modules/P3/assets/fonts/` | `P3Display.ttf`（`scripts/mkfont.py` 由原型 woff2 合成）、`BarlowCondensed-Bold.ttf` |
| `overlay/P3Sys/` | 页面唯一的系统接口：一个命名空间一个单例，对 DMS Service 的薄封装（`import qs.P3Sys`） |
| `niri/dms-p3.kdl` | `Mod+Z` 绑定（`enable.sh` 安装） |
| `docs/PAGE_CONTRACT.md` | 页面契约：骨架、ctx、焦点与按键、控件、P3Sys 一览、自测 |
| `docs/ISLAND_PLAN.md` | 灵动岛的实现方式 |
| `scripts/qmlcheck.sh` | 无头自测 |
| `scripts/dev.sh` | 开发：`init` 建上游工作副本 `work/shell`、`export` 导出补丁、`check`、`restart` |
| `scripts/extract-embedded.py` | 从 `/usr/bin/dms` 解出内置 UI（`build.sh` 调用） |
| `scripts/mkfont.py`、`mkglyphs.py`、`mklunar.js` | 生成字体、图标表、农历表 |
| `scripts/grab.sh`、`preview/grab/` | 截取真实输出（开发用） |
| `prototype/` | 浏览器原型（见下） |

改 `shaders/p3island.frag` 后重新生成 `.qsb`：

```sh
/usr/lib/qt6/bin/qsb --glsl "100 es,120,150" --hlsl 50 --msl 12 -o overlay/Modules/P3/Island/shaders/p3island.frag.qsb overlay/Modules/P3/Island/shaders/p3island.frag
```

## 原型

| 路径 | 说明 |
|---|---|
| `prototype/menu-x.html` | 全屏菜单：APPS / STATUS / CALENDAR / SYSTEM（含 MORE 二级）/ POWER |
| `prototype/island-b.html` | 顶栏灵动岛（BUBBLES）：SDF 气泡串 + 通知中心 |
| `prototype/pages/*.js` | 菜单的每个页面一个文件 |
| `prototype/shared/menu.js`、`menu.css` | 菜单框架，页面 API 写在 `menu.js` 文件头 |
| `prototype/shared/backend.js` | `window.P3Sys` 的 mock 实现，每个操作注明对应的 DMS 2.0 调用或缺口 |
| `prototype/shared/tokens.css`、`data.js`、`icons/`、`fonts/`、`desk.jpg`、`miku-bg.png` | 配色字体、初始快照、图标、假桌面、菜单背景 |
| `prototype/INTEGRATION.md` | 接入 DMS 2.0 的映射表和缺口 |
| `prototype/clipboard/` | 剪贴板历史的四个 P3 方案（静态原型，未选定、未移植；见其中的 `AGENTS.md`） |
| `prototype/archive/` | 未选中的灵动岛方案 A / C 和早期方案文档 `PLAN.md`（路径写的是旧位置） |

> **仓库不上传图片。** `.gitignore` 排除了本目录下所有 png/jpg/webp/gif，只有字体和 svg 图标进仓库。缺图时原型照常运行（假桌面和菜单背景不显示，png 图标为空），QML 版菜单背景只用纯色水下层、图标退回主题图标。要还原：`p5-reference/p3-miku/bg.png` 复制成 `prototype/shared/miku-bg.png`；任意 16:9 壁纸复制成 `prototype/shared/desk.jpg`；png 图标从系统图标主题（`/usr/share/icons`、`/usr/share/pixmaps`）按 `shared/data.js` / `backend.js` 里的文件名复制到 `prototype/shared/icons/`。`build.sh` 会把 `miku-bg.png` 和 `icons/` 拷进构建产物。新增截图也不要提交。

浏览器直接打开 `file://…/prototype/menu-x.html` 或 `island-b.html`；`?static=1` 静态截图，`?page=ID` 直达菜单页；灵动岛 `?state=N`、`?w=1706`、`?demo=1`；mock 后端 `?lat=ms` 延迟，`?fail=net.connect,bt.connect,…` 让指定操作失败。

## 设计约定

- 只有 P3 蓝一套色板。除菜单的水下背景外不用渐变，不做 hover 效果，只响应点击。
- 展示字（Nunito Sans 900 斜体，`P3 Display`）只给名词和数字，其余标签用 Barlow Condensed。
- 界面里不写解释性小字（不重复标题的副标题、不写提示行）。
- 灵动岛颜色 `#14306e`，通知中心是平铺的行。菜单焦点是元素左上角一个脉动的天蓝光点。

## 同系列

`p3-kits/p3-lock/`（锁屏）、`p3-kits/p3-lyrics/`（桌面歌词）、`wallpaper/`（P3 壁纸切换），以及 `p5-reference/` 里的 P3 原型：`p3-miku`（菜单背景原型）、`phone`。
