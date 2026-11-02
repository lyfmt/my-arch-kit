# dms-p3 → DMS 2.0 接入说明

目标：把 `menu-x.html`（全屏菜单）和 `island-b.html`（顶栏灵动岛）移植成 `dms-p3` 里的 QML。dms-p3 和 dms-p5 并列，是独立的补丁包，不在 dms-p5 上改。
基线版本是系统里的 **dux-shell / dms 2.0.0**，源码在 tag v2.0.0 的 `quickshell/` 目录。

**状态：已按本文接入完成。** QML 在 `overlay/`（菜单 `Modules/P3/`、灵动岛 `Modules/P3/Island/`、系统接口 `P3Sys/`），补丁在 `patches/`，安装见 `../AGENTS.md`。本文保留为原型 ↔ DMS 2.0 的对照表；每个 `P3Sys` 单例的文件头写了它实际用的 Service 调用和剩下的缺口，以文件为准。

## 1. 原型里已经准备好的部分

- `shared/backend.js` 定义 `window.P3Sys`，是原型唯一的系统接口。页面不持有假数据，也不拼命令字符串。
  - `P3Sys.<ns>.state`：同步快照，对应 QML 里 Service 的属性绑定。
  - `P3Sys.<ns>.<action>()`：返回 Promise，结果是 `{ok,msg}` 或 `P3Error{code,message}`，对应 Service 的函数调用。
  - `P3Sys.on(ns, fn)`：变化事件，对应属性的 changed 信号。
  - 每个 action 的 JSDoc 写了 `@dms`，即 2.0 里对应的 Service 函数和 `dms ipc call …`。DMS 没有接口的写成 `@gap`，并给出实现办法。
- mock 实现
  - 延迟：`?lat=ms`。
  - 失败注入：`?fail=net.connect,bt.connect,calendar.events,…`。
  - 内置失败场景：Wi-Fi 密码填 `wrongpass` 报认证失败；连接 `MX Master 3` 报无响应；强制结束 pid ≤ 1000 的进程被拒绝。
  - `?static=1` 时零延迟，没有实时 tick，截图结果稳定。
- 页面已处理加载中、出错回滚、禁用和确认这几种状态。QML 端照做即可。

移植时一个 namespace 对应一个 QML 单例 `P3Sys/<Ns>.qml`。它是对 DMS Service 的薄封装，
负责把 2.0 的属性名转成原型用的字段，并把异步结果统一成 `done(ok,msg)` 信号。这样页面 QML 可以照搬 JS 的结构。

## 2. 映射表

| P3Sys | DMS 2.0 | 调试命令 |
|---|---|---|
| apps.ranked / launch | `AppSearchService.searchApplications(q)`、`AppUsageHistoryData.getRankedApps()`、`SessionService.launchDesktopEntry(entry)` + `addAppUsage` | `dms ipc call spotlight openQuery <q>` |
| tray.* | `SystemTray.items`、`item.activate()`、`QsMenuOpener{menu:item.menu}` | `dms ipc call tray list / activate <id> / menu <id>` |
| proc.* / stats.* | `DgopService` 的属性；用 `addRef/removeRef` 引用计数控制轮询；`setSortBy`；结束进程用 `Process ["kill","-15"/"-9",pid]`（同 ProcessContextMenu.qml） | `dms ipc call processlist toggle` |
| battery.setProfile | `PowerProfileWatcher.applyProfile(id)` | `dms ipc call powerprofile set balanced` |
| power.run | `SessionService.suspend/logout/reboot/poweroff`；锁屏走 `lock`（之后由 P3 锁屏接管，原型和接入说明见 `p3-kits/p3-lock/`） | `dms ipc call lock lock`、`dms restart` |
| net.* | `NetworkService.toggleWifiRadio / scanWifi / connectToWifi / disconnectWifi / forgetWifiNetwork`；结果看 `currentWifiSSID`、`connectionError`、`passwordDialogShouldReopen`；企业网走 `credentialsNeeded` → `submitCredentials` | `nmcli` |
| bt.* | `BluetoothService.setBluetoothEnabled / pairDevice / connectDeviceWithTrust`，`adapter.discovering` | `bluetoothctl` |
| audio.* | `AudioService.setVolume / setSink / setSource`，`sink.audio.muted`；单个应用的音量用 `Pipewire.nodes` 里 `isStream && isSink` 的节点 + `PwObjectTracker` | `dms ipc call audio setvolume 50`、`dms ipc call mic mute` |
| display.* | `DisplayService.setBrightness(pct, device, true)`；`NightModeService.enableNightMode/disableNightMode`；`SettingsData.nightModeAutoEnabled/StartHour/EndHour/Temperature` | `dms ipc call brightness set 60`、`dms ipc call night toggle` |
| mode.setDnd | `SessionData.setDoNotDisturb(on, min, "p3menu")` | `dms ipc call notifications toggleDoNotDisturb`、`enableDoNotDisturbFor 60` |
| mode.setCaffeine | `SessionService.toggleIdleInhibit()`（先比较 `idleInhibited`） | `dms ipc call inhibit toggle` |
| settings.set | `SettingsData.set(key, v)`；键名对应见 backend.js 里的 `SET` 表，`settings.describe(k)` 可以直接查。输入相关的键会触发 `updateCompositorInput()`，写入 niri 的输入配置 | `dms ipc call settings set fontScale 1.1` |
| rules.set | `SettingsData.notificationRules`，规则按 appName exact 匹配 | `dms ipc call settings get notificationRules` |
| keybinds.* | `KeybindsService.getFlatBinds / saveBind / resetBind`，写 `~/.config/niri/dms/binds.kdl` | `dms ipc call keybinds …` |
| autostart.set | 照 `AutoStartTab.qml`：`~/.config/autostart/<id>.desktop`，用 `Hidden=` 开关 | |
| update.* | `SystemUpdateService.checkForUpdates / runUpdates / availableUpdates` | `dms ipc call systemupdater …` |
| notify.* | `NotificationService.notifications / dismissNotification / clearAllNotifications`，点击时调用 action 的 `invoke()` 并聚焦窗口 | `dms ipc call notifications clearAll` |
| media.* | `MprisController.activePlayer` 的 playPause/next/previous；`Mpris.players` 用于切换播放器 | `dms ipc call mpris playPause` |
| calendar.events | `CalendarService.loadEvents(from,to)`、`getEventsForDate` | |
| clock | `SystemClock { precision: Minutes }` | |

## 3. 缺口（DMS 2.0 没有接口）

| 功能 | 做法 | 现状 |
|---|---|---|
| 勿扰时间段 | p3 自己的 `Timer`，每分钟检查一次时间，调用 `SessionData.setDoNotDisturb(on,0,"p3-schedule")`；手动操作过就跳过当天这一段 | 已实现（`P3Sys/Settings.qml`，时段存 `~/.cache/p3/settings.json`） |
| 合盖动作 | 用 pkexec 写 `/etc/systemd/logind.conf.d/50-p3.conf` 的 `HandleLidSwitch=`，然后 `systemctl kill -s HUP systemd-logind`。需要 polkit 规则 | 只读：`P3Sys/Power.qml` 从 logind 读 `HandleLidSwitch` / `HandleLidSwitchExternalPower`；写入要 root，未做 |
| 充电上限 | 写 `/sys/class/power_supply/BAT0/charge_control_end_threshold`。用 udev 规则给用户组写权限，或者 `tlp setcharge`。同时写入 `SettingsData.batteryChargeLimit` | 只读（`P3Sys/Battery.qml`）；写入要 root，未做 |
| 单个应用的提示音 | DMS 只有全局 `soundsEnabled`。「仅弹窗」级别要在播放提示音前查 p3 自己的静音名单（要补一个小补丁） | 名单记在 `~/.cache/p3/silent-apps.json`；`NotificationService` 的补丁未做，「仅弹窗」目前仍有提示音 |
| fcitx5 输入法 | `Process ["fcitx5-remote","-s",id]`，读取用 `-n`；切换键写 `~/.config/fcitx5/config` 的 `[Hotkey/TriggerKeys]`，再 `fcitx5-remote -r` | 已实现（`P3Sys/Ime.qml`） |
| Clash | mihomo 控制接口：`PATCH /configs {"mode"}`、`{"tun":{"enable"}}`、`PUT /proxies/<组>`。端口和 secret 从 Clash Verge 的 `config.yaml` 读 | 已实现（`P3Sys/Clash.qml`）。系统代理：状态读 `verge.yaml`，切换触发 Clash Verge 托盘菜单的「系统代理」条目 |
| QQ 在线状态 | 没有接口。在托盘菜单里找文字匹配的项来触发，找不到就隐藏这一行 | 已实现（`P3Sys/Qq.qml`）：按托盘菜单里的「退出 QQ」认定 QQ；当前状态只能是最后一次设置的值 |
| 默认应用 | `xdg-settings set default-web-browser`、`xdg-mime default <desk> inode/directory / audio/*`。2.0 的 `defaultApp` IPC 只能打开面板 | 已实现（`P3Sys/Defaults.qml`）；终端没有 xdg 标准，只读 |
| 节假日 / 调休 | 读 holiday-cn 的 `<year>.json`，缓存到 `~/.cache/p3/` | 已实现（`P3Sys/Calendar.qml`）：2007 年到明年；空表 1 天、今年及以后 7 天重取，取失败保留缓存；12 月 20 日起同时查下一年 |
| 农历 | Qt 不带中国历法。把 `Intl zh-CN-u-ca-chinese` 生成的 1900–2100 年表打包 | 已实现：`scripts/mklunar.js` 生成 `P3Sys/lunar.js`（1900–2100） |

## 4. 新增 IPC 与按键

在 overlay 里加一个 `IpcHandler { target: "p3menu" }`：

- `toggle()`
- `open(page)`：page 可以是 `apps|status|calendar|system|power`
- `close()`
- `status()`

niri 绑定：`Mod+Z { spawn "dms" "ipc" "call" "p3menu" "toggle"; }`。
菜单窗口用 `PanelWindow` + `WlrLayershell.layer: Overlay` + `keyboardFocus: Exclusive`，铺满聚焦的那块屏幕。

## 5. 灵动岛：island-b ↔ `Modules/DIsland`

2.0 里灵动岛是 `Modules/DIsland`，顶栏是 `Modules/DBar`。
活动 id 有：home、media、notification、notificationcenter、controlcenter、launcher、powermenu、clipboard、wallpaper，外加 system 系列。

| island-b 状态 | DIsland Activity |
|---|---|
| 平时（时钟 / 电量） | HomeCompact |
| 播放中的胶囊 | MediaCompact；展开是 MediaExpanded |
| 新通知卡片 | NotificationCompact → NotificationExpanded（数据来自 `IslandNotificationSource`） |
| 通知中心 | NotificationCenterExpanded |
| 音量 / 亮度 OSD | SystemLevelCompact / SystemLevelExpanded（数据来自 `IslandSystemSource`） |
| 勿扰 / 保持唤醒提示 | SystemStateCompact |

调试命令：`dms ipc call island show notificationcenter`、`island open media`、`island close`、`island cycle`、`island status`。
实现没有另起窗口，岛的窗口、多屏和拖动沿用 DMS：`IslandController` 的补丁按 `P3IslandLayout.js` 给出气泡串的目标尺寸，`DIslandSurface` 的补丁把上表这些 Activity 换成空面，内容由 `Modules/P3/Island/P3IslandLayer` 画。详见 `docs/ISLAND_PLAN.md`。

## 6. dms-p3 包结构（照 dms-p5 的做法，基线直接用 v2.0.0）

- 结构照 `dms-p5/`：`patches/`（`BASE_VERSION` 写 v2.0.0）、`overlay/`、`build.sh`、`enable.sh`、`disable.sh`、`scripts/`。构建产物放 `~/.local/share/dms-p3/shell`，niri 用 `dms run -c <该目录>` 启动。
- `scripts/qmlcheck.sh` 在无头 sway 里自测（虚拟 1920×1080 输出），不开嵌套 niri。
- DMS 2.0 的 UI 启动时会迁移 `settings.json`（`configVersion` 18 → 42），1.6.3 的 UI 读不了迁移后的文件。`enable.sh` 第一次启用时存一份原样，`disable.sh` 停掉 DMS 后写回。
- 2.0 的路径和 1.6.3 不同：`Modules/DankIsland/*` 改成了 `Modules/DIsland/*`（`DIslandSurface`、`DIslandHostWindow`），`Modules/DankBar/*` 改成了 `Modules/DBar/*`，`IslandSatelliteHost.qml` 没有了（由 `IslandBarHost` / `IslandContentHost` 取代）。dms-p5 的补丁不能直接参考行号。
- `p3menu` 的 `IpcHandler` 和菜单窗口放在 `overlay/` 里。
- dms-p5 和 dms-p3 都改 DMS 的同一批文件，只能启用一个。`enable.sh` 要先检查另一个是否启用中。
- 重启时只用 `dms restart`，或者带锚定路径的 pkill（`pkill -f 'qs -p .*/dms-p3/shell'`）。不要用宽泛的 `pkill qs`，kanban 和 music 两个 qs 实例还在跑。

## 7. 接入顺序与剩余工作

构建脚本、`P3Sys` 单例、灵动岛和五个菜单页都已完成。灵动岛没有逐个改 Activity，而是给 `DIslandSurface` 和 `IslandController` 打补丁、内容画在 `P3IslandLayer` 里，见 `docs/ISLAND_PLAN.md`。

剩下的是第 3 节里需要 root 的部分（合盖动作写入、充电上限写入）和单个应用提示音的上游补丁。这些要单独确认，不能顺手做。
