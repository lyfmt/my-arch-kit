import QtQuick

// 原型的文字层级。kind 取 P3.type 里的键：
//   h1 h2 num numSm title item（P3 Display 斜体 900，line-height .86）
//   sec label value meta unit chip（Barlow Condensed Bold，大写 + 字距）
//   zh（Noto Sans CJK SC 500，字距 .06em）
//   P3Text { kind: "label"; text: "WI-FI"; color: row.fg }
// lineBox 为 true 时行盒和原型的 CSS 一致，上下各用负内边距收掉多出来的半个行距，baselineOffset 随之一致：
//   标签字（默认开）：line-height 1（meta 1.1），盒高 = 字号，基线在盒顶下 .9em（Barlow ascent + descent = 1.2em）。
//   展示字（默认关）：line-height .86，基线在盒顶下 .759em（P3 Display ascent 1.011 + descent .353）。
//     关着时盒高是 1.36em、基线在盒顶下 1.011em，页面里按 baselineOffset 摆放的展示字都按这个算；
//     菜单框架的主列表、标题和日期块打开它，按盒顶 / 盒底摆放即与原型对齐。
Text {
    id: root

    property string kind: "label"
    readonly property var spec: P3.type[kind] || P3.type.label
    // 标签字默认大写（原型 text-transform: uppercase）；value / zh 不转
    property bool upper: spec.family === "label" && kind !== "value"

    color: P3.tx
    font.family: spec.family === "display" ? P3.fontDisplay : spec.family === "zh" ? P3.fontZh : P3.fontLabel
    font.pixelSize: spec.size
    font.italic: spec.family === "display"
    font.weight: spec.family === "display" ? Font.Black : spec.family === "zh" ? Font.Medium : Font.Bold
    font.letterSpacing: spec.size * (spec.spacing !== undefined ? spec.spacing : (spec.family === "display" ? -0.01 : 0))
    font.capitalization: upper ? Font.AllUppercase : Font.MixedCase
    lineHeightMode: Text.ProportionalHeight
    lineHeight: spec.family === "display" ? 0.86 : 1
    property bool lineBox: spec.family === "label"
    readonly property real cssTrim: !lineBox ? 0 : spec.family === "label" ? font.pixelSize * (1.2 - (kind === "meta" ? 1.1 : 1)) / 2 : spec.family === "display" ? font.pixelSize * (1.011 + 0.353 - 0.86) / 2 : 0
    topPadding: -cssTrim
    bottomPadding: -cssTrim
    textFormat: Text.PlainText
    renderType: Text.QtRendering
}
