import QtQuick
import QtQuick.Shapes

// 原型 .power：替换密码块位置的三行纯文字。选中项 = 白楔 + 红碎片 + 红残影（全屏唯一的斜元素）。
// 舞台坐标：left 1010、top 712，每行 64px，提示行在三行下方 26px
Item {
    id: root

    required property var session
    required property real now
    property bool interactive: true

    readonly property var names: ({ suspend: "SUSPEND", reboot: "REBOOT", poweroff: "POWER OFF" })

    x: 1010
    y: 712
    width: 820
    height: 192 + 26 + 20

    Repeater {
        model: root.session.actions

        delegate: Item {
            id: pi

            required property string modelData
            required property int index
            readonly property bool sel: root.session.psel === index
            readonly property bool ask: root.session.pask === index
            readonly property string label: root.names[modelData] + (ask ? "?" : "")

            // 入场：依次 .06 / .12 / .18s；opacity .3s、位移 .5s；离开无延迟
            Delayed {
                id: shown
                source: root.session.pmode
                delay: 60 * (pi.index + 1)
            }
            property real enter: shown.value ? 1 : 0
            property real slide: shown.value ? 0 : 60
            Behavior on enter { NumberAnimation { duration: 300; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
            Behavior on slide { NumberAnimation { duration: 500; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }

            x: slide
            y: index * 64
            width: tx.implicitWidth + 26
            height: 64
            opacity: enter

            // 白楔：inset -20 -24 -10 -14，clip-path polygon(0 34%, 100% 0, 98% 100%, 4% 92%)；选中时从左缘展开 320ms
            readonly property real wp: Theme.bez(Theme.eOut, (root.now - root.session.pselAt) / 320)
            // 执行时的弹一下：40% 处 scale(1.06, 1.2)
            readonly property real hitT: (root.now - root.session.phitAt) / 380
            readonly property real hit: !sel || hitT < 0 || hitT >= 1 ? 0 : hitT < 0.4 ? Theme.bez(Theme.eSnap, hitT / 0.4) : 1 - Theme.bez(Theme.eSnap, (hitT - 0.4) / 0.6)

            Shape {
                id: wedge
                visible: pi.sel
                x: -14
                y: -20
                width: pi.width + 38
                height: 94
                preferredRendererType: Shape.CurveRenderer
                transform: Scale {
                    origin.x: wedge.width / 2
                    origin.y: wedge.height / 2
                    xScale: 1 + 0.06 * pi.hit
                    yScale: 1 + 0.2 * pi.hit
                }
                ShapePath {
                    fillColor: Theme.shard
                    strokeColor: "transparent"
                    strokeWidth: 0
                    PathPolyline {
                        readonly property real w: wedge.width
                        readonly property real h: wedge.height
                        readonly property real p: pi.wp
                        path: [
                            Qt.point(0, 0.34 * h),
                            Qt.point(p * w, 0.34 * h * (1 - p)),
                            Qt.point((0.04 + 0.94 * p) * w, (0.92 + 0.08 * p) * h),
                            Qt.point(0.04 * w, 0.92 * h),
                            Qt.point(0, 0.34 * h)
                        ]
                    }
                }
            }

            // 红碎片：left -26、宽 38%、top -12、bottom 14，polygon(0 92%, 100% 0, 82% 36%)；延迟 40ms 从左下弹入
            Shape {
                id: shard
                readonly property real sp: Theme.bez(Theme.eSnap, (root.now - root.session.pselAt - 40) / 320)
                visible: pi.sel
                x: -26 - 30 * (1 - sp)
                y: -12 + 10 * (1 - sp)
                width: 0.38 * pi.width
                height: 62
                opacity: Math.min(1, Math.max(0, sp))
                preferredRendererType: Shape.CurveRenderer
                ShapePath {
                    fillColor: Theme.red
                    strokeColor: "transparent"
                    strokeWidth: 0
                    PathPolyline {
                        path: [Qt.point(0, 0.92 * shard.height), Qt.point(shard.width, 0), Qt.point(0.82 * shard.width, 0.36 * shard.height), Qt.point(0, 0.92 * shard.height)]
                    }
                }
            }

            // 红残影：选中时 translate(4px, 3px)，确认态 (6px, 4px)
            property real echoOp: sel ? 1 : 0
            property real echoDx: ask ? 6 : sel ? 4 : 0
            property real echoDy: ask ? 4 : sel ? 3 : 0
            Behavior on echoOp { NumberAnimation { duration: 160; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eEase } }
            Behavior on echoDx { NumberAnimation { duration: 320; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
            Behavior on echoDy { NumberAnimation { duration: 320; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }

            Text {
                id: echo
                x: 8
                y: 6 + 0.759 * 48 - baselineOffset
                text: pi.label
                color: Theme.red
                opacity: pi.echoOp
                font.family: Theme.display
                font.pixelSize: 48
                font.weight: Font.Black
                font.italic: true
                font.letterSpacing: -0.48
                transform: [
                    Scale {
                        origin.x: 0
                        origin.y: echo.baselineOffset
                        xScale: pi.sel ? 1.06 : 1
                        yScale: pi.sel ? 1.06 : 1
                    },
                    Rotation {
                        origin.x: 0
                        origin.y: echo.baselineOffset
                        angle: pi.sel ? -3 : 0
                    },
                    Translate {
                        x: pi.echoDx
                        y: pi.echoDy
                    }
                ]
            }

            // 文字颜色 c3 → 墨色，160ms；原型 pmode 下颜色的 transition-delay 被覆盖为 0
            property color tcol: pi.sel ? Theme.ink : Theme.c3
            Behavior on tcol { ColorAnimation { duration: 160; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eEase } }

            Text {
                id: tx
                x: 8
                y: 6 + 0.759 * 48 - baselineOffset
                text: pi.label
                color: pi.tcol
                font.family: Theme.display
                font.pixelSize: 48
                font.weight: Font.Black
                font.italic: true
                font.letterSpacing: -0.48
                transform: [
                    Scale {
                        origin.x: 0
                        origin.y: tx.baselineOffset
                        xScale: pi.sel ? 1.06 : 1
                        yScale: pi.sel ? 1.06 : 1
                    },
                    Rotation {
                        origin.x: 0
                        origin.y: tx.baselineOffset
                        angle: pi.sel ? -3 : 0
                    }
                ]
            }

            MouseArea {
                anchors.fill: parent
                enabled: root.interactive && root.session.pmode
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onEntered: root.session.powerSelect(pi.index)
                onClicked: {
                    root.session.powerSelect(pi.index);
                    root.session.powerFire();
                    root.session.arm();
                }
            }
        }
    }

    // 提示行：AGAIN TO CONFIRM（红）/ 执行结果
    Delayed {
        id: footShown
        source: root.session.pmode
        delay: 260
    }
    StatusLine {
        x: 0
        y: 192 + 26
        opacity: footOp
        property real footOp: footShown.value ? 1 : 0
        Behavior on footOp { NumberAnimation { duration: 300; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eEase } }
        text: root.session.pmsg
        red: root.session.pred
    }
}
