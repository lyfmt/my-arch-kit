pragma Singleton

import QtQuick
import Quickshell

// P3 字体：标题用 Nunito Sans Black Italic，标签/按键用 Barlow Condensed Bold。CJK 字形由系统回退到 Noto Sans CJK。
Singleton {
    readonly property string display: p3.status === FontLoader.Ready ? p3.name : "Noto Sans CJK SC"
    readonly property string barlow: bc.status === FontLoader.Ready ? bc.name : "Noto Sans CJK SC"
    readonly property string body: "Noto Sans CJK SC"

    FontLoader { id: p3; source: Qt.resolvedUrl("fonts/NunitoSans-BlackItalic.ttf") }
    FontLoader { id: bc; source: Qt.resolvedUrl("fonts/BarlowCondensed-Bold.ttf") }
}
