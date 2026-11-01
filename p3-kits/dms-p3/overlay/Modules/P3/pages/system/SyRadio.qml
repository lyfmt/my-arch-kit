import QtQuick
import qs.Modules.P3

// 单选行（原型 .sy-radio）：图标 + 名字（值字体）[+ meta]，选中时右侧对勾弹出。
SyFocus {
    id: root

    property string icon: ""
    property string text: ""
    property string meta: ""
    property bool selected: false

    SyLead {
        id: lead
        x: 18
        anchors.verticalCenter: parent.verticalCenter
        icon: root.icon
        color: root.fg
    }
    Row {
        x: 18 + (lead.implicitWidth > 0 ? lead.implicitWidth + 16 : 0)
        anchors.verticalCenter: parent.verticalCenter
        spacing: 16
        P3Text {
            id: v
            anchors.verticalCenter: parent.verticalCenter
            kind: "value"
            text: root.text
            color: root.fg
            width: Math.min(implicitWidth, root.width - 18 - parent.x - 22 - 16 - (m.visible ? m.implicitWidth + 16 : 0))
            elide: Text.ElideRight
        }
        P3Text {
            id: m
            visible: root.meta !== ""
            anchors.verticalCenter: parent.verticalCenter
            kind: "meta"
            text: root.meta
            color: root.dimColor
        }
    }
    P3Glyph {
        x: root.width - 18 - 22
        anchors.verticalCenter: parent.verticalCenter
        name: "check"
        size: 22
        stroke: 2.4
        color: root.fg
        opacity: root.selected ? 1 : 0
        scale: root.selected ? 1 : 0.4
        Behavior on opacity {
            NumberAnimation {
                duration: 150
            }
        }
        Behavior on scale {
            NumberAnimation {
                duration: 350
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.spring
            }
        }
    }
}
