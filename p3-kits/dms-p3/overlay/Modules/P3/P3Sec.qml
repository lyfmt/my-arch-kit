import QtQuick

// 分节标题（原型 .p-sec）：Barlow 15px 字距 .24em dim 色，右侧一条 1px 细线拉满（在 15px 行盒内竖向居中），
// 下方留 12px。
Item {
    id: root

    property string text: ""
    property color color: P3.dim

    implicitWidth: 300
    implicitHeight: 15 + 12

    P3Text {
        id: t
        kind: "sec"
        text: root.text
        color: root.color
    }
    Rectangle {
        anchors.left: t.right
        anchors.leftMargin: 16
        anchors.right: parent.right
        y: Math.floor(t.height / 2)
        height: 1
        color: P3.line
    }
}
