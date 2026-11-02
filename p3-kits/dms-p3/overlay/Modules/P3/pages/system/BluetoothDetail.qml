import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// BLUETOOTH：已连接设备大字，蓝牙 / 搜索开关，设备卡片（三列）
SyPane {
    id: d

    readonly property var b: Bt.state
    readonly property var conn: b.devices.filter(x => x.connected)
    readonly property real colW: (width - 28) / 2
    property bool ready: false

    ListModel {
        id: devs
    }
    readonly property var rows: b.devices.map(x => ({
                "name": String(x.name || ""),
                "kind": String(x.kind || "other"),
                "connected": !!x.connected,
                "paired": !!x.paired,
                "nearby": !!x.nearby,
                "battery": x.battery === null || x.battery === undefined ? -1 : Number(x.battery)
            }))
    onRowsChanged: U.sync(devs, rows, r => r.name, k => d.sys.aboutToRemove("dev:" + k))
    Component.onCompleted: {
        U.sync(devs, rows, r => r.name, null);
        ready = true;
    }

    function glyphOf(k) {
        return ({
                "headphones": "head",
                "mouse": "mouse",
                "kbd": "kbd"
            })[k] || "bt";
    }

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
                text: !d.b.available ? "NO ADAPTER" : d.b.on ? "ADAPTER ON · " + d.b.devices.filter(x => x.paired).length + " PAIRED · " + d.conn.length + " CONNECTED" : "ADAPTER OFF"
                color: P3.dim
            }
            P3Text {
                x: 18
                width: Math.min(implicitWidth, parent.width - 36)
                anchors.baseline: parent.top
                anchors.baselineOffset: 92
                kind: "numSm"
                font.pixelSize: 60
                font.letterSpacing: -0.6
                text: !d.b.on ? "BT OFF" : d.conn.length ? d.conn[0].name : "NO DEVICE"
                color: P3.tx
                elide: Text.ElideRight
            }
        }
    }
    SyIn {
        width: d.width
        Row {
            spacing: 28
            SyToggle {
                width: d.colW
                syKey: "bt"
                tall: true
                icon: "bt"
                label: "BLUETOOTH"
                meta: !d.b.on ? "OFF" : d.conn.length ? d.conn.map(x => x.name).join(", ") : "NO DEVICE"
                checked: d.b.on
                disabled: !d.b.available
                action: v => Bt.setPower(v)
            }
            SyToggle {
                id: scan
                width: d.colW
                syKey: "scan"
                tall: true
                leadW: 24
                label: "DISCOVER"
                meta: d.b.scanning ? "SCANNING NEARBY…" : ""
                two: true
                checked: d.b.scanning
                disabled: !d.b.on
                action: v => Bt.setScan(v)
                // 搜索图标：静止时两圈 + 中心方块，搜索时三圈依次向外扩散
                Item {
                    id: rings
                    x: 18
                    anchors.verticalCenter: parent.verticalCenter
                    width: 24
                    height: 24
                    readonly property bool live: scan.on && !d.still
                    Repeater {
                        model: 3
                        Rectangle {
                            id: ring
                            required property int index
                            anchors.fill: parent
                            radius: 12
                            color: "transparent"
                            border.width: 2
                            border.color: scan.fg
                            opacity: rings.live ? 0 : [0.45, 0.9, 0][index]
                            scale: rings.live ? 0.2 : [1, 0.55, 1][index]
                            SequentialAnimation {
                                running: rings.live
                                loops: Animation.Infinite
                                PauseAnimation {
                                    duration: ring.index * 500
                                }
                                ParallelAnimation {
                                    NumberAnimation {
                                        target: ring
                                        property: "scale"
                                        from: 0.2
                                        to: 1.5
                                        duration: 1500
                                        easing.type: Easing.BezierSpline
                                        easing.bezierCurve: P3.ease
                                    }
                                    NumberAnimation {
                                        target: ring
                                        property: "opacity"
                                        from: 1
                                        to: 0
                                        duration: 1500
                                        easing.type: Easing.BezierSpline
                                        easing.bezierCurve: P3.ease
                                    }
                                }
                                PauseAnimation {
                                    duration: (2 - ring.index) * 500
                                }
                            }
                        }
                    }
                    Rectangle {
                        x: 9
                        y: 9
                        width: 6
                        height: 6
                        color: scan.fg
                    }
                }
            }
        }
    }
    SyGap {}
    SySec {
        width: d.width
        below: 24
        text: "DEVICES · " + devs.count
    }
    SyIn {
        width: d.width
        Grid {
            columns: 3
            columnSpacing: 28
            rowSpacing: 28
            Repeater {
                model: devs
                delegate: SyFocus {
                    id: card
                    required property string name
                    required property string kind
                    required property bool connected
                    required property bool nearby
                    required property int battery
                    readonly property bool busy: d.b.busy === name
                    width: (d.width - 56) / 3
                    height: 168
                    line: false
                    syKey: "dev:" + name
                    disabled: busy ? !d.b.on : !(d.b.on && !d.b.busy)
                    onActivated: {
                        if (!Bt.state.busy)
                            run(Bt.toggle(card.name));
                    }
                    Component.onCompleted: if (d.ready && !d.still)
                        fresh.start()
                    ParallelAnimation {
                        id: fresh
                        NumberAnimation {
                            target: body
                            property: "opacity"
                            from: 0
                            to: 1
                            duration: 600
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.spring
                        }
                        NumberAnimation {
                            target: freshT
                            property: "y"
                            from: 30
                            to: 0
                            duration: 600
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.spring
                        }
                    }

                    Item {
                        id: body
                        anchors.fill: parent
                        transform: Translate {
                            id: freshT
                        }
                        Rectangle {
                            anchors.fill: parent
                            color: P3.panel
                        }
                        // 顶行高 24（.p-ico 槽位，28px 图标居中溢出 2px），芯片在行内居中；名字盒顶 = 24 + 12 + 6
                        Item {
                            anchors.fill: parent
                            anchors.margins: 22
                            P3Glyph {
                                x: -2
                                y: -2
                                name: d.glyphOf(card.kind)
                                size: 28
                                color: P3.tx
                            }
                            P3Chip {
                                id: chip
                                anchors.right: parent.right
                                y: 1
                                text: card.busy ? (card.connected ? "DISCONNECTING" : "CONNECTING") : card.connected ? "CONNECTED" : card.nearby ? "NEW" : "PAIRED"
                                ghost: card.busy || (!card.connected && !card.nearby)
                                hot: !card.busy && !card.connected && card.nearby
                                SequentialAnimation on opacity {
                                    running: card.busy && !d.still
                                    loops: Animation.Infinite
                                    PropertyAction {
                                        value: 1
                                    }
                                    PauseAnimation {
                                        duration: 500
                                    }
                                    PropertyAction {
                                        value: 0.35
                                    }
                                    PauseAnimation {
                                        duration: 500
                                    }
                                    onStopped: chip.opacity = 1
                                }
                            }
                            P3Text {
                                anchors.baseline: parent.top
                                anchors.baselineOffset: 42 + 30.4
                                width: parent.width
                                kind: "numSm"
                                text: card.name
                                color: P3.tx
                                elide: Text.ElideRight
                            }
                            Item {
                                visible: card.connected && card.battery >= 0
                                anchors.left: parent.left
                                anchors.right: parent.right
                                anchors.bottom: parent.bottom
                                height: 34
                                P3Bar {
                                    anchors.left: parent.left
                                    anchors.right: pctN.left
                                    anchors.rightMargin: 14
                                    anchors.bottom: parent.bottom
                                    anchors.bottomMargin: 8
                                    value: card.battery
                                }
                                P3Text {
                                    id: pctN
                                    anchors.right: unit.left
                                    anchors.rightMargin: 4
                                    anchors.baseline: parent.bottom
                                    anchors.baselineOffset: -4
                                    kind: "numSm"
                                    text: String(card.battery)
                                    color: P3.tx
                                }
                                P3Text {
                                    id: unit
                                    anchors.right: parent.right
                                    anchors.baseline: pctN.baseline
                                    kind: "unit"
                                    text: "%"
                                    color: P3.dim
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
