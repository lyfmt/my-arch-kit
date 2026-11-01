import QtQuick

// 按住确认（原型 .p-hold）：按住 Enter / 鼠标 holdMs 毫秒（默认 1000）后发 confirmed()；中途松开取消。
// 红色填充从左向右涨满（线性），完成时闪一下。危险动作（注销、重启、关机、结束进程）用它。
//   P3Hold { label: "POWER OFF"; danger: true; onConfirmed: Power.run("poweroff") }
P3Focusable {
    id: root

    property string label: ""
    property string icon: ""
    property bool danger: false
    property int holdMs: 1000
    property real progress: 0
    readonly property bool holding: anim.running
    property bool done: false
    signal confirmed
    readonly property bool p3hold: true
    clickActivates: false

    implicitWidth: 260
    implicitHeight: P3.btnH

    readonly property color labelColor: holding || done ? "#ffffff" : danger ? (focused ? (cursor === "wedge" ? P3.accent : P3.dangerFocus) : P3.danger) : fg

    function start() {
        if (disabled || anim.running)
            return;
        done = false;
        anim.restart();
    }
    function cancel() {
        if (!anim.running)
            return;
        anim.stop();
        back.restart();
    }

    Rectangle {
        anchors.fill: parent
        color: root.focused && root.cursor === "wedge" ? "transparent" : P3.panel
    }
    Rectangle {
        id: fillRect
        width: parent.width * root.progress
        height: parent.height
        color: P3.accent
        opacity: 0.9
    }
    Row {
        anchors.centerIn: parent
        spacing: 12
        P3Glyph {
            visible: root.icon !== ""
            name: root.icon
            color: root.labelColor
            anchors.verticalCenter: parent.verticalCenter
        }
        P3Text {
            kind: "label"
            text: root.label
            color: root.labelColor
            anchors.verticalCenter: parent.verticalCenter
        }
    }

    NumberAnimation {
        id: anim
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
        id: back
        target: root
        property: "progress"
        to: 0
        duration: 300
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

    MouseArea {
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton
        onPressed: {
            root.requestFocus();
            root.start();
        }
        onReleased: root.cancel()
        onCanceled: root.cancel()
    }
}
