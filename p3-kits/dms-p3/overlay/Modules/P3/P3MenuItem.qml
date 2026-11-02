import QtQuick
import QtQuick.Shapes

// 主列表的一项（原型 .it）：P3 展示字 78px，沿头发对角线斜放。
//   选中 .on：白色楔形碎片 + 红色碎片垫底、红色残影 (5,4)、文字变 ink、放大 1.3 并左移 22px
//   paged：缩成左侧竖排的 rail（scale .4），非选中项变 dim
//   playIn() / playOut()：打开 / 关闭时的入场与退场
Item {
    id: root

    property var it: ({})
    property int slot: 0                     // 在主列表里的序号
    property int count: 5
    property bool on: false
    property bool paged: false
    property bool still: false
    readonly property real rx: 150
    readonly property real ry: 270 + slot * 62
    signal clicked

    x: it.x || 0
    y: it.y || 0
    width: label.implicitWidth
    height: label.implicitHeight
    z: on ? 2 : 1

    readonly property color baseColor: P3[it.c || "c1"]

    // ---------------------------------------------------------------- rail（.paged .it）
    property real railT: paged ? 1 : 0
    Behavior on railT {
        enabled: !root.still
        SequentialAnimation {
            PauseAnimation {
                duration: root.slot * 32
            }
            NumberAnimation {
                duration: 620
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.soft
            }
        }
    }
    transform: [
        Scale {
            origin.x: 0
            origin.y: root.height * 0.6
            xScale: 1 - 0.6 * root.railT
            yScale: 1 - 0.6 * root.railT
        },
        Translate {
            x: (root.rx - root.x) * root.railT
            y: (root.ry - root.y) * root.railT
        }
    ]

    // ---------------------------------------------------------------- 入场 / 退场（.mv）
    Item {
        id: mv
        width: root.width
        height: root.height
        opacity: root.still ? 1 : 0
        transform: [
            Rotation {
                id: mvRot
                origin.x: mv.width / 2
                origin.y: mv.height / 2
            },
            Translate {
                id: mvT
            }
        ]

        // ------------------------------------------------------------ .rt（旋转 + 选中放大）
        Item {
            id: rt
            width: root.width
            height: root.height
            property real ang: root.paged ? 0 : (root.it.r || 0)
            property real sc: root.on ? 1.3 : 1
            property real tx: root.on ? (root.paged ? -10 : -22) : 0
            Behavior on ang {
                enabled: !root.still
                NumberAnimation {
                    duration: 220
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
            Behavior on sc {
                enabled: !root.still
                NumberAnimation {
                    duration: 220
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
            Behavior on tx {
                enabled: !root.still
                NumberAnimation {
                    duration: 220
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
            transform: [
                Scale {
                    origin.x: 0
                    origin.y: rt.height * 0.6
                    xScale: rt.sc
                    yScale: rt.sc
                },
                Translate {
                    x: rt.tx
                },
                Rotation {
                    origin.x: 0
                    origin.y: rt.height * 0.6
                    angle: rt.ang
                }
            ]

            // 红色碎片 .sr：left -96 right -22 top -40 bottom 6，polygon(0 88%, 100% 0, 88% 34%)
            Shape {
                id: sr
                x: -96
                y: -40
                width: root.width + 118
                height: root.height + 34
                opacity: root.on ? 1 : 0
                property real k: root.on ? 1 : 0.2
                Behavior on k {
                    enabled: !root.still
                    SequentialAnimation {
                        PauseAnimation {
                            duration: 30
                        }
                        NumberAnimation {
                            duration: 260
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.ease
                        }
                    }
                }
                Behavior on opacity {
                    NumberAnimation {
                        duration: 100
                    }
                }
                transform: Scale {
                    origin.x: sr.width
                    origin.y: 0
                    xScale: sr.k
                }
                ShapePath {
                    fillColor: P3.accent
                    strokeColor: "transparent"
                    startX: 0
                    startY: sr.height * 0.88
                    PathLine {
                        x: sr.width
                        y: 0
                    }
                    PathLine {
                        x: sr.width * 0.88
                        y: sr.height * 0.34
                    }
                    PathLine {
                        x: 0
                        y: sr.height * 0.88
                    }
                }
            }
            // 白色碎片 .sw：left -46 right -54 top -14 bottom -22，polygon(0 66%, 100% 0, 97% 100%, 12% 92%)
            Shape {
                id: sw
                x: -46
                y: -14
                width: root.width + 100
                height: root.height + 36
                opacity: root.on ? 1 : 0
                property real k: root.on ? 1 : 0.2
                property real hitX: 1
                property real hitY: 1
                Behavior on k {
                    enabled: !root.still
                    NumberAnimation {
                        duration: 220
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.ease
                    }
                }
                Behavior on opacity {
                    NumberAnimation {
                        duration: 100
                    }
                }
                transform: [
                    Scale {
                        origin.x: sw.width
                        origin.y: sw.height / 2
                        xScale: sw.k
                    },
                    Scale {
                        origin.x: sw.width / 2
                        origin.y: sw.height / 2
                        xScale: sw.hitX
                        yScale: sw.hitY
                    }
                ]
                ShapePath {
                    fillColor: P3.shard
                    strokeColor: "transparent"
                    startX: 0
                    startY: sw.height * 0.66
                    PathLine {
                        x: sw.width
                        y: 0
                    }
                    PathLine {
                        x: sw.width * 0.97
                        y: sw.height
                    }
                    PathLine {
                        x: sw.width * 0.12
                        y: sw.height * 0.92
                    }
                    PathLine {
                        x: 0
                        y: sw.height * 0.66
                    }
                }
            }

            // 红色残影 .echo
            P3Text {
                kind: "item"
                lineBox: true
                text: root.it.t || ""
                color: P3.accent
                opacity: root.on ? 1 : 0
                x: root.on ? 5 : 0
                y: root.on ? 4 : 0
                Behavior on opacity {
                    NumberAnimation {
                        duration: 100
                    }
                }
                Behavior on x {
                    enabled: !root.still
                    NumberAnimation {
                        duration: 200
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.ease
                    }
                }
                Behavior on y {
                    enabled: !root.still
                    NumberAnimation {
                        duration: 200
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.ease
                    }
                }
            }
            // 文字阴影（--ink-shadow：0 4px 0 deep .8, -2px 2px 0 deep .55），只在未选中且不在 rail 时
            Item {
                opacity: !root.on && !root.paged ? 1 : 0
                Behavior on opacity {
                    NumberAnimation {
                        duration: 120
                    }
                }
                P3Text {
                    kind: "item"
                    lineBox: true
                    text: root.it.t || ""
                    x: -2
                    y: 2
                    color: P3.alpha(P3.deep, 0.55)
                }
                P3Text {
                    kind: "item"
                    lineBox: true
                    text: root.it.t || ""
                    y: 4
                    color: P3.alpha(P3.deep, 0.8)
                }
            }
            P3Text {
                id: label
                kind: "item"
                lineBox: true
                text: root.it.t || ""
                color: root.on ? P3.ink : root.paged ? P3.dim : root.baseColor
                Behavior on color {
                    ColorAnimation {
                        duration: 120
                    }
                }
            }
        }
    }

    MouseArea {
        id: hitArea
        x: -30
        y: -20
        width: root.width + 60
        height: root.height + 40
        acceptedButtons: Qt.LeftButton
        onClicked: root.clicked()
    }
    // 点 (x, y)（item 的坐标）是否落在单击区里；框架用它让主列表跟随指针
    function hitAt(item, x, y) {
        const p = hitArea.mapFromItem(item, x, y);
        return hitArea.contains(p);
    }

    // 确认时白碎片弹一下（.hit：40% 处 scale(1.12, 1.25)）
    function hit() {
        if (!still)
            hitAnim.restart();
    }
    SequentialAnimation {
        id: hitAnim
        ParallelAnimation {
            NumberAnimation {
                target: sw
                property: "hitX"
                to: 1.12
                duration: 150
            }
            NumberAnimation {
                target: sw
                property: "hitY"
                to: 1.25
                duration: 150
            }
        }
        NumberAnimation {
            target: sw
            properties: "hitX,hitY"
            to: 1
            duration: 230
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
    }

    // itIn：from opacity 0, translateX 170, rotate 7deg；.72s spring，delay i*60ms + .2s
    function playIn() {
        outAnim.stop();
        if (still) {
            mv.opacity = 1;
            mvT.x = 0;
            mvRot.angle = 0;
            return;
        }
        mv.opacity = 0;
        mvT.x = 170;
        mvRot.angle = 7;
        inAnim.restart();
    }
    // itOut：to opacity 0, translateX -120, rotate -6deg；.32s，delay (n-1-i)*30ms
    function playOut() {
        inAnim.stop();
        if (still) {
            mv.opacity = 0;
            return;
        }
        outAnim.restart();
    }
    SequentialAnimation {
        id: inAnim
        PauseAnimation {
            duration: 200 + root.slot * 60
        }
        ParallelAnimation {
            NumberAnimation {
                target: mv
                property: "opacity"
                to: 1
                duration: 300
            }
            NumberAnimation {
                target: mvT
                property: "x"
                to: 0
                duration: 720
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.spring
            }
            NumberAnimation {
                target: mvRot
                property: "angle"
                to: 0
                duration: 720
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.spring
            }
        }
    }
    SequentialAnimation {
        id: outAnim
        PauseAnimation {
            duration: (root.count - 1 - root.slot) * 30
        }
        ParallelAnimation {
            NumberAnimation {
                target: mv
                property: "opacity"
                to: 0
                duration: 320
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.exit
            }
            NumberAnimation {
                target: mvT
                property: "x"
                to: -120
                duration: 320
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.exit
            }
            NumberAnimation {
                target: mvRot
                property: "angle"
                to: -6
                duration: 320
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.exit
            }
        }
    }
}
