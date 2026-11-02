import QtQuick
import qs.Modules.P3

// 液态开关（原型 .sy .p-switch）：60×28，2px 描边；开时圆头填充从左扫入（.5s 回弹），
// 滑块右移 32px，翻转途中拉长到 30px（拖尾一侧）。颜色跟随所在的 P3Focusable。
Item {
    id: root

    property bool on: false
    property P3Focusable host: null
    readonly property color trackC: host ? host.trackColor : P3.line
    readonly property color onC: host ? host.onColor : P3.fill
    readonly property color knobOff: host ? host.dimColor : P3.dim
    property real stretch: 0

    implicitWidth: 60
    implicitHeight: 28
    clip: true

    onOnChanged: knobAnim.restart()

    Rectangle {
        x: root.on ? -28 : -102
        width: 88
        height: 28
        color: root.onC
        topRightRadius: 14
        bottomRightRadius: 14
        Behavior on x {
            NumberAnimation {
                duration: 500
                easing.type: Easing.BezierSpline
                easing.bezierCurve: [0.3, 1.35, 0.5, 1, 1, 1]
            }
        }
    }
    Rectangle {
        anchors.fill: parent
        color: "transparent"
        border.width: 2
        border.color: root.on ? root.onC : root.trackC
    }
    Rectangle {
        id: knob
        property real base: root.on ? 37 : 5
        x: base - (root.on ? root.stretch : 0)
        y: 5
        width: 18 + root.stretch
        height: 18
        color: root.on ? P3.ink : root.knobOff
        Behavior on base {
            NumberAnimation {
                duration: 420
                easing.type: Easing.BezierSpline
                easing.bezierCurve: [0.3, 1.5, 0.5, 1, 1, 1]
            }
        }
        Behavior on color {
            ColorAnimation {
                duration: 150
            }
        }
    }
    SequentialAnimation {
        id: knobAnim
        NumberAnimation {
            target: root
            property: "stretch"
            to: 12
            duration: 147
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
        NumberAnimation {
            target: root
            property: "stretch"
            to: 0
            duration: 273
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
    }
}
