import QtQuick
import Quickshell

// 截帧用的测试壳：把 LyricsLayer 放进普通窗口（1920×1080 舞台、深色底），按 P3LYRICS_SHOTS 列出的时刻截图到 /tmp。
//   P3LYRICS_DEMO=1 P3LYRICS_DEMO_SONG=1 P3LYRICS_SHOTS=2.2,3.0,6.0 qs -p shell/capture.qml
// 截图名 /tmp/p3lyr-cap-<秒>.png；全部截完后退出。P3LYRICS_ZOOM 设歌词缩放（默认 1）。只用来调试，install.sh 不装它。
ShellRoot {
    id: root
    readonly property var shots: (Quickshell.env("P3LYRICS_SHOTS") || "2,4").split(",").map(parseFloat)
    readonly property string bg: Quickshell.env("P3LYRICS_BG") === "light" ? "#e8edf1" : "#000510"
    property real t0: Date.now()
    property int n: 0

    FloatingWindow {
        implicitWidth: 1920
        implicitHeight: 1080
        color: root.bg
        Item {
            id: stage
            anchors.fill: parent
            Rectangle { anchors.fill: parent; color: root.bg }
            LyricsLayer {
                id: layer
                // 窗口被平铺时尺寸不定：舞台固定 1920×1080 再整体缩放进窗口，截图坐标与 index.html 一致
                width: 1920
                height: 1080
                scale: Math.min(parent.width / 1920, parent.height / 1080)
                transformOrigin: Item.TopLeft
                music: Music
                idleHidden: false
                trans: Quickshell.env("P3LYRICS_TRANS") !== "0"
                zoom: parseFloat(Quickshell.env("P3LYRICS_ZOOM")) || 1
            }
        }
    }
    Timer {
        interval: 16
        repeat: true
        running: true
        onTriggered: {
            if (root.n >= root.shots.length) return;
            const el = (Date.now() - root.t0) / 1000;
            if (el < root.shots[root.n]) return;
            const name = "/tmp/p3lyr-cap-" + root.shots[root.n].toFixed(2) + ".png";
            root.n++;
            const last = root.n >= root.shots.length;
            stage.grabToImage(r => { r.saveToFile(name); console.log("shot", name); if (last) Qt.quit(); });
        }
    }
}
