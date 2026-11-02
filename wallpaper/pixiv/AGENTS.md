# wallpaper/pixiv — Pixiv 壁纸后端

壁纸组件的数据后端：从 pixiv.pictures 的登录态出发，把「我的收藏」和「我关注的画师」的横版原图增量下载到本地壁纸库；按屏幕定时轮换；提供带 3 天保留期和永久屏蔽列表的壁纸回收站（`wallpaper-trash`）。`wallpaper/shell` 的覆盖层通过 `wallpaper-trash` 删除 / 还原壁纸。

更详细的使用说明见同目录 `README.md`（从原项目原样搬来，屏幕型号已去掉）。

## 功能

- **同步**（`pixiv_wallpaper.py --once`，`run.sh` 带 flock 锁）
  - 收藏 → `<root>/收藏/`；关注画师的近期作品（默认每人 4 个）→ `<root>/关注/<uid>_<画师名>/`。
  - 增量：一整页都没有新收藏就停；只抓**新关注**画师的作品。状态存 `<root>/.state/state.json`，日志 `<root>/.state/scraper.log`。
  - 尺寸筛选：横版、≥ `min_width×min_height`、宽高比在 `[最窄屏比例×(1−aspect_tolerance), max_aspect]` 内；可跳过 R-18 / AI / 指定 tag / 超大文件。
  - 每张图旁写一个同名 `.json`（tags、作者、尺寸、原图地址）。
  - 接口走 `api.cocomi.eu.org` 代理的 Pixiv App API，原图按 `[images].hosts` 顺序尝试镜像。
- **轮换**（`--sync-rotation` / `--rotate`）
  - 把图库按屏幕轮流分到 `[rotation].dir/<输出名>/`（符号链接，互不相交，两屏不撞图）。
  - `--rotate` 给每块屏随机换一张，用 `dms ipc call wallpaper setFor <屏幕> <图片>` 应用。
  - 屏幕用**显示器型号**标识（`niri msg --json outputs` 的 `model`），内屏输出名会在 eDP-1 / eDP-2 间漂移；未列出的已连接屏幕自动追加。
- **回收站**（`wallpaper_trash.py`，也被主程序 import）
  - `put` 把图片和同名 `.json` 移入 `<trash>/files/`，写 `index.json`，并删除轮换目录中指向它的链接。
  - 「作品:页」（`iid:page`）写入永久屏蔽列表 `blocked`，同步时跳过，`--rescan` 也不会拉回。
  - 超过 `retention_days`（默认 3 天）的条目在每次轮换 / 同步时自动清除文件，屏蔽记录保留。
  - 子命令：`put <path>`、`list`、`restore <iid:page>`、`purge [--days N]`、`count`、`blocked`、`is-blocked <key>`，均支持 `--json`。
- **DMS 壁纸页补丁（已弃用，保留备查）**
  - `dms_shell_patch.py <WallpaperTab.qml>`：对 DMS DankDash 壁纸页做幂等文本补丁（有 `// >>> wallpaper-trash patch` 标记就跳过）：加 `Quickshell.Io` / `qs.Services` 导入；加 `d` 键和底栏回收站按钮，调用 `~/.local/bin/wallpaper-trash put <path> --json`；成功 / 失败弹 Toast；删除期间保持网格位置不跳回第 0 页。每个锚点必须恰好出现 1 次，否则报错退出（提示 DMS 版本已变）。
  - `dms-shell-sync.sh`：把 `$XDG_RUNTIME_DIR/danklinux-shell/<hash>/` 里解包的 DMS UI 复制到 `~/.local/share/dms-shell`，打补丁，记录 hash，默认 `dms kill` 后用 `DMS_SHELL_DIR` 重启 DMS（`--if-stale` 仅版本变化时执行，`--no-restart` 不重启）。
  - `dms-shell-run.sh`：补丁 UI 的 `VERSION` 与 `dms version` 一致时设 `DMS_SHELL_DIR` 再 `dms run`，否则回退内嵌 UI。
  - 现在删除壁纸走 `wallpaper/shell` 覆盖层（或旧的 kitty 选择器），**不要再运行这三个脚本**；`dms-shell-sync.sh` 会重启 DMS。

## 文件

```
pixiv/                         → 安装到 ~/Projects/pixiv-wallpaper/（默认，与现有部署一致）
├── pixiv_wallpaper.py         主程序：同步 / 轮换 / 登录态
├── wallpaper_trash.py         回收站库 + CLI（~/.local/bin/wallpaper-trash 是指向它的符号链接）
├── get-session.sh             通过 agent-chrome (CDP 9222) + agent-browser 读取 localStorage["PXV_NOW_COOKIE"]
├── run.sh                     手动跑一轮（flock .run.lock）
├── install-timer.sh           pip 装依赖、复制并启用 systemd 用户单元、enable-linger
├── config.example.toml        配置模板 → 复制为 config.toml
├── requirements.txt           requests、Pillow
├── systemd/
│   ├── pixiv-wallpaper.service/.timer          每天 03:30 同步（随机延迟 20 分钟）
│   └── pixiv-wallpaper-rotate.service/.timer   开机 1 分钟后起、每 5 分钟轮换
├── dms_shell_patch.py / dms-shell-sync.sh / dms-shell-run.sh   已弃用的 DMS 补丁
└── README.md                  原项目说明
```

`config.toml`、`.run.lock`、`__pycache__/` 已写进 `.gitignore`。

## 依赖（Arch 包名）

- `python`（≥ 3.11，用到 `tomllib`）、`python-requests`、`python-pillow`
- `dms`（DankMaterialShell，轮换用 `dms ipc call wallpaper setFor/getFor`）
- `niri`（`niri msg --json outputs` 探测屏幕）
- 登录态提取：`agent-chrome` 用户服务（Chromium，独立 profile `~/.config/chromium-agent/`，开 CDP 9222）、`agent-browser`、`curl`
- `util-linux`（`flock`）

## 安装步骤

1. 检查依赖。
2. 复制到安装目录（已存在先备份；`config.toml` 不在仓库里，别覆盖现有那份）：
   ```sh
   mkdir -p ~/Projects/pixiv-wallpaper
   cp -a wallpaper/pixiv/. ~/Projects/pixiv-wallpaper/
   cd ~/Projects/pixiv-wallpaper
   [ -f config.toml ] || cp config.example.toml config.toml
   ```
   装到别处时需要同步修改：`config.toml` 的 `[auth].fetch_script`、`systemd/*.service` 里的 `%h/Projects/pixiv-wallpaper`。脚本本身按自身位置定位，不依赖安装路径。
3. 编辑 `config.toml`：`[download].root`、`screens`（显示器型号）、`screen_aspects`、`[rotation].screens`。
4. 回收站命令：`ln -sf ~/Projects/pixiv-wallpaper/wallpaper_trash.py ~/.local/bin/wallpaper-trash`。
5. 定时任务：`./install-timer.sh`（会 `enable --now` 两个 timer，并尝试 `loginctl enable-linger`）。

## 登录态

- 登录态是 pixiv.pictures 的 `localStorage["PXV_NOW_COOKIE"]`（长效 `PHPSESSID`），存在 Agent Chrome 的 profile 里。
- 首次运行或接口报登录失效时调用 `[auth].fetch_script`（`get-session.sh`）提取，写入 `[auth].cache`（默认 `~/.config/pixiv-wallpaper/auth.json`，权限 0600）。
- 浏览器里也没登录时：从应用菜单打开 Agent Chrome，登录一次 pixiv.pictures，再 `python3 pixiv_wallpaper.py --refresh-auth`。
- **auth.json 和任何 PHPSESSID 都不能进仓库**；仓库里只有 `config.example.toml`。

## 验证

```sh
cd ~/Projects/pixiv-wallpaper
python3 -m py_compile pixiv_wallpaper.py wallpaper_trash.py dms_shell_patch.py
for f in *.sh; do bash -n "$f"; done
wallpaper-trash --help && wallpaper-trash count     # 只读
python3 pixiv_wallpaper.py --probe                  # 需联网 + 登录态，打印账号/收藏数
systemctl --user list-timers 'pixiv-wallpaper*'
journalctl --user -u pixiv-wallpaper -u pixiv-wallpaper-rotate -n 50
```

## 注意

- 仓库副本与 `~/Projects/pixiv-wallpaper` 的差异：`dms-shell-sync.sh` 的 `PROJECT` 改为按脚本自身位置解析（原来写死 `$HOME/Projects/pixiv-wallpaper`）；`config.toml` 换成了去掉屏幕型号的 `config.example.toml`；service 里加了一行安装位置注释；README 去掉了具体屏幕型号。
- `--rotate` / `--once` / `put` / `restore` / `purge` 都会改文件或换壁纸，测试时不要随手跑；`--dry-run` 仍会下载原图来校验尺寸。
- 数据来自第三方 Pixiv 代理，仅供个人壁纸使用；控制频率，尊重版权。
