import QtQuick
import qs.Modules.P3

// 动作行：图标 + 标签 …… 值 + 箭头
SyFocus {
    id: root

    property string icon: ""
    property string label: ""
    property string value: ""

    SyLead {
        id: lead
        x: 18
        anchors.verticalCenter: parent.verticalCenter
        icon: root.icon
        color: root.fg
    }
    P3Text {
        x: 18 + (lead.implicitWidth > 0 ? lead.implicitWidth + 16 : 0)
        anchors.verticalCenter: parent.verticalCenter
        kind: "label"
        text: root.label
        color: root.fg
    }
    P3Text {
        anchors.right: chev.left
        anchors.rightMargin: 20
        anchors.verticalCenter: parent.verticalCenter
        kind: "value"
        text: root.value
        color: root.fg
    }
    P3Glyph {
        id: chev
        x: root.width - 18 - 18
        anchors.verticalCenter: parent.verticalCenter
        name: "chev"
        size: 18
        color: root.dimColor
    }
}
