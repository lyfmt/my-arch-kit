import QtQuick
import QtQuick.Layouts

// 一行（原型 .p-row）：56px 高（tall: 72），左右 18px 内边距，底部 1px 细线；可聚焦。
//   P3Row { icon: "wifi"; label: "WI-FI"; value: "lyfmt-5G"; chevron: true; onActivated: … }
//   meta 非空时为两行（label + meta），自动 tall
//   trailing（默认属性）：放在右侧的自定义内容（替代 value），例如 P3Switch
P3Focusable {
    id: root

    property string icon: ""
    property string label: ""
    property string meta: ""
    property string value: ""
    property bool chevron: false
    property bool tall: meta !== ""
    default property alias trailing: rightSlot.data

    implicitWidth: 400
    implicitHeight: tall ? P3.rowTallH : P3.rowH

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: 1
        color: P3.line
    }
    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 18
        anchors.rightMargin: 18
        spacing: 16
        P3Glyph {
            visible: root.icon !== ""
            name: root.icon
            color: root.fg
        }
        ColumnLayout {
            spacing: 7
            Layout.fillWidth: true
            P3Text {
                kind: "label"
                text: root.label
                color: root.fg
                elide: Text.ElideRight
                Layout.fillWidth: true
            }
            P3Text {
                visible: root.meta !== ""
                kind: "meta"
                text: root.meta
                color: root.dimColor
                elide: Text.ElideRight
                Layout.fillWidth: true
            }
        }
        P3Text {
            visible: root.value !== ""
            kind: "value"
            text: root.value
            color: root.fg
        }
        Item {
            id: rightSlot
            visible: children.length > 0
            implicitWidth: childrenRect.width
            implicitHeight: childrenRect.height
        }
        P3Glyph {
            visible: root.chevron
            name: "chev"
            size: 20
            color: root.dimColor
        }
    }
}
