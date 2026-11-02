# 字体

| 文件 | 字体 | 许可证 | 来源 |
| --- | --- | --- | --- |
| `NunitoSans-BlackItalic-latin.woff2` | Nunito Sans（可变字体，latin 子集，用作 900 italic 展示字 "P3"） | SIL OFL 1.1 | Google Fonts，取自 `p5-reference/p3-menu/fonts/` |
| `NunitoSans-BlackItalic-latinext.woff2` | 同上，latin-ext 子集 | SIL OFL 1.1 | 同上 |
| `NunitoSans-BlackItalic.ttf` | 由上面两个 woff2 转出：固定 opsz=12 的静态实例，合并 latin + latin-ext，族名改成 `P3 Nunito Sans` 避免和系统字体冲突。QML 版用它 | SIL OFL 1.1 | fontTools 转换（`instancer` + `merge`） |
| `BarlowCondensed-Bold.ttf` | Barlow Condensed Bold | SIL OFL 1.1，全文见 `barlow-OFL.txt` | 取自 `p5-reference/save-carousel/fonts/` |

Nunito Sans 版权 © The Nunito Sans Project Authors，同样以 SIL Open Font License 1.1 授权（条款与 `barlow-OFL.txt` 相同，仅版权行不同）。

`../bg.png`（本地，不进 git）是本仓库自绘的倒立初音背景，取自 `p5-reference/p3-miku/bg.png`。

Quickshell（Qt）读不了 woff2，所以 QML 版用 `NunitoSans-BlackItalic.ttf` 和 `BarlowCondensed-Bold.ttf`，由 `Theme.qml` 的 `FontLoader` 加载，不依赖系统字体。woff2 留给 HTML 原型。
