import QtQuick

// 一个字（原型的 .g）：平涂，只做 translate + skewX（transform-origin 在字框中心）
Text {
    id: g
    objectName: "glyph"

    property int role: 0          // 0 主句 --main，1 拍点 --red，2 翻译 / 歌手 --sub
    property real tx: 0
    property real ty: 0
    property real sk: 0           // skewX，度
    readonly property real k: Math.tan(sk * Math.PI / 180)

    color: role === 1 ? Theme.red : role === 2 ? Theme.sub : Theme.main
    verticalAlignment: Text.AlignVCenter
    textFormat: Text.PlainText
    renderType: Text.QtRendering
    transform: Matrix4x4 {
        matrix: Qt.matrix4x4(1, g.k, 0, g.tx - g.k * g.height / 2,
                             0, 1, 0, g.ty,
                             0, 0, 1, 0,
                             0, 0, 0, 1)
    }
}
