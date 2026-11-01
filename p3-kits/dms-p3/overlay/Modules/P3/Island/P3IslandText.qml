import QtQuick
import qs.Modules.P3

// 岛上的文字，字号按原型逐处给。face：d = P3 Display 斜体 900（数字、名词），
// l = Barlow Condensed Bold 大写 + 字距，zh = Noto Sans CJK SC 500。
Text {
    property string face: "d"
    property real size: 13
    property real spacing: face === "d" ? -0.01 : face === "l" ? 0.14 : 0.06

    color: P3.tx
    font.family: face === "d" ? P3.fontDisplay : face === "l" ? P3.fontLabel : P3.fontZh
    font.pixelSize: size
    font.italic: face === "d"
    font.weight: face === "d" ? Font.Black : face === "l" ? Font.Bold : Font.Medium
    font.letterSpacing: size * spacing
    font.capitalization: face === "l" ? Font.AllUppercase : Font.MixedCase
    textFormat: Text.PlainText
    renderType: Text.QtRendering
    maximumLineCount: 1
    wrapMode: Text.NoWrap
}
