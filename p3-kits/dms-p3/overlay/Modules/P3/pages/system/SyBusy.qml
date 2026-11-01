import QtQuick
import qs.Modules.P3

// 忙碌条（原型 .sy-busy）：70×3 轨道上一段 30% 的块从左到右循环
Item {
    id: root

    property color trackColor: P3.line
    property color onColor: P3.fill
    property bool still: false

    implicitWidth: 70
    implicitHeight: 3
    clip: true

    Rectangle {
        anchors.fill: parent
        color: root.trackColor
    }
    Rectangle {
        id: chunk
        width: root.width * 0.3
        height: parent.height
        x: root.still ? root.width * 0.35 : -width
        color: root.onColor
        NumberAnimation on x {
            running: !root.still && root.visible
            from: -chunk.width
            to: root.width
            duration: 900
            loops: Animation.Infinite
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
    }
}
