import QtQuick
import qs.Modules.P3
import qs.P3Sys

// MODE：性能模式分段，勿扰 / 保持唤醒，电池（电量、状态行、充电上限标记）
SyPane {
    id: d

    readonly property var b: Battery.state
    readonly property real colW: (width - 28) / 2
    readonly property string batLine: {
        const out = [b.charging ? "CHARGING" : b.plugged ? "PLUGGED IN" : "ON BATTERY"];
        if (b.remain)
            out.push(b.remain + (b.charging ? " TO FULL" : " LEFT"));
        if (b.watts > 0)
            out.push(b.watts + " W");
        return out.join(" · ");
    }

    SyGap {
        height: 8
    }
    SySec {
        width: d.width
        text: "POWER PROFILE"
        below: 24
    }
    SyIn {
        width: d.width
        SySeg {
            width: d.width
            items: d.sys ? d.sys.profiles : []
            current: d.b.profile
            avail: d.b.profiles
            usable: d.b.profileAvailable
            still: d.still
            action: id => Battery.setProfile(id)
        }
    }
    SyGap {
        height: 30
    }
    SyIn {
        width: d.width
        Row {
            spacing: 28
            SyToggle {
                width: d.colW
                syKey: "dnd"
                tall: true
                icon: "bell"
                label: "DO NOT DISTURB"
                meta: Mode.state.dnd ? "SILENT · POPUPS HIDDEN" : Notify.state.unread + " UNREAD"
                checked: Mode.state.dnd
                action: v => Mode.setDnd(v)
            }
            SyToggle {
                width: d.colW
                syKey: "caffeine"
                tall: true
                icon: "sun"
                label: "CAFFEINE"
                meta: Mode.state.caffeine ? "IDLE INHIBITED" : "IDLE TIMERS ACTIVE"
                checked: Mode.state.caffeine
                action: v => Mode.setCaffeine(v)
            }
        }
    }
    SyGap {
        visible: d.b.available
        height: 34
    }
    SySec {
        visible: d.b.available
        width: d.width
        text: "BATTERY"
    }
    // 电量 80px（底边对齐）| 状态行 + 10px 电量条，红色竖线标出充电上限
    SyIn {
        visible: d.b.available
        width: d.width
        Item {
            width: d.width
            height: 6 + 80 * 0.86
            P3Text {
                id: pct
                x: 18
                anchors.baseline: parent.bottom
                anchors.baselineOffset: -8
                kind: "num"
                font.pixelSize: 80
                font.letterSpacing: -0.8
                text: String(d.b.pct)
                color: P3.tx
            }
            P3Text {
                id: unit
                anchors.left: pct.right
                anchors.leftMargin: 4
                anchors.baseline: pct.baseline
                kind: "unit"
                text: "%"
                color: P3.dim
            }
            Item {
                x: unit.x + unit.width + 34
                width: parent.width - 18 - x
                height: parent.height
                P3Text {
                    y: parent.height - 10 - 10 - 14 - height
                    width: parent.width
                    kind: "meta"
                    text: d.batLine
                    color: P3.dim
                    elide: Text.ElideRight
                }
                Rectangle {
                    id: lim
                    y: parent.height - 10 - 10
                    width: parent.width
                    height: 10
                    color: P3.line
                    Rectangle {
                        width: parent.width * Math.max(0, Math.min(100, d.b.pct)) / 100
                        height: parent.height
                        color: P3.fill
                    }
                    Rectangle {
                        visible: d.b.limit > 0
                        x: parent.width * Math.min(100, d.b.limit) / 100
                        y: -8
                        width: 2
                        height: parent.height + 16
                        color: P3.accent
                        // 标记太靠右时文字放到竖线左侧
                        P3Text {
                            x: parent.x + 8 + implicitWidth > lim.width ? -8 - implicitWidth : 8
                            y: -14
                            kind: "meta"
                            font.pixelSize: 12
                            font.letterSpacing: 12 * 0.14
                            text: "LIMIT " + d.b.limit
                            color: P3.accent
                        }
                    }
                }
            }
        }
    }
}
