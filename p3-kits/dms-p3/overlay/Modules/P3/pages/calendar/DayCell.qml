import QtQuick
import QtQuick.Shapes
import qs.Modules.P3
import qs.P3Sys

// 月历的一格（原型 .cl-c）：日期数字、休/班、日程点。今天在数字后面垫白色楔形 + 红色残影；
// 焦点时数字以左下角为原点放大到 1.16。
P3Focusable {
    id: cell

    required property int index
    property Item sheet: null
    readonly property var host: sheet ? sheet.host : null

    readonly property bool calCell: true
    readonly property var date: sheet ? new Date(sheet.year, sheet.month, 1 - sheet.lead + index) : new Date(0)
    readonly property string key: host ? host.keyOf(date) : ""
    readonly property bool out: !sheet || date.getMonth() !== sheet.month
    readonly property bool weekend: date.getDay() === 0 || date.getDay() === 6
    readonly property var info: Calendar.day(date)
    readonly property bool today: !!host && host.todayKey === key
    readonly property bool hasDot: {
        if (!host)
            return false;
        host.evRev;
        const ev = host.eventsOf(key);
        return !!ev && ev.length > 0;
    }
    readonly property bool still: !!host && host.still

    // 原型：.out 用 rgba(fill,.3)，焦点时 dim；周末（非调休上班）的数字混 20% sky
    readonly property color fgBase: out ? (focused ? P3.dim : P3.alpha(P3.fill, 0.3)) : (focused ? P3.fill : P3.tx)
    readonly property color numColor: today ? P3.ink : weekend && !(info && info.work) ? mix(fgBase, P3.sky, 0.2) : fgBase

    // CSS color-mix(in srgb, a (1-t), b t)：预乘 alpha 插值
    function mix(a, b, t) {
        const wa = a.a * (1 - t), wb = b.a * t, A = wa + wb;
        if (A <= 0)
            return Qt.rgba(0, 0, 0, 0);
        return Qt.rgba((a.r * wa + b.r * wb) / A, (a.g * wa + b.g * wb) / A, (a.b * wa + b.b * wb) / A, A);
    }

    width: sheet ? sheet.cellW : 0
    height: 88
    x: (index % 7) * width
    y: 141 + Math.floor(index / 7) * 88
    opacity: 1
    disabled: !sheet || !sheet.live

    onActivated: if (host)
        host.select(date)

    Rectangle {
        y: 87
        width: parent.width
        height: 1
        color: P3.line
    }

    P3Text {
        visible: !!cell.info && (cell.info.off || cell.info.work)
        x: cell.width - 14 - implicitWidth
        y: 12
        kind: "zh"
        font.pixelSize: 16
        font.letterSpacing: 0.96
        text: cell.info && cell.info.off ? "休" : "班"
        color: cell.info && cell.info.off ? P3.sky : P3.dim
    }

    // 数字盒：44px、line-height .86 → 高 37.84，底边距格底 13（12 内边距 + 1 线）；基线在盒顶下 31.9（对齐原型的实测位置）
    Item {
        id: nbox

        property real s: cell.focused ? 1.16 : 1

        x: 16
        y: 75 - height
        width: num.implicitWidth
        height: 37.84
        transform: Scale {
            origin.x: 0
            origin.y: nbox.height
            xScale: nbox.s
            yScale: nbox.s
        }
        Behavior on s {
            enabled: !cell.still
            NumberAnimation {
                duration: 220
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.soft
            }
        }

        // 今天：外扩 -6 -14 -8 -14，clip-path polygon(12px 4px, 100% 0, 100%-6px 100%, 0 92%)
        Item {
            id: wedge

            visible: cell.today
            x: -14
            y: -6
            width: nbox.width + 28
            height: nbox.height + 14

            Shape {
                anchors.fill: parent
                preferredRendererType: Shape.CurveRenderer
                transform: Translate {
                    x: cell.focused ? 9 : 6
                    y: cell.focused ? 7 : 5
                    Behavior on x {
                        enabled: !cell.still
                        NumberAnimation {
                            duration: 200
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.soft
                        }
                    }
                    Behavior on y {
                        enabled: !cell.still
                        NumberAnimation {
                            duration: 200
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.soft
                        }
                    }
                }
                ShapePath {
                    fillColor: P3.accent
                    strokeColor: "transparent"
                    startX: 12
                    startY: 4
                    PathLine {
                        x: wedge.width
                        y: 0
                    }
                    PathLine {
                        x: wedge.width - 6
                        y: wedge.height
                    }
                    PathLine {
                        x: 0
                        y: wedge.height * 0.92
                    }
                    PathLine {
                        x: 12
                        y: 4
                    }
                }
            }
            Shape {
                anchors.fill: parent
                preferredRendererType: Shape.CurveRenderer
                ShapePath {
                    fillColor: P3.shard
                    strokeColor: "transparent"
                    startX: 12
                    startY: 4
                    PathLine {
                        x: wedge.width
                        y: 0
                    }
                    PathLine {
                        x: wedge.width - 6
                        y: wedge.height
                    }
                    PathLine {
                        x: 0
                        y: wedge.height * 0.92
                    }
                    PathLine {
                        x: 12
                        y: 4
                    }
                }
            }
        }

        P3Text {
            id: num
            y: 31.9 - baselineOffset
            kind: "num"
            font.pixelSize: 44
            font.letterSpacing: -0.44
            text: String(cell.date.getDate())
            color: cell.numColor
            Behavior on color {
                enabled: !cell.still
                ColorAnimation {
                    duration: 120
                }
            }
        }
    }

    // 日程点：8px 方块转 45°，紧跟数字（gap 10，今天再让出 8），底边距格底 20
    Rectangle {
        visible: cell.hasDot
        x: 16 + nbox.width + 10 + (cell.today ? 8 : 0)
        y: 61
        width: 8
        height: 8
        rotation: 45
        color: cell.focused ? P3.fill : P3.sky
    }
}
