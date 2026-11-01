# p3-lock 接入 DMS 2.0

目标：和 `p5lock` 一样做成独立的一次性 Quickshell 进程（`qs -n -c p3lock`），由 DMS 2.0（dux-shell 2.0.0）的 Custom Lock Command 拉起。不改 DMS 源码，不依赖 dms-p3 补丁包；dms-p3 和 dms-p5 哪个启用都能用。

## 1. DMS 2.0 的锁屏入口（已对照 `/usr/bin/dms` 内嵌 QML 核实）

- `Modules/Lock` 的 `lock()`：`customPowerActionLock` 非空时调 `spawnCustomLocker()`，即 `Quickshell.execDetached(["sh", "-c", customPowerActionLock])`，然后 `IdleService.dismissFadeToLock()`，DMS 自己不再建 `WlSessionLock`。
- 走到 `lock()` 的入口：`dms ipc call lock lock`、DMS 界面的锁屏按钮、空闲超时锁屏、`lockAtStartup`、开启 loginctl 集成后的 `loginctl lock-session`（`handleLoginctlCustomLock`，`customLockerSpawned` 防重复，`SessionUnlocked` 时清零）。
- **不管用的入口**：`lockBeforeSuspend` 等的是 DMS 自己的 `IdleService.isSessionLockSecure`，自定义锁屏不会让它变 true，所以 DMS 发起的挂起会等到超时兜底才执行。需要“先锁再挂起”时用 `p3lock.sh --wait && systemctl suspend`（niri 绑定，同 p5lock）。
- `lock lockAndOutputsOff`：同上，依赖 DMS 自己的 session lock，自定义锁屏下关屏不会触发。
- DMS 不检查自定义命令是否成功。脚本错了 = 按锁屏什么都不发生、屏幕没锁。

系统 `~/.config/DankMaterialShell/settings.json` 的 `customPowerActionLock` 已指向 `~/.config/quickshell/p3lock/p3lock.sh`；换回 p5lock 的脚本即还原。

## 2. 原型 ↔ QML 映射

原型里 `backend.js`（`window.P3Lock`）就是 QML 里 `shell.qml` 根对象要提供的东西；`lock.js` 对应 `LockScene.qml`，只通过下面这些接口和系统打交道。

| 原型 `P3Lock` | QML 实现（照 `p5lock/shell/shell.qml`） |
| --- | --- |
| `state.user` | `Quickshell.env("USER")` |
| `state.host` | `FileView { path: "/etc/hostname" }` |
| `state.caps` + `on('caps')` | `ls -d /sys/class/leds/*::capslock` 一次，`FileView` 每 300ms 读 `brightness` |
| `auth.submit(pw)` | `PamContext { configDirectory: Quickshell.shellDir + "/pam"; config: "p3lock" }`，`responseRequired` 时 `respond(password)` |
| 拒绝码 `denied` / `maxtries` / `error` | `PamResult.Failed` / `MaxTries` / `Error`，状态行文字 `WRONG PASSWORD` / `TOO MANY TRIES` / `AUTH ERROR` |
| VERIFYING 至少 700ms | `lock.js` 里的 `settle()`；QML 里同样等 `max(0, 700 - 已用时)` 再出结果 |
| `power.run(a)` | `Quickshell.execDetached(["systemctl", a])`。不调 DMS `SessionService`（它会弹确认框，且 DMS 可能没在跑） |
| `release()` | `lock.locked = false`；`rm -f $XDG_RUNTIME_DIR/p3lock.secure`；overlay 播完后半段动画 → `Qt.quit()` |
| `state.secure` | `WlSessionLock.onSecureChanged` 为 true 时 `touch` 标记文件（`p3lock.sh --wait` 等它） |
| `relock()`、按 `L` | 原型专用。真实实现里重新上锁 = DMS 再次拉起进程 |
| 20 秒回到待机 | `Timer`，在 `Session.qml` 里 |
| 电源图标只在用鼠标时显示 | `HoverHandler` / `MouseArea.hoverEnabled`，键盘事件时隐藏 |

## 3. 解锁转场（两段）

`body.up` 的动画按时间分两段，切点 450ms，和 p5lock 的“锁屏表面铺满 → 解除锁定 → overlay 继续”同构：

1. **0–450ms，锁屏表面**：UI 上浮淡出、光束变亮、焦散加强、一次性气泡涌出。
2. **450ms 起，overlay**：`release()` 解除 session lock，`WlrLayer.Overlay` 的 `PanelWindow`（`keyboardFocus: None`，`mask: Region {}`）画出同一帧画面，然后水下层下沉 1080px + 放大 1.12，露出真实桌面（原型里的 `#desk` 占位在 QML 里不需要）。
3. 兜底：PAM 成功后 1.5s 还没 `release()` 就强制解除（同 p5lock）。

overlay 第一帧必须和锁屏表面最后一帧一致，否则解除锁定时会闪一下。背景、光束、气泡做成一个 `Underwater.qml`，锁屏表面和 overlay 共用（对应 p5lock 的 `StripeCover.qml`）。

## 4. 主题与资源

- 背景图：`assets/bg.png`（不进 git）。QML 里先固定用它；之后可选读 DMS `session.json` 的壁纸（p5lock 的 `Theme.wallpaperFor`）。
- 配色：原型是 P3 蓝 + `?theme=lavender`。和 dms-p3 一致只保留 P3 蓝，`Theme.qml` 单例写死色值，不跟 matugen。
- 字体：woff2 Quickshell 用不了，见 `assets/fonts/README.md`。中文用 Noto Sans CJK。
- 舞台按 1920×1080 设计、cover 缩放、窄屏靠右对齐：QML 里用一个 1920×1080 的 `Item` + `scale`，`x` 按同样公式偏移。
- 动效只用 transform / opacity / clip，对应 `Behavior` / `NumberAnimation` / `layer` 遮罩；`feTurbulence` 焦散改成预渲染贴图或 `ShaderEffect`。

## 5. 包结构（已移植）

```
shell/                 → ~/.config/quickshell/p3lock/（install.sh 复制）
├── shell.qml          入口：WlSessionLock、解锁 overlay、450ms 交接、1.5s 兜底
├── Session.qml        状态与系统接口（= backend.js + lock.js 里与画面无关的部分）：PAM、Caps Lock、电源、20 秒回待机
├── LockScene.qml      单块屏幕的画面 + 键盘鼠标；interactive: false 时给 overlay 用
├── Underwater.qml     背景 / 光束 / 焦散 / 气泡 / 视差 / 下沉，锁屏表面与 overlay 共用
├── PowerMenu.qml      电源三项（白楔 + 红碎片 + 红残影）
├── StatusLine.qml     状态行（换字时右移淡入）
├── Digit.qml          时钟的一位数字（分钟变化落字）
├── Delayed.qml        transition-delay 的替代
├── Theme.qml          色值、字体（FontLoader）、CSS 缓动曲线
├── demo.qml           普通窗口预览，不锁屏、不碰 PAM / systemctl，带自动截图脚本
├── shaders/water.frag(.qsb)  光束 + 焦散（替代 feTurbulence）
├── assets/            仓库里是指向 ../assets 的符号链接；安装时复制成实体（bg.png、两个 ttf）
├── p3lock.sh          启动脚本
└── pam/p3lock         PAM 配置，与 p5lock 相同
```

**和原型的差别**：画面上的动画都按墙钟算（`Session.epoch` / `upStart`），锁屏表面和 overlay 是两个 `LockScene` 实例，同一时刻画的是同一帧；密码颗粒只在锁屏表面上（overlay 接手时 UI 已经淡出）。原型的 `#desk` 占位桌面不需要：overlay 在水面亮线以上把 deep 裁掉，露出的就是真实桌面。

**PAM 不需要 /etc/pam.d**：`PamContext.configDirectory` 指向 `shellDir/pam`，Quickshell 的 PAM 子进程直接从这个目录读 `p3lock`（已用错误密码实测：日志 `Starting pam session ... with config "p3lock" in dir ".../pam"`，结果 `Failed`）。p5lock 也是这样，`/etc/pam.d` 里没有 p5lock / p3lock。

## 6. 接入顺序

1. 写 `demo.qml` + `LockScene.qml`，在普通窗口里对齐原型截图（`shots/`）。
2. 写 `shell.qml`（照抄 p5lock 的骨架，改名 p3lock），`qs -c p3lock` 手动测上锁 / 解锁 / 错误密码。
3. 把 `customPowerActionLock` 改成 `~/.config/quickshell/p3lock/p3lock.sh`，测第 1 节列的入口。**这一步改用户配置，先确认再做。**
4. 可选：niri 绑定 `p3lock.sh --wait && systemctl suspend`，替换 p5lock 的同名绑定。

测试时注意：ext-session-lock 下锁屏进程在解锁前崩溃，合成器会保持锁定。先在 `demo.qml` 里调完，真锁前准备好 TTY 退路。TTY 登录的 shell 里没有 `WAYLAND_DISPLAY`，必须手动指定，否则新起的 qs 连不上 niri；只杀锁屏进程不会解锁，必须再起一个能用的锁屏去解锁：

```sh
# Ctrl+Alt+F3 登录后；图形会话的 socket 是 $XDG_RUNTIME_DIR/wayland-1（以 ls $XDG_RUNTIME_DIR 为准）
pkill -f 'qs -n -c p3lock'
WAYLAND_DISPLAY=wayland-1 ~/.config/quickshell/p3lock/p3lock.sh
# p3lock 本身起不来时，换已验证可用的 p5lock 解锁：
WAYLAND_DISPLAY=wayland-1 ~/.config/quickshell/p5lock/p5lock.sh
# 然后 Ctrl+Alt+F2（或 niri 所在的 VT）回到图形会话输入密码
```
