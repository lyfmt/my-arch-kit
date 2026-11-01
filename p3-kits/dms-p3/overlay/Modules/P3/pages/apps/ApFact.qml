import QtQuick
import qs.Modules.P3

// 详情列的一条事实（原型 .ap-fact）：54px 高、底部细线；左侧中文标签（dim），右侧值（Barlow 22px），基线对齐。
Item {
    id: root

    property string label: ""
    property string value: ""

    width: 400
    height: 54

    Rectangle {
        anchors.bottom: parent.bottom
        width: parent.width
        height: 1
        color: P3.line
    }
    Item {
        id: base
        y: 37
        width: 1
        height: 1
    }
    P3Text {
        id: labelText
        anchors.baseline: base.top
        kind: "zh"
        font.pixelSize: 17
        text: root.label
        color: P3.dim
    }
    P3Text {
        anchors.baseline: base.top
        anchors.right: parent.right
        width: Math.min(implicitWidth, root.width - labelText.width - 24)
        horizontalAlignment: Text.AlignRight
        elide: Text.ElideLeft
        kind: "value"
        text: root.value
        color: P3.tx
    }
}
