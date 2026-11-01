import QtQuick

// 按钮（原型 .p-btn）：64px 高平涂 panel 块，居中 label（可带图标）；danger 时文字为红。
//   P3Button { label: "SCAN"; icon: "search"; onActivated: Net.scan() }
P3Focusable {
    id: root

    property string label: ""
    property string icon: ""
    property bool danger: false

    implicitWidth: Math.max(160, content.implicitWidth + 44)
    implicitHeight: P3.btnH

    readonly property color labelColor: danger ? (focused ? (cursor === "wedge" ? P3.accent : P3.dangerFocus) : P3.danger) : fg

    Rectangle {
        anchors.fill: parent
        color: root.focused && root.cursor === "wedge" ? "transparent" : P3.panel
    }
    Row {
        id: content
        anchors.centerIn: parent
        spacing: 12
        P3Glyph {
            visible: root.icon !== ""
            name: root.icon
            color: root.labelColor
            anchors.verticalCenter: parent.verticalCenter
        }
        P3Text {
            kind: "label"
            text: root.label
            color: root.labelColor
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}
