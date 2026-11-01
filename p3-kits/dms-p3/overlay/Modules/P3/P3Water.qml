import QtQuick
import QtQuick.Effects
import QtQuick.Shapes

// 水下背景（原型 .water）：唯一允许渐变的地方。
//   miku-bg 铺满（.sea inset -30），depth 深色团压住 APPS 后面的亮带，5 道光束摆动，16 个气泡上浮。
//   tide 0→1：斜边水面从屏幕底部涨上来（tideIn .8s / tideOut .5s，斜率同原型 clip-path）
//   dive 0→1：进入子页时水下放大 1.55（右下角为原点）+ 3px 模糊，veil 深色罩 .46
// 原型里的 caustic（feTurbulence 噪声）没有移植。
Item {
    id: root

    property real tide: 0
    property real dive: 0
    // 打开时水下从下方浮起（riseIn：translateY 80 + scale 1.04 → 原位），1 = 起点
    property real rise: 0
    property bool still: false
    property bool running: true
    readonly property real slant: Math.atan2(108, 1920) * 180 / Math.PI
    // 水面左端的 y：tide 0 = 1209.6（112%），1 = -129.6（-12%）
    readonly property real edgeY: 1209.6 - tide * 1339.2
    readonly property real x0: -300
    readonly property real y0: edgeY + 300 * 108 / 1920

    width: P3.stageW
    height: P3.stageH
    clip: true

    Item {
        id: clipper
        x: root.x0
        y: root.y0
        width: 2600
        height: 2600
        rotation: -root.slant
        transformOrigin: Item.TopLeft
        clip: true

        Item {
            id: water
            width: P3.stageW
            height: P3.stageH
            transform: [
                Translate {
                    x: -root.x0
                    y: -root.y0
                },
                Rotation {
                    angle: root.slant
                }
            ]

            // ---------------------------------------------------- .sea / .dive
            Item {
                id: dive
                x: -30
                y: -30
                width: P3.stageW + 60
                height: P3.stageH + 60
                transform: [
                    Scale {
                        origin.x: dive.width
                        origin.y: dive.height
                        xScale: 1 + 0.55 * root.dive
                        yScale: 1 + 0.55 * root.dive
                    },
                    Scale {
                        origin.x: dive.width / 2
                        origin.y: dive.height / 2
                        xScale: 1 + 0.04 * root.rise
                        yScale: 1 + 0.04 * root.rise
                    },
                    Translate {
                        y: 80 * root.rise
                    }
                ]
                layer.enabled: root.dive > 0.01
                layer.effect: MultiEffect {
                    blurEnabled: true
                    blurMax: 16
                    blur: 0.2 * root.dive
                }

                Image {
                    anchors.fill: parent
                    source: Qt.resolvedUrl("assets/miku-bg.png")
                    fillMode: Image.PreserveAspectCrop
                    asynchronous: false
                    cache: true
                    smooth: true
                }
                // .depth：900×520 椭圆，深色 .5，35% 之后淡出
                Shape {
                    x: 860 + 30
                    y: 120 + 30
                    width: 900
                    height: 900
                    opacity: 0.5
                    transform: Scale {
                        yScale: 520 / 900
                    }
                    ShapePath {
                        strokeColor: "transparent"
                        fillGradient: RadialGradient {
                            centerX: 450
                            centerY: 450
                            centerRadius: 450
                            focalX: 450
                            focalY: 450
                            GradientStop {
                                position: 0.35
                                color: P3.deep
                            }
                            GradientStop {
                                position: 1
                                color: P3.alpha(P3.deep, 0)
                            }
                        }
                        PathRectangle {
                            width: 900
                            height: 900
                        }
                    }
                }
                // .rays：5 道白色光束，24° 倾斜，12s 左右来回摆动
                Item {
                    x: 900 + 30
                    y: -80 + 30
                    width: 1100
                    height: 900
                    opacity: 0.75
                    Repeater {
                        model: [
                            [260, 40, 1, 14000],
                            [420, 90, 0.6, 12000],
                            [610, 26, 1, 9000],
                            [720, 70, 0.5, 16000],
                            [900, 34, 1, 11000]
                        ]
                        delegate: Rectangle {
                            id: ray
                            required property var modelData
                            x: modelData[0]
                            width: modelData[1]
                            height: 1000
                            opacity: modelData[2] * (0.55 + 0.45 * sway)
                            transformOrigin: Item.Top
                            rotation: 24 + (sway - 0.5) * 6
                            property real sway: 0.5
                            gradient: Gradient {
                                GradientStop {
                                    position: 0
                                    color: Qt.rgba(1, 1, 1, 0.2)
                                }
                                GradientStop {
                                    position: 0.85
                                    color: Qt.rgba(1, 1, 1, 0)
                                }
                            }
                            SequentialAnimation on sway {
                                running: root.running && !root.still
                                loops: Animation.Infinite
                                NumberAnimation {
                                    from: 0
                                    to: 1
                                    duration: ray.modelData[3]
                                    easing.type: Easing.InOutSine
                                }
                                NumberAnimation {
                                    from: 1
                                    to: 0
                                    duration: ray.modelData[3]
                                    easing.type: Easing.InOutSine
                                }
                            }
                        }
                    }
                }
                P3Bubbles {
                    x: 30
                    y: 30
                    running: root.running
                    still: root.still
                }
            }
            // .veil
            Rectangle {
                anchors.fill: parent
                color: P3.deep
                opacity: 0.46 * root.dive
            }
        }
    }
}
