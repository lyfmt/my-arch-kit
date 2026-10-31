# my-arch-kit — 安装指南（给 Agent）

这是一组面向 **Arch Linux + niri + DankMaterialShell (DMS)** 桌面的 Quickshell 组件包。
每个顶层目录是一个独立组件，可以单独安装，互不依赖。

| 目录 | 组件 | 一句话说明 |
| --- | --- | --- |
| [`music/`](music/AGENTS.md) | 音乐卡片 | 网易云 + mpv + MPRIS 的浮动播放卡片：旋转唱片、cava 环形频谱、滚动歌词、搜索 |
| [`kanban/`](kanban/AGENTS.md) | 看板 | 快捷键呼出的覆盖层看板：TODO / DOING / DONE 三列 + 定时刷新的每日任务 |
| [`p5lock/`](p5lock/AGENTS.md) | P5 锁屏 | Persona 5 风格的 session-lock 锁屏，接入 DMS 的自定义锁屏命令 |
| [`dms-p5/`](dms-p5/AGENTS.md) | P5 DMS 改造 | 对 DMS 内置 UI 打补丁：歪斜卡片栏、勒索信时钟、拉绳、P5 面板与菜单（安装方式与其它组件不同，见包内说明） |
| [`p3-kits/`](p3-kits/AGENTS.md) | P3 系列 | Persona 3 Reload 风格组件集合：`dms-p3`（灵动岛顶栏 + 全屏菜单，基于 DMS 2.0；**接入逻辑和映射已写全，QML 移植未开始，暂不能安装**，与 dms-p5 只能启用一个）、`p3-lyrics`（桌面歌词原型） |
| [`p5-reference/`](p5-reference/AGENTS.md) | P 系列参考包 | **不是组件、无需安装**：收集自 CodePen 的 8 个 Persona 5 风格 UI 片段，已本地化，作参考用 |

用户让你安装某个组件时：**先完整读完该组件目录里的 `AGENTS.md`**，它包含依赖、步骤、验证方法和注意事项。本文件只讲所有组件共用的约定。

> `p5-reference/` 是例外：它只是参考素材集合，没有 `shell/`、`niri/` 等安装结构，直接打开里面的 `index.html` 查看即可，不要按下面的安装流程处理。

## 包结构约定

```
<组件>/
├── AGENTS.md        包内安装指导与注意事项
├── shell/           Quickshell 配置本体 → 复制到 ~/.config/quickshell/<组件>/
├── niri/*.kdl       niri 配置片段      → 复制到 ~/.config/niri/，再在 config.kdl 里 include
└── systemd/*.service（如有）            → 复制到 ~/.config/systemd/user/
```

- 目标目录名必须与组件目录名一致（`music` / `kanban` / `p5lock`）。代码、脚本、IPC 命令里都按这个名字调用 `qs -c <组件>`，改名会导致快捷键、服务和脚本失效。
- Quickshell 的配置发现规则：如果 `~/.config/quickshell/shell.qml` 存在，它会成为唯一的 default 配置，`qs -c <名字>` 将找不到子目录。遇到这种情况改用 `qs -p ~/.config/quickshell/<组件>` 启动，并相应调整 niri 片段和脚本。

## 通用前置条件

- `quickshell`：需要较新的版本（组件用到了 `BackgroundEffect`、`ShortcutInhibitor`、`Quickshell.Services.Pam` 等），推荐 AUR 的 `quickshell-git`。
- `niri`：快捷键、窗口规则和“当前聚焦显示器”查询都基于 niri。
- DMS：可选但推荐。各组件的配色读取 DMS 生成的 matugen 色板 `~/.cache/DankMaterialShell/dms-colors.json`（换壁纸后自动跟随）；文件不存在时使用内置的默认紫色配色。

## 通用安装流程

1. **检查依赖**：用 `pacman -Q <包名>` 逐个确认包内 `AGENTS.md` 列出的依赖。缺失的用 `pacman` / AUR 助手安装。
2. **检查冲突**：目标目录 `~/.config/quickshell/<组件>` 已存在时，先移走或备份（如 `mv <dir> <dir>.bak-$(date +%Y%m%d%H%M%S)`）。
3. **复制文件**：`cp -a <组件>/shell ~/.config/quickshell/<组件>`（`-a` 保留脚本的可执行位）。也可以按用户偏好改为软链接到本仓库，方便 `git pull` 更新。
4. **接入 niri**：
   - 复制 `niri/*.kdl` 到 `~/.config/niri/`，在 `~/.config/niri/config.kdl` 末尾追加 `include "<文件名>.kdl"`。
   - 追加前用 `grep -rn '<按键>' ~/.config/niri/` 检查快捷键是否已被占用；冲突时换键或替换原绑定。
   - 用 `niri validate` 校验配置。niri 会在配置保存后自动热重载，无需重启；配置无效时 niri 保留旧配置并报错。
   - `spawn-at-startup` 只在 niri 启动时执行，本次会话需要按包内说明手动启动一次。
5. **按包内 `AGENTS.md` 完成其余步骤并验证**。


## 重启单个组件

DMS 本身也运行在 quickshell 上，重启某个组件用 `qs kill -c <组件>`，再按包内说明重新启动。
