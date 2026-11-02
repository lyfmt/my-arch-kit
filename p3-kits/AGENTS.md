# p3-kits — Persona 3 Reload 风格系列

每个子目录是一个独立的 P3 组件，互不依赖，安装或查看前先读该目录里的 `AGENTS.md`。各目录都不上传图片，缺图时的还原方法写在各自的说明里。

| 目录 | 说明 | 状态 |
| --- | --- | --- |
| [`dms-p3/`](dms-p3/AGENTS.md) | DMS 改造：灵动岛顶栏 + 全屏菜单，基于 DMS 2.0，与 `dms-p5` 只能启用一个 | QML 已移植（菜单五页 + 灵动岛气泡串），可安装：`enable.sh` / `disable.sh`（会重启 DMS；停用时还原启用前的 `settings.json`） |
| [`p3-lock/`](p3-lock/AGENTS.md) | 锁屏（水下上浮），独立 Quickshell 进程，经 DMS Custom Lock Command 拉起，替代 `p5lock` | 已安装到 `~/.config/quickshell/p3lock/` 并接入 DMS：`customPowerActionLock` → `~/.config/quickshell/p3lock/p3lock.sh`，真锁屏已测试 |
| [`p3-lyrics/`](p3-lyrics/AGENTS.md) | 桌面歌词（RIPTIDE），独立实例 `qs -c p3lyrics`，只读接入 `music/` | QML 版已完成，已安装并在运行（`qs -c p3lyrics`） |
