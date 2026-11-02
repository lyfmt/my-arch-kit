import QtQuick
import "Engine.js" as E

// 一块屏幕上的歌词层（原型的 #stage + #lyr）。舞台按 1920×1080 设计，等比缩放到屏幕（同原型 fit()）。
// 歌词层原点 = 主句右缘、底边所贴的点：默认在舞台 (1800, 844)；拖动过就用 fx / fy（屏幕宽高的比例）。
// 整块（主句、翻译、水线、浪）跟着原点一起再乘 zoom。
// 动效全部在 Engine.js；这里只提供 QML 组件、字体、颜色、帧驱动和调整模式的指针 / 键盘处理。
Item {
    id: lay

    // 由 shell.qml 传入
    property var music: null
    property bool wanted: true        // 开关（IPC show / hide）
    property bool idleHidden: false   // 暂停太久 / 没在播
    property bool trans: true
    property bool adjusting: false

    // 摆放：fx / fy < 0 = 默认位置；zoom 0.5–2
    property real fx: -1
    property real fy: -1
    property real zoom: 1
    signal placed()          // 用户改了摆放（拖动 / 滚轮 / 方向键 / 复位）
    signal adjustDone()
    signal transToggle()

    // 引擎写回
    property bool frozen: false
    property bool busy: false
    property bool hasContent: false
    property rect box: Qt.rect(-560, -71, 560, 84)   // 当前句在 #lyr 里的外框（舞台像素）

    readonly property real s: Math.min(width / 1920, height / 1080)
    readonly property real k: s * zoom
    readonly property real ax: fx >= 0 ? fx * width : width / 2 + (1800 - 960) * s
    readonly property real ay: fy >= 0 ? fy * height : height / 2 + (844 - 540) * s
    readonly property string fontP3: Theme.p3Font
    readonly property string fontSC: Theme.sc
    readonly property string fontJP: Theme.jp
    readonly property string fontBarlow: Theme.barlow
    readonly property real baseOp: Theme.baseOp

    onAxChanged: E.place()
    onAyChanged: E.place()
    onKChanged: E.place()
    onWidthChanged: E.place()
    onHeightChanged: E.place()
    onTransChanged: E.setTrans(trans)

    function moveTo(x, y) {
        if (width <= 0 || height <= 0) return;
        fx = Math.max(0, Math.min(1, x / width));
        fy = Math.max(0, Math.min(1, y / height));
    }
    function zoomBy(f) {
        zoom = Math.max(0.5, Math.min(2, Math.round(zoom * f * 1000) / 1000));
        placed();
    }
    function resetPlace() {
        fx = -1;
        fy = -1;
        zoom = 1;
        placed();
    }
    // 当前句在屏幕上的外框 [x, y, w, h]（取整，status 用）
    function screenBox() {
        return [Math.round(ax + box.x * k), Math.round(ay + box.y * k), Math.round(box.width * k), Math.round(box.height * k)];
    }
    // 屏幕坐标是否落在当前句上（外框四周多留 16px）
    function hit(x, y) {
        const p = 16, b = box;
        return x >= ax + b.x * k - p && x <= ax + (b.x + b.width) * k + p
            && y >= ay + b.y * k - p && y <= ay + (b.y + b.height) * k + p;
    }

    Item {
        id: lyr
        x: lay.ax
        y: lay.ay
        width: 0
        height: 0
        scale: lay.k
        transformOrigin: Item.TopLeft
        // 暂停：整层变暗（#lyr.paused）
        opacity: lay.frozen ? 0.42 : 1
        Behavior on opacity {
            NumberAnimation { duration: 320; easing.type: Easing.BezierSpline; easing.bezierCurve: [0.22, 0.9, 0.24, 1, 1, 1] }
        }
    }

    // 调整模式里水线提亮、缓慢呼吸，表示句子可以拖
    property real pulse: 0.4
    SequentialAnimation on pulse {
        running: lay.adjusting
        loops: Animation.Infinite
        NumberAnimation { from: 0.4; to: 0.9; duration: 900; easing.type: Easing.InOutSine }
        NumberAnimation { from: 0.9; to: 0.4; duration: 900; easing.type: Easing.InOutSine }
    }

    Component { id: glyphComp; Glyph {} }
    Component { id: mskComp; Msk {} }
    Component { id: blockComp; Item {} }
    Component { id: trComp; Item {} }
    Component { id: waveComp; Wave { lift: lay.adjusting ? lay.pulse : 0 } }

    // ---------- 调整模式 ----------
    // 面板这时接收整屏指针：按在句子上拖动，其它地方按下 / 右键结束；滚轮在哪儿都缩放
    onAdjustingChanged: {
        grab.dragging = false;
        if (adjusting) {
            keys.forceActiveFocus();
            idleOut.restart();
        } else {
            idleOut.stop();
        }
    }
    function poke() { if (adjusting) idleOut.restart(); }
    Timer {
        id: idleOut
        interval: 8000
        onTriggered: grab.dragging ? restart() : lay.adjustDone()
    }
    MouseArea {
        id: grab
        anchors.fill: parent
        enabled: lay.adjusting
        visible: enabled
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        property bool dragging: false
        property bool over: false
        property real px: 0
        property real py: 0
        property real sx: 0
        property real sy: 0
        cursorShape: dragging ? Qt.ClosedHandCursor : over ? Qt.OpenHandCursor : Qt.ArrowCursor
        onPositionChanged: m => {
            lay.poke();
            if (dragging) lay.moveTo(sx + m.x - px, sy + m.y - py);
            else over = lay.hit(m.x, m.y);
        }
        onPressed: m => {
            lay.poke();
            if (m.button === Qt.RightButton || !lay.hit(m.x, m.y)) {
                lay.adjustDone();
                return;
            }
            dragging = true;
            px = m.x;
            py = m.y;
            sx = lay.ax;
            sy = lay.ay;
        }
        onReleased: {
            if (!dragging) return;
            dragging = false;
            lay.placed();
        }
        onDoubleClicked: m => {
            if (!lay.hit(m.x, m.y)) return;
            dragging = false;
            lay.resetPlace();
        }
        onWheel: w => {
            lay.poke();
            if (w.angleDelta.y !== 0) lay.zoomBy(Math.pow(1.1, w.angleDelta.y / 120));
        }
    }
    Item {
        id: keys
        focus: true
        Keys.onPressed: e => {
            if (!lay.adjusting) return;
            lay.poke();
            const step = (e.modifiers & Qt.ShiftModifier) ? 20 : 2;
            switch (e.key) {
            case Qt.Key_Escape:
            case Qt.Key_Return:
            case Qt.Key_Enter:
                lay.adjustDone();
                break;
            case Qt.Key_T:
                lay.transToggle();
                break;
            case Qt.Key_Left:
                lay.moveTo(lay.ax - step, lay.ay);
                lay.placed();
                break;
            case Qt.Key_Right:
                lay.moveTo(lay.ax + step, lay.ay);
                lay.placed();
                break;
            case Qt.Key_Up:
                lay.moveTo(lay.ax, lay.ay - step);
                lay.placed();
                break;
            case Qt.Key_Down:
                lay.moveTo(lay.ax, lay.ay + step);
                lay.placed();
                break;
            case Qt.Key_Plus:
            case Qt.Key_Equal:
                lay.zoomBy(1.1);
                break;
            case Qt.Key_Minus:
                lay.zoomBy(1 / 1.1);
                break;
            default:
                return;
            }
            e.accepted = true;
        }
    }

    // 有动画时逐帧推进；静止时（停留、暂停、空屏）低频轮询，等下一句的时间戳 / 播放状态变化
    property real lastT: 0
    function step() {
        const t = Date.now();
        const dt = lay.lastT > 0 ? (t - lay.lastT) / 1000 : 0;
        lay.lastT = t;
        E.frame(dt);
    }
    FrameAnimation {
        running: lay.busy && Theme.ready
        onTriggered: lay.step()
    }
    Timer {
        interval: lay.hasContent || lay.adjusting || lay.music.active ? 50 : 250
        repeat: true
        running: !lay.busy && Theme.ready
        onTriggered: lay.step()
    }
    Component.onCompleted: E.setTrans(lay.trans)
}
