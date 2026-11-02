import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// KEYBINDS：搜索框（i、单击或任意处 / 进入输入，输入即过滤）、niri 快捷键列表（504px 可滚动；Enter 录新组合键）、全部重置
SyPane {
    id: d

    readonly property var all: Keybinds.state.list
    readonly property string q: sys ? sys.bq.trim().toLowerCase() : ""
    readonly property var rows: {
        const out = [];
        for (let i = 0; i < all.length; i++) {
            const b = all[i];
            if (q && (b.key + " " + b.label + " " + b.cmd).toLowerCase().indexOf(q) < 0)
                continue;
            out.push({
                "i": i,
                "k": String(b.key),
                "chg": b.key !== b.key0,
                "label": String(b.label || ""),
                "cmd": String(b.cmd || "")
            });
        }
        return out;
    }
    onRowsChanged: U.sync(binds, rows, r => String(r.i), k => d.sys.aboutToRemove("bind:" + k))
    onQChanged: list.contentY = 0
    Component.onCompleted: U.sync(binds, rows, r => String(r.i), null)
    ListModel {
        id: binds
    }

    SyIn {
        width: d.width
        topPadding: 8
        SyFocus {
            id: search
            width: d.width
            line: false
            syKey: "search"
            textEntry: true
            onActivated: {
                const f = d.sys.firstBind();
                if (f)
                    d.sys.ctx.focus(f);
            }
            Rectangle {
                anchors.fill: parent
                color: "transparent"
                border.width: 1
                border.color: P3.line
            }
            Row {
                x: 18
                anchors.verticalCenter: parent.verticalCenter
                spacing: 14
                Item {
                    anchors.verticalCenter: parent.verticalCenter
                    width: 24
                    height: 24
                    P3Glyph {
                        anchors.centerIn: parent
                        name: "search"
                        size: 20
                        color: search.dimColor
                    }
                }
                P3Text {
                    visible: !!d.sys && d.sys.bq !== ""
                    anchors.verticalCenter: parent.verticalCenter
                    kind: "value"
                    font.pixelSize: 20
                    font.letterSpacing: 20 * 0.06
                    text: d.sys ? d.sys.bq : ""
                    color: search.fg
                }
                Rectangle {
                    anchors.verticalCenter: parent.verticalCenter
                    width: 2
                    height: 22
                    color: P3.fill
                    visible: search.editing
                    opacity: search.editing ? 1 : 0
                    SequentialAnimation on opacity {
                        running: search.editing && !d.still
                        loops: Animation.Infinite
                        PropertyAction {
                            value: 1
                        }
                        PauseAnimation {
                            duration: 500
                        }
                        PropertyAction {
                            value: 0
                        }
                        PauseAnimation {
                            duration: 500
                        }
                    }
                }
                P3Text {
                    visible: !d.sys || d.sys.bq === ""
                    anchors.verticalCenter: parent.verticalCenter
                    kind: "label"
                    font.pixelSize: 15
                    font.letterSpacing: 15 * 0.14
                    text: "SEARCH"
                    color: P3.dim
                }
            }
            P3Text {
                anchors.right: parent.right
                anchors.rightMargin: 18
                anchors.verticalCenter: parent.verticalCenter
                kind: "meta"
                text: d.q ? binds.count + " / " + d.all.length : d.all.length + " BINDS"
                color: search.dimColor
            }
        }
    }

    SyIn {
        width: d.width
        topPadding: 10
        Flickable {
            id: list
            width: d.width
            height: 504
            contentWidth: width
            contentHeight: col.height
            interactive: contentHeight > height + 0.5
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            Column {
                id: col
                width: list.width
                Repeater {
                    model: binds
                    delegate: SyFocus {
                        id: row
                        required property string uid
                        required property string k
                        required property bool chg
                        required property string label
                        required property string cmd
                        readonly property bool cap: !!d.sys && d.sys.capKey === "bind:" + uid
                        width: col.width
                        syKey: "bind:" + uid
                        onActivated: d.sys.startCapture("bind:" + uid)
                        SyKeys {
                            x: 18
                            anchors.verticalCenter: parent.verticalCenter
                            keys: row.k
                            changed: row.chg
                            fg: row.fg
                            track: row.trackColor
                        }
                        P3Text {
                            x: 18 + 230 + 16
                            width: 150
                            anchors.verticalCenter: parent.verticalCenter
                            kind: "zh"
                            font.letterSpacing: 18 * 0.04
                            text: row.label
                            color: row.fg
                            elide: Text.ElideRight
                        }
                        Text {
                            visible: !row.cap
                            x: 18 + 230 + 16 + 150 + 16
                            width: row.width - 18 - x
                            anchors.verticalCenter: parent.verticalCenter
                            font.family: "monospace"
                            font.pixelSize: 14
                            font.weight: Font.Medium
                            text: row.cmd
                            color: row.dimColor
                            elide: Text.ElideRight
                        }
                        SyCapt {
                            visible: row.cap
                            x: row.width - 18 - width
                            anchors.verticalCenter: parent.verticalCenter
                            still: d.still
                        }
                        Rectangle {
                            visible: row.cap
                            anchors.fill: parent
                            color: "transparent"
                            border.width: 2
                            border.color: P3.accent
                        }
                    }
                }
                Item {
                    visible: binds.count === 0 && d.q !== ""
                    width: col.width
                    height: 30 + 14 + 30
                    P3Text {
                        x: 18
                        anchors.verticalCenter: parent.verticalCenter
                        kind: "meta"
                        text: "NO MATCH"
                        color: P3.dim
                    }
                }
            }
        }
    }

    SyIn {
        width: d.width
        topPadding: 14
        SyFocus {
            id: reset
            width: d.width
            line: false
            syKey: "bindReset"
            onActivated: {
                d.sys.bq = "";
                reset.run(Keybinds.resetAll());
            }
            P3Glyph {
                x: 18 + 2
                anchors.verticalCenter: parent.verticalCenter
                name: "reboot"
                size: 20
                color: reset.fg
            }
            P3Text {
                x: 18 + 24 + 16
                anchors.verticalCenter: parent.verticalCenter
                kind: "label"
                text: "RESET ALL"
                color: reset.fg
            }
        }
    }
}
