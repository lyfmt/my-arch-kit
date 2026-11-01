import QtQuick
import QtQuick.Effects

// 焦点光点（原型 .p-tide）：9px fill 色圆点，sky 光晕 1.8s 脉动，18px 波纹环向外扩散。
// 由框架放在焦点元素左上角（-7, -5）并随焦点滑动；页面不直接使用。
Item {
    id: root

    property bool on: false
    property bool still: false        // 截图模式：不做循环动画
    property int popSerial: 0         // 每次 +1 弹一下（新焦点 / 激活）

    width: 0
    height: 0
    opacity: on ? 1 : 0
    Behavior on opacity {
        NumberAnimation {
            duration: 120
        }
    }

    Item {
        id: dot
        x: -7
        y: -5
        width: 9
        height: 9
        property real pulse: 0
        scale: 1 + pulse * 0.12

        RectangularShadow {
            anchors.fill: parent
            radius: 4.5
            blur: 16 + dot.pulse * 10
            spread: 5 + dot.pulse * 4
            color: P3.glowSoft
        }
        RectangularShadow {
            anchors.fill: parent
            radius: 4.5
            blur: 6 + dot.pulse * 3
            spread: 2 + dot.pulse
            color: P3.alpha(P3.sky, 0.85 + dot.pulse * 0.1)
        }
        Rectangle {
            anchors.fill: parent
            radius: 4.5
            color: P3.fill
        }
        SequentialAnimation on pulse {
            running: root.on && !root.still
            loops: Animation.Infinite
            NumberAnimation {
                to: 1
                duration: 900
                easing.type: Easing.InOutSine
            }
            NumberAnimation {
                to: 0
                duration: 900
                easing.type: Easing.InOutSine
            }
        }
    }

    // 波纹环
    Rectangle {
        id: ring
        x: -11.5
        y: -9.5
        width: 18
        height: 18
        radius: 9
        color: "transparent"
        border.color: P3.fill
        border.width: 1.5
        opacity: 0
        scale: 0.5
        ParallelAnimation {
            running: root.on && !root.still
            loops: Animation.Infinite
            NumberAnimation {
                target: ring
                property: "scale"
                from: 0.5
                to: 1.9
                duration: 1800
                easing.type: Easing.OutQuad
            }
            NumberAnimation {
                target: ring
                property: "opacity"
                from: 0.75
                to: 0
                duration: 1800
                easing.type: Easing.OutQuad
            }
        }
    }

    // 弹一下（原型 tdPopDot：.2 → 1.5 → 1）
    onPopSerialChanged: if (!still)
        pop.restart()
    SequentialAnimation {
        id: pop
        NumberAnimation {
            target: dot
            property: "scale"
            from: 0.2
            to: 1.5
            duration: 180
            easing.type: Easing.OutQuad
        }
        NumberAnimation {
            target: dot
            property: "scale"
            to: 1
            duration: 160
            easing.bezierCurve: P3.spring
        }
        ScriptAction {
            script: dot.scale = Qt.binding(() => 1 + dot.pulse * 0.12)
        }
    }
}
