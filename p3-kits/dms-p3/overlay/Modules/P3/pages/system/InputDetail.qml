import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// INPUT：左列 输入法（fcitx5 列表 + 切换键录制）、键盘重复；右列 触摸板
SyPane {
    id: d

    readonly property var ime: Ime.state
    readonly property var st: Settings.state
    readonly property real colW: (width - 28) / 2
    readonly property bool capturing: !!(sys && sys.capKey === "imeKey")

    // 输入法单选：先标上新选择，失败退回
    property string imeWant: ""
    readonly property string imeShown: imeWant !== "" ? imeWant : ime.im
    readonly property string imeCur: ime.im
    onImeCurChanged: if (imeWant === imeCur)
        imeWant = ""
    function pickIme(id, row) {
        if (id === imeShown)
            return;
        imeWant = id;
        row.run(Ime.set(id), {
            "done": ok => {
                if (!ok || d.ime.im === id)
                    d.imeWant = "";
            }
        });
    }
    function imeTag(id) {
        if (id === "keyboard-us")
            return "EN";
        const m = /^keyboard-(\w+)/.exec(id);
        return m ? m[1].toUpperCase() : "中";
    }
    ListModel {
        id: imes
    }
    readonly property var imeRows: ime.list.map(x => ({
                "id": String(x.id),
                "name": String(x.name || x.id)
            }))
    onImeRowsChanged: U.sync(imes, imeRows, r => r.id, k => d.sys.aboutToRemove("ime:" + k))
    Component.onCompleted: U.sync(imes, imeRows, r => r.id, null)

    function setting(k) {
        return v => Settings.set(k, v);
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
                    text: "INPUT METHOD"
                }
                SyIn {
                    width: parent.width
                    Repeater {
                        model: imes
                        delegate: SyRadio {
                            id: r
                            required property string uid
                            required property string name
                            width: d.colW
                            syKey: "ime:" + uid
                            text: d.imeTag(uid) + " · " + uid.toUpperCase()
                            meta: name !== uid ? name : ""
                            selected: d.imeShown === uid
                            onActivated: d.pickIme(uid, r)
                        }
                    }
                }
                SyIn {
                    width: parent.width
                    SyFocus {
                        id: trig
                        width: parent.width
                        syKey: "imeKey"
                        disabled: !d.ime.available
                        onActivated: d.sys.startCapture("imeKey")
                        P3Glyph {
                            id: kg
                            x: 18
                            anchors.verticalCenter: parent.verticalCenter
                            name: "kbd"
                            size: 24
                            color: trig.fg
                        }
                        P3Text {
                            x: kg.x + kg.width + 16
                            anchors.verticalCenter: parent.verticalCenter
                            kind: "label"
                            text: "SWITCH KEY"
                            color: trig.fg
                        }
                        SyKeys {
                            visible: !d.capturing
                            x: trig.width - 18 - width
                            anchors.verticalCenter: parent.verticalCenter
                            keys: d.ime.trigger
                            fg: trig.fg
                            track: trig.trackColor
                        }
                        SyCapt {
                            visible: d.capturing
                            x: trig.width - 18 - width
                            anchors.verticalCenter: parent.verticalCenter
                            still: d.still
                        }
                        Rectangle {
                            visible: d.capturing
                            anchors.fill: parent
                            color: "transparent"
                            border.width: 2
                            border.color: P3.accent
                        }
                    }
                }
                SyGap {}
                SySec {
                    width: parent.width
                    text: "KEYBOARD"
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        width: parent.width
                        syKey: "delay"
                        label: "REPEAT DELAY · MS"
                        from: 150
                        to: 800
                        step: 25
                        value: d.st.repeatDelay
                        action: d.setting("repeatDelay")
                    }
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        width: parent.width
                        syKey: "rate"
                        label: "REPEAT RATE · /S"
                        from: 10
                        to: 80
                        step: 5
                        value: d.st.repeatRate
                        action: d.setting("repeatRate")
                    }
                }
            }

            Column {
                width: d.colW
                SySec {
                    width: parent.width
                    text: "TOUCHPAD"
                }
                SyIn {
                    width: parent.width
                    SyToggle {
                        width: parent.width
                        syKey: "tap"
                        label: "TAP TO CLICK"
                        checked: d.st.tapToClick
                        action: d.setting("tapToClick")
                    }
                }
                SyIn {
                    width: parent.width
                    SyToggle {
                        width: parent.width
                        syKey: "natural"
                        label: "NATURAL SCROLL"
                        checked: d.st.naturalScroll
                        action: d.setting("naturalScroll")
                    }
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        width: parent.width
                        syKey: "tspeed"
                        icon: "mouse"
                        label: "POINTER SPEED"
                        value: d.st.touchSpeed
                        action: d.setting("touchSpeed")
                    }
                }
            }
        }
    }
}
