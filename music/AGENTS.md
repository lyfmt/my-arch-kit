# music — 音乐卡片

一张浮动的网易云音乐播放卡片。卡片只负责显示与交互，真正的播放由常驻的 systemd 用户服务完成，所以关掉卡片音乐也不会停。

## 功能

- **卡片**（`qs -c music`）：普通 xdg 窗口，标题 `Music Card`，由 niri 管理（默认浮动在屏幕正中，可聚焦、移动、切平铺）。
  - 左侧唱片：封面随播放旋转，外圈一圈竖线随 cava 频谱跳动（cava 只在卡片可见时运行）。
  - 右侧：歌名、歌手 / 来源标签、逐行滚动歌词（有翻译时显示在当前行下方）。
  - 鼠标贴左 / 右 / 下边缘浮出毛玻璃浮层：左 = 歌单栏（右键可从列表移除），右 = 搜索（歌曲 / 歌手 / 歌单，歌手可进入热门歌曲页，歌单可收藏到歌单栏），下 = 工具栏（切歌、进度、音量、播放方式、桌面歌词、喜欢、收藏到歌单）。
  - 工具栏的「词」是 P3 桌面歌词（`p3-kits/p3-lyrics/`，`qs -c p3lyrics`）的开关：左键开 / 关（实例没在跑时先 `qs -n -c p3lyrics -d` 拉起）；右键或长按进入歌词的位置 / 大小调整。开着时字和圆底是主题色；状态跟随 `$XDG_STATE_HOME/p3lyrics/state.json`，并用 IPC `status` 确认实例还在。没装 p3lyrics 时按钮一直是关的。
- **后端**（`music-card.service` → `shell/backend/musicd.py`）：网易云 API + mpv 播放 + MPRIS。
  - MPRIS 名称 `org.mpris.MediaPlayer2.music_card`，DMS 的媒体控件、媒体键、`playerctl` 都能直接控制。
  - 播放队列、进度、音量、播放方式会持久化，重启后恢复。

### 快捷键（卡片聚焦时，按 `?` 可在卡片内查看）

| 按键 | 作用 |
| --- | --- |
| `Space` | 播放 / 暂停 |
| `N` `P`（或 `.` `,`） | 下一首 / 上一首 |
| `←` `→` | 快退 / 快进 5 秒（按住 Shift 为 15 秒） |
| `1` `2` `3` | 播放歌单栏第 1 / 2 / 3 项 |
| `F` | 喜欢 / 取消喜欢 |
| `S` 然后 `1`-`9` | 收藏到对应歌单 |
| `R` | 切换单曲循环 |
| `/` 或 `Ctrl+F` | 搜索（`Tab` 切换歌曲 / 歌手 / 歌单） |
| `↑` `↓` `Enter` | 选择搜索结果并插队播放；`Ctrl+Enter` 加入播放列表；歌手页 `Shift+Enter` 播放全部 |
| `L` `B` | 固定显示歌单栏 / 工具栏 |
| `Esc` | 收起浮层 / 返回 |
| `Mod+M`（niri） | 卡片未显示 → 显示；已显示未聚焦 → 聚焦；已聚焦 → 隐藏 |

`Mod+Q` 关闭卡片只是隐藏，后端照常播放。

### IPC

```sh
qs ipc -c music call music toggle          # 同 Mod+M
qs ipc -c music call music open | close
qs ipc -c music call music playPause | next | prev
qs ipc -c music call music search          # 显示卡片并聚焦搜索框
qs ipc -c music call music find 晴天 song   # 直接搜索，第二个参数 song | artist
qs ipc -c music call music panel playlists # 固定浮层：playlists | toolbar | search | help | none
```

## 文件

```
shell/                     → ~/.config/quickshell/music/
├── shell.qml              卡片窗口、键盘处理、IPC
├── Backend.qml            与后端的 socket 通信（单例）
├── Theme.qml              DMS 配色 + 字体 + 圆角
├── Disc.qml / Lyrics.qml / Panel.qml / Sidebar.qml / SearchPanel.qml / SongRow.qml / Toolbar.qml / LyricsButton.qml / HelpOverlay.qml / Icon.qml / IconButton.qml
├── cava.conf              cava 配置（48 段，pipewire 输入，输出到 stdout）
├── fonts/MaterialSymbolsRounded.ttf   图标字体（Google Material Symbols，Apache-2.0），随包附带无需安装
└── backend/
    ├── musicd.py          播放后端：mpv 控制、MPRIS、Unix socket 服务
    └── netease.py         网易云 API 封装（weapi 加密借用 openssl 命令）
niri/music.kdl             → ~/.config/niri/music.kdl（自启、窗口规则、Mod+M）
systemd/music-card.service → ~/.config/systemd/user/music-card.service
```

运行时文件：

| 路径 | 内容 |
| --- | --- |
| `$XDG_RUNTIME_DIR/music-card.sock` | 卡片 ↔ 后端，每行一个 JSON |
| `$XDG_RUNTIME_DIR/music-card-mpv.sock` | 后端 ↔ mpv（mpv 以 `--no-config` 启动，不受用户 mpv 配置影响） |
| `~/.cache/music-card/state.json` | 播放队列、进度、音量等 |
| `~/.cache/music-card/device-id` | 首次运行生成的随机设备 ID（喜欢 / 收藏等写操作需要） |
| `~/.config/music-card/config.json` | 可选配置，见下文 |

## 依赖（Arch 包名）

- `quickshell`（推荐 `quickshell-git`）、`niri`
- `mpv`、`cava`、`pipewire`（cava 从 pipewire 取音频）
- `python`、`python-requests`、`python-dbus`、`python-gobject`、`openssl`
- `noto-fonts-cjk`（界面字体 Noto Sans CJK SC）
- 网易云登录来源：AUR `netease-cloud-music-gtk`（或 `netease-cloud-music-gtk-bin`）。后端不实现登录，只复用它保存的 cookie：`~/.local/share/netease-cloud-music-gtk4/cookies.json`

## 安装步骤

1. 检查上述依赖，缺失的装上。
2. 复制卡片：`cp -a music/shell ~/.config/quickshell/music`（目标已存在先备份）。
3. **登录网易云**：打开 netease-cloud-music-gtk 登录一次，确认 `~/.local/share/netease-cloud-music-gtk4/cookies.json` 存在。
   - cookie 文件不存在时后端启动即退出，systemd 会反复重启直到触发启动频率限制。所以务必先登录，再启用服务。
4. 安装后端服务：
   ```sh
   install -Dm644 music/systemd/music-card.service ~/.config/systemd/user/music-card.service
   systemctl --user daemon-reload
   systemctl --user enable --now music-card.service
   ```
   服务挂在 `graphical-session.target` 上。如果用户不是通过 `niri-session`（systemd 方式）启动 niri，这个 target 可能不会被激活，开机自启会失效；此时可改为在 niri 里 `spawn-at-startup "systemctl" "--user" "start" "music-card.service"`。
5. 接入 niri：复制 `niri/music.kdl` 到 `~/.config/niri/`，在 `config.kdl` 追加 `include "music.kdl"`。先检查 `Mod+M` 是否已被占用，再 `niri validate`。
6. 本次会话手动启动卡片（之后由 `spawn-at-startup` 自启）：
   ```sh
   env QT_SCALE_FACTOR=1.5 qs -c music -d
   ```

## 可选配置：歌单栏显示哪些歌单

默认显示账号下**所有自建歌单**（含“我喜欢的音乐”），最后追加“每日推荐”。想只显示部分歌单并指定顺序，写 `~/.config/music-card/config.json`：

```json
{ "playlists": ["歌单名 A", "歌单名 B"] }
```

名字必须与网易云里的自建歌单名完全一致，不存在的名字会被忽略。改完执行 `systemctl --user restart music-card.service` 生效。快捷键 `1` `2` `3` 对应歌单栏前三项，`S` 后的数字对应“收藏到”菜单的顺序。

## 验证

```sh
systemctl --user status music-card.service      # active (running)
ls "$XDG_RUNTIME_DIR/music-card.sock"           # socket 已创建
busctl --user list | grep music_card            # MPRIS 已注册
qs ipc -c music call music open                 # 卡片出现，侧栏能看到歌单
```

侧栏一直显示“加载中…”或提示“歌单加载失败”：多半是 cookie 过期，在 netease-cloud-music-gtk 里重新登录，然后重启服务。日志：`journalctl --user -u music-card.service -n 50`。

## 注意事项

- **缩放**：`music.kdl` 里用 `QT_SCALE_FACTOR=1.5` 把卡片整体放大 50%（清晰重绘，不是拉伸）。窗口规则里的默认尺寸 `1076×495` 就是卡片原始尺寸 `717×330` 乘以这个系数；改缩放系数时两处要一起改。
- **圆角**：`Theme.qml` 中 `radius: 8`。如果用户的 niri 窗口规则设置了 `geometry-corner-radius`，把两者调成一致，卡片边缘才不会露出直角。
- **配色**：读取 DMS 的 `~/.cache/DankMaterialShell/dms-colors.json` 并实时跟随；没有 DMS 时使用内置默认色。
- **重启卡片**：`qs kill -c music` 后重新执行第 6 步的命令。
- **停止播放后端**：`systemctl --user stop music-card.service`。
- 音量条调节的是后端 mpv 的音量，与系统音量相互独立。
- 喜欢 / 收藏属于写操作，网易云风控要求带设备类 cookie；后端会自动补齐，若仍返回 `-460`，通常是 cookie 本身已失效。
- 本组件只调用网易云的公开网页接口，接口变动可能导致个别功能失效；排查时先看服务日志。
