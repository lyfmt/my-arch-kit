import QtQuick
import qs.Modules.P3

// 按住确认的左对齐按钮（原型 .p-btn.p-hold.sy-hold）：56px 高 panel 块，图标 + 标签靠左。
// 按住 Enter / 鼠标 holdMs 后发 confirmed()；红色填充从左向右涨满，中途松开回弹。
SyFocus {
    id: root

    property string label: ""
    property string icon: ""
    property int holdMs: 1000
    property real progress: 0
    property bool done: false
    readonly property bool holding: anim.running
    readonly property bool p3hold: true
    readonly property color labelColor: holding || done ? "#ffffff" : fg
    signal confirmed

    line: false
    clickActivates: false

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
        color: P3.panel
    }
    Rectangle {
        width: parent.width * root.progress
        height: parent.height
        color: P3.accent
        opacity: 0.9
    }
    Row {
        x: 22
        anchors.verticalCenter: parent.verticalCenter
        spacing: 12
        Item {
            visible: root.icon !== ""
            anchors.verticalCenter: parent.verticalCenter
            width: 24
            height: 24
            P3Glyph {
                anchors.centerIn: parent
                name: root.icon || "x"
                size: 20
                color: root.labelColor
            }
        }
        P3Text {
            anchors.verticalCenter: parent.verticalCenter
            kind: "label"
            text: root.label
            color: root.labelColor
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
    MouseArea {
        anchors.fill: parent
        enabled: !root.disabled
        onPressed: {
            root.requestFocus();
            root.start();
        }
        onReleased: root.cancel()
        onCanceled: root.cancel()
    }
}
