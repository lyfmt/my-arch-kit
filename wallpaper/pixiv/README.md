# Pixiv 壁纸同步（我的收藏 + 我关注的画师）

从 [pixiv.pictures](https://pixiv.pictures/) 的**登录态**出发，同步两类内容到本地壁纸库，
只保留适合当壁纸的**横版原图**，并按屏幕定时轮换（每 5 分钟一张）。

数据接口走 `api.cocomi.eu.org` 代理的 Pixiv App API；登录态直接复用
**Agent Chrome** 里已经登录好的 `pixiv.pictures`，无需再登一次。

## 同步内容

| 来源 | 说明 | 存到 |
|------|------|------|
| 我的收藏 | Pixiv 公开收藏的全部原画 | `收藏/` |
| 我关注的画师 | 每位画师接口回传的近期作品预览（默认 4 个） | `关注/<uid>_<画师名>/` |

自动化是**增量**的：

- **新增的收藏** → 下载；翻到一整页都没有新收藏就停（最新收藏在最前）。
- **新关注的画师** → 下载其近期作品；已关注画师后来发布的新作不重复抓，避免一次拉爆图库。

## 尺寸校验（不合适的直接不下载）

只保留同时满足以下条件的图：

- 横版：`宽 > 高`
- 分辨率达标：`min_width × min_height`（默认 1280×720）
- 宽高比在合理范围内：
  - 下限 = 最窄屏幕比例 × (1 − `aspect_tolerance`)，默认 `1.6 × 0.8 = 1.28`（太方/太竖的跳过）
  - 上限 = `max_aspect`，默认 `3.5`（**2:1、3:1 这种超宽全景会下载**；再极端的才跳过）

示例：内置屏 `2560×1600 = 1.600`、外接屏 `2560×1440 = 1.778`（屏幕型号写在 `config.toml` 的 `screens` 里）。
竖图、方图会被跳过；超宽全景（≤3.5）则会收进来，交给 DMS 缩放/裁切铺满屏幕。

## 分屏轮换（每 5 分钟）

- 同步结束后会把图库按屏幕轮流分配，建成两个扁平的符号链接目录（不占额外磁盘）：

  ```
  ~/Pictures/Wallpapers/Pixiv-rotation/
    eDP-1/       # 内置屏（当前输出名）
    HDMI-A-1/    # 外接屏
  ```

- 两屏取自**互不相交**的目录，所以永远不会撞图。
- `pixiv-wallpaper-rotate.timer` 每 **5 分钟**随机换一张，通过 DMS
  `wallpaper setFor <屏幕> <图片>` 应用。

> **屏幕标识用型号，不要写输出名。** niri 的内屏输出名会在 `eDP-1` / `eDP-2`
> 之间漂移；如果配置里写死 `eDP-2`，DMS 的 `setFor` 会返回 `SUCCESS` 却匹配不到
> 真实屏幕（静默失败，内屏就一直不换）。因此 `[rotation].screens` / `[download].screens`
> 推荐写显示器型号（`niri msg --json outputs` 里的 `model`，也是 DMS 内部存储用的键）。
> 脚本启动时会按当前实际连接的输出解析（型号或输出名都认），未列出的已连接屏幕会
> 自动追加，输出名漂移或首次运行时还会自动重建轮换目录，所以不会再失效。

## 壁纸选择器（Mod+Y，普通 kitty 窗口）

壁纸不再用 DMS 的 DankDash 浮层选择，而是打开一个由 niri 管理的普通
kitty 窗口（`app-id = wallpaper-picker`），因此和终端等窗口一样有圆角、模糊，
并使用同一套 kitty 主题。入口脚本：`~/.local/bin/wallpaper-picker`。

| 按键 | 作用 |
|------|------|
| `↑↓` / `jk`、`PgUp/PgDn` | 移动 |
| `Enter` | 应用到选择器所在的那块屏幕 |
| `1`-`9` | 应用到第 N 块屏幕 |
| `a` | 应用到全部屏幕 |
| `d` | 移入壁纸回收站 |
| `T` | 查看回收站（`Enter`/`u` 还原，`P` 清理过期，`T` 返回） |
| `/` | 搜索（文件名 / 标题 / 作者 / 标签） |
| `s` | 切换排序（名称 / 时间 / 大小） |
| `r` | 随机跳转 |
| `o` | 用系统图片查看器打开 |
| `R` | 重新扫描 |
| `q` / `Esc` | 退出 |

配置文件在 `~/.config/wallpaper-picker/config.toml`（扫描目录、缩略图大小等）；
回收站路径直接复用本项目的 `config.toml`，所以删除 / 还原和同步脚本是同一个回收站。

### 壁纸回收站

- 回收站目录：`~/Pictures/Wallpapers/Pixiv/.trash/`（图片和同名 `.json` 元数据一起移入）
- **不会被重新下载**：被删除的「作品:页」会写进永久屏蔽列表，同步脚本即使重跑、
  甚至 `--rescan` 也不会再拉回来
- **3 天后自动清除**：每 5 分钟的轮换任务和每日同步任务都会清理超过 `retention_days`
  的条目；文件清除后永久屏蔽记录仍保留
- 轮换目录里指向它的符号链接会一并删除，不会留下悬空链接

命令行管理：

```bash
wallpaper-trash list                    # 看回收站里有什么、还剩几天
wallpaper-trash restore <iid:page>      # 还原
wallpaper-trash purge [--days 3]        # 手动清理过期项
wallpaper-trash count                   # 条目数
```

保留天数在 `config.toml` 的 `[trash]` 里改。

## 登录态

登录态是 `localStorage["PXV_NOW_COOKIE"]`（一个长效 `PHPSESSID`），存在 Agent Chrome 的
独立 profile（`~/.config/chromium-agent/`）里，重启仍在。

```bash
python3 pixiv_wallpaper.py --refresh-auth   # 从浏览器重新提取并缓存
python3 pixiv_wallpaper.py --probe          # 测试登录态、看账号/收藏数
```

- 首次运行会调用 `get-session.sh`：按需拉起 `agent-chrome` → 打开 pixiv.pictures →
  读出 `PHPSESSID`，缓存到 `~/.config/pixiv-wallpaper/auth.json`（0600）。
- 之后直接读缓存，不再开浏览器；接口报“登录态失效”时会自动重新提取一次。
- 若缓存失效且浏览器也没登录：从应用菜单打开 **Agent Chrome**，登录一次即可。

## 目录结构

```
~/Projects/pixiv-wallpaper/
  pixiv_wallpaper.py      # 主程序
  wallpaper_trash.py      # 壁纸回收站（put/list/restore/purge，也被主程序导入）
  dms_shell_patch.py      # [已弃用] 旧 DMS 壁纸页补丁，改用 kitty 选择器后不再使用
  dms-shell-sync.sh       # [已弃用] 同上
  config.toml             # 配置（由 config.example.toml 复制，不入库）
  get-session.sh          # 从 agent-chrome 提取登录态
  run.sh                  # 手动跑一轮（带锁）
  install-timer.sh        # 安装/更新定时任务
  systemd/                # systemd 用户单元

~/.config/wallpaper-picker/           # kitty 壁纸选择器
  picker.py
  config.toml
~/.local/bin/wallpaper-picker         # 选择器启动脚本（Mod+Y）
~/.local/bin/wallpaper-trash          # 回收站命令行

~/Pictures/Wallpapers/Pixiv/          # root 可在 config 改
  收藏/         150653889_p0_标题.jpg + 同名 .json
  关注/
    163536_Rella/
    ...
  .trash/                 # 壁纸回收站（index.json + files/）
  .state/state.json       # 去重 / 增量 / 断点状态
  .state/scraper.log      # 运行日志
```

每张图旁边有一个同名 `.json`，记录完整 tags、作者、尺寸、原图地址、作品链接等。

## 常用命令

```bash
./run.sh                          # 手动跑一轮（增量）
./run.sh --dry-run                # 只统计不写文件（仍会下载用于校验尺寸）
./run.sh --only bookmarks         # 只同步收藏
./run.sh --only following         # 只同步关注画师
./run.sh --limit 20               # 本轮最多下载 20 张（0 = 不限制）
./run.sh --rescan                 # 改了筛选规则后，重新评估全部作品（已下载的不重下）

python3 pixiv_wallpaper.py --probe          # 测试登录态
python3 pixiv_wallpaper.py --refresh-auth   # 刷新登录态
python3 pixiv_wallpaper.py --rotate         # 每块屏立即换一张
python3 pixiv_wallpaper.py --sync-rotation  # 重建每屏轮换目录
niri msg --json outputs                     # 查看屏幕名/型号

./install-timer.sh                # 安装/更新定时任务
journalctl --user -u pixiv-wallpaper -f     # 看日志
```

## 修改配置（`config.toml`，改完即生效）

- 放宽/收紧尺寸筛选：`min_width / min_height / aspect_tolerance / max_aspect / screen_aspects`
  （改完跑一次 `./run.sh --rescan` 让已有的作品重新按新规则评估）
- 允许 R-18：`allow_r18 = true`（默认 false，壁纸会公开显示）
- 跳过 AI：`skip_ai = true`
- 每轮上限：`max_new_per_run`（0 = 不限制）
- 定时抓取频率：改 `systemd/pixiv-wallpaper.timer` 后重跑 `./install-timer.sh`
- 轮换频率：改 `systemd/pixiv-wallpaper-rotate.timer` 后重跑 `./install-timer.sh`

## 说明

数据来自第三方 Pixiv 代理服务，仅用于个人壁纸收集；请控制频率、尊重原作者版权，勿二次分发。
