# p3-lock — P3R 风格锁屏（HTML 原型 + QML 版）

Persona 3 Reload 风格锁屏，用来替换 `p5lock`。`index.html` 是定稿的浏览器原型（纯静态、离线，双击即可）；`shell/` 是按原型移植的 QML 版，作为独立锁屏进程（`qs -n -c p3lock`）由 DMS 的 Custom Lock Command 拉起。背景（bg 图 + 光束 + 焦散 + 气泡 + 视差）最初从 `p5-reference/p3-shell/shared/shell.js` 复制而来。

**现状：QML 移植完成，已安装到 `~/.config/quickshell/p3lock/` 并接入 DMS：`settings.json` 的 `customPowerActionLock` 指向 `~/.config/quickshell/p3lock/p3lock.sh`，真锁屏已测试。** 改回 p5lock 时把这一项换回 p5lock 的脚本；改用户配置前先确认。

## 文件

| 路径 | 说明 |
| --- | --- |
| `index.html` / `lock.css` / `lock.js` | 定稿原型。`lock.js` 只管画面和按键 |
| `backend.js` | `window.P3Lock`：用户名、密码校验、电源、Caps Lock、解锁的唯一入口（mock），每项标了 QML 里的对应实现 |
| `INTEGRATION.md` | DMS 2.0 锁屏入口（已核实）、原型 ↔ QML 映射、解锁转场分段、包结构、接入顺序 |
| `shell/` | QML 版锁屏，文件分工见 `INTEGRATION.md` 第 5 节。`shell.qml` 真锁屏入口，`demo.qml` 窗口预览 |
| `shell/p3lock.sh`、`shell/pam/p3lock` | 启动脚本和 PAM 配置（照 p5lock） |
| `shell/shaders/water.frag` | 光束 + 焦散着色器；改完要 `/usr/lib/qt6/bin/qsb --qt6 -o water.frag.qsb water.frag` |
| `shell/assets` | 指向 `../assets` 的符号链接，让仓库里能直接跑 `qs -p shell/demo.qml` |
| `install.sh` | 复制到 `~/.config/quickshell/p3lock/`，已存在的先备份成 `p3lock.bak-<时间>`。不需要 sudo |
| `assets/` | 字体（进 git，许可证见 `assets/fonts/README.md`；QML 用 ttf，woff2 只给原型）、`bg.png`（不进 git） |
| `drafts/`、`shots/` | 草稿和截图 |

> **仓库不上传图片。** `.gitignore` 排除了本目录下所有 png/jpg/webp/gif。新 clone 缺背景时页面落在纯色底上；要还原，把 `p5-reference/p3-miku/bg.png` 复制成 `assets/bg.png`。新增截图也不要提交。

## 安装与验证

```sh
./install.sh                                       # → ~/.config/quickshell/p3lock/
qs -p ~/.config/quickshell/p3lock/demo.qml         # 窗口预览，不锁屏
```

- **不需要 /etc/pam.d**：`PamContext.configDirectory` 读安装目录下的 `pam/p3lock`（已实测，p5lock 同理）。
- demo 调试变量：`P3LOCK_SIZE=1920x1080`、`P3LOCK_STATE=idle|typing|verify|error|power|caps|unlock`、`P3LOCK_CAPS=1`、`P3LOCK_FAIL=maxtries|autherror`。
- 自动走一遍所有状态并截图：`mkdir -p /tmp/p3shot && P3LOCK_SIZE=1920x1080 P3LOCK_SHOT=/tmp/p3shot qs -p shell/demo.qml`（目录要先建好，否则不出图）（`P3LOCK_SCRIPT=minute` 只测分钟落字）。没有显示器时加 `QT_QPA_PLATFORM=offscreen`。截图别提交。
- 真锁屏测试（`~/.config/quickshell/p3lock/p3lock.sh`）之前先准备好 TTY 退路，见 `INTEGRATION.md` 第 6 节末尾TTY 里没有 `WAYLAND_DISPLAY`，要写成 `WAYLAND_DISPLAY=wayland-1 ~/.config/quickshell/p3lock/p3lock.sh`（起不来就换 `p5lock/p5lock.sh`）。
- `pam/p3lock` 缺失或读不到时 `PamContext.start()` 返回 false，界面显示 `AUTH ERROR`，可以重试（不会卡在 VERIFYING）。

## 操作

| 按键 | 作用 |
| --- | --- |
| 任意键 / 明显的鼠标移动 / 点击 | 从待机唤醒（第一个字符直接算输入） |
| 字符 / `Backspace` | 输入 / 删一位 |
| `Esc`、`Ctrl+U` | 清空；密码为空时 `Esc` 回到待机 |
| `Enter` | 提交 → VERIFYING（至少 700ms）；原型 / demo 里输入 `fail` 失败、其他任意值解锁；真锁屏走 PAM |
| `Tab`（或点右下角电源图标） | 电源菜单：`↑↓`/`Tab`/悬停选择，`Enter`/点击执行，`Esc` 或点空白处返回 |
| `L`（已解锁时，仅原型 / demo） | 重新锁定 |

电源：挂起立即执行；重启、关机要再按一次 Enter（项目文字变成 `REBOOT?`，红字 `AGAIN TO CONFIRM`）。原型和 `demo.qml` 只打日志 `[demo] systemctl …`；`shell.qml` 直接 `systemctl`。QML 版没有 `L` 重新锁定（demo 里有）。
20 秒无操作回到待机并清空密码。

## 原型调试参数

`?static`（关动画）、`?theme=lavender`、`?state=idle|typing|verify|error|power|caps|unlock`。
mock 后端：`?user=` `?host=`、`?caps`、`?lat=ms`（校验延迟）、`?fail=auth|maxtries|autherror|power`（注入失败）。截图在 `shots/`。

## 设计规则

- 不放任何面板 / 卡片 / 底框。所有元素挂在同一条左缘 x=1010、宽 820 的版心上，Miku 和左半屏不碰。
- 字号只有三档：时钟 312px、用户名 44px（电源词 48px）、标签 14–22px。展示字 `.d` 只给数字和名词，其余是 `.l` 直立标签，中文用 Noto Sans CJK。
- 唯一渐变 = 背景水。唯一的斜元素 = 电源选中项的白楔 + 红碎片 + 红残影。
- 每个状态只有一处强调色：错误时线和点变红，电源确认时只有提示行变红，CAPS LOCK 只在开启时出现。
- 不放按键说明小字。电源图标只在用鼠标时浮现在水位线右下，一按键盘就隐藏。
- 密码框就是一条 2px 水位线；电源菜单替换密码块的位置，不另开弹层。
- 动效：入场依次上浮、画线；每个字落到线上并荡开波纹；删字上浮消失；验证时亮段沿线往返；错误时抖动 → 变红 → 下沉；分钟变化时只有变化的数字落入；解锁 = 上浮出水（光束变亮、气泡涌出、水下层下沉、桌面从上方降下）。全部是 transform / opacity / clip-path，方便移植 QML。

## 草稿（`drafts/`，保留作对比，资源引用 `../../assets/`）

| 目录 | 一句话 |
| --- | --- |
| `a-surface/` | 右侧单列 + 大时钟 + 水位线密码，上浮解锁。**定稿的底子** |
| `b-column/` | 沿 P3R 主菜单斜排一列词，楔形在行间滑动；结构最像游戏，但斜排 + 斜楔叠在一起偏乱 |
| `c-quiet/` | 待机只剩一个时钟，唤醒后缩小上移；分钟落字动画被采纳 |
| `d-wedge/` | 密码框本身是白楔；楔形常驻显得像一块悬浮矩形，解锁白/红闪屏偏刺眼 |
