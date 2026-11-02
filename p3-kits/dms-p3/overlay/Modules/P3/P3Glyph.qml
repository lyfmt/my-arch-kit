import QtQuick
import QtQuick.Shapes
import "P3Glyphs.js" as G

// 24 网格线性图标（原型 P3Menu.glyph(name, size, stroke)）。名字列表见 P3Glyphs.js。
//   P3Glyph { name: "wifi"; size: 24; color: focusable.fg }
Item {
    id: root

    property string name: "x"
    property real size: 24
    property real stroke: 2
    property color color: P3.tx

    readonly property var g: G.GLYPHS[name] || G.GLYPHS.x
    implicitWidth: size
    implicitHeight: size

    Shape {
        anchors.fill: parent
        preferredRendererType: Shape.CurveRenderer
        transform: Scale {
            xScale: root.size / 24
            yScale: root.size / 24
        }
        ShapePath {
            strokeColor: root.color
            strokeWidth: root.stroke
            fillColor: "transparent"
            capStyle: ShapePath.SquareCap
            joinStyle: ShapePath.MiterJoin
            PathSvg {
                path: root.g.s
            }
        }
        ShapePath {
            strokeColor: "transparent"
            strokeWidth: 0
            fillColor: root.g.f ? root.color : "transparent"
            PathSvg {
                path: root.g.f || "M0 0"
            }
        }
    }
}
