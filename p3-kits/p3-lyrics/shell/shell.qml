import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland

// P3 桌面歌词（RIPTIDE）：qs -c p3lyrics
// 透明、点击穿透、不拿键盘焦点的 layer-shell 面板，放在 Bottom 层（壁纸之上、窗口之下）。
// 只显示在一块屏幕上：P3LYRICS_SCREEN（输出名，如 HDMI-A-1）> 启动时 niri 聚焦的屏幕；
// 之后用 IPC `screen <名字>` / `here`（移到当前聚焦的屏幕）换屏。
ShellRoot {
    id: root

    property bool wanted: Quickshell.env("P3LYRICS_HIDDEN") !== "1"
    readonly property bool transDefault: Quickshell.env("P3LYRICS_TRANS") !== "0"
    property string screenName: Quickshell.env("P3LYRICS_SCREEN") || ""
    readonly property var targetScreen: {
        const ss = Quickshell.screens;
        for (let i = 0; i < ss.length; i++) if (ss[i].name === screenName) return ss[i];
        return ss.length ? ss[0] : null;
    }

    // 暂停超过 IDLE 秒（默认 20，0 = 不隐藏）或启动时就没在播：歌词沉下留空；继续播放时从当前句重新入场。
    // 暂停的头 IDLE 秒里歌词冻结、整层变暗（同原型 Space）。
    readonly property real idleSec: {
        const v = parseFloat(Quickshell.env("P3LYRICS_IDLE"));
        return isNaN(v) ? 20 : v;
    }
    property bool idleHidden: !Music.playing
    Connections {
        target: Music
        function onPlayingChanged() {
            if (Music.playing) {
                idleTimer.stop();
                root.idleHidden = false;
            } else if (root.idleSec > 0) {
                idleTimer.restart();
            }
        }
    }
    Timer {
        id: idleTimer
        interval: root.idleSec * 1000
        onTriggered: root.idleHidden = !Music.playing
    }

    function focusedHere() { focusProc.running = true; }
    Process {
        id: focusProc
        command: ["niri", "msg", "-j", "focused-output"]
        stdout: StdioCollector {
            onStreamFinished: {
                try {
                    const n = JSON.parse(text).name;
                    if (n) root.screenName = n;
                } catch (e) {}
            }
        }
    }
    Component.onCompleted: if (!screenName) focusedHere()

    IpcHandler {
        target: "p3lyrics"
        function toggle(): void { root.wanted = !root.wanted; }
        function show(): void { root.wanted = true; }
        function hide(): void { root.wanted = false; }
        function trans(): void { layer.toggleTrans(); }
        function screen(name: string): void { root.screenName = name; }
        function here(): void { root.focusedHere(); }
        function status(): string {
            return JSON.stringify({ shown: root.wanted, online: Music.online, playing: Music.playing,
                                    song: Music.song ? Music.song.name : null, lines: Music.lines.length,
                                    idleHidden: root.idleHidden, screen: root.targetScreen ? root.targetScreen.name : null });
        }
    }

    PanelWindow {
        id: win

        screen: root.targetScreen
        color: "transparent"
        // 只盖住屏幕下半部分（舞台 y ≥ 480），歌词和下沉的字都在这一块里
        readonly property real sh: screen ? screen.height : 1080
        readonly property real sw: screen ? screen.width : 1920
        readonly property real s: Math.min(sw / 1920, sh / 1080)
        readonly property real y0: Math.max(0, Math.floor(sh / 2 + (480 - 540) * s))
        anchors {
            left: true
            right: true
            bottom: true
        }
        implicitHeight: Math.ceil(sh - y0)
        exclusionMode: ExclusionMode.Ignore
        WlrLayershell.layer: WlrLayer.Bottom
        WlrLayershell.namespace: "p3lyrics"
        WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
        mask: Region {}
        surfaceFormat.opaque: false

        LyricsLayer {
            id: layer
            anchors.fill: parent
            music: Music
            wanted: root.wanted
            idleHidden: root.idleHidden
            transDefault: root.transDefault
            stageW: win.sw
            stageH: win.sh
            stageY0: win.y0
        }
    }
}
