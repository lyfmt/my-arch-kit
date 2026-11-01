import QtQuick
import QtQuick.Shapes
import qs.Modules.P3

// 水箱读数（原型 .st-tank）：panel 底的玻璃槽，液面高度 = level%，表面两层波纹慢慢漂移。
// 读数画两层：液面以上是 tx 色，没进液面的部分是 ink 色（裁到液面以下）。
// 槽下方一行：左 label、右 meta，按基线对齐。
Item {
    id: root

    property real level: 0              // 0..100
    property bool filled: true          // false：液面停在 0（入场前）
    property bool still: false
    property real glassH: 250
    property string num: ""
    property string unit: "%"
    property real numSize: 64
    property bool numLow: false         // 读数贴底（电池槽）
    property string label: ""
    property string meta: ""
    property int limit: 0               // 1..99：在该高度画充电上限刻度

    property real shownLevel: filled ? Math.max(0, Math.min(100, level)) : 0
    Behavior on shownLevel {
        enabled: !root.still
        NumberAnimation {
            duration: 1200
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.soft
        }
    }
    readonly property real surfY: glassH * (1 - Math.max(0, Math.min(100, shownLevel)) / 100)
    readonly property real numBase: numLow ? glassH - 27.3 : 63.7
    readonly property bool flowing: !still && visible

    implicitHeight: glassH + 31

    component Wave: Shape {
        id: wv
        property real tileW: 280
        property real amp: 2.6
        property real cycles: 2.2        // tileW 内的波数
        property real dur: 7000          // 平移 tileW 所需毫秒
        property bool reverse: false
        property bool running: false
        readonly property real per: tileW / cycles
        // 平移整数个波长，循环接缝处不跳
        readonly property real shift: per * Math.max(1, Math.floor(cycles))
        readonly property string d: {
            let s = "M0 5";
            for (let x = 0; x <= tileW * 2; x += 4)
                s += "L" + x + " " + (5 + Math.sin(x / per * Math.PI * 2) * amp).toFixed(2);
            return s + "L" + (tileW * 2) + " 10L0 10Z";
        }
        width: tileW * 2
        height: 10
        preferredRendererType: Shape.CurveRenderer
        ShapePath {
            fillColor: P3.fill
            strokeColor: "transparent"
            strokeWidth: 0
            PathSvg {
                path: wv.d
            }
        }
        NumberAnimation on x {
            running: wv.running
            from: wv.reverse ? -wv.shift : 0
            to: wv.reverse ? 0 : -wv.shift
            duration: Math.round(wv.dur * wv.shift / wv.tileW)
            loops: Animation.Infinite
        }
    }

    Rectangle {
        id: glass
        width: root.width
        height: root.glassH
        color: P3.panel
        clip: true

        NumUnit {
            x: 18
            y: root.numBase - baseY
            text: root.num
            unit: root.unit
            size: root.numSize
        }

        Item {
            id: water
            y: root.surfY
            width: parent.width
            height: root.glassH - root.surfY
            Rectangle {
                anchors.fill: parent
                color: P3.fill
            }
            Item {
                id: surf
                property real bob: 0
                y: -9 + bob
                width: parent.width
                height: 10
                SequentialAnimation on bob {
                    running: root.flowing
                    loops: Animation.Infinite
                    NumberAnimation {
                        to: 1.5
                        duration: 2300
                        easing.type: Easing.InOutSine
                    }
                    NumberAnimation {
                        to: 0
                        duration: 2300
                        easing.type: Easing.InOutSine
                    }
                }
                Wave {
                    y: -3
                    opacity: 0.4
                    tileW: root.width
                    amp: 2.2
                    cycles: 1.5
                    dur: 11000
                    reverse: true
                    running: root.flowing
                }
                Wave {
                    tileW: root.width
                    amp: 2.6
                    cycles: 2.2
                    dur: 7000
                    running: root.flowing
                }
            }
        }

        Item {
            id: inkClip
            y: root.surfY + 2
            width: parent.width
            height: Math.max(0, root.glassH - y)
            clip: true
            NumUnit {
                x: 18
                y: root.numBase - baseY - inkClip.y
                text: root.num
                unit: root.unit
                size: root.numSize
                color: P3.ink
                unitColor: P3.ink
            }
        }

        Rectangle {
            id: limitMark
            visible: root.limit > 0 && root.limit < 100
            x: parent.width - 22
            y: root.glassH * (1 - root.limit / 100) - 2
            width: 22
            height: 2
            color: P3.tx
            P3Text {
                kind: "meta"
                text: String(root.limit)
                color: P3.dim
                font.pixelSize: 13
                font.letterSpacing: 0.78
                x: -6 - implicitWidth
                y: 4.3 - baselineOffset
            }
        }
    }

    P3Text {
        kind: "label"
        text: root.label
        x: 2
        y: root.glassH + 29.3 - baselineOffset
    }
    P3Text {
        kind: "meta"
        text: root.meta
        color: P3.dim
        font.pixelSize: 15
        font.letterSpacing: 0.9
        x: root.width - 2 - implicitWidth
        y: root.glassH + 29.3 - baselineOffset
    }
}
