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

- layer-shell `Bottom` 层（壁纸之上、普通窗口之下），namespace `p3lyrics`，`mask: Region {}` 点击穿透，`keyboardFocus: None`。
- 只盖住屏幕下半部分（舞台 y ≥ 480）；舞台按 1920×1080 设计，等比缩放到屏幕，主句右缘 / 底边贴在舞台 (1800, 844)。
- **只显示在一块屏幕上**：`P3LYRICS_SCREEN`（输出名）> 启动时 niri 聚焦的屏幕；运行中用 IPC `screen <名字>` / `here` 换屏。多屏同时显示两份一样的歌词意义不大，所以没做。

### 和原型的差别（只在原型没覆盖的情况）

- 真歌词没有手写 `|`：主句超过 980 舞台像素时按宽度均分成最多 3 行（英文只在空格断，中日文优先在标点/空格断）。
- 暂停：头 20s 冻结 + 整层变暗（同原型 Space）；超过 `P3LYRICS_IDLE` 秒（默认 20，`0` 不隐藏）沉下留空，继续播放时当前句重新入场。启动时没在播也不显示。
- 停播 / 没歌词 / 纯音乐 / 后端断开 / IPC hide：当前句按切歌方式（260ms）顺浪沉下。
- 拖进度（与本地插值相差 > 1s）当作原型的跳句（`seek`：k = .6、不出红浪）。
- 日文判定按整首歌（歌名或任一句有假名就用 Noto Sans CJK JP），避免汉字句换字形。
- 没有 L / B 键：主题、浅色用环境变量 `P3LYRICS_THEME=lavender`、`P3LYRICS_BG=light`。
- 没有移植 reduced-motion 分支（原型里 `RM.matches` 时只做 180/140ms 整块淡入淡出）：Quickshell 下没有对应的系统信号，始终跑完整的浪。

### 文件

```
shell/                       → ~/.config/quickshell/p3lyrics/
├── shell.qml                PanelWindow、选屏、暂停隐藏、IPC
├── LyricsLayer.qml          舞台缩放 + #lyr 原点 + 帧驱动
├── Engine.js                动效引擎（index.html <script> 的移植：时间轴、浪、入场/退场、翻译开关）
├── Glyph.qml / Msk.qml      一个字（.g）/ 一行的水面裁切（.msk + .in）
├── Wave.qml + shaders/      水线 + 浪刃（ShaderEffect，改 wave.frag 后 qsb --qt6 重编）
├── Music.qml                只读 socket 客户端 + 演示模式
├── Theme.qml                颜色 token、字体
├── Demo.js                  演示模式的三首假歌（照搬 index.html）
├── capture.qml              截帧调试用，不安装
└── assets -> ../assets      字体
test/fake-musicd.py          假后端（同协议），按脚本暂停/跳转/切歌/无歌词
niri/p3lyrics.kdl            自启 + Mod+Alt+K 显示/隐藏、Mod+Alt+T 翻译
install.sh                   复制到 ~/.config/quickshell/p3lyrics（已存在先备份）
```

### 依赖

`quickshell-git`（Qt ≥ 6.9）、`niri`、`noto-fonts-cjk`、`music/` 组件（后端在跑才有歌词）。

### 安装

1. `p3-kits/p3-lyrics/install.sh`
2. 接入 niri：复制 `niri/p3lyrics.kdl` 到 `~/.config/niri/`，`config.kdl` 追加 `include "p3lyrics.kdl"`；先 `grep -rn 'Mod+Alt+K\|Mod+Alt+T' ~/.config/niri/` 确认没被占；`niri validate`。
3. 本次会话手动启动：`qs -c p3lyrics -d`

### 卸载 / 回滚

1. 停实例：`qs kill -c p3lyrics`
2. niri：删掉 `config.kdl` 里的 `include "p3lyrics.kdl"` 行，`rm ~/.config/niri/p3lyrics.kdl`，再 `niri validate`。
3. 配置目录：彻底移除用 `rm -r ~/.config/quickshell/p3lyrics`；回到上一个版本则把 install.sh 留下的最新备份放回去：`rm -r ~/.config/quickshell/p3lyrics && mv "$(ls -d ~/.config/quickshell/p3lyrics.bak-* | sort | tail -1)" ~/.config/quickshell/p3lyrics`，然后 `qs -c p3lyrics -d`。

### IPC

```sh
qs ipc -c p3lyrics call p3lyrics toggle | show | hide | trans
qs ipc -c p3lyrics call p3lyrics screen HDMI-A-1   # 换屏；here = 当前聚焦的屏
qs ipc -c p3lyrics call p3lyrics status            # JSON：shown / online / playing / song / lines / screen
```

### 环境变量

`P3LYRICS_SCREEN`、`P3LYRICS_IDLE`、`P3LYRICS_TRANS=0`（默认关翻译）、`P3LYRICS_HIDDEN=1`（启动时隐藏）、`P3LYRICS_THEME=lavender`、`P3LYRICS_BG=light`、`P3LYRICS_SOCK`（换 socket）、`P3LYRICS_DEMO=1`（不连后端，循环三首假歌；`P3LYRICS_DEMO_SONG`、`P3LYRICS_DEMO_T` 选歌和起点）。

### 验证

```sh
qs list --all                                   # 有 p3lyrics 实例
qs ipc -c p3lyrics call p3lyrics status         # online: true，播放中 lines > 0
niri msg layers | grep -A2 p3lyrics             # Bottom layer、Keyboard interactivity: none
# 不连真播放器：
test/fake-musicd.py /tmp/p3lyr-fake.sock '4:pause,6:play,9:seek=11,14:nolyric,14.5:next' &
P3LYRICS_SOCK=/tmp/p3lyr-fake.sock qs -p p3-kits/p3-lyrics/shell
# 后端不在：日志里不应出现 quickshell.io.socket 警告，启动 fake-musicd 后几秒内 online 变 true
P3LYRICS_SOCK=/tmp/p3lyr-none.sock qs -p p3-kits/p3-lyrics/shell
# 截帧（普通窗口，舞台坐标与 index.html 一致，图写到 /tmp/p3lyr-cap-*.png）：
P3LYRICS_DEMO=1 P3LYRICS_DEMO_SONG=1 P3LYRICS_DEMO_T=10.6 P3LYRICS_SHOTS=1,2,4 qs -p p3-kits/p3-lyrics/shell/capture.qml
```

`QT_QPA_PLATFORM=offscreen` 下 ShaderEffect 不渲染（水线、浪刃看不到），截帧要在 Wayland 下跑。重启：`qs kill -c p3lyrics && qs -c p3lyrics -d`。

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
