import QtQuick
import qs.Modules.P3

// 密码框（原型 .sy-field）：36px 高 1px 细线框；每个字符一个菱形点，后跟闪烁光标；空时光标 + PASSWORD。
// 输入由页面的 handleKey 处理（焦点在这里时），count = 已输入的字符数。
SyFocus {
    id: root

    property int count: 0
    property bool still: false

    line: false
    clickActivates: false
    height: 36

    Rectangle {
        anchors.fill: parent
        color: "transparent"
        border.width: 1
        border.color: P3.line
    }
    Row {
        x: 14
        anchors.verticalCenter: parent.verticalCenter
        spacing: 7
        Repeater {
            model: root.count
            Item {
                width: 10
                height: 10
                anchors.verticalCenter: parent.verticalCenter
                Rectangle {
                    anchors.centerIn: parent
                    width: 10
                    height: 10
                    color: P3.tx
                    rotation: 45
                    scale: 0.86
                    NumberAnimation on scale {
                        running: !root.still
                        from: 0
                        to: 0.86
                        duration: 220
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.spring
                    }
                }
            }
        }
        Rectangle {
            anchors.verticalCenter: parent.verticalCenter
            width: 2
            height: 20
            color: P3.fill
            SequentialAnimation on opacity {
                running: !root.still
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
            visible: root.count === 0
            anchors.verticalCenter: parent.verticalCenter
            kind: "label"
            font.pixelSize: 15
            font.letterSpacing: 15 * 0.14
            text: "PASSWORD"
            color: P3.dim
        }
    }
}
