pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io
import "Demo.js" as Demo

// 只读接入 music 卡片的后端（~/.config/quickshell/music/backend/musicd.py）：
// $XDG_RUNTIME_DIR/music-card.sock，每行一个 JSON。musicd 接受多个客户端，连上即推送 snapshot，
// 之后广播 track / status / pos / lyric；这里从不发命令。歌词行 {t, text, trans}。
// P3LYRICS_SOCK 换 socket 路径（测试用 test/fake-musicd.py）；P3LYRICS_DEMO=1 不连后端，循环播放原型里的三首假歌。
Singleton {
    id: mu

    readonly property bool demo: Quickshell.env("P3LYRICS_DEMO") === "1"
    readonly property string sockPath: Quickshell.env("P3LYRICS_SOCK") || ((Quickshell.env("XDG_RUNTIME_DIR") || "/tmp") + "/music-card.sock")

    readonly property bool online: demo || sock.connected
    property var song: null          // {id, name, artist, duration(ms), …}
    property var lines: []           // [{t, text, trans}]
    property int linesGen: 0         // lines 每换一次 +1（引擎靠它判断歌词变了）
    onLinesChanged: linesGen++
    property bool playing: false
    // 有歌、有歌词：歌词层才有东西可显示
    readonly property bool active: online && song !== null && lines.length > 0

    // 播放进度：后端每 0.5s 校准一次，中间本地插值（与 Backend.qml 相同）
    property real basePos: 0
    property real baseTime: 0
    function setPos(p) {
        basePos = p;
        baseTime = Date.now();
    }
    function pos() {
        if (!playing) return basePos;
        const p = basePos + (Date.now() - baseTime) / 1000;
        const d = song && song.duration > 0 ? song.duration / 1000 : 1e9;
        return Math.min(p, d);
    }

    function handle(m) {
        switch (m.ev) {
        case "snapshot":
            applyTrack(m.song);
            playing = !!m.playing;
            if (m.lyric && song && m.lyric.id === song.id) lines = m.lyric.lines || [];
            setPos(m.pos || 0);
            break;
        case "track":
            applyTrack(m.song);
            break;
        case "status":
            setPos(m.pos || 0);
            playing = !!m.playing;
            break;
        case "pos":
            setPos(m.pos || 0);
            break;
        case "lyric":
            if (song && m.id === song.id) lines = m.lines || [];
            break;
        }
    }
    function applyTrack(s) {
        if (!s || !song || song.id !== s.id) lines = [];
        song = s || null;
    }

    Socket {
        id: sock
        path: mu.sockPath
        parser: SplitParser {
            onRead: line => {
                try {
                    mu.handle(JSON.parse(line));
                } catch (e) {
                    console.warn("p3lyrics: bad message", e);
                }
            }
        }
        onConnectedChanged: {
            if (!connected) {
                mu.song = null;
                mu.lines = [];
                mu.playing = false;
            }
        }
    }
    // 自动重连（启动时也走这里）。每 1.5s 用 test -S / stat 看一眼 socket 文件，不存在就不连，
    // music 没起时日志保持干净。musicd 退出时不删 socket 文件，留下的旧文件连不上：
    // 对同一个文件（inode + mtime 不变）每次失败间隔翻倍，1.5s → 最长 30s；musicd 重启会
    // 重新 bind 出新文件，看到新文件立刻连。旧文件上的每次失败 Quickshell 会打一行
    // quickshell.io.socket 警告，属预期。
    property int connectFails: 0
    property string failedId: ""     // 上次连失败时的 "inode mtime"
    property real nextTry: 0
    Process {
        id: probe
        // 不用 stat 的 %F：文件类型名随 locale 变（中文环境是「套接字」）
        command: ["sh", "-c", "test -S \"$1\" && stat -L -c '%i %Y' \"$1\"", "sh", mu.sockPath]
        stdout: StdioCollector {
            onStreamFinished: {
                const id = text.trim();
                if (id === "" || mu.demo || sock.connected) return;
                if (id !== mu.failedId) {
                    mu.connectFails = 0;
                } else if (Date.now() < mu.nextTry) {
                    return;
                }
                mu.failedId = id;
                mu.connectFails++;
                mu.nextTry = Date.now() + Math.min(30000, 1500 * Math.pow(2, mu.connectFails - 1));
                sock.connected = true;
            }
        }
        stderr: StdioCollector {}
    }
    Connections {
        target: sock
        function onConnectedChanged() {
            if (sock.connected) {
                mu.connectFails = 0;
                mu.failedId = "";
            }
        }
    }
    Timer {
        interval: 1500
        repeat: true
        triggeredOnStart: true
        running: !mu.demo && !sock.connected
        onTriggered: if (!probe.running) probe.running = true
    }

    // ---------- 演示模式 ----------
    property int demoIdx: 0
    function demoLoad(i, at) {
        demoIdx = (i + Demo.SONGS.length) % Demo.SONGS.length;
        const s = Demo.SONGS[demoIdx];
        song = { id: "demo" + demoIdx, name: s.title, artist: s.artist, duration: s.end * 1000 };
        lines = s.lines;
        setPos(at || 0);
    }
    function demoToggle() {
        setPos(pos());
        playing = !playing;
    }
    function demoNext() { demoLoad(demoIdx + 1, 0); }
    function demoSeek(t) { setPos(t); }
    Timer {
        interval: 200
        repeat: true
        running: mu.demo && mu.playing
        onTriggered: if (mu.song && mu.pos() >= mu.song.duration / 1000) mu.demoNext()
    }
    Component.onCompleted: {
        if (!demo) return;
        const s = parseInt(Quickshell.env("P3LYRICS_DEMO_SONG") || "0") || 0;
        const t = parseFloat(Quickshell.env("P3LYRICS_DEMO_T") || "0") || 0;
        demoLoad(s, t);
        playing = true;
    }
}
