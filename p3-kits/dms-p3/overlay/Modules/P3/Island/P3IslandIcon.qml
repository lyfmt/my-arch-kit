import QtQuick
import QtQuick.Shapes
import qs.Modules.P3

// 岛上的实心小图标（原型 island-b 的 IC 表；系统状态几枚按同一笔法补齐）。按 viewBox 等比缩放到 size 内居中。
Item {
    id: root

    property string name: "vol"
    property real size: 15
    property color color: P3.fill

    readonly property var icons: ({
            "vol": {
                "vb": [24, 24],
                "d": "M3 9h4l5-4v14l-5-4H3z M15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2z M18.3 5.7a9 9 0 0 1 0 12.6l-1.4-1.4a7 7 0 0 0 0-9.8z"
            },
            "mute": {
                "vb": [24, 24],
                "d": "M3 9h4l5-4v14l-5-4H3z M14.6 9.4l1.4-1.4 2.6 2.6 2.6-2.6 1.4 1.4-2.6 2.6 2.6 2.6-1.4 1.4-2.6-2.6-2.6 2.6-1.4-1.4 2.6-2.6z"
            },
            "sun": {
                "vb": [24, 24],
                "d": "M7.5 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0z M11 1h2v4h-2z M11 19h2v4h-2z M1 11h4v2H1z M19 11h4v2h-4z M4.2 5.6l1.4-1.4 2.8 2.8-1.4 1.4z M15.6 17l1.4-1.4 2.8 2.8-1.4 1.4z M4.2 18.4l2.8-2.8 1.4 1.4-2.8 2.8z M15.6 7l2.8-2.8 1.4 1.4-2.8 2.8z"
            },
            "mic": {
                "vb": [24, 24],
                "d": "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z M5 11h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z"
            },
            "micoff": {
                "vb": [24, 24],
                "d": "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z M5 11h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z M3.3 4.7l1.4-1.4 16 16-1.4 1.4z"
            },
            "bolt": {
                "vb": [12, 16],
                "d": "M7 0 0 9h5l-1 7 8-10H7z"
            },
            "prev": {
                "vb": [24, 24],
                "d": "M5 5h2.5v14H5z M20 5v14L8.5 12z"
            },
            "next": {
                "vb": [24, 24],
                "d": "M16.5 5H19v14h-2.5z M4 5v14l11.5-7z"
            },
            "play": {
                "vb": [24, 24],
                "d": "M6 4v16l14-8z"
            },
            "pause": {
                "vb": [24, 24],
                "d": "M6 4h4.5v16H6z M13.5 4H18v16h-4.5z"
            },
            "moon": {
                "vb": [24, 24],
                "d": "M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3z"
            },
            "caps": {
                "vb": [24, 24],
                "d": "M12 3l8.5 9H15v5H9v-5H3.5z M9 19h6v2H9z"
            },
            "gauge": {
                "vb": [24, 24],
                "d": "M12 4a9.5 9.5 0 0 0-9.5 9.5V16h2.4v-2.5a7.1 7.1 0 0 1 14.2 0V16h2.4v-2.5A9.5 9.5 0 0 0 12 4z M10.6 14.4l5.6-6.2 1.2 1-4.6 6.4a1.7 1.7 0 1 1-2.2-1.2z"
            },
            "eye": {
                "vb": [24, 24],
                "d": "M12 5C6.6 5 2.8 9.1 1.5 12c1.3 2.9 5.1 7 10.5 7s9.2-4.1 10.5-7C21.2 9.1 17.4 5 12 5z M12 8.2a3.8 3.8 0 1 1 0 7.6a3.8 3.8 0 1 1 0-7.6z"
            },
            "plug": {
                "vb": [24, 24],
                "d": "M8 2h2v5H8z M14 2h2v5h-2z M5 7h14v4a7 7 0 0 1-6 6.9V22h-2v-4.1A7 7 0 0 1 5 11z"
            }
        })
    readonly property var spec: icons[name] || icons.vol
    readonly property real scale_: Math.min(width / spec.vb[0], height / spec.vb[1])

    implicitWidth: size
    implicitHeight: size

    Shape {
        x: (root.width - root.spec.vb[0] * root.scale_) / 2
        y: (root.height - root.spec.vb[1] * root.scale_) / 2
        width: root.spec.vb[0]
        height: root.spec.vb[1]
        preferredRendererType: Shape.CurveRenderer
        transform: Scale {
            xScale: root.scale_
            yScale: root.scale_
        }

        ShapePath {
            strokeWidth: -1
            strokeColor: "transparent"
            fillColor: root.color
            fillRule: ShapePath.OddEvenFill

            PathSvg {
                path: root.spec.d
            }
        }
    }
}
