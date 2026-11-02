import QtQuick
import qs.Modules.P3

// 滑块（.p-slider，SYSTEM 页版本）：上行 [图标] 标签 [色块] …… 数值，下行 8px 轨道 + 6×20 把手。
// value 绑定后端；←→ / 拖动 / 滚轮按 step 改值，先显示本地值，action(v) 失败时退回后端值（不弹提示，同原型 quiet）。
//   big     数值 64px（主音量、亮度）
//   dimmed  轨道填充和数值降到 .35（静音时）
//   swatch  标签后的色块（色温）
//   locked  只读（需要 root 的设置）：数值前加锁形图标，不可聚焦；text 可替换数值文字
SyFocus {
    id: root

    property string label: ""
    property string icon: ""
    property string img: ""
    property bool big: false
    property bool dimmed: false
    property color swatch: "transparent"
    property bool hasSwatch: false
    property real from: 0
    property real to: 100
    property real step: 5
    property real value: 0
    property var action: null
    property bool locked: false
    property string text: ""

    readonly property bool syLR: true
    property bool dragging: false
    property bool _hold: false
    property real _local: 0
    readonly property real shown: _hold || dragging ? _local : value
    readonly property real ratio: to > from ? Math.max(0, Math.min(1, (shown - from) / (to - from))) : 0
    readonly property real numSize: big ? 64 : 40
    // 数值行高（CSS line-height .86）与它的底边
    readonly property real rowBottom: 12 + numSize * 0.86

    line: false
    clickActivates: false
    disabled: locked
    implicitHeight: rowBottom + 12 + 8 + 16

    function setValue(v) {
        v = Math.max(from, Math.min(to, Math.round(v / step) * step));
        if (v === shown)
            return;
        _local = v;
        _hold = true;
        holdT.restart();
        if (!action)
            return;
        const p = action(v);
        if (p && typeof p.then === "function")
            p.then(null, () => {
                holdT.stop();
                root._hold = false;
            });
    }
    Timer {
        id: holdT
        interval: 900
        onTriggered: if (!root.dragging)
            root._hold = false
    }

    keyHandler: e => {
        if (e.key === Qt.Key_Left || e.key === Qt.Key_A) {
            setValue(shown - step);
            return true;
        }
        if (e.key === Qt.Key_Right || e.key === Qt.Key_D) {
            setValue(shown + step);
            return true;
        }
        return false;
    }

    // 标签：图标 / 图片 + 文字 + 色块，整体底边对齐数值行，内部竖直居中
    Row {
        id: labelRow
        x: 18
        spacing: 12
        readonly property real boxH: Math.max(17, root.img !== "" ? 22 : root.icon !== "" ? 20 : 0, root.hasSwatch ? 22 : 0)
        y: root.rowBottom - boxH / 2 - height / 2
        SyLead {
            anchors.verticalCenter: parent.verticalCenter
            icon: root.icon
            img: root.img
            size: root.img !== "" ? 22 : 20
            glyphSize: 20
            color: root.fg
        }
        P3Text {
            anchors.verticalCenter: parent.verticalCenter
            kind: "label"
            text: root.label
            color: root.fg
            width: Math.min(implicitWidth, root.width - 36 - 12 - 28 - 140)
            elide: Text.ElideRight
        }
        Item {
            visible: root.hasSwatch
            anchors.verticalCenter: parent.verticalCenter
            width: 22
            height: 22
            Rectangle {
                anchors.fill: parent
                color: "transparent"
                border.width: 2
                border.color: root.trackColor
            }
            Rectangle {
                x: 4
                y: 4
                width: 14
                height: 14
                color: root.swatch
                Behavior on color {
                    ColorAnimation {
                        duration: 200
                    }
                }
            }
        }
    }
    P3Glyph {
        visible: root.locked
        anchors.right: num.left
        anchors.rightMargin: 10
        y: root.rowBottom - root.numSize * 0.43 - 8
        name: "lock"
        size: 16
        color: root.dimColor
    }
    P3Text {
        id: num
        anchors.right: parent.right
        anchors.rightMargin: 18
        anchors.baseline: parent.top
        anchors.baselineOffset: root.rowBottom - root.numSize * 0.1
        kind: "numSm"
        font.pixelSize: root.numSize
        font.letterSpacing: -0.01 * root.numSize
        text: root.text !== "" ? root.text : String(Math.round(root.shown))
        color: root.fg
        opacity: root.dimmed ? 0.35 : 1
    }
    Item {
        id: track
        x: 18
        y: root.rowBottom + 12
        width: parent.width - 36
        height: 8
        Rectangle {
            anchors.fill: parent
            color: root.trackColor
        }
        Rectangle {
            height: parent.height
            width: parent.width * root.ratio
            color: root.onColor
            opacity: root.dimmed ? 0.35 : 1
            Behavior on width {
                enabled: !root.dragging
                NumberAnimation {
                    duration: 140
                    easing.type: Easing.BezierSpline
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
            enabled: !root.disabled
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
            onReleased: {
                root.dragging = false;
                holdT.restart();
            }
            onCanceled: {
                root.dragging = false;
                holdT.restart();
            }
        }
    }
    WheelHandler {
        enabled: !root.disabled
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
            root.setValue(root.shown + n * root.step);
        }
    }
}
