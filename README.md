# my-arch-kit

一组面向 **Arch Linux + niri + DankMaterialShell (DMS)** 桌面的 Quickshell 组件。每个顶层目录是一个独立组件，可以单独安装。

| 组件 | 说明 |
| --- | --- |
| [`music/`](music/AGENTS.md) | 网易云音乐浮动播放卡片：旋转唱片、cava 环形频谱、滚动歌词、搜索；后端基于 mpv，支持 MPRIS |
| [`kanban/`](kanban/AGENTS.md) | `Mod+;` 呼出的覆盖层看板：TODO / DOING / DONE 三列，外加按时间点自动刷新的每日任务 |
| [`p5lock/`](p5lock/AGENTS.md) | Persona 5 风格的 session-lock 锁屏，可接入 DMS 的自定义锁屏命令 |
| [`dms-p5/`](dms-p5/AGENTS.md) | 对 DMS 内置 UI 打补丁的 P5 改造（PHANTOM VIOLET）：歪斜卡片栏、勒索信时钟、拉绳、P5 面板与菜单 |
| [`p3-kits/`](p3-kits/AGENTS.md) | Persona 3 Reload 风格系列：[`dms-p3`](p3-kits/dms-p3/AGENTS.md)（基于 DMS 2.0 的灵动岛顶栏 + 全屏菜单，接入逻辑和映射已写全，QML 移植未开始，还不能安装）、[`p3-lyrics`](p3-kits/p3-lyrics/AGENTS.md)（桌面歌词原型） |
| [`p5-reference/`](p5-reference/AGENTS.md) | **不是组件、无需安装**：收集自 CodePen 的 8 个 Persona 5 风格 UI 片段，作参考用 |

配色跟随 DMS 生成的 matugen 色板，换壁纸后自动变化；没有 DMS 时使用内置配色。

`dms-p5/`、`p3-kits/dms-p3/` 的安装方式与其它组件不同（它是补丁包，不是独立的 Quickshell 配置），见包内 `AGENTS.md`；`p5-reference/` 只是素材集合，直接打开里面的 `index.html` 查看。

## 依赖

- [`quickshell-git`](https://aur.archlinux.org/packages/quickshell-git)（需要较新的版本）
- `niri`
- DMS（可选，提供配色、壁纸和锁屏入口）

各组件的其他依赖见对应目录下的 `AGENTS.md`。

## 安装

每个组件的结构相同：

```
<组件>/
├── shell/      → ~/.config/quickshell/<组件>/
├── niri/*.kdl  → ~/.config/niri/，并在 config.kdl 里 include
└── systemd/    → ~/.config/systemd/user/（仅 music）
```

以看板为例：

```sh
cp -a kanban/shell ~/.config/quickshell/kanban
cp kanban/niri/kanban.kdl ~/.config/niri/
echo 'include "kanban.kdl"' >> ~/.config/niri/config.kdl
niri validate
qs -c kanban -d
```

目标目录名必须与组件名一致（`music` / `kanban` / `p5lock`）。完整步骤、快捷键和配置项见各组件的 `AGENTS.md`；这些文档也可以直接交给 Agent 照着安装。
