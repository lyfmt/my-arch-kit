# p3-lyrics — P3 风格桌面歌词（RIPTIDE 定稿）

桌面歌词。`index.html` 是浏览器里的定稿原型（原创假歌）；`shell/` 是按它移植的 Quickshell 版，作为独立实例 `qs -c p3lyrics` 运行，只读接入 `music/` 的后端，显示正在播放的真歌词。独立组件，不依赖 `p5-reference/`：字体在 `assets/fonts/`（来源与许可证见 `assets/fonts/README.md`），双击即可打开。

> **仓库不上传图片。** `.gitignore` 排除了本目录下所有 png/jpg/webp/gif：背景 `assets/bg.png`、`shots/` 截图、`drafts/` 草稿截图都只在本地。新 clone 没有背景图时页面照常运行，只是落在纯色底上（`#bg` 加载失败会自动移除）；要预览原背景，把 `p5-reference/p3-miku/bg.png`（或任意 16:9 壁纸）复制成 `assets/bg.png`。新增截图也不要提交。

## 动效（RIPTIDE）

- 一次只显示一句 + 翻译；主句右缘对齐 x=1800，底边 y≈844，翻译紧贴水线下方、右缘缩进 .6em。
- 水线 = 主句最后一行的裁切边，1.2px 平涂细线常驻（opacity .18）。
- **第一道浪（入场）**：浪刃从左边远处冲过整句、越过右缘，浪峰经过的字从水下浮起并停在前倾 -6°。
- **第二道浪（停留 + 退场）**：入场结束后出发，从左往右走过水线，速度按本句剩余时长算，提前留出最后一个字沉完的时间。浪峰到哪个字，那个字被顶起 → 落回 → 沉进水下。翻译字跟随正上方的主句字，晚 80ms、顶起更小。整句沉完后下一句隔 40ms 入场。
- 跳句 / 切歌 / 第二道浪还没走完时，用原有的顺浪方向逐字沉下退场。
- `--red`：快歌里的单词短句（连续拍点只红第一句）；静默之后第一句的入场浪刃。
- 行间隔 < 1.2s 不出第二道浪；行后间隔 ≥ 6s 视为间奏，停留 4.2s 后沉下留空。
- 按 T 开翻译：浪离翻译 < 560ms 或已沉时不加，从下一句开始显示；浪还在路上则加入后随浪沉下。


## QML 版（shell/）

**状态：已移植，可安装。** 动效常量、判定、时序与 `index.html` 逐项一致（入场浪、停留浪、红色规则、间奏、跳句/切歌、翻译开关、暂停冻结）。

### 数据来源

只读连 `$XDG_RUNTIME_DIR/music-card.sock`（`music/` 的 `musicd.py`）。musicd 接受多个客户端，连上即推 `snapshot`，之后广播 `track` / `status` / `pos` / `lyric`；歌词行 `{t, text, trans}`，翻译来自网易云 `tlyric`，已经在 `merge_lyric()` 里合进来，**不用改 music**。p3lyrics 从不发命令。断开后（启动时也一样）每 1.5s 用 `test -S` + `stat` 看 socket 文件：不存在就不连，music 没起时日志是干净的。musicd 退出时不删 socket 文件，留下的旧文件连不上：对同一个文件（inode + mtime 不变）每次失败间隔翻倍，最长 30s；musicd 重启会重新 bind 出新文件，看到新文件立刻重连。旧文件上的每次失败都有一行 `WARN quickshell.io.socket: ... ConnectionRefusedError`（前 2 分钟约 7 行，之后每分钟 2 行）；后端退出那一刻还有一行 `PeerClosedError`。这些都属预期。

### 窗口

- layer-shell `Overlay` 层（所有窗口之上，全屏窗口也盖不住），namespace `p3lyrics`，盖满整块屏幕（`exclusionMode: Ignore`，可以放到任意位置，包括顶栏上）。
- 平时 `mask` 是空区域（点击穿透）、`keyboardFocus: None`；关着、或者没有要显示的句子（停播、暂停超时、句子全部沉完）时整个面板不映射，不挡全屏窗口的直接扫描输出。
- 舞台按 1920×1080 设计，等比缩放到屏幕。歌词原点 = 主句右缘 / 底边所贴的点：默认在舞台 (1800, 844)；拖过以后用屏幕宽高的比例记位置（换分辨率 / 换屏仍在相对同一处）。缩放 0.5–2× 作用在整块上（主句、翻译、水线、浪），动效不变。
- 原点可以拖到屏幕任意处；某一句（多行、带翻译）越出屏幕时只把这一句往里挪，离边缘至少 12px；放大到一行放不下屏幕宽度时按屏幕宽度收窄换行宽度。
- **只显示在一块屏幕上**：`P3LYRICS_SCREEN`（输出名）> 启动时 niri 聚焦的屏幕；运行中用 IPC `screen <名字>` / `here` 换屏。多屏同时显示两份一样的歌词意义不大，所以没做。

### 开关与调整（music 卡片的「词」按钮）

没有系统快捷键，也不在歌词上放任何按钮、把手、提示字。入口只有 music 卡片底部工具栏的「词」（`music/shell/LyricsButton.qml`）：

- **左键**：开 / 关（`qs ipc -c p3lyrics call p3lyrics -- show` / `hide`）。p3lyrics 实例没在跑时先 `qs -n -c p3lyrics -d` 拉起再调用。开着时按钮是 primary 色字 + 淡色圆底。按钮状态读 `state.json`（文件监视），并在工具栏出现、鼠标移上去、每次操作后、工具栏显示期间每 5s 用 `status` 确认实例还在；实例不在按「关」显示。
- **右键 / 长按**：进入调整模式（IPC `adjust`，再调一次退出）。不改变开关：关着时调整完句子会沉下去。

调整模式：

- 面板临时接收这块屏幕上的全部指针（`mask: null`），键盘 `Exclusive`（进入即可用 Esc，不用先点一下）。
- 显示一句停着不动的样句（不出第二道浪）：进入时刚唱过的那句，还没开始唱就用第一句，没有歌词时用演示歌第一句；不管在播、暂停、间奏还是关着。退出后回到正常显示。
- 唯一的标记：水线提亮并缓慢呼吸；鼠标在句子上是张开的手，拖动时是握拳。
- 在句子上（外框四周多 16px）按住拖动 = 移动；滚轮（任意位置）= 缩放，每格 ×1.1，0.5–2×；双击句子 = 复位到默认位置和 1×；方向键微调 2px（Shift 20px）；`+` / `-` 缩放；`T` 翻译开关。
- 结束：Esc / Enter、右键、在句子以外的地方按下（这次点击被吃掉）、8s 没有任何操作。

### 状态文件

`$XDG_STATE_HOME/p3lyrics/state.json`（默认 `~/.local/state/p3lyrics/state.json`），启动时读，改动后 250ms 写回（原子写），music 卡片只读：

```json
{"enabled": true, "trans": true, "x": 0.62, "y": 0.31, "scale": 1.33}
```

`enabled` 没有记录时为 false（装好后默认不显示，点「词」才开）；`x` / `y` 是原点在屏幕上的比例，`null` = 默认位置。环境变量 `P3LYRICS_HIDDEN=1|0`、`P3LYRICS_TRANS=0|1` 在启动时覆盖记录（并写回）。

### 和原型的差别（只在原型没覆盖的情况）

- 真歌词没有手写 `|`：主句超过 980 舞台像素时按宽度均分成最多 3 行（英文只在空格断，中日文优先在标点/空格断）。
- 暂停：头 20s 冻结 + 整层变暗（同原型 Space）；超过 `P3LYRICS_IDLE` 秒（默认 20，`0` 不隐藏）沉下留空，继续播放时当前句重新入场。启动时没在播也不显示。
- 停播 / 没歌词 / 纯音乐 / 后端断开 / 关掉：当前句按切歌方式（260ms）顺浪沉下。
- 拖进度（与本地插值相差 > 1s）当作原型的跳句（`seek`：k = .6、不出红浪）。
- 日文判定按整首歌（歌名或任一句有假名就用 Noto Sans CJK JP），避免汉字句换字形。
- 没有 L / B 键：主题、浅色用环境变量 `P3LYRICS_THEME=lavender`、`P3LYRICS_BG=light`。
- 没有移植 reduced-motion 分支（原型里 `RM.matches` 时只做 180/140ms 整块淡入淡出）：Quickshell 下没有对应的系统信号，始终跑完整的浪。

### 文件

```
shell/                       → ~/.config/quickshell/p3lyrics/
├── shell.qml                PanelWindow（Overlay、映射 / 输入区域 / 键盘）、选屏、暂停隐藏、状态文件、IPC
├── LyricsLayer.qml          舞台缩放 + 原点 / 缩放 + 帧驱动 + 调整模式的拖动 / 滚轮 / 按键
├── Engine.js                动效引擎（index.html <script> 的移植：时间轴、浪、入场/退场、翻译开关）+ 越界内移、调整模式样句
├── Glyph.qml / Msk.qml      一个字（.g）/ 一行的水面裁切（.msk + .in）
├── Wave.qml + shaders/      水线 + 浪刃（ShaderEffect，改 wave.frag 后 qsb --qt6 重编）
├── Music.qml                只读 socket 客户端 + 演示模式
├── Theme.qml                颜色 token、字体
├── Demo.js                  演示模式的三首假歌（照搬 index.html）
├── capture.qml              截帧调试用，不安装
└── assets -> ../assets      字体
test/fake-musicd.py          假后端（同协议），按脚本暂停/跳转/切歌/无歌词
niri/p3lyrics.kdl            自启（不绑快捷键）
install.sh                   复制到 ~/.config/quickshell/p3lyrics（已存在先备份）
```

### 依赖

`quickshell-git`（Qt ≥ 6.9）、`niri`、`noto-fonts-cjk`、`music/` 组件（后端在跑才有歌词；开关和调整入口在卡片工具栏的「词」按钮，需要带 `LyricsButton.qml` 的卡片）。

### 安装

1. `p3-kits/p3-lyrics/install.sh`
2. 接入 niri：复制 `niri/p3lyrics.kdl` 到 `~/.config/niri/`，`config.kdl` 追加 `include "p3lyrics.kdl"`；`niri validate`。
3. music 卡片要带「词」按钮：`music/shell/LyricsButton.qml` + `Toolbar.qml`（见 `music/AGENTS.md`）。
4. 本次会话手动启动：`qs -n -c p3lyrics -d`（不启动也行，第一次点「词」会自己拉起）。默认是关的，点「词」打开。

### 卸载 / 回滚

1. 停实例：`qs kill -c p3lyrics`
2. niri：删掉 `config.kdl` 里的 `include "p3lyrics.kdl"` 行，`rm ~/.config/niri/p3lyrics.kdl`，再 `niri validate`。
3. 配置目录：彻底移除用 `rm -r ~/.config/quickshell/p3lyrics`；回到上一个版本则把 install.sh 留下的最新备份放回去：`rm -r ~/.config/quickshell/p3lyrics && mv "$(ls -d ~/.config/quickshell/p3lyrics.bak-* | sort | tail -1)" ~/.config/quickshell/p3lyrics`，然后 `qs -n -c p3lyrics -d`。

### IPC

```sh
qs ipc -c p3lyrics call p3lyrics toggle | hide | trans
qs ipc -c p3lyrics call p3lyrics -- show           # show 和 `qs ipc show` 子命令同名，要加 --
qs ipc -c p3lyrics call p3lyrics adjust            # 进入 / 退出调整模式
qs ipc -c p3lyrics call p3lyrics reset             # 位置、大小复位
qs ipc -c p3lyrics call p3lyrics screen HDMI-A-1   # 换屏；here = 当前聚焦的屏
qs ipc -c p3lyrics call p3lyrics status            # JSON：shown / trans / adjusting / x / y / scale / online / playing / song / lines / idleHidden / mapped / box / screen
```

`box` 是当前句在屏幕上的外框 `[x, y, w, h]`（像素），`mapped` 是面板此刻是否映射。

### 环境变量

`P3LYRICS_SCREEN`、`P3LYRICS_IDLE`、`P3LYRICS_TRANS=0|1`、`P3LYRICS_HIDDEN=1|0`（启动时覆盖状态文件里的翻译 / 开关）、`P3LYRICS_THEME=lavender`、`P3LYRICS_BG=light`、`P3LYRICS_SOCK`（换 socket）、`P3LYRICS_DEMO=1`（不连后端，循环三首假歌；`P3LYRICS_DEMO_SONG`、`P3LYRICS_DEMO_T` 选歌和起点）。

### 验证

```sh
qs list --all                                   # 有 p3lyrics 实例
qs ipc -c p3lyrics call p3lyrics status         # online: true，播放中 lines > 0；开着且在唱时 mapped: true
niri msg layers | grep -B1 -A3 p3lyrics         # 只在映射时出现：Overlay 层、Keyboard interactivity: none（调整模式里是 exclusive）
cat ~/.local/state/p3lyrics/state.json          # 点「词」/ 拖动 / 缩放后跟着变
# 不连真播放器、不动真状态文件（会开一个歌词面板，在无头 sway 里跑更稳妥）：
test/fake-musicd.py /tmp/p3lyr-fake.sock '4:pause,6:play,9:seek=11,14:nolyric,14.5:next' &
XDG_STATE_HOME=/tmp/p3lyr-state P3LYRICS_HIDDEN=0 P3LYRICS_SOCK=/tmp/p3lyr-fake.sock qs -p p3-kits/p3-lyrics/shell
# 后端不在：日志里不应出现 quickshell.io.socket 警告，启动 fake-musicd 后几秒内 online 变 true
XDG_STATE_HOME=/tmp/p3lyr-state P3LYRICS_SOCK=/tmp/p3lyr-none.sock qs -p p3-kits/p3-lyrics/shell
# 截帧（普通窗口，舞台坐标与 index.html 一致，图写到 /tmp/p3lyr-cap-*.png）：
P3LYRICS_DEMO=1 P3LYRICS_DEMO_SONG=1 P3LYRICS_DEMO_T=10.6 P3LYRICS_SHOTS=1,2,4 qs -p p3-kits/p3-lyrics/shell/capture.qml
# P3LYRICS_ZOOM=1.5 看缩放后的整块
```

`QT_QPA_PLATFORM=offscreen` 下 ShaderEffect 不渲染（水线、浪刃看不到），截帧要在 Wayland 下跑。重启：`qs kill -c p3lyrics && qs -n -c p3lyrics -d`（开关、位置、大小、翻译从状态文件恢复）。

## 原型操作 / 调试

| 键 | 作用 |
| --- | --- |
| Space | 暂停（所有动画冻结） |
| T | 翻译开关 |
| N | 下一首 |
| ← / → | 上一句 / 下一句 |
| L | p3 / lavender 主题 |
| B | 深 / 浅背景 |

也接受 `postMessage({cmd})`（pause/trans/song/lineNext/linePrev/theme/bg），`window.__lyr` 读状态。
URL 参数：`?song=0|1|2`（中 / 日+中 / 英+中）、`?t=秒`、`?slow=倍数`、`?bg=light`、`?theme=lavender`、`?trans=0`。reduced-motion 时只做整块淡入淡出。

## 设计规则（用户定的）

- 只有字：不要背景、楔形、面板、色块、小标签。
- 字是平涂：无描边、阴影、发光、模糊、渐变；不做逐字 / 卡拉 OK 填充。
- 字形贴合 p3-shell（中日 Noto Sans CJK Bold，英文 P3 斜体展示字），不要 Noto Black + skewX。
- 可读性靠位置和颜色；`--red` 少用。

## 文件

- `index.html` — 定稿原型。
- `shell/`、`test/`、`niri/`、`install.sh` — QML 版，见上文。
- `shots/` — 定稿截图（仅本地，不进 git）（入场、浪峰、停留、日文、双行英文、浅色、lavender、红色拍点、暂停、双语沉下）。
- `assets/` — `bg.png` 背景（仅本地）、`fonts/`（Nunito Sans 900 italic 展示字、Barlow Condensed Bold）。
- `drafts/` — 历次方案的 HTML 存档，资源引用 `../../../p5-reference/`（只是存档，需要仓库里有 p5-reference 才能正常显示）。草稿截图同样不进 git：
  - `drafts/index.html` + `variants/` — 第一轮（edge / wedge / tide / free）
  - `drafts/v2/` — slab / stagger / tilt
  - `drafts/v3/` — rise / slide / surface（选中 SURFACE）
  - `drafts/v4/` — swell / waterline / ripple（加浪）
  - `drafts/v5/` — a STAGGER / b GLINT / c RIPTIDE（选中 c，即定稿的来源；`c.html` 与定稿只差资源路径）
