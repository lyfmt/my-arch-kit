import QtQuick
import qs.Modules.P3

// 信号格（原型 .sy-sig）：四根柱 25/50/75/100% 高，达到阈值 1/30/55/75 的点亮。big = 44px 高。
Row {
    id: root

    property real value: 0
    property bool big: false
    property color litColor: P3.tx
    property color offColor: P3.line
    readonly property int lit: [1, 30, 55, 75].filter(t => value >= t).length
    readonly property real h: big ? 44 : 20

    spacing: big ? 6 : 3
    height: h

    Repeater {
        model: 4
        Rectangle {
            required property int index
            anchors.bottom: parent.bottom
            width: root.big ? 10 : 5
            height: root.h * (index + 1) / 4
            color: index < root.lit ? root.litColor : root.offColor
        }
    }
}
