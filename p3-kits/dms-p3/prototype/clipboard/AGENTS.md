# clipboard — 剪切板历史的 P3 方案

DMS 2.0 剪切板历史（`Modals/Clipboard/`）的 P3 改造原型，四个方向并列，供挑选。

**现状：静态原型，未选定方案。** 数据是各方案 js 里的 mock，没有接 `P3Sys` / `ClipboardService`，也没有 QML。

## 方案

| 文件 | 方向 | 说明 |
|---|---|---|
| `a-tide.html` / `.css` / `.js` | A · TIDE 列表 | 居中切角面板，左列表右预览，最接近菜单页 |
| `b-wedge.html` / `.css` / `.js` | B · WEDGE 斜切 | 屏幕右侧斜切色板，平行四边形行，白楔形 + 红残影 |
| `c-island.html` / `.css` / `.js` | C · ISLAND 下拉 | 顶部灵动岛的 activity：复制时胶囊提示，打开时下垂成面板，行同 island-b 通知中心 |
| `d-deck.html` / `.css` / `.js` | D · DECK 卡组 | 全屏横向卡组，当前卡抬起倾斜 |
| `index.html` | — | 对比页：四个方案的缩略预览和链接 |

每个 html 文件头注释里有完整的 QML 对应表和 URL 参数。清空 / 删除置顶都改成 POWER 页的按住 1s 确认，红色只出现在选中残影和确认进度上。

## 查看

浏览器打开 `file://…/prototype/clipboard/index.html`，或直接打开某个方案。

- `?static=1` 静态截图（不播动画）。
- 通用参数：`?tab=saved`、`?sel=N`、`?q=…`、`?filter=all|text|long_text|image`、`?hints=1`、`?mode=preview|editor|confirm|empty|offline`。
- 各方案另有：A/B `?mode=menu`；B/D `?mode=copied|closed`，D `?mode=ctx`；B `?enterPaste=1`、`?fail=1`；C `?state=idle|toast|open`、`?w=1706`、`?ctx=1`。
- 缺图时照常运行（见上级 `AGENTS.md`）。

## 键盘

和 `ClipboardKeyboardController.qml` 同一张表：

- `↑↓` / `Tab` `Shift+Tab` / `Ctrl+J K N P` 移动选中；`Enter` 复制并关闭，`Shift+Enter` 粘贴。
- `Ctrl+Tab` 切 HISTORY / SAVED；`←→` 切类型筛选（A；D 里 `←→` 是翻卡）；直接打字即搜索。
- `Ctrl+S` 置顶 / 取消，`Ctrl+E` 编辑（编辑器内 `Ctrl+S` 保存，`Ctrl+Shift+S` 保存并关闭，`Ctrl+Shift+V` 保存并粘贴），`Ctrl+Space` 预览（预览里 `↑↓` 仍换条目）。
- `Delete` 删除，`Shift+Delete` 清空（按住 `Enter` 1s 确认），`Menu` / `Shift+F10` 右键菜单，`F10` 显示按键提示。
- `Esc` 逐层退出：编辑器 → 预览 → 右键菜单 → 清空搜索 → 关闭。关闭后 `Alt+V`（代表 Mod+Alt+V）重新打开。C 里 `V` 开关面板，`C` 模拟一次新复制。

## 对应的 DMS 2.0 文件

四个方案都覆盖同一组文件（`Modals/Clipboard/`）：

| QML | A | B | C | D |
|---|---|---|---|---|
| `ClipboardHistoryModal.qml` / `ClipboardHistoryPopout.qml` | `#stage` / `.pw` | `#cb` 全屏层 | `#isl` 面板态（做成 DIsland activity） | `#stage` |
| `ClipboardHeader.qml` | `.hd` | `.hd` | `.ch` | `.hd` |
| `ClipboardContent.qml` / `ClipboardHistoryContent.qml` | `.tb` + `.bd` | `.srch` `.flt` | `.cs` `.cf` `.cl` | `.bar` + `#deck` |
| `ClipboardEntry.qml` / `ClipboardThumbnail.qml` | `.row` / `.th` | `.row` / `.th` | `.ck` / `.lead img` | `.card` / `.thumb` |
| `ClipboardActions.qml` | 预览区下的按钮 | `.acts` | 行内展开动作条 | `.acts` |
| `ClipboardContextMenu.qml` | `.cx` | `.cm` | `.cm` | `#ctx` |
| `ClipboardImagePreview.qml` | `#ovPv` | `.pv` | `mode=preview` | `#pv` |
| `ClipboardEditor.qml` | `#ovEd` | `.ed` | `mode=editor` | `#ed` |
| `ClipboardKeyboardController.qml` | `onKey()` | `onKey()` | `onKey()` | `onKey()` |
| `ClipboardKeyboardHints.qml` | `.ft .hk` | `.hints` | `.hint` | `.hints` |
| 清空 / 删除置顶确认 | `#ovCf` | `.cf` | `mode=confirm` | `#cf` |

`ClipboardConstants.qml`（LONG=200、PREVIEW=100）和 `Services/ClipboardService.qml` 的逻辑在各方案 js 里用 mock 实现。C 另需新增一个 compact 组件（复制提示），订阅 `ClipboardService` 的新增条目。
