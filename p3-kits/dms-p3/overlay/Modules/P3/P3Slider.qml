import QtQuick

// 滑块（原型 .p-slider）：←→ 按 step 调、拖动、滚轮；值变化发 moved(value)。
//   P3Slider { label: "VOLUME"; from: 0; to: 100; step: 5; value: Audio.state.vol; onMoved: v => Audio.setVolume(v) }
// 布局：上行 label + 右侧数值（P3 Display 40px），下行 8px 轨道，末端 6×20 把手。
P3Focusable {
    id: root

    property string label: ""
    property real from: 0
    property real to: 100
    property real step: 1
    property real value: 0
    property string unit: ""
    property bool showValue: true
    readonly property real ratio: to > from ? Math.max(0, Math.min(1, (value - from) / (to - from))) : 0
    property bool dragging: false
    signal moved(real value)

    implicitWidth: 400
    implicitHeight: 92
    clickActivates: false

    function setValue(v) {
        v = Math.max(from, Math.min(to, Math.round(v / step) * step));
        if (v === value)
            return;
        value = v;
        moved(v);
    }

    keyHandler: e => {
        if (e.key === Qt.Key_Left || e.key === Qt.Key_A) {
            setValue(value - step);
            return true;
        }
        if (e.key === Qt.Key_Right || e.key === Qt.Key_D) {
            setValue(value + step);
            return true;
        }
        return false;
    }

    P3Text {
        x: 18
        y: 12
        kind: "label"
        text: root.label
        color: root.fg
    }
    Row {
        anchors.right: parent.right
        anchors.rightMargin: 18
        y: 12
        spacing: 4
        visible: root.showValue
        P3Text {
            kind: "numSm"
            text: String(Math.round(root.value))
            color: root.fg
            anchors.bottom: parent.bottom
        }
        P3Text {
            visible: root.unit !== ""
            kind: "unit"
            text: root.unit
            color: root.dimColor
            anchors.bottom: parent.bottom
            anchors.bottomMargin: 4
        }
    }
    Item {
        id: track
        x: 18
        width: parent.width - 36
        height: 8
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 16
        Rectangle {
            anchors.fill: parent
            color: root.trackColor
        }
        Rectangle {
            id: bar
            height: parent.height
            width: parent.width * root.ratio
            color: root.onColor
            Behavior on width {
                enabled: !root.dragging
                NumberAnimation {
                    duration: 140
                    easing.bezierCurve: P3.ease
                }
            }
            Rectangle {
                x: parent.width - 3
                y: -6
                width: 6
                height: 20
                color: root.onColor
            }
        }
        MouseArea {
            anchors.fill: parent
            anchors.topMargin: -12
            anchors.bottomMargin: -12
            preventStealing: true
            onPressed: m => {
                root.requestFocus();
                root.dragging = true;
                root.setValue(root.from + m.x / track.width * (root.to - root.from));
            }
            onPositionChanged: m => {
                if (pressed)
                    root.setValue(root.from + m.x / track.width * (root.to - root.from));
            }
            onReleased: root.dragging = false
            onCanceled: root.dragging = false
        }
    }
    WheelHandler {
        // Wayland 上滚轮事件常被标成 TouchPad 设备；120 = 一格 = 一步
        acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
        property real acc: 0
        onWheel: e => {
            acc += e.angleDelta.y;
            const n = Math.trunc(acc / 120);
            if (!n)
                return;
            acc -= n * 120;
            root.requestFocus();
            root.setValue(root.value + n * root.step);
        }
    }
}
