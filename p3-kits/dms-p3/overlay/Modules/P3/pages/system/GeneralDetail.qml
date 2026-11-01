import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// GENERAL：左列 默认应用（终端只读）、系统更新（按住确认），右列 开机自启、本机信息
SyPane {
    id: d

    readonly property real colW: (width - 28) / 2
    readonly property var up: Update.state

    function appName(id) {
        const a = Apps.byId(id);
        return a ? a.name : id;
    }
    function names(role) {
        return (Defaults.options[role] || []).map(id => appName(id));
    }

    ListModel {
        id: autos
    }
    readonly property var autoRows: Autostart.state.list.map(a => ({
                "id": String(a.id),
                "nm": String(a.name || a.id),
                "ic": String(a.icon || ""),
                "en": !!a.on
            }))
    onAutoRowsChanged: U.sync(autos, autoRows, r => r.id, k => d.sys.aboutToRemove("auto:" + k))
    Component.onCompleted: U.sync(autos, autoRows, r => r.id, null)

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
                    text: "DEFAULT APPS"
                }
                SyIn {
                    width: parent.width
                    Repeater {
                        model: [["browser", "BROWSER", "globe"], ["files", "FILES", "folder"], ["term", "TERMINAL", "term"], ["music", "MUSIC", "music"]]
                        delegate: SyCycle {
                            required property var modelData
                            readonly property string role: modelData[0]
                            readonly property int cur: Defaults.state[role]
                            width: d.colW
                            syKey: role
                            icon: modelData[2]
                            label: modelData[1]
                            opts: d.names(role)
                            index: cur
                            // 终端没有 xdg 标准，只读（显示 Mod+T 的命令）
                            locked: role === "term"
                            text: cur < 0 || locked ? (Defaults.current[role] ? d.appName(Defaults.current[role]) : "—") : ""
                            action: i => Defaults.set(role, i)
                        }
                    }
                }
                SyGap {}
                SySec {
                    width: parent.width
                    text: "UPDATES"
                }
                SyIn {
                    width: parent.width
                    SyHold {
                        id: upd
                        width: parent.width
                        syKey: "upd"
                        holdMs: 900
                        icon: "reboot"
                        label: d.up.running ? "更新中" : d.up.count ? "UPDATE " + d.up.count : "UP TO DATE"
                        disabled: !(d.up.count > 0 && !d.up.running)
                        onConfirmed: upd.run(Update.run())
                    }
                }
            }

            Column {
                width: d.colW
                SySec {
                    width: parent.width
                    text: "AUTOSTART"
                }
                SyIn {
                    width: parent.width
                    Repeater {
                        model: autos
                        delegate: SyToggle {
                            required property string uid
                            required property string nm
                            required property string ic
                            required property bool en
                            width: d.colW
                            syKey: "auto:" + uid
                            img: ic
                            label: nm
                            name: true
                            checked: en
                            action: v => Autostart.set(uid, v)
                        }
                    }
                    Item {
                        visible: autos.count === 0
                        width: parent.width
                        height: P3.rowH
                        P3Text {
                            x: 18
                            anchors.verticalCenter: parent.verticalCenter
                            kind: "meta"
                            text: "NONE"
                            color: P3.dim
                        }
                    }
                }
                SyGap {
                    height: 16
                }
                SySec {
                    width: parent.width
                    text: "ABOUT"
                }
                SyIn {
                    width: parent.width
                    SyInfo {
                        width: parent.width
                        label: "HOST"
                        value: About.state.host
                    }
                    SyInfo {
                        width: parent.width
                        label: "KERNEL"
                        value: About.state.kernel
                    }
                }
            }
        }
    }
}
