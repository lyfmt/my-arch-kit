import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// SOUND：左列 输出（主音量、静音、输出设备）+ 输入设备；右列 各应用音量 + 麦克风（增益、静音、电平）
SyPane {
    id: d

    readonly property var a: Audio.state
    readonly property real colW: (width - 28) / 2
    readonly property bool active: !!(sys && sys.live) && !still

    // 设备单选：点下去先显示新选择，后端跟上或失败时回到后端值
    property int sinkWant: -1
    property int srcWant: -1
    readonly property int sinkShown: sinkWant >= 0 ? sinkWant : a.sink
    readonly property int srcShown: srcWant >= 0 ? srcWant : a.source
    onASinkChanged: if (sinkWant === a.sink)
        sinkWant = -1
    onASourceChanged: if (srcWant === a.source)
        srcWant = -1
    readonly property int aSink: a.sink
    readonly property int aSource: a.source
    Timer {
        id: sinkSettle
        interval: 1500
        onTriggered: d.sinkWant = -1
    }
    Timer {
        id: srcSettle
        interval: 1500
        onTriggered: d.srcWant = -1
    }
    function pickSink(i, row) {
        if (i === sinkShown)
            return;
        sinkWant = i;
        row.run(Audio.setSink(i), {
            "done": ok => {
                if (!ok)
                    d.sinkWant = -1;
                else if (d.sinkWant >= 0)
                    sinkSettle.restart();
            }
        });
    }
    function pickSrc(i, row) {
        if (i === srcShown)
            return;
        srcWant = i;
        row.run(Audio.setSource(i), {
            "done": ok => {
                if (!ok)
                    d.srcWant = -1;
                else if (d.srcWant >= 0)
                    srcSettle.restart();
            }
        });
    }
    function devGlyph(kind) {
        return ({
                "head": "head",
                "display": "display",
                "out": "vol",
                "mic": "mic"
            })[kind] || "vol";
    }

    ListModel {
        id: sinks
    }
    ListModel {
        id: srcs
    }
    ListModel {
        id: streams
    }
    readonly property var sinkRows: a.sinks.map(s => ({
                "id": String(s.id),
                "name": String(s.name || s.id),
                "kind": String(s.kind || "")
            }))
    readonly property var srcRows: a.sources.map(s => ({
                "id": String(s.id),
                "name": String(s.name || s.id),
                "kind": String(s.kind || "")
            }))
    readonly property var streamRows: a.streams.map(s => ({
                "id": String(s.id),
                "name": String(s.name || ""),
                "icon": Apps.iconSource(s.icon || String(s.name || "").toLowerCase()),
                "vol": Number(s.vol) || 0
            }))
    onSinkRowsChanged: U.sync(sinks, sinkRows, r => r.id, k => d.sys.aboutToRemove("sink:" + k))
    onSrcRowsChanged: U.sync(srcs, srcRows, r => r.id, k => d.sys.aboutToRemove("src:" + k))
    onStreamRowsChanged: U.sync(streams, streamRows, r => r.id, k => d.sys.aboutToRemove("app:" + k))
    Component.onCompleted: {
        U.sync(sinks, sinkRows, r => r.id, null);
        U.sync(srcs, srcRows, r => r.id, null);
        U.sync(streams, streamRows, r => r.id, null);
    }

    Item {
        width: d.width
        height: cols.height + 8
        Row {
            id: cols
            y: 8
            spacing: 28

            Column {
                width: d.colW
                SySec {
                    width: parent.width
                    text: "OUTPUT"
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        width: parent.width
                        syKey: "vol"
                        big: true
                        icon: "vol"
                        label: "VOLUME"
                        step: 2
                        value: d.a.vol
                        dimmed: d.a.muted
                        disabled: !d.a.available
                        action: v => Audio.setVolume(v)
                    }
                }
                SyIn {
                    width: parent.width
                    SyToggle {
                        width: parent.width
                        syKey: "mute"
                        icon: "mute"
                        label: "MUTE"
                        checked: d.a.muted
                        disabled: !d.a.available
                        action: v => Audio.setMuted(v)
                    }
                }
                SyIn {
                    width: parent.width
                    Repeater {
                        model: sinks
                        delegate: SyRadio {
                            id: sk
                            required property int index
                            required property string uid
                            required property string name
                            required property string kind
                            width: d.colW
                            syKey: "sink:" + uid
                            icon: d.devGlyph(kind)
                            text: name
                            selected: d.sinkShown === index
                            onActivated: d.pickSink(index, sk)
                        }
                    }
                }
                SyGap {}
                SySec {
                    width: parent.width
                    text: "INPUT"
                }
                SyIn {
                    width: parent.width
                    Repeater {
                        model: srcs
                        delegate: SyRadio {
                            id: sr
                            required property int index
                            required property string uid
                            required property string name
                            required property string kind
                            width: d.colW
                            syKey: "src:" + uid
                            icon: d.devGlyph(kind)
                            text: name
                            selected: d.srcShown === index
                            onActivated: d.pickSrc(index, sr)
                        }
                    }
                }
            }

            Column {
                width: d.colW
                SySec {
                    width: parent.width
                    text: "APPS"
                }
                Repeater {
                    model: streams
                    delegate: SyIn {
                        id: st
                        required property string uid
                        required property string name
                        required property string icon
                        required property int vol
                        width: d.colW
                        SySlider {
                            width: parent.width
                            syKey: "app:" + st.uid
                            img: st.icon
                            label: st.name
                            step: 5
                            value: st.vol
                            action: v => Audio.setStream(st.uid, v)
                        }
                    }
                }
                SyIn {
                    visible: streams.count === 0
                    width: parent.width
                    Item {
                        width: parent.width
                        height: P3.rowH
                        P3Text {
                            x: 18
                            anchors.verticalCenter: parent.verticalCenter
                            kind: "meta"
                            text: "NO PLAYBACK"
                            color: P3.dim
                        }
                    }
                }
                SyGap {
                    height: 12
                }
                SySec {
                    width: parent.width
                    text: "MICROPHONE"
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        width: parent.width
                        syKey: "mic"
                        icon: "mic"
                        label: "GAIN"
                        value: d.a.mic
                        dimmed: d.a.micMuted
                        disabled: d.a.source < 0
                        action: v => Audio.setMic(v)
                    }
                }
                SyIn {
                    width: parent.width
                    SyToggle {
                        width: parent.width
                        syKey: "micmute"
                        icon: "mute"
                        label: "MIC MUTE"
                        checked: d.a.micMuted
                        disabled: d.a.source < 0
                        action: v => Audio.setMicMuted(v)
                    }
                }
                SyIn {
                    width: parent.width
                    topPadding: 12
                    SyMeter {
                        width: parent.width
                        muted: d.a.micMuted || d.a.source < 0
                        active: d.active && d.visible
                    }
                }
            }
        }
    }
}
