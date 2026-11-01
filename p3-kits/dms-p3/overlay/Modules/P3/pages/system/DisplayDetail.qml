import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// DISPLAY：左列 背光 + 显示器（只读），右列 夜间模式（开关、色温、计划）
SyPane {
    id: d

    readonly property var s: Display.state
    readonly property real colW: (width - 28) / 2

    ListModel {
        id: mons
    }
    readonly property var monRows: s.monitors.map(m => ({
                "name": String(m.name),
                "w": Number(m.w) || 0,
                "h": Number(m.h) || 0,
                "sc": Number(m.scale) || 1,
                "primary": !!m.primary
            }))
    onMonRowsChanged: U.sync(mons, monRows, r => r.name, null)
    Component.onCompleted: U.sync(mons, monRows, r => r.name, null)

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
                    text: "BRIGHTNESS"
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        width: parent.width
                        syKey: "bright"
                        big: true
                        icon: "sun"
                        label: "BACKLIGHT"
                        from: 1
                        value: d.s.bright
                        disabled: !d.s.available
                        action: v => Display.setBrightness(v)
                    }
                }
                SyGap {}
                SySec {
                    width: parent.width
                    text: "MONITORS"
                }
                SyIn {
                    width: parent.width
                    Repeater {
                        model: mons
                        delegate: Item {
                            id: m
                            required property string name
                            required property int w
                            required property int h
                            required property real sc
                            required property bool primary
                            width: d.colW
                            height: 50
                            P3Glyph {
                                x: 18 + 2
                                anchors.verticalCenter: parent.verticalCenter
                                name: "display"
                                size: 20
                                color: P3.tx
                            }
                            Row {
                                x: 18 + 24 + 16
                                anchors.verticalCenter: parent.verticalCenter
                                spacing: 16
                                P3Text {
                                    anchors.verticalCenter: parent.verticalCenter
                                    kind: "value"
                                    font.pixelSize: 19
                                    font.letterSpacing: 19 * 0.04
                                    text: m.name
                                    color: P3.tx
                                }
                                P3Chip {
                                    visible: m.primary
                                    anchors.verticalCenter: parent.verticalCenter
                                    text: "PRIMARY"
                                }
                            }
                            P3Text {
                                anchors.right: parent.right
                                anchors.rightMargin: 18
                                anchors.verticalCenter: parent.verticalCenter
                                kind: "meta"
                                text: m.w + "×" + m.h + " · ×" + Math.round(m.sc * 100) / 100
                                color: P3.dim
                            }
                            Rectangle {
                                anchors.left: parent.left
                                anchors.right: parent.right
                                anchors.bottom: parent.bottom
                                height: 1
                                color: P3.line
                            }
                        }
                    }
                    Item {
                        visible: mons.count === 0
                        width: parent.width
                        height: 50
                        P3Text {
                            x: 18
                            anchors.verticalCenter: parent.verticalCenter
                            kind: "meta"
                            text: "NONE"
                            color: P3.dim
                        }
                    }
                }
            }

            Column {
                width: d.colW
                SySec {
                    width: parent.width
                    text: "NIGHT LIGHT"
                }
                SyIn {
                    width: parent.width
                    SyToggle {
                        width: parent.width
                        syKey: "night"
                        tall: true
                        icon: "moon"
                        label: "NIGHT LIGHT"
                        meta: d.s.night ? "ON · " + d.s.temp + "K" : "OFF"
                        checked: d.s.night
                        action: v => Display.setNight(v)
                    }
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        id: temp
                        width: parent.width
                        syKey: "temp"
                        label: "TEMPERATURE"
                        from: 2500
                        to: 6500
                        step: 250
                        value: d.s.temp
                        hasSwatch: true
                        swatch: U.kelvin(temp.shown)
                        disabled: !d.s.night
                        action: v => Display.setTemp(v)
                    }
                }
                SyIn {
                    width: parent.width
                    SyCycle {
                        width: parent.width
                        syKey: "nsched"
                        icon: "cal"
                        label: "SCHEDULE"
                        opts: ["手动", "日落到日出", "22:00 – 07:00"]
                        index: d.s.sched
                        need: d.s.night
                        action: i => Display.setSchedule(i)
                    }
                }
            }
        }
    }
}
