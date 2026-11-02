import QtQuick
import qs.Modules.P3

// 行首图标：24px 线性图标（icon），或应用图标图片（img，size 默认 28）
Item {
    id: root

    property string icon: ""
    property string img: ""
    property real size: img !== "" ? 28 : 24
    property real glyphSize: 24
    property color color: P3.tx

    visible: icon !== "" || img !== ""
    implicitWidth: visible ? size : 0
    implicitHeight: size

    P3Glyph {
        visible: root.icon !== "" && root.img === ""
        anchors.centerIn: parent
        name: root.icon || "x"
        size: root.glyphSize
        color: root.color
    }
    Image {
        visible: root.img !== ""
        anchors.fill: parent
        source: root.img
        sourceSize.width: 64
        sourceSize.height: 64
        fillMode: Image.PreserveAspectFit
        smooth: true
        asynchronous: true
    }
}
