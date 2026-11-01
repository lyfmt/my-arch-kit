import QtQuick
import QtQuick.Shapes

// 楔形焦点（原型 .p-cursor，data-cursor="wedge"）：白色斜切块垫在元素后面，红色残影偏移 (6,5)。
// 外扩 inset: -6px -8px -6px -14px，clip-path polygon(14px 0, 100% 0, 100%-6px 100%, 0 100%)。
Item {
    id: root

    property bool on: false
    property bool moving: false       // 移动瞬间残影跳到 (-10,5) 再弹回
    property int popSerial: 0

    opacity: on ? 1 : 0
    Behavior on opacity {
        NumberAnimation {
            duration: 120
        }
    }

    component Wedge: Shape {
        property color c
        x: -14
        y: -6
        width: root.width + 22
        height: root.height + 12
        ShapePath {
            fillColor: c
            strokeColor: "transparent"
            startX: 14
            startY: 0
            PathLine {
                x: root.width + 22
                y: 0
            }
            PathLine {
                x: root.width + 16
                y: root.height + 12
            }
            PathLine {
                x: 0
                y: root.height + 12
            }
            PathLine {
                x: 14
                y: 0
            }
        }
    }

    Wedge {
        id: echo
        c: P3.accent
        transform: Translate {
            id: echoT
            x: 6
            y: 5
        }
    }
    Wedge {
        id: shard
        c: P3.shard
        transform: Scale {
            id: popS
            origin.x: shard.width / 2
            origin.y: shard.height / 2
        }
    }

    onMovingChanged: if (moving) {
        echoT.x = -10;
        echoBack.restart();
    }
    NumberAnimation {
        id: echoBack
        target: echoT
        property: "x"
        to: 6
        duration: 300
        easing.bezierCurve: P3.soft
    }
    onPopSerialChanged: pop.restart()
    SequentialAnimation {
        id: pop
        ParallelAnimation {
            NumberAnimation {
                target: popS
                property: "xScale"
                to: 1.04
                duration: 120
            }
            NumberAnimation {
                target: popS
                property: "yScale"
                to: 1.18
                duration: 120
            }
        }
        NumberAnimation {
            target: popS
            properties: "xScale,yScale"
            to: 1
            duration: 180
            easing.bezierCurve: P3.ease
        }
    }
}
