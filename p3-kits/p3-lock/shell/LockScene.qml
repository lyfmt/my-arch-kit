import QtQuick
import QtQuick.Shapes
import Quickshell

// 单块屏幕的锁屏画面，对应原型 lock.js + lock.css。
// 1920×1080 舞台按 cover 缩放，比 16:9 窄的屏靠右对齐（只裁左侧背景）。
// interactive: false 用于解锁 overlay：只画同一帧画面，不接键盘鼠标，不画密码颗粒
FocusScope {
    id: root

    required property var session
    property bool interactive: true

    readonly property var s: session
    readonly property real now: uw.now
    readonly property real up: uw.up
    readonly property bool idle: !s.awake
    readonly property int maxv: Math.floor((820 - 40) / 32)

    // 解锁：UI 上浮淡出（opacity .5s ease，位移 .9s ease-in-out，时钟晚 50ms），按墙钟计算，overlay 同帧
    function upOp(delay) {
        return up < 0 ? 1 : 1 - Theme.bez(Theme.eEase, (up - delay) / 500);
    }
    function upY(delay) {
        return up < 0 ? 0 : -80 * Theme.bez(Theme.eIo, (up - delay) / 900);
    }

    // ───────────── 密码颗粒 / 波纹（每块屏幕各自一份，跟随 session 信号） ─────────────
    ListModel {
        id: dots
    }
    ListModel {
        id: ripples
    }
    Connections {
        target: root.interactive ? root.s : null
        function onTyped(n) {
            dots.append({ n: n, born: Date.now(), outAt: 0 });
            ripples.append({ rx: 12 + (Math.min(n, root.maxv) - 1) * 32, born: Date.now() });
        }
        function onBackspaced() {
            for (let i = dots.count - 1; i >= 0; i--) {
                if (dots.get(i).outAt === 0) {
                    dots.setProperty(i, "outAt", Date.now());
                    break;
                }
            }
        }
        function onCleared(animated) {
            if (!animated) {
                dots.clear();
                return;
            }
            const t = Date.now();
            for (let i = 0; i < dots.count; i++)
                if (dots.get(i).outAt === 0)
                    dots.setProperty(i, "outAt", t);
        }
    }
    Timer {
        running: dots.count > 0 || ripples.count > 0
        interval: 100
        repeat: true
        onTriggered: {
            const t = Date.now();
            for (let i = dots.count - 1; i >= 0; i--) {
                const o = dots.get(i).outAt;
                if (o > 0 && t - o > 480)
                    dots.remove(i);
            }
            for (let i = ripples.count - 1; i >= 0; i--)
                if (t - ripples.get(i).born > 620)
                    ripples.remove(i);
        }
    }
    readonly property int live: Array.from(s.password).length

    // ───────────── 键盘 ─────────────
    Keys.onPressed: event => {
        if (!root.interactive)
            return;
        event.accepted = true;
        if (root.s.unlocking)
            return;
        const wasIdle = root.idle;
        const ctrl = event.modifiers & Qt.ControlModifier;
        const alt = event.modifiers & (Qt.AltModifier | Qt.MetaModifier);
        root.s.pointer = false;
        root.s.wake();
        const k = event.key;
        if (root.s.pmode) {
            if (k === Qt.Key_Up || k === Qt.Key_Backtab)
                root.s.powerMove(-1);
            else if (k === Qt.Key_Down || k === Qt.Key_Tab)
                root.s.powerMove(1);
            else if (k === Qt.Key_Return || k === Qt.Key_Enter || k === Qt.Key_Space)
                root.s.powerFire();
            else if (k === Qt.Key_Escape)
                root.s.closePower();
            return;
        }
        if (k === Qt.Key_Tab || k === Qt.Key_Backtab)
            root.s.openPower();
        else if (k === Qt.Key_Return || k === Qt.Key_Enter)
            root.s.submit();
        else if (k === Qt.Key_Backspace && !ctrl)
            root.s.back();
        else if (k === Qt.Key_Escape && !root.s.password.length && !wasIdle)
            root.s.goIdle();
        else if (k === Qt.Key_Escape || (ctrl && (k === Qt.Key_U || k === Qt.Key_Backspace)))
            root.s.clear();
        else if (!ctrl && !alt && event.text.length > 0 && event.text.charCodeAt(0) >= 32 && event.text.charCodeAt(0) !== 127)
            // 唤醒用的第一个键也算输入（与 p5lock 一致）
            root.s.type(event.text);
        else
            event.accepted = false;
    }

    // ───────────── 鼠标：视差 + 明显移动才唤醒 + 点空白处关电源菜单 ─────────────
    property real mx: -1
    property real my: -1
    HoverHandler {
        enabled: root.interactive
        onPointChanged: {
            const p = point.position;
            if (root.width <= 0 || root.s.unlocking)
                return;
            root.s.point(p.x / root.width - 0.5, p.y / root.height - 0.5);
            if (root.mx < 0) {
                root.mx = p.x;
                root.my = p.y;
                return;
            }
            if (Math.abs(p.x - root.mx) + Math.abs(p.y - root.my) > 24) {
                root.mx = p.x;
                root.my = p.y;
                root.s.pointer = true;
                root.s.wake();
            }
        }
    }
    MouseArea {
        anchors.fill: parent
        enabled: root.interactive
        onPressed: {
            if (root.s.unlocking)
                return;
            root.s.wake();
            if (root.s.pmode)
                root.s.closePower();
        }
    }

    // ───────────── 舞台 ─────────────
    readonly property real k: Math.max(width / 1920, height / 1080)
    readonly property real over: Math.max(0, 1920 * k - width)

    Underwater {
        id: uw
        session: root.s
        transformOrigin: Item.TopLeft
        scale: root.k
        x: root.width / 2 - 960 * root.k - root.over / 2
        y: root.height / 2 - 540 * root.k

        // 日期：数字用展示字，星期用标签；基线 322 + .759×58
        Item {
            id: when
            x: 1010
            property real idleY: root.idle ? 70 : 0
            Behavior on idleY { NumberAnimation { duration: 900; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
            y: idleY + root.upY(0)
            opacity: root.upOp(0)

            Text {
                id: md
                y: 322 + 0.759 * 58 - baselineOffset
                text: Qt.formatDateTime(clock.date, "MM/dd")
                color: Theme.tx
                font.family: Theme.display
                font.pixelSize: 58
                font.weight: Font.Black
                font.italic: true
                font.letterSpacing: -0.58
            }
            Text {
                x: md.implicitWidth + 18
                y: 322 + 0.759 * 58 - baselineOffset
                text: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][clock.date.getDay()]
                color: Theme.fill
                font.family: Theme.label
                font.pixelSize: 22
                font.letterSpacing: 22 * 0.14
            }
        }

        // 时钟：312px，时 = 白，冒号与分 = 浅蓝；分钟变化时只有变化的那一位从上方落入
        Item {
            id: clockItem
            x: 1010 - 22
            property real idleY: root.idle ? 70 : 0
            Behavior on idleY { NumberAnimation { duration: 900; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
            y: idleY + root.upY(50)
            opacity: root.upOp(50)

            readonly property string hh: Qt.formatDateTime(clock.date, "hh")
            readonly property string mm: Qt.formatDateTime(clock.date, "mm")
            readonly property real base: 384 + 0.759 * 312

            Row {
                Repeater {
                    model: 2
                    Digit {
                        required property int index
                        ch: clockItem.hh.charAt(index)
                        color: Theme.tx
                        baseY: clockItem.base
                        now: root.now
                    }
                }
                Item {
                    width: colon.implicitWidth + 312 * 0.05
                    height: 1
                    Text {
                        id: colon
                        x: 312 * 0.04
                        y: clockItem.base - 312 * 0.06 - baselineOffset
                        text: ":"
                        color: Theme.fill
                        font.family: Theme.display
                        font.pixelSize: 312
                        font.weight: Font.Black
                        font.italic: true
                        font.letterSpacing: -312 * 0.035
                    }
                }
                Repeater {
                    model: 2
                    Digit {
                        required property int index
                        ch: clockItem.mm.charAt(index)
                        color: Theme.fill
                        baseY: clockItem.base
                        now: root.now
                    }
                }
            }
        }

        // 待机提示：呼吸
        Text {
            x: 1010
            property real awakeOp: root.idle ? 1 : 0
            property real awakeY: root.idle ? 0 : -14
            Behavior on awakeOp { NumberAnimation { duration: 500; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eEase } }
            Behavior on awakeY { NumberAnimation { duration: 900; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
            readonly property real breathe: {
                const k = ((root.now - root.s.epoch) % 3600) / 3600;
                return 1 - 0.65 * Theme.bez(Theme.eIo, k < 0.5 ? k * 2 : 2 - k * 2);
            }
            y: 772 + 0.9 * 16 - baselineOffset + awakeY
            opacity: awakeOp * (root.idle ? breathe : 1)
            visible: opacity > 0.001
            text: "PRESS ANY KEY"
            color: Theme.faint
            font.family: Theme.label
            font.pixelSize: 16
            font.letterSpacing: 16 * 0.32
        }

        // ───────────── 密码块：left 1010 top 726 宽 820 ─────────────
        Item {
            id: pass
            x: 1010
            width: 820
            height: 160
            readonly property real tgtOp: root.idle || root.s.pmode ? 0 : 1
            readonly property real tgtY: root.idle ? 40 : root.s.pmode ? 30 : 0
            property real bOp: tgtOp
            property real bY: tgtY
            Behavior on bOp { NumberAnimation { duration: root.s.pmode ? 300 : 450; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
            Behavior on bY { NumberAnimation { duration: root.s.pmode ? 500 : 700; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
            y: 726 + bY + root.upY(0)
            opacity: bOp * root.upOp(0)
            visible: opacity > 0.001

            // 入场：用户名（.08s）、线、底注（.22s）依次从右侧滑入
            component Enter: Item {
                id: en
                property int delay: 0
                Delayed {
                    id: dl
                    source: !root.idle
                    delay: en.delay
                }
                property real eOp: dl.value ? 1 : 0
                property real eX: dl.value ? 0 : 40
                Behavior on eOp { NumberAnimation { duration: 500; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
                Behavior on eX { NumberAnimation { duration: 700; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
                opacity: eOp
                transform: Translate { x: en.eX }
            }

            Enter {
                id: who
                delay: 80
                width: 820
                height: 44

                Text {
                    id: userText
                    y: 0.759 * 44 - baselineOffset
                    text: root.s.user
                    color: Theme.tx
                    font.family: Theme.display
                    font.pixelSize: 44
                    font.weight: Font.Black
                    font.italic: true
                    font.letterSpacing: -0.44
                }
                Text {
                    x: userText.implicitWidth + 14
                    y: 0.759 * 44 - baselineOffset
                    text: "@ " + root.s.host
                    color: Theme.dim
                    font.family: Theme.label
                    font.pixelSize: 18
                    font.letterSpacing: 18 * 0.14
                    font.capitalization: Font.AllUppercase
                }
                Text {
                    id: capsText
                    property real cOp: root.s.caps ? 1 : 0
                    property real cY: root.s.caps ? 0 : 8
                    Behavior on cOp { NumberAnimation { duration: 160; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eEase } }
                    Behavior on cY { NumberAnimation { duration: 320; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eSnap } }
                    // margin-left: auto；行尾的字距也算在宽度里
                    x: 820 - implicitWidth
                    y: 0.759 * 44 - baselineOffset + cY
                    opacity: cOp
                    text: "CAPS LOCK"
                    color: Theme.fill
                    font.family: Theme.label
                    font.pixelSize: 18
                    font.letterSpacing: 18 * 0.14
                }
            }

            // 水位线：top 58，高 56
            Enter {
                id: line
                y: 58
                width: 820
                height: 56
                readonly property bool busy: root.s.busy
                readonly property bool err: root.s.denied

                // 2px 线：入场从左向右画出（延迟 .1s，.9s）
                Rectangle {
                    id: waterline
                    y: 54
                    width: 820
                    height: 2
                    property real sx: root.idle ? 0 : 1
                    Behavior on sx {
                        SequentialAnimation {
                            PauseAnimation { duration: 100 }
                            NumberAnimation { duration: 900; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut }
                        }
                    }
                    color: line.err ? Theme.red : Theme.line
                    Behavior on color { ColorAnimation { duration: 160 } }
                    transform: Scale { xScale: Math.max(0.0001, waterline.sx) }
                }

                // 颗粒（overflow hidden）
                Item {
                    id: dotsBox
                    width: 820
                    height: 56
                    clip: true

                    Item {
                        id: row
                        x: 4 + shift + root.shake
                        y: 56 - 12 - 16
                        property real shift: -Math.max(0, root.live - root.maxv) * 32
                        Behavior on shift { NumberAnimation { duration: 320; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }

                        Repeater {
                            model: dots
                            delegate: Rectangle {
                                id: dot
                                required property int index
                                required property int n
                                required property real born
                                required property real outAt

                                readonly property real t: root.now
                                // 叠加各段动画：落下 / 验证时起伏 / 失败下沉 / 删除上浮
                                readonly property var st: {
                                    let y = 0, sc = 1, op = 1;
                                    if (outAt > 0) {
                                        const e = Theme.bez(Theme.eOut, (t - outAt) / 500);
                                        return { y: -46 * e, sc: 1 - 0.5 * e, op: 1 - e };
                                    }
                                    if (root.s.denied && root.s.sinkAt > 0) {
                                        const e = Theme.bez(Theme.eIo, (t - root.s.sinkAt - n * 25) / 550);
                                        return { y: 40 * e, sc: 1, op: 1 - e };
                                    }
                                    if (root.s.busy) {
                                        const k = t - root.s.busySince - n * 60;
                                        if (k > 0) {
                                            const e = Theme.alt(Theme.eIo, k / 1000, 0.9);
                                            return { y: -6 * e, sc: 1, op: 1 - 0.7 * e };
                                        }
                                    }
                                    const d = (t - born) / 420;
                                    if (d < 1) {
                                        const e = Theme.bez(Theme.eSnap, d);
                                        y = -34 * (1 - e);
                                        sc = 0.3 + 0.7 * e;
                                        op = d < 0.6 ? Math.min(1, Math.max(0, Theme.bez(Theme.eSnap, d / 0.6))) : 1;
                                    }
                                    return { y: y, sc: sc, op: op };
                                }
                                x: index * 32
                                y: st.y
                                width: 16
                                height: 16
                                radius: 8
                                scale: st.sc
                                opacity: st.op
                                color: root.s.denied ? Theme.red : Theme.tx
                                Behavior on color { ColorAnimation { duration: 160 } }
                            }
                        }
                    }
                }

                // 波纹：每落下一粒，线上荡开一道
                Repeater {
                    model: ripples
                    delegate: Rectangle {
                        required property real rx
                        required property real born
                        readonly property real e: Theme.bez(Theme.eOut, (root.now - born) / 600)
                        x: rx - 80
                        y: 56 + 1 - 4
                        width: 160
                        height: 4
                        color: Theme.fill
                        opacity: 1 - e
                        transform: Scale { origin.x: 80; xScale: 0.05 + 0.95 * e }
                    }
                }

                // 光标：竖条，1.1s 闪烁
                Rectangle {
                    x: 4 + cx
                    y: 56 - 8 - 26
                    width: 4
                    height: 26
                    color: Theme.fill
                    property real cx: Math.min(root.live, root.maxv) * 32
                    Behavior on cx { NumberAnimation { duration: 320; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eSnap } }
                    visible: !root.idle && !line.busy && !line.err && ((root.now - root.s.epoch) % 1100) < 550
                }

                // 验证：亮段沿线往返
                Rectangle {
                    visible: line.busy
                    x: 640 * Theme.alt(Theme.eIo, (root.now - root.s.busySince) / 1000, 0.9)
                    y: 54
                    width: 180
                    height: 2
                    color: Theme.fill
                }
            }

            // 底注：状态行 + 电源图标（只在用鼠标时浮现）
            Enter {
                id: foot
                delay: 220
                y: 58 + 56 + 18
                width: 820
                height: 20

                StatusLine {
                    text: root.s.statusText
                    red: root.s.statusRed
                }

                Item {
                    id: pwr
                    width: 26
                    height: 26
                    x: 820 - 26
                    readonly property bool on: root.s.pointer && !root.idle && root.interactive
                    property real pOp: on ? 1 : 0
                    property real pY: on ? 0 : 6
                    Behavior on pOp { NumberAnimation { duration: 160; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eEase } }
                    Behavior on pY { NumberAnimation { duration: 320; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
                    y: -3 + pY
                    opacity: pOp
                    visible: pOp > 0.001

                    Shape {
                        anchors.fill: parent
                        preferredRendererType: Shape.CurveRenderer
                        transform: Scale { xScale: 26 / 24; yScale: 26 / 24 }
                        ShapePath {
                            fillColor: "transparent"
                            strokeColor: pwrMouse.containsMouse ? Theme.fill : Theme.dim
                            strokeWidth: 2.4
                            capStyle: ShapePath.RoundCap
                            PathSvg { path: "M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" }
                        }
                    }
                    MouseArea {
                        id: pwrMouse
                        anchors.fill: parent
                        enabled: pwr.on
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            root.s.wake();
                            root.s.openPower();
                        }
                    }
                }
            }
        }

        PowerMenu {
            session: root.s
            now: root.now
            interactive: root.interactive
            opacity: root.upOp(0)
            visible: opacity > 0.001
            transform: Translate { y: root.upY(0) }
        }
    }

    // 失败抖动：15% -18 / 35% 14 / 55% -8 / 75% 4，每段 ease-out，共 420ms
    readonly property real shake: {
        if (!s.denied || s.failAt <= 0)
            return 0;
        const k = (now - s.failAt) / 420;
        if (k <= 0 || k >= 1)
            return 0;
        const kf = [[0, 0], [0.15, -18], [0.35, 14], [0.55, -8], [0.75, 4], [1, 0]];
        for (let i = 1; i < kf.length; i++) {
            if (k <= kf[i][0]) {
                const a = kf[i - 1], b = kf[i];
                return a[1] + (b[1] - a[1]) * Theme.bez(Theme.eOut, (k - a[0]) / (b[0] - a[0]));
            }
        }
        return 0;
    }

    SystemClock {
        id: sysClock
        precision: SystemClock.Minutes
    }
    // demo 调试：把时钟往后拨一分钟，看分钟落字
    property int debugMinutes: 0
    function debugTick() {
        debugMinutes++;
    }
    QtObject {
        id: clock
        readonly property date date: new Date(sysClock.date.getTime() + root.debugMinutes * 60000)
    }
}
