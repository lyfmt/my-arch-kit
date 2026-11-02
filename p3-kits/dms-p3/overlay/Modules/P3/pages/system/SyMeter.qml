import QtQuick
import qs.Modules.P3
import qs.P3Sys

// 麦克风电平（原型 .sy-meter）：28 根竖条，左右各留 18px。每 110ms 取一次 Audio.micPeak（0…100），
// 最新的在最右侧，往左滚动；超过 88% 的条为红色。
// 静音时整排压成 3px 暗线。active 为真且没静音时才向 Audio 要电平（watchMic / releaseMic）。
Item {
    id: root

    property bool active: false
    property bool muted: false
    readonly property int count: 28
    property var hist: []

    implicitWidth: 400
    implicitHeight: 52

    onMutedChanged: if (muted)
        hist = []

    readonly property bool listening: active && !muted
    property bool held: false
    onListeningChanged: hold(listening)
    Component.onCompleted: hold(listening)
    Component.onDestruction: hold(false)
    function hold(on) {
        if (on === held)
            return;
        held = on;
        if (on)
            Audio.watchMic();
        else
            Audio.releaseMic();
    }
    Timer {
        interval: 110
        repeat: true
        running: root.held
        onTriggered: {
            const a = root.hist.slice(-(root.count - 1));
            a.push(Audio.micPeak);
            root.hist = a;
        }
    }

    Row {
        x: 18
        width: parent.width - 36
        height: parent.height
        spacing: 5
        Repeater {
            model: root.count
            Rectangle {
                required property int index
                readonly property real v: {
                    const k = index - (root.count - root.hist.length);
                    return k >= 0 ? root.hist[k] : 0;
                }
                width: (root.width - 36 - 5 * (root.count - 1)) / root.count
                height: root.muted ? 3 : Math.max(3, root.height * v / 100)
                y: root.height - height
                color: root.muted ? P3.line : v > 88 ? P3.accent : P3.fill
                Behavior on height {
                    NumberAnimation {
                        duration: 90
                    }
                }
            }
        }
    }
}
