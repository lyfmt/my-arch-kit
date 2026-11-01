import QtQuick
import Quickshell.Widgets
import qs.Modules.P3

// 图标盒（原型 .ap-ico / .ap-tile）：s×s。
//   有图标：按比例画进去（IconImage，异步）
//   没有图标或加载失败：panel 底 + 名字首字母（P3 展示字，s × .5）
//   glyph 非空：2px 描边方块 + 34px 线性图标（ALL APPS）
//   badge > 0：右上角红色计数
Item {
    id: root

    property string source: ""
    property string name: ""
    property string glyph: ""
    property int s: 60
    property int badge: 0
    property color fg: P3.tx
    property color trackColor: P3.line
    readonly property bool hasImage: glyph === "" && source !== "" && img.status === Image.Ready

    width: s
    height: s

    IconImage {
        id: img
        anchors.fill: parent
        visible: root.hasImage
        source: root.glyph === "" ? root.source : ""
        asynchronous: true
        mipmap: true
        backer.sourceSize: Qt.size(root.s * 2, root.s * 2)
    }

    Rectangle {
        anchors.fill: parent
        visible: root.glyph === "" && (root.source === "" || img.status === Image.Error)
        color: P3.panel
        P3Text {
            anchors.centerIn: parent
            kind: "h2"
            font.pixelSize: Math.round(root.s * 0.5)
            font.letterSpacing: 0
            rightPadding: Math.round(root.s * 0.03)
            text: (root.name || "?").charAt(0).toUpperCase()
            color: root.fg
        }
    }

    Rectangle {
        anchors.fill: parent
        visible: root.glyph !== ""
        color: "transparent"
        border.width: 2
        border.color: root.trackColor
        P3Glyph {
            anchors.centerIn: parent
            name: root.glyph || "apps"
            size: 34
            color: root.fg
        }
    }

    Rectangle {
        visible: root.badge > 0
        x: root.s + 9 - width
        y: -7
        width: Math.max(24, badgeText.implicitWidth + 12)
        height: 22
        color: P3.accent
        P3Text {
            id: badgeText
            anchors.centerIn: parent
            anchors.verticalCenterOffset: 1
            kind: "label"
            font.pixelSize: 14
            font.letterSpacing: 0.56
            text: String(root.badge)
            color: "#ffffff"
        }
    }
}
