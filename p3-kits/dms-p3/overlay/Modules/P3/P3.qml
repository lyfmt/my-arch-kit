pragma Singleton

import QtQuick
import Quickshell

// dms-p3 设计令牌，对应 prototype/shared/tokens.css + menu.css 的 :root。
// 只有 P3 蓝一套：水下背景是唯一的渐变，其余平涂；没有单独的 hover 样式（指针移到元素上 = 焦点移过去）；焦点 = 元素左上角脉动的天蓝光点。
// 尺寸都是原型舞台像素（1920×1080，cover 缩放），菜单窗口统一乘 stageScale。
Singleton {
    id: root

    // ---------------------------------------------------------------- 颜色
    readonly property color deep: "#020a52"
    readonly property color sea: "#0626c4"
    readonly property color sky: "#0b8fe8"
    readonly property color fill: "#a3f0ff"
    readonly property color ink: "#04103c"
    readonly property color tx: "#ecfcff"
    readonly property color c1: "#a1eefd"
    readonly property color c2: "#90e1f2"
    readonly property color c3: "#7ccdf4"
    readonly property color c4: "#c2f6ff"
    readonly property color c5: "#74c9ff"
    readonly property color dim: Qt.rgba(163 / 255, 240 / 255, 1, 0.62)
    readonly property color line: Qt.rgba(163 / 255, 240 / 255, 1, 0.22)
    readonly property color panel: Qt.rgba(120 / 255, 200 / 255, 1, 0.08)
    readonly property color glass: Qt.rgba(4 / 255, 16 / 255, 60 / 255, 0.72)
    readonly property color accent: "#e3121b"
    readonly property color shard: "#ffffff"
    readonly property color danger: "#ff7076"
    readonly property color dangerFocus: "#ff9aa0"
    readonly property color glow: Qt.rgba(11 / 255, 143 / 255, 232 / 255, 0.85)
    readonly property color glowSoft: Qt.rgba(11 / 255, 143 / 255, 232 / 255, 0.35)
    readonly property color stageBg: "#000510"
    // 灵动岛（island-b）
    readonly property color isl: "#14306e"
    readonly property color isl2: "#1d3d82"

    function alpha(c, a) {
        return Qt.rgba(c.r, c.g, c.b, a);
    }

    // ---------------------------------------------------------------- 字体
    // .d 展示字（名词、数字）：P3 Display = Nunito Sans 12pt Condensed Black Italic，line-height .86
    // .l 标签字（其余一切）：Barlow Condensed Bold，大写，字距 .14em
    // .zh 中文：Noto Sans CJK SC 500，字距 .06em
    readonly property string fontDisplay: displayFont.status === FontLoader.Ready ? displayFont.name : "P3 Display"
    readonly property string fontLabel: labelFont.status === FontLoader.Ready ? labelFont.name : "Barlow Condensed"
    readonly property string fontZh: "Noto Sans CJK SC"

    FontLoader {
        id: displayFont
        source: Qt.resolvedUrl("assets/fonts/P3Display.ttf")
    }
    FontLoader {
        id: labelFont
        source: Qt.resolvedUrl("assets/fonts/BarlowCondensed-Bold.ttf")
    }

    // ---------------------------------------------------------------- 字号（原型 menu.css 的 PAGE PRIMITIVES）
    readonly property var type: ({
            "h1": {
                "size": 96,
                "family": "display"
            },
            "h2": {
                "size": 48,
                "family": "display"
            },
            "num": {
                "size": 64,
                "family": "display"
            },
            "numSm": {
                "size": 40,
                "family": "display"
            },
            "title": {
                "size": 104,
                "family": "display"
            },
            "item": {
                "size": 78,
                "family": "display"
            },
            "sec": {
                "size": 15,
                "family": "label",
                "spacing": 0.24
            },
            "label": {
                "size": 17,
                "family": "label",
                "spacing": 0.14
            },
            "value": {
                "size": 22,
                "family": "label",
                "spacing": 0.04
            },
            "meta": {
                "size": 13,
                "family": "label",
                "spacing": 0.12
            },
            "unit": {
                "size": 16,
                "family": "label",
                "spacing": 0.12
            },
            "chip": {
                "size": 13,
                "family": "label",
                "spacing": 0.12
            },
            "zh": {
                "size": 18,
                "family": "zh",
                "spacing": 0.06
            }
        })

    // ---------------------------------------------------------------- 舞台与面板几何
    readonly property int stageW: 1920
    readonly property int stageH: 1080
    readonly property int pageX: 400
    readonly property int pageY: 250
    readonly property int pageW: 1410
    readonly property int pageH: 680
    readonly property int headY: 96
    readonly property int headH: 130
    readonly property int rowH: 56
    readonly property int rowTallH: 72
    readonly property int btnH: 64
    readonly property int gap: 28

    // ---------------------------------------------------------------- 动效（cubic-bezier 控制点，给 Easing.BezierSpline 用）
    // ease  cubic-bezier(.22,.9,.24,1)   spring (.34,1.56,.64,1)   soft (.3,1.25,.5,1)
    readonly property var ease: [0.22, 0.9, 0.24, 1, 1, 1]
    readonly property var spring: [0.34, 1.56, 0.64, 1, 1, 1]
    readonly property var soft: [0.3, 1.25, 0.5, 1, 1, 1]
    readonly property var swoop: [0.6, 0.05, 0.3, 1, 1, 1]
    readonly property var exit: [0.5, 0, 0.9, 0.5, 1, 1]
}
