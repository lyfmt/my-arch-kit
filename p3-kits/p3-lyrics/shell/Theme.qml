pragma Singleton

import QtQuick
import Quickshell

// 颜色只取 p3.css 的两套 token（与 index.html 相同）；浅背景时主句用 --ink，翻译用 --sea。
// 字体：中日文 Noto Sans CJK（系统字体），英文 P3 展示字（Nunito Sans Black Italic），歌手名 Barlow Condensed。
Singleton {
    id: th

    property bool lavender: Quickshell.env("P3LYRICS_THEME") === "lavender"
    property bool light: Quickshell.env("P3LYRICS_BG") === "light"

    readonly property color ink: lavender ? "#1b0f33" : "#04103c"
    readonly property color tx: lavender ? "#f6f0ff" : "#ecfcff"
    readonly property color fill: lavender ? "#d0bcff" : "#a3f0ff"
    readonly property color sea: lavender ? "#4b2f9e" : "#0626c4"
    readonly property color red: lavender ? "#ff3d6e" : "#e3121b"

    readonly property color main: light ? ink : tx
    readonly property color sub: light ? sea : fill
    readonly property real baseOp: light ? 0.3 : 0.18   // 水线常驻亮度

    readonly property bool ready: p3.status === FontLoader.Ready && bc.status === FontLoader.Ready
    readonly property string p3Font: p3.status === FontLoader.Ready ? p3.name : "Noto Sans CJK SC"
    readonly property string barlow: bc.status === FontLoader.Ready ? bc.name : "Noto Sans CJK SC"
    readonly property string sc: "Noto Sans CJK SC"
    readonly property string jp: "Noto Sans CJK JP"

    FontLoader { id: p3; source: Qt.resolvedUrl("assets/fonts/NunitoSans-BlackItalic.ttf") }
    FontLoader { id: bc; source: Qt.resolvedUrl("assets/fonts/BarlowCondensed-Bold.ttf") }
}
