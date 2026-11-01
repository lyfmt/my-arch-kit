import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// NETWORK：当前网络大字 + 信号，Wi-Fi / Clash TUN 开关，可用网络列表（选中加密网络时展开密码行）
SyPane {
    id: d

    readonly property var n: Net.state
    readonly property var c: Clash.state
    readonly property var cur: n.list.find(w => w.on) || null
    readonly property real colW: (width - 28) / 2

    readonly property string bigText: n.wifi && n.ssid ? n.ssid : n.ethernet ? "ETHERNET" : "OFFLINE"
    readonly property string netLine: {
        if (n.wifi && n.ssid)
            return ["CONNECTED", cur ? cur.security : "", cur ? cur.band : ""].filter(x => x).join(" · ");
        if (n.ethernet)
            return "WIRED · CONNECTED";
        if (!n.available)
            return "NO WI-FI ADAPTER";
        return n.wifi ? "NOT CONNECTED" : "WI-FI RADIO OFF";
    }
    readonly property string vpnMeta: {
        if (!c.available)
            return "OFFLINE";
        const node = String(c.node || "").split("·").pop().trim();
        if (c.tun)
            return "TUN ON" + (node ? " · " + node : "");
        if (c.sysproxy)
            return "SYSTEM PROXY" + (node ? " · " + node : "");
        return "DIRECT · NO PROXY";
    }

    ListModel {
        id: aps
    }
    readonly property var rows: n.list.map(w => ({
                "ssid": String(w.ssid || ""),
                "sig": Number(w.sig) || 0,
                "sec": !!w.sec,
                "on": !!w.on,
                "saved": !!w.saved
            }))
    onRowsChanged: U.sync(aps, rows, r => r.ssid, k => d.sys.aboutToRemove("ap:" + k))
    Component.onCompleted: U.sync(aps, rows, r => r.ssid, null)

    // 大字行：上方状态行 + 网络名，右侧大信号格
    SyIn {
        width: d.width
        Item {
            width: parent.width
            height: 116
            P3Text {
                x: 18
                anchors.verticalCenter: parent.top
                anchors.verticalCenterOffset: 29.25
                kind: "meta"
                text: d.netLine
                color: P3.dim
            }
            P3Text {
                x: 18
                width: Math.min(implicitWidth, sig.x - 28 - x)
                anchors.baseline: parent.top
                anchors.baselineOffset: 92
                kind: "numSm"
                font.pixelSize: 60
                font.letterSpacing: -0.6
                text: d.bigText
                color: P3.tx
                elide: Text.ElideRight
            }
            SySig {
                id: sig
                x: parent.width - 18 - width
                y: 98 - height
                big: true
                value: d.n.wifi && d.n.ssid ? (d.cur ? d.cur.sig : d.n.signal) : 0
            }
        }
    }
    SyIn {
        width: d.width
        Row {
            spacing: 28
            SyToggle {
                width: d.colW
                syKey: "wifi"
                tall: true
                icon: "wifi"
                label: "WI-FI"
                meta: !d.n.available ? "NO ADAPTER" : d.n.wifi ? (d.n.ssid || "ON") : "OFF"
                checked: d.n.wifi
                disabled: !d.n.available
                action: v => {
                    if (!v)
                        d.sys.pwSsid = "";
                    return Net.setWifi(v);
                }
            }
            SyToggle {
                width: d.colW
                syKey: "vpn"
                tall: true
                icon: "vpn"
                label: "CLASH TUN"
                meta: d.vpnMeta
                checked: d.c.tun
                disabled: !d.c.available
                action: v => Clash.setTun(v)
            }
        }
    }
    SyGap {}
    SySec {
        width: d.width
        text: "AVAILABLE · " + aps.count
    }
    SyIn {
        width: d.width
        Repeater {
            model: aps
            delegate: Column {
                id: ap
                required property string ssid
                required property int sig
                required property bool sec
                required property bool on
                required property bool saved
                readonly property bool busy: d.n.connecting === ssid
                width: d.width

                SyFocus {
                    id: row
                    width: parent.width
                    height: 62
                    syKey: "ap:" + ap.ssid
                    disabled: ap.busy ? !d.n.wifi : !(d.n.wifi && !d.n.connecting)
                    onActivated: d.sys.activateAp({
                        "ssid": ap.ssid,
                        "sec": ap.sec,
                        "on": ap.on,
                        "saved": ap.saved
                    })
                    SySig {
                        id: s
                        x: 18
                        anchors.verticalCenter: parent.verticalCenter
                        value: ap.sig
                        litColor: row.fg
                        offColor: row.trackColor
                    }
                    P3Text {
                        x: s.x + s.width + 16
                        width: Math.min(implicitWidth, right.x - 16 - x)
                        anchors.verticalCenter: parent.verticalCenter
                        kind: "value"
                        text: ap.ssid
                        color: row.fg
                        elide: Text.ElideRight
                    }
                    Row {
                        id: right
                        x: row.width - 18 - width
                        anchors.verticalCenter: parent.verticalCenter
                        spacing: 10
                        P3Text {
                            visible: ap.busy
                            anchors.verticalCenter: parent.verticalCenter
                            kind: "meta"
                            text: "CONNECTING"
                            color: row.dimColor
                        }
                        SyBusy {
                            visible: ap.busy
                            anchors.verticalCenter: parent.verticalCenter
                            still: d.still
                            trackColor: row.trackColor
                            onColor: row.fg
                        }
                        P3Chip {
                            visible: !ap.busy && ap.on
                            anchors.verticalCenter: parent.verticalCenter
                            text: "CONNECTED"
                        }
                        Item {
                            visible: !ap.busy && !ap.on && ap.sec
                            width: 24
                            height: 24
                            anchors.verticalCenter: parent.verticalCenter
                            P3Glyph {
                                anchors.centerIn: parent
                                name: "lock"
                                size: 18
                                color: row.fg
                            }
                        }
                        Item {
                            visible: !ap.busy && !ap.on
                            width: 4 + 18
                            height: 18
                            anchors.verticalCenter: parent.verticalCenter
                            P3Glyph {
                                x: 4
                                name: "chev"
                                size: 18
                                color: row.dimColor
                            }
                        }
                    }
                }

                // 密码行：8 / 60 / 10，展开时回弹；认证失败时抖动
                Item {
                    id: pwWrap
                    readonly property bool open: d.sys.pwSsid === ap.ssid
                    width: parent.width
                    height: open ? 78 : 0
                    visible: open || height > 0
                    clip: true
                    Behavior on height {
                        enabled: !d.still
                        NumberAnimation {
                            duration: 420
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.spring
                        }
                    }
                    Rectangle {
                        y: 8
                        width: parent.width
                        height: 60
                        color: P3.panel
                        transform: Translate {
                            id: shakeT
                        }
                        P3Glyph {
                            x: 18 + 2
                            anchors.verticalCenter: parent.verticalCenter
                            name: "lock"
                            size: 20
                            color: P3.tx
                        }
                        SyField {
                            x: 18 + 24 + 16
                            width: parent.width - x - 18
                            anchors.verticalCenter: parent.verticalCenter
                            syKey: "pw"
                            count: pwWrap.open ? d.sys.pwVal.length : 0
                            still: d.still
                        }
                    }
                    Connections {
                        target: d.sys
                        function onPwShakeNChanged() {
                            if (pwWrap.open)
                                shake.restart();
                        }
                    }
                    SequentialAnimation {
                        id: shake
                        NumberAnimation {
                            target: shakeT
                            property: "x"
                            to: -12
                            duration: 80
                        }
                        NumberAnimation {
                            target: shakeT
                            property: "x"
                            to: 9
                            duration: 100
                        }
                        NumberAnimation {
                            target: shakeT
                            property: "x"
                            to: -5
                            duration: 100
                        }
                        NumberAnimation {
                            target: shakeT
                            property: "x"
                            to: 0
                            duration: 120
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.ease
                        }
                    }
                }
            }
        }
    }
}
