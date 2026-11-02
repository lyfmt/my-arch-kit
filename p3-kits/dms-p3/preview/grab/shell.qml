import QtQuick
import Quickshell
import Quickshell.Wayland

// 截取某个输出（不碰剪贴板、不切焦点）。由 scripts/grab.sh 调用。
//   P3_SCREEN=<输出名>  P3_OUT=<png>
ShellRoot {
    PanelWindow {
        id: win
        implicitWidth: 1
        implicitHeight: 1
        color: "transparent"
        WlrLayershell.layer: WlrLayer.Background
        WlrLayershell.namespace: "p3-grab"
        exclusiveZone: -1
        anchors.top: true
        anchors.left: true
        mask: Region {}
        ScreencopyView {
            id: view
            captureSource: Quickshell.screens.find(s => s.name === Quickshell.env("P3_SCREEN")) ?? Quickshell.screens[0]
            width: sourceSize.width
            height: sourceSize.height
            live: false
            opacity: 0.001
            onHasContentChanged: if (hasContent) Qt.callLater(() => view.grabToImage(r => {
                r.saveToFile(Quickshell.env("P3_OUT") || "/tmp/p3shots/grab.png");
                Qt.exit(0);
            }))
        }
    }
}
