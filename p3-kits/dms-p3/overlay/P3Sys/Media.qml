pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Services.Mpris
import qs.Services

// P3Sys.media — 媒体播放。@dms MprisController.activePlayer / availablePlayers / setActivePlayer；
//   player.togglePlaying() / next() / previous()（MprisController 的 playPause 等同）。
//   pos 每秒刷新（播放时调用 positionChanged()）。
// state: { available, title, artist, art, playing, pos (s), len (s), player, players: [identity], idx, canNext, canPrev }
Base {
    id: root
    ns: "media"

    readonly property var p: MprisController.activePlayer
    readonly property var players: MprisController.availablePlayers || []
    property real pos: p ? p.position : 0
    readonly property var state: ({
            "available": !!p,
            "title": p ? (MprisController.stableTitle || p.trackTitle || "") : "",
            "artist": p ? (MprisController.stableArtist || p.trackArtist || "") : "",
            "art": p ? (p.trackArtUrl || "") : "",
            "playing": p ? p.isPlaying : false,
            "pos": Math.round(pos),
            "len": p && p.lengthSupported ? Math.round(p.length) : 0,
            "player": p ? (p.identity || "") : "",
            "players": players.map(x => x.identity || ""),
            "idx": p ? players.indexOf(p) : -1,
            "canNext": p ? p.canGoNext : false,
            "canPrev": p ? p.canGoPrevious : false
        })
    onStateChanged: notify()

    Timer {
        interval: 1000
        repeat: true
        running: !!root.p && root.p.isPlaying
        onTriggered: {
            root.p.positionChanged();
            root.pos = root.p.position;
        }
    }

    function need(action) {
        return p ? null : fail(action, "noplayer", "没有正在播放的应用");
    }
    function playPause() {
        return need("playPause") || (p.togglePlaying(), ok("playPause", null));
    }
    function next() {
        return need("next") || (p.next(), ok("next", null));
    }
    function previous() {
        return need("previous") || (p.previous(), ok("previous", null));
    }
    function cyclePlayer() {
        if (players.length < 2)
            return fail("cyclePlayer", "single", "只有一个播放器");
        const n = players[(players.indexOf(p) + 1) % players.length];
        MprisController.setActivePlayer(n);
        return ok("cyclePlayer", n.identity || "");
    }
}
