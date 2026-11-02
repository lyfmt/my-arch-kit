pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Services.Pipewire
import qs.Services

// P3Sys.audio — 音量与设备。@dms AudioService（Pipewire）
//   setSink(i) / setSource(i) 的 i 是 state.sinks / state.sources 的下标。
//   单个应用音量：Pipewire 里 isStream && isSink 的节点（排除 DMS 自己的流），node.audio.volume = v/100。
//   sourceNode = 当前输入节点（AudioService.source，没有时为 null）。
//   麦克风电平：watchMic() / releaseMic() 引用计数，计数 > 0 且输入没静音时才开 PwNodePeakMonitor；
//   micPeak = 峰值 -60…0 dB → 0…100（不在 state 里，变化太快；没在监听时为 0）。
// state: { available, vol, muted, mic, micMuted, sinks: [{ id, name, kind }], sources, sink, source,
//          streams: [{ id, name, icon, vol }] }
Base {
    id: root
    ns: "audio"

    readonly property var sinkNodes: (AudioService.pipewireNodes || []).filter(n => n.audio && n.isSink && !n.isStream)
    readonly property var sourceNodes: (AudioService.pipewireNodes || []).filter(n => n.audio && !n.isSink && !n.isStream && !/\.monitor$/.test(n.name || ""))
    readonly property var streamNodes: (AudioService.pipewireNodes || []).filter(n => n.audio && n.isSink && n.isStream && !AudioService.isOwnStream(n))

    function kindOf(n) {
        const s = (n.name || "") + " " + (n.description || "");
        if (/bluez/i.test(s))
            return "head";
        if (/hdmi|displayport/i.test(s))
            return "display";
        return n.isSink ? "out" : "mic";
    }

    readonly property var state: ({
            "available": !!AudioService.sink,
            "vol": AudioService.sinkVolumePercent,
            "muted": !!(AudioService.sink?.audio?.muted),
            "mic": AudioService.sourceVolumePercent,
            "micMuted": !!(AudioService.source?.audio?.muted),
            "sinks": sinkNodes.map(n => ({
                        "id": n.name,
                        "name": AudioService.displayName(n),
                        "kind": kindOf(n)
                    })),
            "sources": sourceNodes.map(n => ({
                        "id": n.name,
                        "name": AudioService.displayName(n),
                        "kind": kindOf(n)
                    })),
            "sink": sinkNodes.indexOf(AudioService.sink),
            "source": sourceNodes.indexOf(AudioService.source),
            "streams": streamNodes.map(n => ({
                        "id": String(n.id),
                        "name": n.properties?.["application.name"] || AudioService.displayName(n),
                        "icon": n.properties?.["application.icon-name"] || "",
                        "vol": Math.round((n.audio?.volume ?? 0) * 100)
                    }))
        })
    onStateChanged: notify()

    PwObjectTracker {
        objects: root.streamNodes
    }

    readonly property var sourceNode: AudioService.source || null
    property int micRefs: 0
    readonly property real micPeak: micMon.enabled ? Math.max(0, Math.min(100, (20 * Math.log10(Math.max(micMon.peak, 1e-6)) + 60) / 60 * 100)) : 0
    function watchMic() {
        micRefs++;
    }
    function releaseMic() {
        micRefs = Math.max(0, micRefs - 1);
    }
    PwNodePeakMonitor {
        id: micMon
        node: root.sourceNode
        enabled: root.micRefs > 0 && !!root.sourceNode && !root.sourceNode.audio?.muted
    }

    function clamp(v, a, b) {
        return Math.max(a, Math.min(b, Math.round(v)));
    }

    function setVolume(v) {
        if (!AudioService.sink)
            return fail("setVolume", "nosink", "没有输出设备");
        AudioService.setVolume(clamp(v, 0, 100));
        if (AudioService.sink.audio.muted && v > 0)
            AudioService.sink.audio.muted = false;
        return ok("setVolume", "音量 " + clamp(v, 0, 100) + "%");
    }
    function setMuted(m) {
        if (!AudioService.sink?.audio)
            return fail("setMuted", "nosink", "没有输出设备");
        AudioService.sink.audio.muted = !!m;
        return ok("setMuted", m ? "已静音" : "已取消静音");
    }
    function setMic(v) {
        if (!AudioService.source)
            return fail("setMic", "nosource", "没有输入设备");
        AudioService.setMicVolume(clamp(v, 0, 100));
        return ok("setMic", "麦克风 " + clamp(v, 0, 100) + "%");
    }
    function setMicMuted(m) {
        if (!AudioService.source?.audio)
            return fail("setMicMuted", "nosource", "没有输入设备");
        AudioService.source.audio.muted = !!m;
        return ok("setMicMuted", m ? "麦克风已静音" : "麦克风已开启");
    }
    function setSink(i) {
        const n = sinkNodes[i];
        if (!n)
            return fail("setSink", "gone", "输出设备已断开");
        AudioService.setSink(n);
        return ok("setSink", "输出 → " + AudioService.displayName(n));
    }
    function setSource(i) {
        const n = sourceNodes[i];
        if (!n)
            return fail("setSource", "gone", "输入设备已断开");
        AudioService.setSource(n);
        return ok("setSource", "输入 → " + AudioService.displayName(n));
    }
    function setStream(id, v) {
        const n = streamNodes.find(x => String(x.id) === String(id));
        if (!n || !n.audio)
            return fail("setStream", "gone", "该应用已停止播放");
        n.audio.volume = clamp(v, 0, 100) / 100;
        return ok("setStream", null);
    }
}
