import QtQuick
import Quickshell
import Quickshell.Widgets
import qs.Modules.P3

// 通知的应用图：通知自带的图（裁满）→ 主题图标（留边）→ 应用名首字。
ClippingRectangle {
    id: root

    property string image: ""
    property string iconName: ""
    property string label: ""
    property real size: 32

    readonly property string themed: {
        const n = root.iconName;
        if (!n || n.indexOf(":") !== -1)
            return "";
        if (n.startsWith("/"))
            return "file://" + n;
        if (n.startsWith("file://"))
            return n;
        return Quickshell.iconPath(n, true);
    }
    readonly property bool showImage: root.image !== "" && photo.status !== Image.Error
    readonly property bool showIcon: !root.showImage && root.themed !== "" && icon.status !== Image.Error

    implicitWidth: size
    implicitHeight: size
    radius: 9
    color: root.showImage ? "transparent" : P3.isl2

    Image {
        id: photo

        anchors.fill: parent
        visible: root.showImage
        source: root.image
        sourceSize: Qt.size(root.size * 2, root.size * 2)
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        cache: true
        smooth: true
    }

    Image {
        id: icon

        anchors.fill: parent
        anchors.margins: Math.round(root.size * 0.14)
        visible: root.showIcon
        source: root.showImage ? "" : root.themed
        sourceSize: Qt.size(root.size * 2, root.size * 2)
        fillMode: Image.PreserveAspectFit
        asynchronous: true
        cache: true
        smooth: true
    }

    P3IslandText {
        anchors.centerIn: parent
        visible: !root.showImage && !root.showIcon
        face: "d"
        size: Math.round(root.size * 0.5)
        color: P3.fill
        text: (root.label || "?").trim().charAt(0).toUpperCase()
    }
}
