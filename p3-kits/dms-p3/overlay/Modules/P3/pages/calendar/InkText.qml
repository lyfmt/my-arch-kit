import QtQuick
import qs.Modules.P3

// 展示字（P3 Display）加原型的 --ink-shadow：0 4px 0 deep .8、-2px 2px 0 deep .55。
Item {
    id: root

    property string text: ""
    property real px: 76
    property color color: P3.tx

    implicitWidth: face.implicitWidth
    implicitHeight: face.implicitHeight
    baselineOffset: face.baselineOffset

    P3Text {
        x: -2
        y: 2
        kind: "num"
        font.pixelSize: root.px
        font.letterSpacing: -0.01 * root.px
        text: root.text
        color: P3.alpha(P3.deep, 0.55)
    }
    P3Text {
        y: 4
        kind: "num"
        font.pixelSize: root.px
        font.letterSpacing: -0.01 * root.px
        text: root.text
        color: P3.alpha(P3.deep, 0.8)
    }
    P3Text {
        id: face
        kind: "num"
        font.pixelSize: root.px
        font.letterSpacing: -0.01 * root.px
        text: root.text
        color: root.color
    }
}
