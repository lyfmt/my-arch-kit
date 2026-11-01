import QtQuick

// 平涂开关（原型 .p-switch）：56×28，2px 描边；开 = 填满 on 色、滑块右移 28px（spring）。
// 放在 P3Toggle / P3Row 里，颜色跟随所在的 P3Focusable。
Item {
    id: root

    property bool on: false
    property P3Focusable host: null
    readonly property color trackC: host ? host.trackColor : P3.line
    readonly property color onC: host ? host.onColor : P3.fill
    readonly property color knobOff: host ? host.dimColor : P3.dim
    readonly property color knobOn: host && host.focused && host.cursor === "wedge" ? P3.shard : P3.ink

    implicitWidth: 56
    implicitHeight: 28

    Rectangle {
        anchors.fill: parent
        color: root.on ? root.onC : "transparent"
        border.color: root.on ? root.onC : root.trackC
        border.width: 2
    }
    Rectangle {
        x: root.on ? 33 : 5
        y: 5
        width: 18
        height: 18
        color: root.on ? root.knobOn : root.knobOff
        Behavior on x {
            NumberAnimation {
                duration: 280
                easing.bezierCurve: P3.spring
            }
        }
    }
}
