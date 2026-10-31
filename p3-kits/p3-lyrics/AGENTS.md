# p3-lyrics — P3 风格桌面歌词（RIPTIDE 定稿）

桌面歌词的视觉 / 动效原型，只做外观和动效，之后接 `music/`。纯静态单文件 `index.html`，歌词全是原创假歌。独立组件，不依赖 `p5-reference/`：字体在 `assets/fonts/`（来源与许可证见 `assets/fonts/README.md`），双击即可打开。

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

## 操作 / 调试

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

- `index.html` — 定稿。
- `shots/` — 定稿截图（仅本地，不进 git）（入场、浪峰、停留、日文、双行英文、浅色、lavender、红色拍点、暂停、双语沉下）。
- `assets/` — `bg.png` 背景（仅本地）、`fonts/`（Nunito Sans 900 italic 展示字、Barlow Condensed Bold）。
- `drafts/` — 历次方案的 HTML 存档，资源引用 `../../../p5-reference/`（只是存档，需要仓库里有 p5-reference 才能正常显示）。草稿截图同样不进 git：
  - `drafts/index.html` + `variants/` — 第一轮（edge / wedge / tide / free）
  - `drafts/v2/` — slab / stagger / tilt
  - `drafts/v3/` — rise / slide / surface（选中 SURFACE）
  - `drafts/v4/` — swell / waterline / ripple（加浪）
  - `drafts/v5/` — a STAGGER / b GLINT / c RIPTIDE（选中 c，即定稿的来源；`c.html` 与定稿只差资源路径）
