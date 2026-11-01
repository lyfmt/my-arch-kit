import QtQuick
import qs.Modules.P3

// 按键块（原型 .sy-kc）："Mod+Shift+T" → 每段一个 1px 描边小块；changed = 和初始绑定不同（描边为前景色）
Row {
    id: root

    property string keys: ""
    property bool changed: false
    property color fg: P3.tx
    property color track: P3.line

    spacing: 6

    Repeater {
        model: root.keys ? root.keys.split("+") : []
        Item {
            id: chip
            required property string modelData
            width: t.implicitWidth + 16
            height: 26
            Rectangle {
                anchors.fill: parent
                color: "transparent"
                border.width: 1
                border.color: root.changed ? root.fg : root.track
            }
            P3Text {
                id: t
                anchors.centerIn: parent
                anchors.verticalCenterOffset: 0.5
                kind: "label"
                font.pixelSize: 15
                font.letterSpacing: 15 * 0.08
                text: chip.modelData
                color: root.fg
            }
        }
    }
}
