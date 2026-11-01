import QtQuick
import qs.Modules.P3

// 进程行（原型 .st-pr）：名称 · PID，右侧 CPU / MEM 两列（未排序的一列用 dim 色）。
// 按住确认：按住 Enter / 鼠标 holdMs 毫秒后发 confirmed()（框架按 p3hold 调 start / cancel），红色从左涨满。
// 行是固定槽位：pid < 0 时隐藏；页面换了 pid 后调 playIn() 播放入场，pid 离开列表时调 playOut()。
P3Focusable {
    id: row

    property int slot: 0
    property int pid: -1
    property var proc: null             // { pid, name, cpu, mem(MB) }；离开列表后为 null，保留最后的读数
    property string sortKey: "cpu"
    property bool still: false
    property bool gone: false

    readonly property bool p3procRow: true
    readonly property bool p3hold: true
    property int holdMs: 900
    property real progress: 0
    readonly property bool holding: holdAnim.running
    property bool done: false
    signal confirmed

    property var shown: ({
            "name": "",
            "cpu": 0,
            "mem": 0
        })
    onProcChanged: if (proc)
        shown = proc

    visible: pid >= 0
    disabled: gone
    opacity: 1
    clickActivates: false
    property real collapse: 1
    implicitWidth: 880
    height: P3.rowH * collapse

    readonly property color txC: holding || done ? "#ffffff" : fg
    readonly property color dimC: holding || done ? "#ffffff" : dimColor

    function memParts(mb) {
        return mb >= 1000 ? [(mb / 1024).toFixed(1), "GB"] : [String(Math.round(mb)), "MB"];
    }

    function start() {
        if (disabled || holdAnim.running)
            return;
        done = false;
        back.stop();
        holdAnim.restart();
    }
    function cancel() {
        if (!holdAnim.running)
            return;
        holdAnim.stop();
        back.restart();
    }
    function reset() {
        holdAnim.stop();
        back.stop();
        doneT.stop();
        outAnim.stop();
        progress = 0;
        done = false;
        gone = false;
        collapse = 1;
    }
    function playIn() {
        reset();
        inAnim.stop();
        if (still) {
            body.opacity = 1;
            body.x = 0;
            return;
        }
        body.opacity = 0;
        body.x = -24;
        inAnim.start();
    }
    function playOut() {
        cancel();
        gone = true;
        if (still)
            return;
        inAnim.stop();
        outAnim.start();
    }

    Item {
        id: body
        width: row.width
        height: P3.rowH

        Rectangle {
            width: parent.width * row.progress
            height: parent.height
            color: P3.accent
            opacity: 0.9
        }
        Rectangle {
            y: parent.height - 1
            width: parent.width
            height: 1
            color: P3.line
        }
        P3Text {
            id: nm
            kind: "label"
            upper: false
            text: row.shown.name
            color: row.txC
            font.pixelSize: 21
            font.letterSpacing: 0.84
            x: 18
            y: 36 - baselineOffset
        }
        P3Text {
            kind: "meta"
            text: String(row.pid)
            color: row.dimC
            font.pixelSize: 14
            font.letterSpacing: 1.12
            x: nm.x + nm.implicitWidth + 18
            y: 32.5 - baselineOffset
        }
        NumUnit {
            readonly property bool on: row.sortKey === "cpu"
            text: (+row.shown.cpu || 0).toFixed(1)
            unit: "%"
            size: 30
            spacing: 0
            unitSize: 13
            color: on ? row.txC : row.dimC
            unitColor: row.dimC
            x: row.width - 18 - 120 - 18 - width
            y: 36.9 - baseY
        }
        NumUnit {
            readonly property bool on: row.sortKey === "mem"
            readonly property var m: row.memParts(+row.shown.mem || 0)
            text: m[0]
            unit: m[1]
            size: 30
            spacing: 0
            unitSize: 13
            color: on ? row.txC : row.dimC
            unitColor: row.dimC
            x: row.width - 18 - width
            y: 36.9 - baseY
        }
    }

    SequentialAnimation {
        id: inAnim
        PauseAnimation {
            duration: row.slot * 30
        }
        ParallelAnimation {
            NumberAnimation {
                target: body
                property: "opacity"
                to: 1
                duration: 360
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: body
                property: "x"
                to: 0
                duration: 360
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
    }
    ParallelAnimation {
        id: outAnim
        NumberAnimation {
            target: body
            property: "opacity"
            to: 0
            duration: 300
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
        NumberAnimation {
            target: body
            property: "x"
            to: 60
            duration: 300
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
        NumberAnimation {
            target: row
            property: "collapse"
            to: 0
            duration: 300
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
    }

    NumberAnimation {
        id: holdAnim
        target: row
        property: "progress"
        from: 0
        to: 1
        duration: row.holdMs
        onFinished: if (row.progress >= 1) {
            row.done = true;
            doneT.restart();
            row.confirmed();
        }
    }
    NumberAnimation {
        id: back
        target: row
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
            row.done = false;
            row.progress = 0;
        }
    }

    MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton
        enabled: !row.disabled
        onPressed: {
            row.requestFocus();
            row.start();
        }
        onReleased: row.cancel()
        onCanceled: row.cancel()
    }
}
