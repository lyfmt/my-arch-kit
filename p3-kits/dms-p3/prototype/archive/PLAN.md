# P3 SHELL 方案：顶栏精简 + P3 菜单

状态：方案待 review，还没有写 HTML 和 QML。
目录：`p5-reference/p3-shell/`。所有新文件都放在这里。`p3-miku/`、`phone/` 和 `index.html` 里未提交的改动一律不碰。

## 1. 总体结构

- **菜单**：在 `p3-miku` 的水下主菜单基础上扩展。它是一个全屏 Overlay 层，在当前聚焦的屏幕上打开。主列表保留 P3R 的斜排菜单项，选中某一项后，二级页从右侧滑进来，背景仍是同一片水。
- **打开方式**（默认三种都做）：
  - 快捷键 `Mod+Backspace`。物理按键是 Caps+Backspace，在已加载的 niri 配置里没有被占用。
  - 点击灵动岛上的时钟。
  - `dms ipc call p3menu toggle`。
- **关闭和返回**：`Esc` 或右键退回上一级，在主列表再按一次就关闭。启动应用后菜单自动关闭，让出键盘焦点（做法同 `P5AppsWindow`）。
- **操作方式**：键盘用 ↑↓/W/S 选择，Enter 进入，←/Esc 返回，鼠标悬停选中、单击确认、滚轮切换。这些都沿用 `p3-miku`。
- **顶栏**：只保留需要一直看得到的信息，其余功能移进菜单。

## 2. 顶栏

### 2.1 逐项处理

| 元素 | 处理 | 原因 / 功能去哪了 |
|---|---|---|
| workspaceSwitcher | **保留** | 当前有几个工作区、在哪一个，只有它能一眼看到 |
| focusedWindow | **删除** | 标题信息价值低，在笔记本屏上还会被岛遮住。点它打开的 `P5WindowDossier` 会失去入口，见问题 4 |
| centerWidgets: music / clock / weather | **删除配置** | 灵动岛模式下这三项本来就不渲染，删掉没有任何可见变化 |
| systemTray（飞书、magpie、Fcitx、Sunshine、Clash、QQ） | **移入菜单「应用」页**（方案 A）/ 保留（方案 B） | 托盘是这几个常用应用实际的入口。移走后看不到 Clash 的状态图标 |
| clipboard | **删除** | `Mod+Alt+V` 打开的是同一个 WantedBoard。失去的只有拖放存入和右键清空 |
| cpuUsage / memUsage | **删除，数值进菜单「状态」页** | `P5ProcessBoard` 原来只能从这里打开，所以要同时把 `Ctrl+Alt+Del` 改成打开它，「状态」页也放一个跳转链接 |
| battery | **保留，只显示百分比** | 笔记本上电量要随时看得到。详情（剩余时间、功率、电源模式）移到「状态」页 |
| controlCenterButton | **保留** | Wi-Fi、蓝牙、音频设备、夜间模式这些开关别处没有入口，菜单也不打算重做 |
| 岛：时钟 + 日期 | 保留 | 无法关闭。点击改为打开 P3 菜单，见问题 3 |
| 岛：通知铃 + 计数 | 保留 | 通知中心 P5PhoneChat 不变 |
| 岛：音乐可视化槽 | 保留 | 点开是 P5MediaPage |
| 岛展开页 `P5HomeDash` | 由菜单吸收 | 它的数值条和月历与菜单的「状态」「日历」页重复，见问题 3 |
| 拉绳 | 文档里写了，代码里从来没有实现过 | 方案 C 里补做，作为打开菜单的一种方式 |

### 2.2 视觉方案（`bar.html`，同时用 2560 和 1706 两种宽度的假桌面展示）

- **A 精简 P5**：沿用现在的 P5 板块和淡紫色。左边是工作区，中间是岛，右边是电量和控制中心。这是改动最小的方案。
- **B 精简 + P3 化**：内容同 A，再加一个紧凑托盘。顶栏改成平涂的深墨蓝条，数字用 P3 字体，顶栏的观感和菜单统一。
- **C 拉绳**：两侧只剩工作区和电量，岛下面垂一根拉绳，拉一下（点击或下拉）打开菜单，带回弹动画。

## 3. 菜单

### 3.1 主列表（方案 A：7 项。方案 B：保留 p3-miku 原来的 9 项）

| 项 | 说明 | 行为 |
|---|---|---|
| APPS | 应用入口 · 常驻与常用 | 二级页 |
| STATUS | 系统状态 · 数值读数 | 二级页（新增） |
| CALENDAR | 日历 · 今日任务 | 二级页 |
| MUSIC | 音乐卡片 | `qs ipc -c music call music open` |
| KANBAN | 看板 | `qs ipc -c kanban call kanban open` |
| SETTINGS | DMS 设置 | `dms ipc call settings focusOrToggle` |
| POWER | 锁屏 / 睡眠 / 注销 / 重启 / 关机 | 二级页 |

方案 A 把 FILES、TERMINAL、BROWSER 收进 APPS 页的「固定」组，这样主列表更短。右上角的日期和时间块保留。

### 3.2 二级页

**APPS 应用入口**
- 「固定」：终端 `kitty`、浏览器 `chromium`、文件 `thunar`，再加一项「全部应用 →」，它打开 `Mod+Z` 的轮盘。
- 「常用」：取 `appusage.json` 里使用次数前 8 的应用，比如 magpie、飞书、Buffin、Clash、QQ、Termius。
- 「后台常驻」：系统托盘里的应用。左键激活，右键在菜单里弹出它的托盘菜单。
- 设计变体：**A** 是 P3 列表行，图标加名称加一行说明。**B** 是图标网格。

**STATUS 数值**
- 内容：CPU %（含温度和频率）、RAM、SWAP、GPU 温度、磁盘、网速、运行时间、负载、电池（百分比、状态、剩余时间、功率、电源模式）。
- 底部放一个链接「进程 →」，打开 P5ProcessBoard。
- 数据来源：`DgopService`、`BatteryService`。这些服务只在菜单打开时采样。
- 设计变体：**A** 用 phone v2 的「水箱」液位计加折线图。**B** 用大号 P3 数字竖排，加细进度条。

**CALENDAR 日历**
- 月历：滚轮或 ←/→ 翻月，`T` 回到今天，今天的格子用白楔形标出。
- 右侧是「今日」：读取 kanban 的 `board.json`，列出 DOING、TODO 和每日任务（带 HH:MM）。只读，不写回。
- 本机没有 khal 或其他日程后端，所以页面上不显示日程事件。kanban 的任务也没有日期，只能显示今天。
- 设计变体：**A** 左月历右今日。**B** 仿 P3R 换日画面：大日期加一周横条，月历收在下面。

**POWER 电源**
- 锁屏（p5lock）、睡眠（先锁屏再挂起，同 `Mod+Alt+P`）、注销、重启、关机。
- 重启、关机、注销需要长按 1 秒确认，按住时进度条填满，松开就取消。
- 设计变体：**A** 用二级斜排列表，每项一行，和主菜单同一种语言。**B** 用五张大卡片横排。

### 3.3 背景开关

- `?bg=water`（默认）：与 p3-miku 相同，倒置的 Miku 加水下背景。
- `?bg=none`：菜单直接叠在桌面截图上，只保留菜单和动效。

之前做壁纸切换器时，你说过覆盖层不要自带背景，所以两种都做出来，放在一起对比。

## 4. HTML 交付物

```
p5-reference/p3-shell/
  PLAN.md
  index.html        总览，列出每个部分的缩略卡片，可切换变体和主题
  shared/
    tokens.css      P3 蓝和 DMS 淡紫两套色板（从 p3-miku 和 phone v2 整理而来）
    stage.js        1920×1080 舞台缩放、主题/变体/屏宽参数、静态截图模式
    data.js         假数据，取自本机的快照：托盘、常用应用、board.json、数值
    desk.png        假桌面背景（bar.html 和 bg=none 用）
    bg-lavender.png 淡紫版水下背景（复制 grade.py 后改色生成，不改原文件）
  bar.html          顶栏 A/B/C
  menu.html         主列表 A/B，含开合动画
  apps.html  status.html  calendar.html  power.html   各二级页 A/B
```

- **URL 参数**：`?theme=p3|lavender`、`?v=A|B|C`、`?w=2560|1706`（模拟两块屏）、`?bg=water|none`、`?static=1`（停掉动画，用于截图）。
- **快捷键**：`T` 切换主题，`V` 切换变体。
- **字体和资源**：直接引用 `../p3-menu/fonts`、`../save-carousel/fonts` 和 `../p3-miku/bg.png`，不复制。
- **两块屏的检查**：每页都在 2560×1440 和 1706×1066 两种尺寸下检查。笔记本屏左右各会裁掉约 100px，主要内容不放在这两条边里。
- **这一阶段不做**：QML、真实数据、IPC。另外 `p5-reference/index.html` 的总目录等你选定方案后再加卡片。

## 5. 后续 QML 落地（选定方案后）

- **菜单窗口**：新建 `dms-p5/overlay/Modules/P5/P3Menu.qml` 和 `P3MenuWindow.qml`，写法照 `P5Apps.qml` 和 `P5AppsWindow.qml`，即单例加 LazyLoader，Overlay 层，独占键盘焦点。
- **IPC**：在 `DMSShellIPC.qml.patch` 里加 `p3menu` target，提供 open、toggle 和 page 三个调用。
- **进程面板**：把 `Ctrl+Alt+Del` 对应的 `processlist` IPC 改成打开 P5ProcessBoard。
- **岛的点击**：在 HomeCompact 和 IslandController 的 patch 里，把点击时钟的行为改成打开菜单。
- **配置**：编辑 `settings.json`，删掉第 2 节决定删除的部件，删前先备份。在 niri 的 `binds.kdl` 里加 `Mod+Backspace`。
- **字体**：Qt 加载 woff2 需要 brotli 支持，需要先验证，不行就转成 ttf。
- **版本**：系统已经升级到 DMS 2.0.0（dux-shell），而 dms-p5 的 patch 仍基于 1.6.3 构建。写 QML 之前要先决定继续用 1.6.3，还是先迁移到 2.0。

## 6. 待确认问题（括号里是我的默认）

1. **「当前快捷栏的应用」指什么？**（默认：三者混合。固定启动项（终端/浏览器/文件），加 appusage 常用应用，加托盘常驻应用。）如果你指的只是托盘里那几个图标，APPS 页就只做「后台常驻」一组。
2. **托盘从顶栏移走吗？**（默认：移走，即顶栏方案 A/C。Clash 的状态图标会因此看不到。）
3. **灵动岛展开页 P5HomeDash 还要吗？**（默认：不要。点击时钟改成打开 P3 菜单，月历和数值只在菜单里保留一份。）
4. **P5WindowDossier（窗口档案）删掉 focusedWindow 后还要入口吗？**（默认：不要，接受它失去入口。如需保留，可以在 APPS 页顶部放一张「当前窗口」卡片。）

## 7. 风险与取舍

- **整体风格**：顶栏和其余 P5 页面是 P5 淡紫，菜单是 P3 蓝。顶栏方案 B 和 lavender 主题就是用来弥合这个差异的，HTML 阶段并排展示，你对比后再选。
- **斜排例外**：p3-miku 的菜单项在未选中时也是斜的，和「只有选中项倾斜」的规则冲突。我默认把主列表当作 P3R 的标志性例外保留，二级页严格遵守规则。
- **配色对比度**：亮水区上的 APPS、FILES 文字对比度不到 3:1，新版会把主列表下移，或者给文字加墨色描边。
- **托盘菜单**：DMS 的托盘菜单在 Top 层，会被菜单的 Overlay 层盖住，所以落地时要在菜单窗口里自己绘制托盘菜单（用 QsMenuOpener）。
