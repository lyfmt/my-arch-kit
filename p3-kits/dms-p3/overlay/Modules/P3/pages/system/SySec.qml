import QtQuick
import qs.Modules.P3

// 分节标题（.p-sec，SYSTEM 页的间距）：15px 字 + 右侧细线；below = 下边距（10，.fr 为 24）。
// 自带换入动画：随块滑入，细线在 80ms 后从左向右展开（.6s）。
Item {
    id: root

    property string text: ""
    property real below: 10
    readonly property bool syIn: true
    property real dx: 0

    implicitWidth: 300
    implicitHeight: 15 + below

    transform: Translate {
        x: root.dx
    }

    P3Text {
        id: t
        anchors.verticalCenter: parent.top
        anchors.verticalCenterOffset: 7.5
        kind: "sec"
        text: root.text
        color: P3.dim
    }
    Rectangle {
        id: rule
        x: t.width + 16
        y: 7
        width: Math.max(0, root.width - x)
        height: 1
        color: P3.line
        transform: Scale {
            id: ruleScale
        }
    }

    function play(i) {
        anim.stop();
        opacity = 0.01;
        dx = 46;
        ruleScale.xScale = 0;
        pause.duration = i * 34;
        anim.start();
    }

    SequentialAnimation {
        id: anim
        PauseAnimation {
            id: pause
        }
        ParallelAnimation {
            NumberAnimation {
                target: root
                property: "opacity"
                to: 1
                duration: 460
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: root
                property: "dx"
                to: 0
                duration: 460
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            SequentialAnimation {
                PauseAnimation {
                    duration: 80
                }
                NumberAnimation {
                    target: ruleScale
                    property: "xScale"
                    to: 1
                    duration: 600
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
        }
    }
}
