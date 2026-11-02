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
| `ctx.close()` | 关闭整个菜单。启动应用、激活窗口、打开终端这类会出现新窗口的动作先调它，再执行动作 |
| `ctx.edit(item)` | 把焦点移到输入框 item（`textEntry: true`）并进入输入，例如选了要密码的 Wi-Fi 后的密码框 |
| `ctx.focus(item)` | 把焦点移到 item，播放进入动画 |
| `ctx.focused()` | 当前焦点元素或 null |
| `ctx.refocus()` | 布局变了以后重新放置焦点指示（框架每 120ms 也会自查一次） |
| `ctx.run(promise, { revert, done })` | 统一处理动作结果：成功不弹提示（结果由控件自己的状态体现）；失败时弹红色提示（中文 message）并调 `revert(err)`；`done(ok, r)` 总会调用。返回原 promise |
| `ctx.toast(text, bad)` | 直接弹一条提示 |
| `ctx.overlay` | 全舞台层：1920×1080 舞台坐标，盖住主列表、页面和日期，在提示条之下。页面把自己声明的元素挂上去（`curtain.parent = ctx.overlay`），元素随页面一起销毁。页面离开后为 null |
| `ctx.still` | 截图模式 |
| `ctx.live` | 本页是否仍是当前页 |

## 3. 焦点与按键（框架负责，页面只标记）

- 可聚焦 = 继承 `P3Focusable` 的元素（下面的 P3Row、P3Toggle、P3Slider、P3Button、P3Hold、P3Card 都是）。自定义控件写成 `P3Focusable { … }`。
- `↑↓←→` / `WASD` / `h j k l` 按空间位置找最近的元素（主方向距离 + 3 × 侧向距离），和原型算法相同。被 `visible: false`、`opacity: 0`、`disabled: true` 或尺寸为 0 的元素会被跳过。
- `Enter` / `Space` / 单击 = `activated()`。
- `Esc` / `Backspace` / 右键 / 左边没有元素时按 `←`（`h`）= 返回。有内层子页的页面在 `handleKey` 里吞掉 `Qt.Key_Escape`。`q` 不绑定。
- vim 键由框架在 `handleKey` 之前翻译，页面和 `keyHandler` 照方向键处理即可：

  | 键 | 作用 |
  |---|---|
  | `h` `j` `k` `l` | ← ↓ ↑ →。到达页面时是 `Qt.Key_Left/Down/Up/Right`，`text` 为空，带 `vim: true`、`synthetic: true` |
  | `Ctrl+h/j/k/l`、`Ctrl+n` / `Ctrl+p` | 同上（↓ / ↑），在输入状态下也是方向键：从搜索框进结果用它们 |
  | `g g` / `G` | 第一个 / 最后一个 |
  | `Ctrl+d` / `Ctrl+u` | 下 / 上半页（可滚动区域的半个可视高度，没有滚动区域时半个页面高） |
  | `l` / `Enter` / `Space` | 进入、激活（和 `→` / `Enter` 原有的含义相同） |

  - 主列表：`j` `k` 换项，`g g` / `G` 第一项 / 最后一项，`l` 打开。
  - `g g` / `G` / `Ctrl+d` / `Ctrl+u` 先以 `{ key: Qt.Key_unknown, text: "", motion: "first" | "last" | "halfDown" | "halfUp" }` 交给 `handleKey`；页面有自己的含义时处理掉返回 true（SYSTEM 分类栏按分类走，CALENDAR 是本月第一天 / 最后一天和翻月），返回 false 时框架沿焦点所在的列走（只在和焦点元素水平重叠的元素里找）。页面里判断按键的代码要放过 `e.motion`，或者先处理它。
  - 单独一个 `g` 等第二个键 1 秒：等来的不是 `g`（或超时）时，先把 `g` 当普通按键交给页面，所以 APPS 里输入以 g 开头的名字照常搜索。
  - 输入是 vim 式的：不在输入时字母不输入，`h j k l` 照常移动。
    - 输入框（焦点元素 `textEntry: true`）拿到焦点时不在输入；`i`（先于 `handleKey`，由框架处理）、单击或页面调 `ctx.edit(item)` 进入输入，元素的 `editing` 变为 true；输入时 `Esc` 由框架退出输入（不交给页面，焦点留在框上），焦点移走也退出。页面判断字母要不要进框时看 `focused.editing`。
    - 页面 `textEntry: true`（APPS 搜索的输入状态）由页面自己切换：APPS 应用区 `i` / `/` 开始搜索，`Esc` 停到结果里，结果里 `i` / `/` 回到输入。
    - 输入状态（页面 `textEntry` 或输入框 `editing`）：`h j k l g G` 都是字母，原样交给 `handleKey`；带 Ctrl 的方向键和半页照常。
- 指针：真实的指针移动把焦点移到指针下最上层的可聚焦元素，用的是同一套焦点指示和进入动画（`wob`），没有单独的 hover 样式；单击照常激活。
  - 主列表（没有打开页面时）指针移到项上只选中、不打开；打开页面后左边的列表不跟指针。
  - 只认真实移动：内容在静止的指针下面滚动、翻页、重排时焦点不动；按过键以后，指针要再移动 6px 以上才重新接管，键盘从当前焦点继续。
  - 指针跟随不滚动 `Flickable`（焦点元素只在可视部分里换）；焦点元素被滚出可视区时光点隐藏。
  - 按住 Enter / Space、鼠标按键按下、录键（`keyCapture`）期间不跟指针。
  - 指针下面最上层是一个启用的左键 `MouseArea`（例如菜单打开时挡住下层点击的遮罩）而它不在可聚焦元素里时，焦点不动。
  - 页面不用做任何事；`disabled` 的元素不接指针。
- 右键先交给 `handleRightClick(e)`：`e.x` / `e.y` 是页面坐标，`e.item` 是指针下最上层的可聚焦元素（没有则为 null）。返回 true 表示已处理（例如在托盘格上右键打开它的菜单）；返回 false 时按返回处理，先以合成的 Escape 交给 `handleKey`（对象带 `synthetic: true`）。
- 带 Ctrl / Alt / Super 的按键（除了上面翻译的 Ctrl 组合）平时被框架丢掉。页面 `keyCapture: true` 期间（录快捷键），所有按下——包括这些组合、单独的修饰键和自动重复——原样交给 `handleKey`，框架不做导航，松开全部吞掉；菜单窗口同时打开 `ShortcutInhibitor`，niri 的 Mod 组合也会送进来。录键结束时页面把 `keyCapture` 改回 false。右键在录键期间照常走上一条（页面可以在合成的 Escape 里取消录键）。
- 焦点元素在 `Flickable` / `ListView` 里时，框架会把它滚进可视区。
- 元素属性：
  - `cursor: "tide"`（默认）：左上角脉动的天蓝光点，文字变 `P3.fill`。
  - `cursor: "wedge"`：白色楔形垫底 + 红色残影，文字变 `P3.ink`。只给像主列表那样的竖排列表用，元素自身要透明。
  - `cursor: "none"`：框架只改 `focused` / `wob`，页面自己画。
  - `autofocus: true`：初始焦点，没有就取第一个。
  - `disabled: true`：跳过、不响应点击和指针、半透明。
  - `textEntry: true`：输入框（搜索框、密码框），`i` / 单击 / `ctx.edit` 进入输入后字母才是输入，见上面的 vim 键。整页都在输入时用页面的 `textEntry`（APPS 的搜索）。
  - 只读：`editing`（输入框是否在输入）。
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

规则：只用 P3 蓝一套；除了框架的水下背景不用渐变；不写单独的 hover 样式（指针跟随由框架移动焦点）；危险动作用 `P3Hold`；`WheelHandler` 要写 `acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad`（Wayland 上滚轮事件常被标成 TouchPad 设备，默认只收 Mouse 会收不到），按 `angleDelta.y` 累计满 120 算一格。

## 5. P3Sys 单例（`overlay/P3Sys/`，`import qs.P3Sys`）

约定和原型 `backend.js` 一样：

- `X.state` 是只读快照，直接绑定。
- 动作返回 Promise：成功 `{ ok: true, msg }`（msg 为中文或 null），失败 `{ code, message }`。同时每个结果都发 `done(ok, msg, "ns.action")`。
- 交给 `page.ctx.run(...)` 处理失败提示和回滚（成功的 msg 不显示）。
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
- 无头会话没有 niri、没有 DMS 后端（`DMS_SOCKET` 未设置），依赖它们的读数显示为空态（KEYBINDS 列表也是空的）；托盘、MPRIS、通知也是独立 dbus 里的空列表。没有真键盘和真指针，需要输入时用下面的 `P3_INPUT`。
- 自测只读：不要调用会改系统状态的动作（Wi-Fi、蓝牙、音量、亮度、夜间模式、快捷键、自启动、电源动作、结束真实进程）。PipeWire 和系统总线（NetworkManager、BlueZ、logind、power-profiles）连的是真机：`P3_INPUT` 里不要在这些控件上按 Enter / Space、点击、←→ / h l、滚轮，POWER 页不要按住。DMS 自己的设置写在临时的 XDG 目录里，可以动。
- `ipc p3menu focus` 返回当前焦点：`closed`、`list <页>`（主列表），或 `<页> <名字> @x,y wxh [typing] [tide]`（页面坐标；`typing` = 字母是输入）。
- 截图只存 `/tmp`，不要提交图片。

### 输入（`P3_INPUT`）

`P3_INPUT` 在 `P3_IPC` 之后，在无头 sway 里用虚拟键盘和虚拟指针（`scripts/vinput.c`，qmlcheck 自动编译）依次发输入，`;` 分隔，每步之后等 `P3_STEP` 秒（默认 0.3）。结果（含 `ipc` 步骤的返回值）在输出的「输入」一节和 `$P3_CHECK_DIR/input.log`。

| 步骤 | 作用 |
|---|---|
| `key <键>` | 按一下：`j`、`G`（= `shift+g`）、`ctrl+d`、`esc`、`enter`、`space`、`backspace`、`slash`、`tab`、`up` … |
| `down <键>` / `up <键>` | 只按下 / 只松开 |
| `type <文字>` | 逐个字符按键 |
| `ptr <x> <y>` | 指针分 4 步滑到输出坐标（1920×1080），像真实移动 |
| `warp <x> <y>` | 指针一步跳过去（测 6px 阈值、静止指针） |
| `click [right]`、`press [right]`、`release [right]` | 鼠标按键 |
| `wheel <n>` | 滚轮 n 格，正数向下 |
| `ipc <target fn …>` | 调一次 IPC，返回值记进日志 |
| `shot <路径>` / `sleep <秒>` | 截图 / 等待 |

```sh
P3_CHECK_DIR=/tmp/p3check-x P3_IPC="p3menu toggle" \
P3_INPUT="key j;ipc p3menu focus;key g;key g;ipc p3menu focus;ptr 1250 520;ipc p3menu focus;key l;sleep 1.5;shot /tmp/p3shots/x.png" \
    scripts/qmlcheck.sh /tmp/p3build-x 3
```

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
