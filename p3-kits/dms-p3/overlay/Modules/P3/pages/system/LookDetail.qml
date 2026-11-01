import QtQuick
import Quickshell
import qs.Modules.P3
import qs.P3Sys
import "util.js" as U

// LOOK：左列 主题（配色、壁纸入口、面板不透明度），右列 文字（字体、缩放）、动效
SyPane {
    id: d

    readonly property var st: Settings.state
    readonly property real colW: (width - 28) / 2
    // 壁纸切换器的快捷键（niri 绑定里命令含 wallpaper 的那一条）
    readonly property var wallBind: Keybinds.state.list.find(b => /wallpaper/i.test(b.cmd)) || null

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
                    text: "THEME"
                }
                SyIn {
                    width: parent.width
                    SyCycle {
                        width: parent.width
                        syKey: "theme"
                        icon: "bulb"
                        label: "COLOR"
                        opts: ["P3 BLUE", "DYNAMIC"]
                        index: d.st.theme
                        action: d.setting("theme")
                    }
                }
                SyIn {
                    width: parent.width
                    SyAct {
                        width: parent.width
                        syKey: "wall"
                        icon: "display"
                        label: "WALLPAPER"
                        value: d.wallBind ? String(d.wallBind.key).toUpperCase() : ""
                        disabled: !d.wallBind
                        onActivated: {
                            const argv = U.spawnArgs(d.wallBind ? d.wallBind.cmd : "");
                            if (!argv.length)
                                return;
                            P3Menu.close();
                            Quickshell.execDetached(argv);
                        }
                    }
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        width: parent.width
                        syKey: "alpha"
                        label: "PANEL OPACITY"
                        from: 40
                        to: 100
                        value: d.st.popupAlpha
                        action: d.setting("popupAlpha")
                    }
                }
            }

            Column {
                width: d.colW
                SySec {
                    width: parent.width
                    text: "TEXT"
                }
                SyIn {
                    width: parent.width
                    SyCycle {
                        width: parent.width
                        syKey: "font"
                        label: "FONT"
                        opts: Settings.fonts
                        index: d.st.font
                        action: d.setting("font")
                    }
                }
                SyIn {
                    width: parent.width
                    SySlider {
                        width: parent.width
                        syKey: "fscale"
                        label: "FONT SCALE · %"
                        from: 80
                        to: 140
                        value: d.st.fontScale
                        action: d.setting("fontScale")
                    }
                }
                SyGap {}
                SySec {
                    width: parent.width
                    text: "MOTION"
                }
                SyIn {
                    width: parent.width
                    SyCycle {
                        width: parent.width
                        syKey: "motion"
                        icon: "play"
                        label: "ANIMATION"
                        opts: ["减弱", "标准", "夸张"]
                        index: d.st.motion
                        action: d.setting("motion")
                    }
                }
            }
        }
    }
}
