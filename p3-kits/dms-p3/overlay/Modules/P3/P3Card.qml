import QtQuick

// 平涂卡片（原型 .p-card）：panel 底、22px 内边距、无边框。可聚焦（默认 tide 光点）。
//   P3Card { width: 400; height: 200; P3Text { … } }  内容放在 contentItem 坐标里（已留出 padding）
P3Focusable {
    id: root

    property int padding: 22
    default property alias content: inner.data

    Rectangle {
        anchors.fill: parent
        color: P3.panel
    }
    Item {
        id: inner
        anchors.fill: parent
        anchors.margins: root.padding
    }
}
