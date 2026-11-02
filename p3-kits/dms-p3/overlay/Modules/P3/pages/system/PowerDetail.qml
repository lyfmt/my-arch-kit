import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// POWER：接电 / 电池两套空闲计时（熄屏、锁屏、睡眠），合盖动作（logind，只读），睡前锁屏，立即锁屏，充电上限（sysfs，只读）
SyPane {
    id: d

    readonly property var st: Settings.state
    readonly property real colW: (width - 28) / 2
    readonly property var mins: sys ? sys.minOpts : []
    readonly property var lockBind: Keybinds.state.list.find(b => /\block\b/i.test(b.cmd) && !/\bunlock\b/i.test(b.cmd)) || null
    readonly property string lid: Power.state.lid

    function setting(k) {
        return v => Settings.set(k, v);
    }

    readonly property var timers: [["Off", "SCREEN OFF"], ["Lock", "LOCK"], ["Sus", "SUSPEND"]]

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
                    text: "PLUGGED IN"
                }
                SyIn {
                    width: parent.width
                    Repeater {
                        model: d.timers
                        delegate: SyCycle {
                            required property var modelData
                            readonly property string k: "ac" + modelData[0]
                            width: d.colW
                            syKey: k
                            label: modelData[1]
                            opts: d.mins
                            index: d.st[k]
                            action: d.setting(k)
                        }
                    }
                }
                SyGap {}
                SySec {
                    width: parent.width
                    text: "LID & LOCK"
                }
                SyIn {
                    width: parent.width
                    SyCycle {
                        width: parent.width
                        syKey: "lid"
                        icon: "sleep"
                        label: "LID CLOSE"
                        locked: true
                        text: d.lid ? U.lidLabel(d.lid) : "—"
                    }
                }
                SyIn {
                    width: parent.width
                    SyToggle {
                        width: parent.width
                        syKey: "lockSus"
                        label: "LOCK BEFORE SLEEP"
                        checked: d.st.lockBeforeSuspend
                        action: d.setting("lockBeforeSuspend")
                    }
                }
                SyIn {
                    width: parent.width
                    SyAct {
                        width: parent.width
                        syKey: "lockNow"
                        icon: "lock"
                        label: "LOCK NOW"
                        value: d.lockBind ? String(d.lockBind.key).toUpperCase() : ""
                        onActivated: {
                            P3Menu.close();
                            Power.run("lock");
                        }
                    }
                }
            }

            Column {
                width: d.colW
                SySec {
                    width: parent.width
                    text: "ON BATTERY"
                }
                SyIn {
                    width: parent.width
                    Repeater {
                        model: d.timers
                        delegate: SyCycle {
                            required property var modelData
                            readonly property string k: "bt" + modelData[0]
                            width: d.colW
                            syKey: k
                            label: modelData[1]
                            opts: d.mins
                            index: d.st[k]
                            action: d.setting(k)
                        }
                    }
                }
                SyGap {}
                SySec {
                    width: parent.width
                    text: "CHARGING"
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        width: parent.width
                        syKey: "limit"
                        icon: "bat"
                        label: "CHARGE LIMIT · %"
                        from: 60
                        to: 100
                        step: 5
                        value: Battery.state.limit
                        locked: true
                        text: Battery.state.limit > 0 ? "" : "—"
                    }
                }
            }
        }
    }
}
