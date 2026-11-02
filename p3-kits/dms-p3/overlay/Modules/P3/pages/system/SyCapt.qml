import QtQuick
import qs.Modules.P3

// 录键状态（原型 .sy-capt）：闪烁的红色小方块 + PRESS KEYS
Row {
    id: root

    property bool still: false

    spacing: 12

    Rectangle {
        anchors.verticalCenter: parent.verticalCenter
        width: 10
        height: 10
        color: P3.accent
        SequentialAnimation on opacity {
            running: !root.still && root.visible
            loops: Animation.Infinite
            PropertyAction {
                value: 1
            }
            PauseAnimation {
                duration: 500
            }
            PropertyAction {
                value: 0
            }
            PauseAnimation {
                duration: 500
            }
        }
    }
    P3Text {
        anchors.verticalCenter: parent.verticalCenter
        kind: "label"
        font.pixelSize: 15
        font.letterSpacing: 15 * 0.14
        text: "PRESS KEYS"
        color: P3.accent
    }
}
