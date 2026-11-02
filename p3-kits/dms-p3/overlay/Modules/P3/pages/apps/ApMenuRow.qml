import QtQuick
import qs.Modules.P3

// 托盘菜单的一行（原型 .ap-mh / .ap-mi）。kind：
//   h       分组标题（不可聚焦）
//   radio   单选：左侧对勾标出当前值
//   toggle  开关：右侧 P3Switch（缩到 .82）
//   node    右侧显示当前值，Enter 切到下一个
//   act     普通条目：左侧 ↗；可勾选的条目勾选时换成对勾
//   quit    按住 Enter / 鼠标 holdMs 后发 confirmed()：红字，红色填充从左涨满
// live = false 时是预览：整行 .38、不可聚焦；变成 live 时按 j × 26ms 错开从左滑入。
P3Focusable {
    id: root

    property string kind: "act"
    property string label: ""
    property string value: ""
    property bool on: false
    property bool checkable: false
    property bool live: false
    property bool locked: false
    property int j: 0
    property bool still: false
    property int holdMs: 700

    readonly property bool isMenuRow: kind !== "h"
    readonly property bool p3hold: kind === "quit"
    property real progress: 0
    readonly property bool holding: holdAnim.running
    property bool done: false
    signal confirmed

    property real shown: 0.38
    property real dx: 0

    disabled: kind === "h" || !live || locked
    clickActivates: kind !== "quit"
    width: 400
    height: kind === "h" ? 34 : 46
    opacity: shown * (live && locked ? 0.4 : 1)

    readonly property color labelColor: kind !== "quit" ? fg : holding || done ? "#ffffff" : focused ? P3.dangerFocus : P3.danger

    function start() {
        if (disabled || holdAnim.running)
            return;
        done = false;
        backAnim.stop();
        holdAnim.restart();
    }
    function cancel() {
        if (!holdAnim.running)
            return;
        holdAnim.stop();
        backAnim.restart();
    }

    Rectangle {
        visible: root.kind === "quit"
        width: parent.width * root.progress
        height: parent.height
        color: P3.accent
        opacity: 0.9
    }

    Item {
        id: content
        x: root.dx
        width: root.width
        height: root.height

        P3Text {
            visible: root.kind === "h"
            x: 36
            anchors.baseline: parent.top
            anchors.baselineOffset: 27
            kind: "zh"
            font.pixelSize: 14
            font.letterSpacing: 14 * 0.14
            text: root.label
            color: P3.dim
        }

        Item {
            id: ck
            visible: root.kind !== "h"
            width: 22
            height: parent.height
            P3Glyph {
                anchors.centerIn: parent
                readonly property bool checkGlyph: root.kind === "radio" || (root.kind === "act" && root.checkable)
                name: checkGlyph ? "check" : root.kind === "quit" ? "x" : "ext"
                size: checkGlyph ? 18 : 16
                color: root.kind === "act" && !root.checkable ? root.dimColor : root.labelColor
                scale: !checkGlyph || root.on ? 1 : 0
                visible: root.kind !== "toggle" && root.kind !== "node"
                Behavior on scale {
                    enabled: !root.still
                    NumberAnimation {
                        duration: 300
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.spring
                    }
                }
            }
        }

        P3Text {
            visible: root.kind !== "h"
            x: 36
            anchors.verticalCenter: parent.verticalCenter
            width: Math.min(implicitWidth, 400 - 36 - 6 - (root.kind === "toggle" ? 54 : root.kind === "node" ? valueText.implicitWidth + 16 : 0))
            elide: Text.ElideRight
            kind: "zh"
            font.weight: Font.Bold
            text: root.label
            color: root.labelColor
        }

        P3Switch {
            visible: root.kind === "toggle"
            anchors.right: parent.right
            anchors.rightMargin: 6
            anchors.verticalCenter: parent.verticalCenter
            transformOrigin: Item.Right
            scale: 0.82
            on: root.on
            host: root
        }

        P3Text {
            id: valueText
            visible: root.kind === "node"
            anchors.right: parent.right
            anchors.rightMargin: 6
            anchors.verticalCenter: parent.verticalCenter
            kind: "value"
            text: root.value
            color: root.fg
        }
    }

    MouseArea {
        anchors.fill: parent
        enabled: root.kind === "quit" && !root.disabled
        acceptedButtons: Qt.LeftButton
        onPressed: {
            root.requestFocus();
            root.start();
        }
        onReleased: root.cancel()
        onCanceled: root.cancel()
    }

    NumberAnimation {
        id: holdAnim
        target: root
        property: "progress"
        from: 0
        to: 1
        duration: root.holdMs
        onFinished: if (root.progress >= 1) {
            root.done = true;
            root.confirmed();
            doneT.restart();
        }
    }
    NumberAnimation {
        id: backAnim
        target: root
        property: "progress"
        to: 0
        duration: 300
        easing.type: Easing.BezierSpline
        easing.bezierCurve: P3.spring
    }
    Timer {
        id: doneT
        interval: 900
        onTriggered: {
            root.done = false;
            root.progress = 0;
        }
    }

    SequentialAnimation {
        id: inAnim
        PauseAnimation {
            duration: root.j * 26
        }
        ParallelAnimation {
            NumberAnimation {
                target: root
                property: "shown"
                to: 1
                duration: 340
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: root
                property: "dx"
                to: 0
                duration: 340
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
    }
    NumberAnimation {
        id: outAnim
        target: root
        property: "shown"
        to: 0.38
        duration: 250
        easing.type: Easing.BezierSpline
        easing.bezierCurve: P3.ease
    }

    function playIn() {
        outAnim.stop();
        if (still) {
            inAnim.stop();
            shown = 1;
            dx = 0;
            return;
        }
        shown = 0.38;
        dx = -14;
        inAnim.restart();
    }
    onLiveChanged: {
        if (live) {
            playIn();
        } else {
            inAnim.stop();
            dx = 0;
            if (still)
                shown = 0.38;
            else
                outAnim.restart();
        }
    }
    Component.onCompleted: if (live)
        playIn()
}
