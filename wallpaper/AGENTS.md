# wallpaper — 壁纸切换覆盖层

替代原来的 kitty 壁纸选择器（`~/.local/bin/wallpaper-picker`）。常驻后台，按 `Mod+Y`（或 `Mod+Alt+W`）在**当前聚焦的显示器**上弹出一排 P3 风格的壁纸卡片，再按一次收起。

没有窗口、没有自己的背景：透明全屏覆盖层直接叠在桌面上。中间一张大卡，两侧逐级缩小到细条，整排沿 -6.5° 的轴线排开。

## 功能

- `←` `→` / `H` `L` / 滚轮：切换。快速连按时位置弹簧最多领先 3 张，标题在切换中隐藏，停稳后再淡入。
- `Enter` / `Space` / 点击中间卡片：设为当前显示器的壁纸（`dms ipc call wallpaper setFor`），覆盖层照常收起，新壁纸由 DMS 自己淡入。成功后不弹提示，失败时顶部弹出原因。
- `D` / `Delete`：移入回收站（`wallpaper-trash put`），卡片落下、邻居合拢。
- `U`：撤销上一次删除（`wallpaper-trash restore`）。
- `Esc` / `Q` / 点击空白处：收起。
- 点击两侧卡片：跳到那张。
- 打开时以该显示器当前的壁纸为中心，并带 `NOW` 标签。
- 标题读图片旁边同名 `.json` 的 `title`（pixiv 下载器生成），没有时用文件名。

### IPC

```sh
qs ipc -c wallpaper call wallpaper toggle | open | close
```

## 文件

```
shell/                      → ~/.config/quickshell/wallpaper/
├── shell.qml               覆盖层窗口、卡片池、键盘鼠标、后端调用、顶部提示、IPC
├── Engine.js               运动引擎：位置弹簧、合拢弹簧、选中弹簧、涟漪、开合、删除/撤销、卡片分配（与 preview 同参数）
├── Card.qml                单张卡片：圆角图片 + 投影 + 地面阴影 + 染色/压暗/模糊 + NOW 标签
├── CutRect.qml             P3 右上切角形状
├── Fonts.qml               字体加载（单例）
├── fonts/                  Nunito Sans Black Italic、Barlow Condensed Bold（OFL）
└── scripts/wallpaper-backend   扫描壁纸库 / 读写 DMS 壁纸 / 调 wallpaper-trash，输出 JSON
niri/wallpaper.kdl          → ~/.config/niri/wallpaper.kdl（自启 + Mod+Y、Mod+Alt+W）
preview/                    浏览器预览版（设计原型），不用安装
pixiv/                      Pixiv 下载 / 轮换 / 回收站后端，见 pixiv/AGENTS.md
```

壁纸目录读 `~/.config/wallpaper-picker/config.toml` 的 `roots` / `exclude_dirs`（与旧选择器共用），没有时用 `~/Pictures/Wallpapers`。始终跳过 `.trash` `.state` `.tmp` `Pixiv-rotation` `.git` 和隐藏目录。

## 依赖（Arch 包名）

- `quickshell`（推荐 `quickshell-git`，需要 Qt ≥ 6.9：用到 `RectangularShadow`、`PathRectangle`）
- `niri`（`niri msg -j focused-output` 定位显示器）
- DMS（`dms ipc call wallpaper getFor/setFor` 读写壁纸）
- `python` ≥ 3.11（后端脚本，只用标准库）
- `noto-fonts-cjk`（标题里的中日文字形）
- `wallpaper-trash` 命令：删除/撤销需要，来自 `pixiv/`。没有时删除会提示失败，其它功能不受影响。

## 安装步骤

1. 检查依赖。
2. 复制：`cp -a wallpaper/shell ~/.config/quickshell/wallpaper`（目标已存在先备份）。
3. 接入 niri：
   - 复制 `niri/wallpaper.kdl` 到 `~/.config/niri/`，在 `config.kdl` 追加 `include "wallpaper.kdl"`。
   - `Mod+Y`、`Mod+Alt+W` 原先绑定在 `~/.config/niri/dms/binds.kdl`（指向 `wallpaper-picker`），**先删掉这两条**，否则 niri 报重复绑定。用 `grep -rn 'Mod+Y\|Mod+Alt+W' ~/.config/niri/` 确认。
   - `config.kdl` 里给 kitty 选择器写的 `window-rule`（`app-id="^wallpaper-picker$"`）可以一并删除，留着也无害。
   - `niri validate`。
4. 本次会话手动启动（之后由 `spawn-at-startup` 自启）：
   ```sh
   qs -c wallpaper -d
   ```

旧的 `~/.local/bin/wallpaper-picker` 和 `~/.config/wallpaper-picker/picker.py` 不用删，需要时仍可在终端里运行。

## 验证

```sh
~/.config/quickshell/wallpaper/scripts/wallpaper-backend list | head -c 300   # {"ok": true, "items": [...]}
qs list --all                                     # 能看到 wallpaper 实例
qs ipc -c wallpaper call wallpaper toggle         # 卡片出现；再执行一次收起
```

## 预览（preview/）

`preview/index.html` 是浏览器里的设计原型，动效参数与 QML 版一致，用来调设计。图片是本机 Pixiv 作品，不进仓库：

```sh
wallpaper/preview/gen-walls.sh        # 从壁纸库随机取 18 张，缩到 1600px 写入 preview/walls/ 和 data.js
chromium wallpaper/preview/index.html
```

原型里的桌面和顶栏是假的（用来看叠加效果）。应用后假桌面像 DMS 一样 1 秒淡入新壁纸，覆盖层收起约 1 秒后自动重新打开。

## 注意事项

- 覆盖层在 Overlay 层、打开时独占键盘。卡住时用 `qs ipc -c wallpaper call wallpaper close`，必要时 `qs kill -c wallpaper`。不要用宽泛的 `pkill qs`，DMS、kanban、music 也是 qs 进程。
- 卡片池 32 张：目标 ±6 张预取，加上移动途中屏上的卡片和正在落下的删除卡片；`Home` / `End` 长距离跳转时峰值约 24 张。卡片在 Repeater 创建时登记一次，之后只在分配 / 回收之间流转，一张卡同一时刻只属于一个条目。
- 图片按主卡尺寸解码（布局取目标屏幕的逻辑尺寸，窗口映射前就已确定），几百张壁纸也不会占很多内存。Qt 的图片读取线程后进先出，预取由远到近申请，所以主卡和左右邻居最先解码；远处卡片的模糊版在各自主图就绪后才申请。卡片回收时清空图源，没开始解码的请求随之取消。
- 列表每次打开时重新扫描，新下载的壁纸下次打开就能看到。
