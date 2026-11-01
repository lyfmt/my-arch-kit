import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// NOTICES：左列 勿扰时间段、弹窗（时长、位置），右列 按应用的通知级别
// 应用列表 = 已有规则的应用 + 发过通知的应用（Notify.state.apps，含当前通知）
SyPane {
    id: d

    readonly property var st: Settings.state
    readonly property real colW: (width - 28) / 2
    readonly property var hours: Array.from({
        "length": 24
    }, (_, h) => String(h).padStart(2, "0") + ":00")

    function setting(k) {
        return v => Settings.set(k, v);
    }
    function appIcon(app) {
        const h = Notify.state.apps.find(x => x.app === app);
        const fromNote = h && h.icon ? Apps.iconSource(h.icon) : "";
        if (fromNote)
            return fromNote;
        const low = app.toLowerCase();
        const a = Apps.all.find(x => x.name.toLowerCase() === low) || Apps.byId(low);
        return a ? Apps.iconSource(a.icon) : "";
    }

    ListModel {
        id: apps
    }
    readonly property var appRows: {
        const names = Object.keys(Rules.state);
        for (const n of Notify.state.apps.concat(Notify.state.items))
            if (n.app && names.indexOf(n.app) < 0)
                names.push(n.app);
        return names.map(n => ({
                    "app": n,
                    "ic": appIcon(n)
                }));
    }
    onAppRowsChanged: U.sync(apps, appRows, r => r.app, k => d.sys.aboutToRemove("appr:" + k))
    Component.onCompleted: U.sync(apps, appRows, r => r.app, null)

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
                    text: "DND SCHEDULE"
                }
                SyIn {
                    width: parent.width
                    SyToggle {
                        width: parent.width
                        syKey: "dndSched"
                        icon: "moon"
                        label: "SCHEDULE"
                        checked: d.st.dndSchedule
                        action: d.setting("dndSchedule")
                    }
                }
                SyIn {
                    width: parent.width
                    SyCycle {
                        width: parent.width
                        syKey: "dndFrom"
                        label: "FROM"
                        opts: d.hours
                        index: d.st.dndFrom
                        need: d.st.dndSchedule
                        action: d.setting("dndFrom")
                    }
                    SyCycle {
                        width: parent.width
                        syKey: "dndTo"
                        label: "UNTIL"
                        opts: d.hours
                        index: d.st.dndTo
                        need: d.st.dndSchedule
                        action: d.setting("dndTo")
                    }
                }
                SyGap {}
                SySec {
                    width: parent.width
                    text: "POPUPS"
                }
                SyIn {
                    width: parent.width
                    SyCycle {
                        width: parent.width
                        syKey: "popT"
                        label: "TIMEOUT"
                        opts: ["3 秒", "5 秒", "8 秒", "常驻"]
                        index: d.st.popTimeout
                        action: d.setting("popTimeout")
                    }
                    SyCycle {
                        width: parent.width
                        syKey: "popPos"
                        label: "POSITION"
                        opts: ["右上", "顶部居中", "右下"]
                        index: d.st.popPos
                        action: d.setting("popPos")
                    }
                }
            }

            Column {
                width: d.colW
                SySec {
                    width: parent.width
                    text: "PER APP"
                }
                SyIn {
                    width: parent.width
                    Repeater {
                        model: apps
                        delegate: SyCycle {
                            required property string app
                            required property string ic
                            width: d.colW
                            syKey: "appr:" + app
                            img: ic
                            label: app
                            name: true
                            opts: d.sys ? d.sys.apprOpts : []
                            index: Rules.state[app] !== undefined ? Rules.state[app] : 0
                            action: i => Rules.set(app, i)
                        }
                    }
                    Item {
                        visible: apps.count === 0
                        width: parent.width
                        height: P3.rowH
                        P3Text {
                            x: 18
                            anchors.verticalCenter: parent.verticalCenter
                            kind: "meta"
                            text: "NO APPS"
                            color: P3.dim
                        }
                    }
                }
            }
        }
    }
}
