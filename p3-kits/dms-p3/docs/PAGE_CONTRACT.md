# 菜单页面契约（给写页面的人）

五个页面互不依赖。改页面时只动该页面的文件和它的 `pages/<name>/` 子目录；框架（`P3MenuWindow`、`P3Page`）、控件和 `P3Sys` 是所有页面共用的，改动要照顾到每个页面。

| 页面 | 文件 | 原型 |
|---|---|---|
| APPS | `overlay/Modules/P3/pages/AppsPage.qml` | `prototype/pages/apps.js` |
| STATUS | `overlay/Modules/P3/pages/StatusPage.qml` | `prototype/pages/status.js` |
| CALENDAR | `overlay/Modules/P3/pages/CalendarPage.qml` | `prototype/pages/calendar.js` |
| SYSTEM | `overlay/Modules/P3/pages/SystemPage.qml` | `prototype/pages/system.js` |
| POWER | `overlay/Modules/P3/pages/PowerPage.qml` | `prototype/pages/power.js` |

页面需要的样式类（原型里 `ap-*`、`st-*` 这类）在原型 JS 文件内的 `<style>` 里，照着移植成页面内部的 QML 组件即可。只给本页用的组件可以写成同一文件里的 `component Foo: Item { … }`；要拆文件就放到 `pages/<name>/` 子目录里，用 `import "<name>"` 引入。

- 子目录里必须有 `qmldir`，每个 QML 类型一行 `Foo Foo.qml`（不写版本号）。缺了它，Quickshell 下子目录里的类型找不到，页面加载失败（`Foo is not a type`）。
- JS 文件按路径导入（`import "<name>/util.js" as U`），不用写进 `qmldir`。
- 现状：`apps/`、`calendar/`、`status/`、`system/` 各有 `qmldir`；POWER 的组件都写在 `PowerPage.qml` 里，`power/` 只放按路径导入的 `Clip.js`。

## 1. 文件骨架

```qml
import QtQuick
import qs.Modules.P3      // P3（令牌）和所有 P3* 控件
import qs.P3Sys           // Apps、Net、Bt……（见第 5 节）

P3Page {
    id: page
    title: "STATUS"         // 页头的 P3 大字，框架负责画，页面里不要重复

    // 可选
    function handleKey(e) { return false }   // 每个按键先到这里；返回 true 表示已处理（关闭内层子页等）
    function handleRightClick(e) { return false }   // 右键，e = { x, y, item }；返回 true 表示已处理
    keyCapture: false                        // 录键时为 true：所有按键原样交给 handleKey（见第 3 节）
    onEntered: { }                           // 构建完成、成为当前页之后
    onLeaving: { }                           // 返回 / 切页、销毁之前（停定时器、removeRef）
    onFocusMoved: item => { }                // 焦点移到 item 之后

    // 正文：页面坐标 1410×680（舞台像素），超出部分被裁掉
}
```

- 页面在打开时创建，离开时销毁，状态不保留。要记住的东西（例如上次选中的标签）放在页面外：用 `P3Sys` 单例的属性，或 `~/.cache/p3/`。
- 舞台是 1920×1080 原型像素，整体 cover 缩放到屏幕。页面里一律用原型的像素值，不要自己乘缩放。
- 构建时 `P3_STILL=1` 等同原型的 `?static=1`：`page.ctx.still` 为 true 时不要做循环动画，直接显示终态。

## 2. ctx

`page.ctx` 在 `onEntered` 之前写入。页面离开后所有调用都是空操作，`focused()` 返回 null，晚到的定时器和 Promise 回调不会把焦点带回已关闭的页面。

| 调用 | 作用 |
|---|---|
| `ctx.back()` | 离开页面（等于顶层 Esc） |
| `ctx.focus(item)` | 把焦点移到 item，播放进入动画 |
| `ctx.focused()` | 当前焦点元素或 null |
| `ctx.refocus()` | 布局变了以后重新放置焦点指示（框架每 120ms 也会自查一次） |
| `ctx.run(promise, { revert, done })` | 统一处理动作结果：成功且 msg 非空时弹提示；失败时弹红色提示（中文 message）并调 `revert(err)`；`done(ok, r)` 总会调用。返回原 promise |
| `ctx.toast(text, bad)` | 直接弹一条提示 |
| `ctx.overlay` | 全舞台层：1920×1080 舞台坐标，盖住主列表、页面和日期，在提示条之下。页面把自己声明的元素挂上去（`curtain.parent = ctx.overlay`），元素随页面一起销毁。页面离开后为 null |
| `ctx.still` | 截图模式 |
| `ctx.live` | 本页是否仍是当前页 |

## 3. 焦点与按键（框架负责，页面只标记）

- 可聚焦 = 继承 `P3Focusable` 的元素（下面的 P3Row、P3Toggle、P3Slider、P3Button、P3Hold、P3Card 都是）。自定义控件写成 `P3Focusable { … }`。
- `↑↓←→` / `WASD` 按空间位置找最近的元素（主方向距离 + 3 × 侧向距离），和原型算法相同。被 `visible: false`、`opacity: 0`、`disabled: true` 或尺寸为 0 的元素会被跳过。
- `Enter` / `Space` / 单击 = `activated()`。不做 hover：鼠标只有单击才移动焦点。
- `Esc` / `Backspace` / 右键 / 左边没有元素时按 `←` = 返回。有内层子页的页面在 `handleKey` 里吞掉 `Qt.Key_Escape`。
- 右键先交给 `handleRightClick(e)`：`e.x` / `e.y` 是页面坐标，`e.item` 是指针下最上层的可聚焦元素（没有则为 null）。返回 true 表示已处理（例如在托盘格上右键打开它的菜单）；返回 false 时按返回处理，先以合成的 Escape 交给 `handleKey`（对象带 `synthetic: true`）。
- 带 Ctrl / Alt / Super 的按键平时被框架丢掉。页面 `keyCapture: true` 期间（录快捷键），所有按下——包括这些组合、单独的修饰键和自动重复——原样交给 `handleKey`，框架不做导航，松开全部吞掉；菜单窗口同时打开 `ShortcutInhibitor`，niri 的 Mod 组合也会送进来。录键结束时页面把 `keyCapture` 改回 false。右键在录键期间照常走上一条（页面可以在合成的 Escape 里取消录键）。
- 焦点元素在 `Flickable` / `ListView` 里时，框架会把它滚进可视区。
- 元素属性：
  - `cursor: "tide"`（默认）：左上角脉动的天蓝光点，文字变 `P3.fill`。
  - `cursor: "wedge"`：白色楔形垫底 + 红色残影，文字变 `P3.ink`。只给像主列表那样的竖排列表用，元素自身要透明。
  - `cursor: "none"`：框架只改 `focused` / `wob`，页面自己画。
  - `autofocus: true`：初始焦点，没有就取第一个。
  - `disabled: true`：跳过、不响应、半透明。
  - 只读：`focused`、`wob`（刚获得焦点的 380ms）、`pressed`（刚激活的 260ms）。
  - 颜色绑定：`fg`、`dimColor`、`trackColor`、`onColor`，按焦点和 cursor 模式算好，内部文字直接用。
  - `keyHandler: e => bool`：焦点在自己身上时先收到按键（滑块用它处理 ←→）。
  - 自己的 MouseArea 在 `onPressed` 里调 `requestFocus()`；`clickActivates: false` 关掉单击即激活。

## 4. 控件（`overlay/Modules/P3/`，字号和尺寸照原型 menu.css 的 PAGE PRIMITIVES）

| 控件 | 用法 |
|---|---|
| `P3` | 令牌单例：颜色 `deep sea sky fill ink tx c1..c5 dim line panel glass accent shard danger isl`，`P3.alpha(c, a)`；几何 `rowH 56 rowTallH 72 btnH 64 gap 28`；缓动 `P3.ease spring soft swoop exit`（给 `easing.type: Easing.BezierSpline; easing.bezierCurve: P3.ease`） |
| `P3Text { kind }` | `h1` 96 / `h2` 48 / `num` 64 / `numSm` 40（P3 展示字，只给名词和数字，行高 .86）；`sec label value meta unit chip`（Barlow Condensed，标签类自动大写）；`zh`（中文）。`lineBox: true` 时行盒和 CSS 一样，`baselineOffset` 与之一致，按盒顶摆放就和原型对齐：标签类默认开，盒高 = 字号（meta 1.1 倍），基线在盒顶下 .9em（meta .95em）；展示字默认关（盒高 1.36em、基线在盒顶下 1.011em），开了以后盒高 .86em、基线在盒顶下 .759em。页面里的展示字一般按 `y: <CSS 基线> - baselineOffset` 或 `anchors.baseline` 摆，两种都不受这个开关影响 |
| `P3Glyph { name; size; stroke; color }` | 24 网格线性图标，名字见 `P3Glyphs.js`（和原型 `P3Menu.GLYPHS` 相同） |
| `P3Sec { text }` | 分节标题 + 右侧细线（15px 行盒 + 下方 12px，共 27px） |
| `P3Row { icon; label; meta; value; chevron }` | 56px 行（有 meta 时 72px），默认子元素放到右侧 |
| `P3Toggle { checked; onToggled: v => … }` | 开关行，单击 / Enter 先翻转再发 toggled |
| `P3Switch { on; host }` | 单独的开关块 |
| `P3Slider { label; from; to; step; value; unit; onMoved: v => … }` | ←→、拖动、滚轮 |
| `P3Hold { label; icon; danger; holdMs; onConfirmed }` | 按住确认，危险动作专用 |
| `P3Button { label; icon; danger }` | 64px 平涂按钮 |
| `P3Bar { value; hot }` | 只读读数条（0..100） |
| `P3Chip { text; hot; ghost }` | 小标签 |
| `P3Card { padding }` | panel 底卡片（可聚焦） |

规则：只用 P3 蓝一套；除了框架的水下背景不用渐变；不写 hover；危险动作用 `P3Hold`。

## 5. P3Sys 单例（`overlay/P3Sys/`，`import qs.P3Sys`）

约定和原型 `backend.js` 一样：

- `X.state` 是只读快照，直接绑定。
- 动作返回 Promise：成功 `{ ok: true, msg }`（msg 为中文或 null），失败 `{ code, message }`。同时每个结果都发 `done(ok, msg, "ns.action")`。
- 交给 `page.ctx.run(...)` 处理提示和回滚。
- `changed()` 信号等同原型的 `P3Sys.on(ns, fn)`。
- 需要轮询的命名空间要引用计数：在 `onEntered` 里 `addRef()` 或 `const release = X.watch()`，在 `onLeaving` 里 `removeRef()` 或 `release()`。

| 单例 | state | 动作 / 函数 |
|---|---|---|
| `Apps` | `all`（`{id,name,icon,keys,entry}`）、`pinned`（`{TERMINAL,BROWSER,FILES}` → id）、`usage` | `byId(id)`、`ranked()`、`search(q)`（全部匹配，打分同 AppSearchService，不封顶；空串 = `ranked()`）、`iconSource(icon)`（`Paths.resolveIconPath`，再按名字变体和 desktop 条目回退，PipeWire 流名也能解析；找不到返回 `""`）、`matchName(name)`（流名 / 窗口名 → desktop 条目）、`launch(id)` |
| `Tray` | `items`（`{id,name,title,appId,icon,status,badge,needsAttention,item}`；`name` 是显示名，`appId` 是匹配到的应用）、`menus`（id → 条目） | `activate(id)`、`menu(id)` → Promise<`[{id,text,enabled,checked,sep,danger,hasChildren,buttonType,entry}]`>（`danger` = `/^(退出\|quit\|exit)/i`）、`probe(all)`、`trigger(id, entryId \| "quit")`、`triggerText(id, 正则)`（失败 `notfound` / `disabled`）、`itemOf(id)`、`trayOfApp(appId)` |
| `Clash` | `available, mode, node, nodes, group, sysproxy, sysproxyWritable, tun` | `addRef/removeRef`、`setMode(m)`、`setTun(on)`、`setNode(n)`、`setSysProxy(on)`（触发 Clash Verge 托盘菜单的「系统代理」，等 `verge.yaml` 变成目标值，最多 5 秒；失败 `unavailable` / `notfound` / `disabled` / `timeout`） |
| `Ime` | `available, im, list, trigger` | `addRef/removeRef`、`set(id)`、`setTrigger(k)`（`Mod` / `Keybinds.state.modSymbol` 换成真实的修饰键） |
| `Qq` | `available, presence, list`；`trayId` | `probe()`（读托盘菜单，按「退出 QQ」认定 QQ）、`set(p)` |
| `Stats` | `cpu, cpuTemp, gpuTemp, cpuGhz, cores, ram…, disk…, uptime, load, procs, down, up, cpuHist`（`gpuTemp` 取各 GPU 的最高温度，没有读数为 null） | `watch()` → release、`rate(bps)` 格式化 |
| `ProcList` | `list: [{pid,name,cpu,mem}]`、`sort` | `watch()`、`sort(k)`、`kill(pid, force)`（成功后 250ms 重新采样） |
| `Battery` | `available, pct, charging, plugged, remain, watts, health, limit, limitWritable, profile, profiles` | `setProfile(id)`、`setLimit`（需要 root，返回 unsupported） |
| `Power` | `supported: {lock,suspend,hibernate,logout,reboot,poweroff}`、`last`、`lid` / `lidExternal`（logind 的 `HandleLidSwitch*`，只读，没读到为 `""`） | `run(a)`，a 取 `lock suspend hibernate logout reboot poweroff restartShell`；`refreshLid()` |
| `Net` | `available, wifi, ssid, signal, ip, vpn, down, up, list, scanning, connecting`；`list` 每项带 `security`（WPA3 / WPA2 / WPA / OWE / WEP / 802.1X / OPEN）和 `band`（`2.4 GHZ` / `5 GHZ` / `6 GHZ` / `""`） | `setWifi`、`scan`、`connect(ssid, pw)`（密码错误时失败 code `auth`）、`disconnect`、`forget`、`submitCredentials`；信号 `credentialsNeeded` |
| `Bt` | `available, on, scanning, devices, busy` | `setPower`、`setScan`、`toggle(name)` |
| `Audio` | `vol, muted, mic, micMuted, sinks, sources, sink, source, streams`；另有 `sourceNode`、`micPeak`（0–100，不在 state 里） | `setVolume`、`setMuted`、`setMic`、`setMicMuted`、`setSink(i)`、`setSource(i)`、`setStream(id, v)`、`watchMic()` / `releaseMic()`（引用计数，有人监听且输入没静音时才测电平） |
| `Display` | `available, bright, night, temp, sched, monitors`（niri 没给输出时取 `Quickshell.screens`） | `setBrightness`、`setNight`、`setTemp`、`setSchedule(i)` |
| `Mode` | `dnd, dndUntil, caffeine` | `setDnd(on, minutes)`、`setCaffeine(on)` |
| `Settings` | `{ <原型 UI 键>: UI 值 }`（不含 `lid`，合盖动作读 `Power.state.lid`） | `set(k, v)`、`describe(k, v)`；勿扰时间段的定时器在这个文件里 |
| `Rules` | `{ <appName>: level }` | `set(app, level)` |
| `Keybinds` | `list: [{key,key0,label,cmd}]`、`modKey`、`modSymbol`（默认 `Super` / `Mod`） | `watch()`、`rebind(old, new)`、`resetAll()` |
| `Autostart` | `list: [{id,name,icon,on,path}]` | `refresh()`、`set(id, on)` |
| `Update` | `available, count, running, checking, checked, error` | `watch()`、`check()`、`run()` |
| `Defaults` | `{browser,files,term,music}`（`options[role]` 里的下标） | `set(role, i)`（term 只读） |
| `Notify` | `items, dnd, unread, apps`（发过通知的应用 `[{app, icon}]`，新的在前，存在 `~/.cache/p3/notify-apps.json`） | `dismiss`、`clearAll`、`activate`、`invoke`、`markSeen`、`setDnd`；信号 `newItem` |
| `Media` | `available, title, artist, art, playing, pos, len, player, players, idx, canNext, canPrev` | `playPause`、`next`、`previous`、`cyclePlayer` |
| `Calendar` | `available, loading, error`；另有 `holidays`、`lastFrom` / `lastTo`、`solarFest` | `day(date)` → `{key,lunar,term,fest,off,work,holiday}`（同步，12 月 20 日起同时查下一年的节假日）、`lunar(date)`、`loadHolidays(y)`、`events(from, to)` → Promise<`{ "YYYY-MM-DD": [{start,end,title,allDay}] }`>（串行；失败 code `unavailable` / `offline` / `timeout` / `failed`）、`slice(from, to)`（同步，取已加载的）；信号 `pushed()`：日程变了或后端刚连上，页面重读 `lastFrom`..`lastTo` |
| `About` | `host, kernel`（第一次用到时跑 `uname -nr`） | `refresh()` |
| `Clock` | `now, h, m, month, day, dow, dowZh, tod` | 每分钟更新 |

每个文件头的注释写了对应的 DMS 2.0 Service 调用和缺口，字段细节以文件为准。

## 6. 自测

```sh
./build.sh --dest /tmp/p3build-x
P3_CHECK_DIR=/tmp/p3check-x P3_IPC="p3menu open status" P3_SHOT=/tmp/p3shots/status.png scripts/qmlcheck.sh /tmp/p3build-x 5
```

- `qmlcheck.sh` 在无头 sway 里跑（虚拟输出 HEADLESS-1，1920×1080，`grim` 截图），自带 dbus 会话和临时的 XDG 目录，不碰正在运行的 DMS，也不在桌面上开窗口。不要为了测试启动嵌套 niri。
- 几个检查并行跑时，每个用自己的 `P3_CHECK_DIR`。
- 输出里只要出现 P3 文件的警告或错误（`@Modules/P3/…`、`@P3Sys/…`），就必须修掉。壁纸、缓存文件、`TrayMenuManager`、portal 这几类上游警告是沙箱造成的，可以忽略。
- 无头会话没有 niri、没有键盘、没有 DMS 后端（`DMS_SOCKET` 未设置），依赖它们的读数显示为空态；托盘、MPRIS、通知也是独立 dbus 里的空列表。
- 自测只读：不要调用会改系统状态的动作（Wi-Fi、蓝牙、音量、亮度、夜间模式、快捷键、自启动、电源动作、结束真实进程）。
- 截图只存 `/tmp`，不要提交图片。

### 截图模式与直达子层

环境变量会传进无头会话，和 `P3_IPC` 一起用。

| 变量 | 作用 |
|---|---|
| `P3_STILL=1` | 截图模式（`ctx.still`）：不做循环动画，直接显示终态。所有页面通用 |
| `P3_SYSTEM_VIEW=<视图>` | SYSTEM 打开时的视图：`network` `bluetooth` `sound` `display` `mode` `more`，或 `more:<input\|keys\|look\|power\|notify\|general>` |
| `P3_SYSTEM_FOCUS=N` | SYSTEM：进入当前视图的详情并聚焦第 N 个可聚焦元素（从 0 数） |
| `P3_POWER_SEL=N` | POWER（这三个只在 `P3_STILL=1` 时读）：焦点放到第 N 项（0..5 = LOCK SLEEP LOGOUT REBOOT OFF SHELL） |
| `P3_POWER_HOLD=0..1` | POWER：焦点项停在这个按住进度 |
| `P3_POWER_CONFIRM=1` | POWER：落下焦点项的确认幕布，不执行动作 |
| `P3_CAL_DAY=YYYY-MM-DD` | CALENDAR：选中并聚焦这一天，翻到它所在的月 |

```sh
P3_STILL=1 P3_SYSTEM_VIEW=more:keys P3_CHECK_DIR=/tmp/p3check-keys P3_IPC="p3menu open system" P3_SHOT=/tmp/p3shots/keys.png scripts/qmlcheck.sh /tmp/p3build-x 5
```

新页面要有子层时照这个办法：变量名用 `P3_<页面>_<名字>`，只在页面里用 `Quickshell.env()` 读，只摆状态、不执行动作，并补到上表。
