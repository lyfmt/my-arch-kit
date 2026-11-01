import QtQuick
import qs.Modules.P3

// 只读信息行：暗色标签 …… 值
Item {
    id: root

    property string label: ""
    property string value: ""

    implicitWidth: 400
    implicitHeight: P3.rowH

    P3Text {
        x: 18
        anchors.verticalCenter: parent.verticalCenter
        kind: "label"
        text: root.label
        color: P3.dim
    }
    P3Text {
        anchors.right: parent.right
        anchors.rightMargin: 18
        anchors.verticalCenter: parent.verticalCenter
        kind: "value"
        text: root.value
        color: P3.tx
    }
    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: 1
        color: P3.line
    }
}
