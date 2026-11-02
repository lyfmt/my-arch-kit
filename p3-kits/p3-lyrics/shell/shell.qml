import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland

// P3 桌面歌词（RIPTIDE）：qs -c p3lyrics
// layer-shell Overlay 层（所有窗口之上）的透明面板，盖满一块屏幕；平时点击穿透、不拿键盘焦点，
// 没有东西要显示时不映射。
// 开关、翻译、位置、大小存在 $XDG_STATE_HOME/p3lyrics/state.json，启动时恢复（没有记录 = 关）。
// 调整模式（IPC adjust；music 卡片里右键 / 长按「词」）：面板临时接收这块屏幕的指针，键盘独占——
// 拖动句子移动，滚轮缩放（0.5–2×），双击句子复位，方向键微调，+ / - 缩放，T 开关翻译；
// Esc / Enter / 右键 / 在句子以外按下结束，8s 没有操作自动结束。
// 只显示在一块屏幕上：P3LYRICS_SCREEN（输出名，如 HDMI-A-1）> 启动时 niri 聚焦的屏幕；
// 之后用 IPC `screen <名字>` / `here`（移到当前聚焦的屏幕）换屏。
ShellRoot {
    id: root

    property bool wanted: false
    property bool trans: true
    property bool adjusting: false
    property string screenName: Quickshell.env("P3LYRICS_SCREEN") || ""
    readonly property var targetScreen: {
        const ss = Quickshell.screens;
        for (let i = 0; i < ss.length; i++) if (ss[i].name === screenName) return ss[i];
        return ss.length ? ss[0] : null;
    }

    // ---------- 持久化 ----------
    // {"enabled": bool, "trans": bool, "x": 0–1 | null, "y": 0–1 | null, "scale": 0.5–2}
    // x / y = 原点（主句右下角）在屏幕上的比例，null = 默认位置（舞台 1800, 844）
    // P3LYRICS_HIDDEN=1 / 0、P3LYRICS_TRANS=0 / 1 在启动时覆盖记录
    readonly property string statePath: (Quickshell.env("XDG_STATE_HOME") || (Quickshell.env("HOME") + "/.local/state")) + "/p3lyrics/state.json"
    property bool loaded: false
    FileView {
        id: stateFile
        path: root.statePath
        blockLoading: true
        printErrors: false
    }
    function num(v, lo, hi, dflt) {
        return typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
    }
    function load() {
        let s = {};
        try {
            s = JSON.parse(stateFile.text()) || {};
        } catch (e) {}
        const h = Quickshell.env("P3LYRICS_HIDDEN"), t = Quickshell.env("P3LYRICS_TRANS");
        root.wanted = h === "1" ? false : h === "0" ? true : s.enabled === true;
        root.trans = t === "0" ? false : t === "1" ? true : s.trans !== false;
        layer.fx = num(s.x, 0, 1, -1);
        layer.fy = num(s.y, 0, 1, -1);
        layer.zoom = num(s.scale, 0.5, 2, 1);
        root.loaded = true;
        root.save();
    }
    function save() {
        if (loaded) saveTimer.restart();
    }
    Timer {
        id: saveTimer
        interval: 250
        onTriggered: stateFile.setText(JSON.stringify({
            enabled: root.wanted,
            trans: root.trans,
            x: layer.fx >= 0 ? layer.fx : null,
            y: layer.fy >= 0 ? layer.fy : null,
            scale: layer.zoom
        }) + "\n")
    }
    onWantedChanged: save()
    onTransChanged: save()

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
    Component.onCompleted: {
        load();
        if (!screenName) focusedHere();
    }

    IpcHandler {
        target: "p3lyrics"
        function toggle(): void { root.wanted = !root.wanted; }
        function show(): void { root.wanted = true; }
        function hide(): void { root.wanted = false; }
        function trans(): void { root.trans = !root.trans; }
        function adjust(): void { root.adjusting = !root.adjusting; }
        function reset(): void { layer.resetPlace(); }
        function screen(name: string): void { root.screenName = name; }
        function here(): void { root.focusedHere(); }
        function status(): string {
            return JSON.stringify({ shown: root.wanted, trans: root.trans, adjusting: root.adjusting,
                                    x: layer.fx >= 0 ? layer.fx : null, y: layer.fy >= 0 ? layer.fy : null, scale: layer.zoom,
                                    online: Music.online, playing: Music.playing,
                                    song: Music.song ? Music.song.name : null, lines: Music.lines.length,
                                    idleHidden: root.idleHidden, mapped: win.visible, box: layer.screenBox(),
                                    screen: root.targetScreen ? root.targetScreen.name : null });
        }
    }

    PanelWindow {
        id: win

        screen: root.targetScreen
        visible: root.adjusting || layer.hasContent || (root.wanted && Music.active && !root.idleHidden)
        color: "transparent"
        anchors {
            left: true
            right: true
            top: true
            bottom: true
        }
        exclusionMode: ExclusionMode.Ignore
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.namespace: "p3lyrics"
        WlrLayershell.keyboardFocus: root.adjusting ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None
        // 空区域 = 点击穿透；调整模式里 null = 整个面板接收指针
        mask: root.adjusting ? null : noInput
        surfaceFormat.opaque: false

        Region { id: noInput }

        LyricsLayer {
            id: layer
            anchors.fill: parent
            music: Music
            wanted: root.wanted
            idleHidden: root.idleHidden
            trans: root.trans
            adjusting: root.adjusting
            onPlaced: root.save()
            onAdjustDone: root.adjusting = false
            onTransToggle: root.trans = !root.trans
        }
    }
}
