import QtQuick

// 只读读数条（原型 .p-bar）：6px 高，track 底 + fill 前景（hot = 红）。value 0..100。
Item {
    id: root

    property real value: 0
    property bool hot: false
    property color trackColor: P3.line
    property color onColor: hot ? P3.accent : P3.fill

    implicitWidth: 200
    implicitHeight: 6

    Rectangle {
        anchors.fill: parent
        color: root.trackColor
    }
    Rectangle {
        height: parent.height
        width: parent.width * Math.max(0, Math.min(100, root.value)) / 100
        color: root.onColor
        Behavior on width {
            NumberAnimation {
                duration: 600
                easing.bezierCurve: P3.ease
            }
        }
    }
}
