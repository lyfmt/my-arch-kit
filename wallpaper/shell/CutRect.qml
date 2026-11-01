import QtQuick
import QtQuick.Shapes

// P3 形状：右上角切一个 45° 的角
Shape {
    id: s

    property color color: "#a3f0ff"
    property color strokeColor: "transparent"
    property real strokeWidth: -1
    property real cut: 12

    preferredRendererType: Shape.CurveRenderer

    ShapePath {
        fillColor: s.color
        strokeWidth: s.strokeWidth
        strokeColor: s.strokeColor
        joinStyle: ShapePath.MiterJoin
        PathPolyline {
            readonly property real i: s.strokeWidth > 0 ? s.strokeWidth / 2 : 0
            path: [Qt.point(i, i), Qt.point(s.width - s.cut, i), Qt.point(s.width - i, s.cut),
                Qt.point(s.width - i, s.height - i), Qt.point(i, s.height - i), Qt.point(i, i)]
        }
    }
}
