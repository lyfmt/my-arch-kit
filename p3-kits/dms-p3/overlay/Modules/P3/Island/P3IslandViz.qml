import QtQuick
import qs.Modules.P3

// 音频可视化：有播放器在放就一直安静地起伏（4 根 2.5px 的柱子，scaleY .34 ↔ .8）；
// 都没在放时压到 .22；减弱动效时停在静态轮廓。
Row {
    id: root

    property bool playing: true
    property bool reducedMotion: false

    readonly property bool animating: root.playing && !root.reducedMotion && root.visible

    spacing: 2
    height: 13

    Repeater {
        model: [
            {
                "dur": 740,
                "rest": 0.35,
                "from": 0.5
            },
            {
                "dur": 1020,
                "rest": 0.7,
                "from": 0.72
            },
            {
                "dur": 620,
                "rest": 0.5,
                "from": 0.4
            },
            {
                "dur": 900,
                "rest": 0.85,
                "from": 0.62
            }
        ]

        Rectangle {
            id: bar

            required property var modelData
            property real wave: modelData.from
            readonly property real still: root.playing ? modelData.rest : 0.22
            property real s: root.animating ? wave : still

            width: 2.5
            height: 13
            radius: 1.25
            color: P3.fill
            opacity: 0.85
            transform: Scale {
                origin.y: 6.5
                yScale: bar.s
            }

            Behavior on s {
                enabled: !root.animating && !root.reducedMotion
                NumberAnimation {
                    duration: 600
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.spring
                }
            }

            SequentialAnimation on wave {
                running: root.animating
                loops: Animation.Infinite

                NumberAnimation {
                    to: 0.8
                    duration: bar.modelData.dur * (0.8 - bar.modelData.from) / 0.46
                    easing.type: Easing.InOutSine
                }
                NumberAnimation {
                    to: 0.34
                    duration: bar.modelData.dur
                    easing.type: Easing.InOutSine
                }
                NumberAnimation {
                    to: bar.modelData.from
                    duration: bar.modelData.dur * (bar.modelData.from - 0.34) / 0.46
                    easing.type: Easing.InOutSine
                }
            }
        }
    }
}
