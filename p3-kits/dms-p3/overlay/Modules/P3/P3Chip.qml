import QtQuick

// 小标签（原型 .p-chip）：fill 平涂 + ink 文字；hot = accent 底白字；ghost = 1px line 描边、dim 文字。
Item {
    id: root

    property string text: ""
    property bool hot: false
    property bool ghost: false

    implicitWidth: t.implicitWidth + 18
    implicitHeight: 22

    Rectangle {
        anchors.fill: parent
        color: root.ghost ? "transparent" : root.hot ? P3.accent : P3.fill
        border.color: root.ghost ? P3.line : "transparent"
        border.width: root.ghost ? 1 : 0
    }
    P3Text {
        id: t
        anchors.centerIn: parent
        kind: "chip"
        text: root.text
        color: root.ghost ? P3.dim : root.hot ? "#ffffff" : P3.ink
    }
}
