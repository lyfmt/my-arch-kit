import QtQuick
import QtQuick.Effects
import QtQuick.Shapes
import Quickshell
import qs.Modules.P3
import qs.P3Sys
import "power/Clip.js" as Clip

// POWER（原型 pages/power.js）：主菜单同款的斜放大字列表，页面自己画焦点（白色楔形 + 红色残影）。
//   LOCK / SLEEP：Enter / 单击直接确认。LOG OUT / REBOOT / SHUT DOWN：按住 Enter 或鼠标 1 秒，
//   进度是逐帧积分的值，中途松开时按阻尼弹簧回到 0（有一次可见的回弹）；满了之后落下全舞台确认幕布。
//   右侧是焦点动作的图标和按住倒计时。RESTART SHELL 是下面的小行（立即执行，正文闪一下）。
//   本机不支持的动作（Power.state.supported）变暗并跳过。
// 执行：幕布落下 900ms 后调 Power.run。锁屏 / 睡眠先关菜单再执行；注销 / 重启 / 关机让幕布留着，
//   6 秒后会话仍在就收起幕布。Power.run 拒绝时幕布立即收起，框架弹红色提示。幕布期间吞掉所有按键。
// 截图模式（P3_STILL=1）下读这几个环境变量，只摆状态、从不执行动作：
//   P3_POWER_SEL=N       焦点放到第 N 项（LOCK SLEEP LOGOUT REBOOT OFF SHELL）
//   P3_POWER_HOLD=0..1   焦点项停在这个按住进度
//   P3_POWER_CONFIRM=1   落下焦点项的确认幕布
P3Page {
    id: page
    title: "POWER"

    readonly property int holdMs: 1000
    // run = Power.run 的动作名，也是 Power.state.supported 的键；x / y / r 是页面坐标和角度（主列表同一套斜线）
    readonly property var acts: [
        {
            "id": "lock",
            "t": "LOCK",
            "g": "lock",
            "c": "c1",
            "run": "lock",
            "cur": "LOCKED",
            "x": 254,
            "y": 84,
            "r": -8
        },
        {
            "id": "sleep",
            "t": "SLEEP",
            "g": "sleep",
            "c": "c4",
            "run": "suspend",
            "cur": "SLEEP",
            "x": 208,
            "y": 184,
            "r": -4
        },
        {
            "id": "logout",
            "t": "LOG OUT",
            "g": "exit",
            "c": "c2",
            "run": "logout",
            "cur": "LOG OUT",
            "hold": true,
            "x": 164,
            "y": 284,
            "r": -7
        },
        {
            "id": "reboot",
            "t": "REBOOT",
            "g": "reboot",
            "c": "c1",
            "run": "reboot",
            "cur": "REBOOT",
            "hold": true,
            "x": 124,
            "y": 384,
            "r": -2
        },
        {
            "id": "off",
            "t": "SHUT DOWN",
            "g": "power",
            "c": "c4",
            "run": "poweroff",
            "cur": "SHUT DOWN",
            "hold": true,
            "x": 80,
            "y": 484,
            "r": 3
        }
    ]
    readonly property var shellAct: ({
            "id": "shell",
            "t": "RESTART SHELL",
            "g": "reboot",
            "run": "restartShell"
        })

    function supported(a) {
        return a.run === "restartShell" || !!Power.state.supported[a.run];
    }

    // ---------------------------------------------------------------- 按住状态
    property var hEl: null            // 正在按住（或回弹中）的项
    property bool holding: false      // 键 / 鼠标仍按着
    property real p: 0                // 进度，回弹时可能略小于 0
    property real v: 0
    property bool busy: false         // 幕布在上面
    property bool committed: false    // 已交给系统执行，离开页面时幕布不收
    readonly property real pc: Math.max(0, Math.min(1, p))
    readonly property bool holdVis: hEl !== null && pc > 0.001
    readonly property bool hot: holding && pc > 0.72
    property var sel: null            // 右侧显示的动作

    property bool fresh: false
    FrameAnimation {
        id: frame
        onTriggered: {
            const dt = page.fresh ? 0 : Math.min(0.05, frameTime);
            page.fresh = false;
            page.step(dt);
        }
    }

    function step(dt) {
        if (holding) {
            if (!ctx || ctx.focused() !== hEl) {
                release();
            } else {
                p = Math.min(1, p + dt * 1000 / holdMs);
                if (p >= 1) {
                    holding = false;
                    frame.stop();
                    confirm(hEl.act, hEl);
                    return;
                }
            }
        }
        if (!holding) {
            // 阻尼弹簧回到 0（ζ≈0.5，一次可见的回弹）
            let pp = p, vv = v;
            for (let s = 0; s < 4; s++) {
                const h = dt / 4;
                vv += (-220 * pp - 15 * vv) * h;
                pp += vv * h;
            }
            p = pp;
            v = vv;
            if (Math.abs(p) < 0.002 && Math.abs(v) < 0.02)
                endHold();
        }
    }
    function startHold(el) {
        if (busy || holding || !el || el.disabled)
            return;
        if (hEl && hEl !== el)
            endHold();
        hEl = el;
        holding = true;
        v = 0;
        if (!ctx || ctx.still)
            return;
        if (!frame.running) {
            fresh = true;
            frame.start();
        }
    }
    function release() {
        if (!holding)
            return;
        holding = false;
        v = -1.5;
        if (p < 0.04) {
            endHold();
            return;
        }
        side.nudge();
        if (!frame.running) {
            fresh = true;
            frame.start();
        }
    }
    function endHold() {
        frame.stop();
        hEl = null;
        holding = false;
        p = 0;
        v = 0;
    }

    // ---------------------------------------------------------------- 确认与执行
    function confirm(a, el) {
        if (!a || busy || !ctx)
            return;
        busy = true;
        if (el)
            el.boom();
        curtain.parent = ctx.overlay;
        curtain.show(a);
        if (ctx.still)
            return;
        runT.act = a;
        runT.restart();
    }
    function lift(ms) {
        if (!curtain.visible || curtain.out)
            return;
        liftT.interval = ms;
        liftT.restart();
    }
    function runAction(name) {
        return Power.run(name);
    }
    function execute(a) {
        const c = ctx;
        if (!c || !c.live)
            return;
        if (a.run === "lock" || a.run === "suspend") {
            if (supported(a)) {
                committed = true;
                P3Menu.close();
            }
            c.run(runAction(a.run), {
                "revert": () => page.lift(0)
            });
            return;
        }
        c.run(runAction(a.run), {
            "revert": () => page.lift(0),
            "done": ok => {
                if (ok)
                    lingerT.restart();
            }
        });
    }
    function activate(el) {
        if (busy || !el || el.disabled)
            return;
        if (el.act.id === "shell") {
            if (ctx && !ctx.still)
                reloadAnim.restart();
            ctx.run(runAction(el.act.run));
            return;
        }
        if (!el.act.hold)
            confirm(el.act, el);
    }

    Timer {
        id: runT
        property var act: null
        interval: 900
        onTriggered: page.execute(act)
    }
    Timer {
        id: lingerT
        interval: 6000
        onTriggered: page.lift(0)
    }
    Timer {
        id: liftT
        onTriggered: {
            curtain.lift();
            page.endHold();
        }
    }

    // ---------------------------------------------------------------- 焦点与按键
    function sync(f) {
        if (!f || !f.act || (sel && f.act.id === sel.id))
            return;
        sel = f.act;
        side.swap();
    }
    onFocusMoved: item => sync(item)

    function handleKey(e) {
        if (busy)
            return true;
        const k = e.key;
        if (k === Qt.Key_Return || k === Qt.Key_Enter || k === Qt.Key_Space) {
            const f = ctx ? ctx.focused() : null;
            if (f && f.act && f.act.hold) {
                if (!e.isAutoRepeat)
                    startHold(f);
                return true;
            }
            return false;
        }
        if (!holding)
            return false;
        switch (k) {
        case Qt.Key_Up:
        case Qt.Key_Down:
        case Qt.Key_Left:
        case Qt.Key_Right:
        case Qt.Key_W:
        case Qt.Key_A:
        case Qt.Key_S:
        case Qt.Key_D:
            return true;
        case Qt.Key_Escape:
        case Qt.Key_Backspace:
            release();
            return true;
        }
        return false;
    }

    // 窗口失去键盘时当作松开
    readonly property bool winActive: Window.active
    onWinActiveChanged: if (!winActive)
        release()

    onEntered: {
        sync(ctx.focused());
        for (let i = 0; i < rep.count; i++)
            rep.itemAt(i).enter();
        if (ctx.still)
            applyStill();
    }
    function applyStill() {
        const order = [];
        for (let i = 0; i < rep.count; i++)
            order.push(rep.itemAt(i));
        order.push(shellRow);
        const n = parseInt(Quickshell.env("P3_POWER_SEL") || "");
        if (n >= 0 && n < order.length && !order[n].disabled)
            ctx.focus(order[n]);
        const f = ctx.focused();
        sync(f);
        const hv = parseFloat(Quickshell.env("P3_POWER_HOLD") || "");
        if (f && f.act.hold && hv > 0) {
            hEl = f;
            p = Math.min(1, hv);
        }
        if (f && f.act.id !== "shell" && Quickshell.env("P3_POWER_CONFIRM") === "1")
            confirm(f.act, f);
    }
    onLeaving: {
        runT.stop();
        lingerT.stop();
        liftT.stop();
        frame.stop();
        if (!committed)
            curtain.hide();
        endHold();
        busy = false;
    }

    // ---------------------------------------------------------------- 正文
    Item {
        id: box
        anchors.fill: parent
        property real reload: 0
        opacity: 1 - 0.75 * reload
        layer.enabled: reload > 0
        layer.effect: MultiEffect {
            blurEnabled: true
            blurMax: 8
            blur: box.reload
        }

        Repeater {
            id: rep
            model: page.acts
            delegate: PowerItem {
                id: it
                required property var modelData
                required property int index
                order: index
                act: modelData
                x: modelData.x
                y: modelData.y
                angle: modelData.r
                tint: P3[modelData.c]
                still: page.ctx ? page.ctx.still : false
                host: page
                disabled: !page.supported(modelData)
                held: page.hEl === it
                p: held ? page.p : 0
                dimTarget: page.holdVis && !held ? page.pc : 0
                shaking: held && page.hot
                onActivated: page.activate(it)
            }
        }

        // RESTART SHELL（.pw-shell）：没有底线，平时 dim，焦点时 fill
        P3Focusable {
            id: shellRow
            readonly property var act: page.shellAct
            x: 60
            y: 618
            width: 330
            height: P3.rowH
            disabled: !page.supported(act)
            readonly property color tone: focused ? P3.fill : P3.dim
            onActivated: page.activate(shellRow)
            Row {
                x: 18
                anchors.verticalCenter: parent.verticalCenter
                spacing: 16
                Item {
                    width: 24
                    height: 24
                    anchors.verticalCenter: parent.verticalCenter
                    P3Glyph {
                        anchors.centerIn: parent
                        name: shellRow.act.g
                        size: 20
                        color: shellRow.tone
                    }
                }
                P3Text {
                    kind: "label"
                    text: shellRow.act.t
                    color: shellRow.tone
                    anchors.verticalCenter: parent.verticalCenter
                }
            }
        }

        PowerSide {
            id: side
            x: 820
            y: 196
            still: page.ctx ? page.ctx.still : false
            holdMs: page.holdMs
            glyph: page.sel ? page.sel.g : "lock"
            meterOn: !!(page.sel && page.sel.hold)
            pc: page.pc
            holding: page.holdVis
            hot: page.hot
        }
    }

    // 重启 shell 时正文闪一下（pwReload：25% 处 opacity .25 + blur 3px，.55s）
    SequentialAnimation {
        id: reloadAnim
        NumberAnimation {
            target: box
            property: "reload"
            to: 1
            duration: 138
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
        NumberAnimation {
            target: box
            property: "reload"
            to: 0
            duration: 412
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
    }

    PowerCurtain {
        id: curtain
        still: page.ctx ? page.ctx.still : false
        onLifted: page.busy = false
    }

    // ================================================================ 本页组件
    // POWER 列表的一项（原型 .pw-it）：84px P3 展示字斜放，和主列表同一套几何。cursor: "none"，焦点由本项自己画：
    //   焦点    白色楔形 + 红色碎片垫底、红色残影 (5,4)、字变 ink，以 (0, 60%) 为原点放大 1.2 并左移 18px
    //   按住    held + p：红色从左向右淹过白色楔形（竖直前沿 + 一道 -14° 斜刃），被淹过的字变白；
    //           放大 1.2 + p×.12，残影拉开到 (5 + 14p, 4 + 7p)；p 是页面的弹簧值，回弹时可能略小于 0
    //   其余项  页面按住时淡出 (1 - .8p) 并左移 56p；shaking 时整项抖动
    //   boom()  确认瞬间白色楔形弹一下，fill 色残像向右飞出
    //   enter() 入场（pwItIn）：从右 150px、旋转 7° 弹入，按 order 错开（每项 50ms）
    // 框架按住接口（与 P3Hold 相同）：p3hold / start() / cancel()，松开 Enter、点别处、离开页面时框架调 cancel()。
    component PowerItem: P3Focusable {
        id: itemRoot

        property var act: ({})
        property int order: 0
        property real angle: 0
        property color tint: P3.c1
        property bool still: false
        property var host: null

        property bool held: false
        property real p: 0
        property real dimTarget: 0
        property bool shaking: false

        readonly property real pc: Math.max(0, Math.min(1, p))
        readonly property bool p3hold: !!act.hold
        readonly property bool lit: focused || held

        function start() {
            if (host)
                host.startHold(itemRoot);
        }
        function cancel() {
            if (host)
                host.release();
        }
        function boom() {
            if (still)
                return;
            hitAnim.restart();
            ghostAnim.restart();
        }
        function enter() {
            if (still) {
                mv.enterT = 1;
                return;
            }
            mv.enterT = 0;
            enterAnim.restart();
        }

        // 文字盒子按 CSS 排：宽 = 字符步进之和（不含斜体出头），高 = line-height .86em，基线在 (盒高 - 字高) / 2 + ascent
        readonly property int fs: 84
        readonly property real boxH: fs * 0.86
        readonly property real textY: (boxH - fm.ascent - fm.descent) / 2 + fm.ascent - label.baselineOffset

        cursor: "none"
        clickActivates: !p3hold
        opacity: disabled ? 0.28 : 1
        z: lit ? 2 : 1
        width: tm.advanceWidth
        height: boxH

        FontMetrics {
            id: fm
            font: label.font
        }
        TextMetrics {
            id: tm
            font: label.font
            text: label.text
        }

        // 别的项按住时直接跟随进度，松开后过渡回去（opacity .3s、位移 .45s soft）
        onDimTargetChanged: {
            if (still || (host && host.holdVis)) {
                fadeBack.stop();
                mv.fade = dimTarget;
                mv.shift = dimTarget;
            } else {
                fadeBack.restart();
            }
        }
        ParallelAnimation {
            id: fadeBack
            NumberAnimation {
                target: mv
                property: "fade"
                to: itemRoot.dimTarget
                duration: 300
            }
            NumberAnimation {
                target: mv
                property: "shift"
                to: itemRoot.dimTarget
                duration: 450
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.soft
            }
        }

        // ---------------------------------------------------------------- 果冻 / 按下（原点 0 60%）
        Item {
            id: wobBox
            width: itemRoot.width
            height: itemRoot.height
            property real sx: 1
            property real sy: 1
            property real dx: 0
            transform: [
                Scale {
                    origin.x: 0
                    origin.y: itemRoot.height * 0.6
                    xScale: wobBox.sx
                    yScale: wobBox.sy
                },
                Translate {
                    x: wobBox.dx
                }
            ]

            // ------------------------------------------------------------ .mv：入场、淡出左移、抖动
            Item {
                id: mv
                width: itemRoot.width
                height: itemRoot.height
                property real enterT: 1
                property real fade: 0
                property real shift: 0
                property real shX: 0
                property real shY: 0
                opacity: Math.max(0, Math.min(1, enterT)) * (1 - fade * 0.8)
                transform: [
                    Rotation {
                        origin.x: mv.width / 2
                        origin.y: mv.height / 2
                        angle: 7 * (1 - mv.enterT)
                    },
                    Translate {
                        x: 150 * (1 - mv.enterT) - 56 * mv.shift + mv.shX
                        y: mv.shY
                    }
                ]

                // -------------------------------------------------------- .rt：斜放 + 焦点放大
                Item {
                    id: rt
                    width: itemRoot.width
                    height: itemRoot.height
                    property real sc: itemRoot.lit ? 1.2 + (itemRoot.held ? itemRoot.p * 0.12 : 0) : 1
                    property real tx: itemRoot.lit ? -18 : 0
                    Behavior on sc {
                        enabled: !itemRoot.held && !itemRoot.still
                        NumberAnimation {
                            duration: 260
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.soft
                        }
                    }
                    Behavior on tx {
                        enabled: !itemRoot.held && !itemRoot.still
                        NumberAnimation {
                            duration: 260
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.soft
                        }
                    }
                    transform: [
                        Scale {
                            origin.x: 0
                            origin.y: rt.height * 0.6
                            xScale: rt.sc
                            yScale: rt.sc
                        },
                        Translate {
                            x: rt.tx
                        },
                        Rotation {
                            origin.x: 0
                            origin.y: rt.height * 0.6
                            angle: itemRoot.angle
                        }
                    ]

                    // 红色碎片 .sr：left -96 right -22 top -40 bottom 6，polygon(0 88%, 100% 0, 88% 34%)
                    Shape {
                        id: sr
                        x: -96
                        y: -40
                        width: itemRoot.width + 118
                        height: itemRoot.height + 34
                        preferredRendererType: Shape.CurveRenderer
                        opacity: itemRoot.focused ? 1 : 0
                        property real k: itemRoot.focused ? 1 : 0.2
                        Behavior on k {
                            enabled: !itemRoot.still
                            SequentialAnimation {
                                PauseAnimation {
                                    duration: 30
                                }
                                NumberAnimation {
                                    duration: 260
                                    easing.type: Easing.BezierSpline
                                    easing.bezierCurve: P3.ease
                                }
                            }
                        }
                        Behavior on opacity {
                            enabled: !itemRoot.still
                            NumberAnimation {
                                duration: 100
                            }
                        }
                        transform: Scale {
                            origin.x: sr.width
                            origin.y: 0
                            xScale: sr.k
                        }
                        ShapePath {
                            fillColor: P3.accent
                            strokeColor: "transparent"
                            startX: 0
                            startY: sr.height * 0.88
                            PathLine {
                                x: sr.width
                                y: 0
                            }
                            PathLine {
                                x: sr.width * 0.88
                                y: sr.height * 0.34
                            }
                            PathLine {
                                x: 0
                                y: sr.height * 0.88
                            }
                        }
                    }

                    // 白色楔形 .sw：left -46 right -54 top -14 bottom -22，polygon(0 66%, 100% 0, 97% 100%, 12% 92%)
                    Shape {
                        id: sw
                        x: -46
                        y: -14
                        width: itemRoot.width + 100
                        height: itemRoot.height + 36
                        preferredRendererType: Shape.CurveRenderer
                        opacity: itemRoot.focused ? 1 : 0
                        property real k: itemRoot.focused ? 1 : 0.2
                        property real hitX: 1
                        property real hitY: 1
                        Behavior on k {
                            enabled: !itemRoot.still
                            NumberAnimation {
                                duration: 220
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: P3.ease
                            }
                        }
                        Behavior on opacity {
                            enabled: !itemRoot.still
                            NumberAnimation {
                                duration: 100
                            }
                        }
                        transform: [
                            Scale {
                                origin.x: sw.width
                                origin.y: sw.height / 2
                                xScale: sw.k * sw.hitX
                                yScale: sw.hitY
                            }
                        ]
                        ShapePath {
                            fillColor: P3.shard
                            strokeColor: "transparent"
                            startX: 0
                            startY: sw.height * 0.66
                            PathLine {
                                x: sw.width
                                y: 0
                            }
                            PathLine {
                                x: sw.width * 0.97
                                y: sw.height
                            }
                            PathLine {
                                x: sw.width * 0.12
                                y: sw.height * 0.92
                            }
                            PathLine {
                                x: 0
                                y: sw.height * 0.66
                            }
                        }
                    }

                    // 红色残影 .echo
                    P3Text {
                        kind: "item"
                        font.pixelSize: itemRoot.fs
                        font.letterSpacing: -itemRoot.fs * 0.01
                        text: itemRoot.act.t || ""
                        color: P3.accent
                        opacity: itemRoot.focused ? 1 : 0
                        x: itemRoot.held ? 5 + itemRoot.p * 14 : itemRoot.focused ? 5 : 0
                        y: itemRoot.textY + (itemRoot.held ? 4 + itemRoot.p * 7 : itemRoot.focused ? 4 : 0)
                        Behavior on opacity {
                            enabled: !itemRoot.still
                            NumberAnimation {
                                duration: 100
                            }
                        }
                        Behavior on x {
                            enabled: !itemRoot.held && !itemRoot.still
                            NumberAnimation {
                                duration: 200
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: P3.ease
                            }
                        }
                        Behavior on y {
                            enabled: !itemRoot.held && !itemRoot.still
                            NumberAnimation {
                                duration: 200
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: P3.ease
                            }
                        }
                    }

                    // 确认时飞出的 fill 色残像 .ghost
                    P3Text {
                        id: ghost
                        kind: "item"
                        font.pixelSize: itemRoot.fs
                        font.letterSpacing: -itemRoot.fs * 0.01
                        text: itemRoot.act.t || ""
                        color: P3.fill
                        y: itemRoot.textY
                        opacity: 0
                        transform: [
                            Scale {
                                id: ghostS
                                origin.x: ghost.width / 2
                                origin.y: ghost.height / 2
                            },
                            Translate {
                                id: ghostT
                            }
                        ]
                    }

                    // 红色淹没 .fl：与白色楔形同形，左边一块实心 + 前沿斜刃（skewX(-14deg)，宽 14、上下各出 20）
                    Item {
                        id: fl
                        x: -46
                        y: -14
                        width: itemRoot.width + 100
                        height: itemRoot.height + 36
                        visible: itemRoot.held
                        readonly property var wedge: [Qt.point(0, height * 0.66), Qt.point(width, 0), Qt.point(width * 0.97, height), Qt.point(width * 0.12, height * 0.92)]
                        readonly property real edge: itemRoot.pc * width
                        readonly property real lean: Math.tan(14 * Math.PI / 180) * (height / 2 + 20)
                        readonly property var body: Clip.convex(Clip.rect(-1, -1, edge + 1, height + 2), wedge)
                        readonly property var blade: Clip.convex([Qt.point(edge - 6 + lean, -20), Qt.point(edge + 8 + lean, -20), Qt.point(edge + 8 - lean, height + 20), Qt.point(edge - 6 - lean, height + 20)], wedge)
                        Shape {
                            anchors.fill: parent
                            preferredRendererType: Shape.CurveRenderer
                            visible: fl.body.length > 2
                            ShapePath {
                                fillColor: P3.accent
                                strokeColor: "transparent"
                                PathPolyline {
                                    path: fl.body.length > 2 ? fl.body : [Qt.point(0, 0), Qt.point(0, 0)]
                                }
                            }
                        }
                        Shape {
                            anchors.fill: parent
                            preferredRendererType: Shape.CurveRenderer
                            visible: fl.blade.length > 2
                            ShapePath {
                                fillColor: P3.accent
                                strokeColor: "transparent"
                                PathPolyline {
                                    path: fl.blade.length > 2 ? fl.blade : [Qt.point(0, 0), Qt.point(0, 0)]
                                }
                            }
                        }
                    }

                    // 字阴影（--ink-shadow：0 4px 0 deep .8, -2px 2px 0 deep .55），只在没有焦点时
                    Item {
                        opacity: itemRoot.focused ? 0 : 1
                        Behavior on opacity {
                            enabled: !itemRoot.still
                            NumberAnimation {
                                duration: 120
                            }
                        }
                        P3Text {
                            kind: "item"
                            font.pixelSize: itemRoot.fs
                            font.letterSpacing: -itemRoot.fs * 0.01
                            text: itemRoot.act.t || ""
                            x: -2
                            y: itemRoot.textY + 2
                            color: P3.alpha(P3.deep, 0.55)
                        }
                        P3Text {
                            kind: "item"
                            font.pixelSize: itemRoot.fs
                            font.letterSpacing: -itemRoot.fs * 0.01
                            text: itemRoot.act.t || ""
                            y: itemRoot.textY + 4
                            color: P3.alpha(P3.deep, 0.8)
                        }
                    }

                    P3Text {
                        id: label
                        kind: "item"
                        font.pixelSize: itemRoot.fs
                        font.letterSpacing: -itemRoot.fs * 0.01
                        text: itemRoot.act.t || ""
                        y: itemRoot.textY
                        color: itemRoot.focused ? P3.ink : itemRoot.tint
                        Behavior on color {
                            enabled: !itemRoot.still
                            ColorAnimation {
                                duration: 120
                            }
                        }
                    }

                    // 被淹过的部分变白 .tw：裁到红色实心块的前沿
                    Item {
                        x: -20
                        y: -20
                        width: Math.max(0, itemRoot.pc * (itemRoot.width + 100) - 46 + 20)
                        height: itemRoot.height + 40
                        clip: true
                        visible: itemRoot.held && width > 20
                        P3Text {
                            kind: "item"
                            font.pixelSize: itemRoot.fs
                            font.letterSpacing: -itemRoot.fs * 0.01
                            text: itemRoot.act.t || ""
                            x: 20
                            y: 20 + itemRoot.textY
                            color: "#ffffff"
                        }
                    }
                }
            }
        }

        // 按住：MouseArea 先于 TapHandler 拿到按下；松开在哪里都算
        MouseArea {
            anchors.fill: parent
            enabled: itemRoot.p3hold && !itemRoot.disabled
            acceptedButtons: Qt.LeftButton
            onPressed: mouse => {
                if (!itemRoot.host || itemRoot.host.busy) {
                    mouse.accepted = false;
                    return;
                }
                itemRoot.requestFocus();
                itemRoot.host.startHold(itemRoot);
            }
            onReleased: itemRoot.cancel()
            onCanceled: itemRoot.cancel()
        }

        // ---------------------------------------------------------------- 动画
        // 入场 pwItIn：.7s spring，延迟 order×50ms + .26s
        SequentialAnimation {
            id: enterAnim
            PauseAnimation {
                duration: 260 + itemRoot.order * 50
            }
            NumberAnimation {
                target: mv
                property: "enterT"
                to: 1
                duration: 700
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.spring
            }
        }

        // 果冻 p-wob（.32s：30% → 1.03/.965 +2px，60% → .99/1.015 -1px）
        onWobChanged: if (wob && !still)
            wobAnim.restart()
        SequentialAnimation {
            id: wobAnim
            ParallelAnimation {
                NumberAnimation {
                    target: wobBox
                    property: "sx"
                    to: 1.03
                    duration: 96
                }
                NumberAnimation {
                    target: wobBox
                    property: "sy"
                    to: 0.965
                    duration: 96
                }
                NumberAnimation {
                    target: wobBox
                    property: "dx"
                    to: 2
                    duration: 96
                }
            }
            ParallelAnimation {
                NumberAnimation {
                    target: wobBox
                    property: "sx"
                    to: 0.99
                    duration: 96
                }
                NumberAnimation {
                    target: wobBox
                    property: "sy"
                    to: 1.015
                    duration: 96
                }
                NumberAnimation {
                    target: wobBox
                    property: "dx"
                    to: -1
                    duration: 96
                }
            }
            ParallelAnimation {
                NumberAnimation {
                    target: wobBox
                    properties: "sx,sy"
                    to: 1
                    duration: 128
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.spring
                }
                NumberAnimation {
                    target: wobBox
                    property: "dx"
                    to: 0
                    duration: 128
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.spring
                }
            }
        }

        // 按下 p-press（.26s，40% 处缩到 .97）
        onPressedChanged: if (pressed && !still) {
            wobAnim.stop();
            pressAnim.restart();
        }
        SequentialAnimation {
            id: pressAnim
            NumberAnimation {
                target: wobBox
                properties: "sx,sy"
                to: 0.97
                duration: 104
            }
            NumberAnimation {
                target: wobBox
                properties: "sx,sy"
                to: 1
                duration: 156
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }

        // 快满时抖动 pwShake（.06s alternate）
        SequentialAnimation {
            running: itemRoot.shaking && !itemRoot.still
            loops: Animation.Infinite
            onRunningChanged: if (!running) {
                mv.shX = 0;
                mv.shY = 0;
            }
            ParallelAnimation {
                NumberAnimation {
                    target: mv
                    property: "shX"
                    to: 2
                    duration: 60
                }
                NumberAnimation {
                    target: mv
                    property: "shY"
                    to: -1
                    duration: 60
                }
            }
            ParallelAnimation {
                NumberAnimation {
                    target: mv
                    property: "shX"
                    to: -2
                    duration: 60
                }
                NumberAnimation {
                    target: mv
                    property: "shY"
                    to: 1
                    duration: 60
                }
            }
        }

        // 确认 pwHit：白色楔形 40% 处 scale(1.12, 1.25)，.38s
        SequentialAnimation {
            id: hitAnim
            ParallelAnimation {
                NumberAnimation {
                    target: sw
                    property: "hitX"
                    to: 1.12
                    duration: 152
                }
                NumberAnimation {
                    target: sw
                    property: "hitY"
                    to: 1.25
                    duration: 152
                }
            }
            NumberAnimation {
                target: sw
                properties: "hitX,hitY"
                to: 1
                duration: 228
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
        // 确认 pwGhost：fill 色残像 .9 → 0，右移 140px、放大 1.5，.6s
        ParallelAnimation {
            id: ghostAnim
            NumberAnimation {
                target: ghost
                property: "opacity"
                from: 0.9
                to: 0
                duration: 600
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: ghostT
                property: "x"
                from: 0
                to: 140
                duration: 600
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: ghostS
                properties: "xScale,yScale"
                from: 1
                to: 1.5
                duration: 600
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
    }

    // POWER 右侧（原型 .pw-side，560 宽）：焦点动作的图标（60px），下面是按住倒计时。
    //   计时条 20 格斜块 + 剩余秒数；只在焦点是按住类动作时显示（meterOn）
    //   swap()：换焦点时图标从右 18px 淡入；nudge()：中途松开时计时条左右晃一下
    component PowerSide: Item {
        id: sideRoot

        property string glyph: "lock"
        property bool meterOn: false
        property real pc: 0               // 按住进度 0..1
        property bool holding: false      // 有按住中的项且进度 > 0
        property bool hot: false          // 按住中且进度 > .72
        property int holdMs: 1000
        property bool still: false

        width: 560
        height: 240

        function swap() {
            if (still)
                return;
            swapAnim.restart();
        }
        function nudge() {
            if (still)
                return;
            nudgeAnim.restart();
        }

        // ---------------------------------------------------------------- 图标 .pw-sel
        Item {
            id: selBox
            width: 60
            height: 60
            property real dx: 0
            transform: Translate {
                x: selBox.dx
            }
            P3Glyph {
                name: sideRoot.glyph
                size: 60
                stroke: 2
                color: P3.fill
            }
        }
        ParallelAnimation {
            id: swapAnim
            NumberAnimation {
                target: selBox
                property: "opacity"
                from: 0
                to: 1
                duration: 320
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: selBox
                property: "dx"
                from: 18
                to: 0
                duration: 320
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }

        // ---------------------------------------------------------------- 计时 .pw-meter（图标下 102px，行高 .86 × 72）
        Item {
            id: meter
            y: 60 + 102
            width: sideRoot.width
            height: 72 * 0.86
            opacity: sideRoot.meterOn ? 1 : 0
            property real dx: 0
            transform: Translate {
                x: meter.dx
            }
            Behavior on opacity {
                enabled: !sideRoot.still
                NumberAnimation {
                    duration: 200
                }
            }

            readonly property int cdW: 150
            readonly property int lit: Math.round(sideRoot.pc * 20)

            // 20 格斜块：polygon(30% 0, 100% 0, 70% 100%, 0 100%)，间隔 5
            Row {
                id: ticks
                y: (meter.height - 22) / 2
                spacing: 5
                readonly property real cellW: (meter.width - 26 - meter.cdW - 19 * spacing) / 20
                Repeater {
                    model: 20
                    delegate: Shape {
                        id: tick
                        required property int index
                        width: ticks.cellW
                        height: 22
                        preferredRendererType: Shape.CurveRenderer
                        ShapePath {
                            fillColor: tick.index < meter.lit ? P3.accent : P3.line
                            strokeColor: "transparent"
                            startX: tick.width * 0.3
                            startY: 0
                            PathLine {
                                x: tick.width
                                y: 0
                            }
                            PathLine {
                                x: tick.width * 0.7
                                y: tick.height
                            }
                            PathLine {
                                x: 0
                                y: tick.height
                            }
                            PathLine {
                                x: tick.width * 0.3
                                y: 0
                            }
                        }
                    }
                }
            }

            // 剩余秒数 .pw-cd：右对齐，单位 S 跟在基线上
            FontMetrics {
                id: cdFm
                font: cd.font
            }
            TextMetrics {
                id: cdTm
                font: cd.font
                text: cd.text
            }
            TextMetrics {
                id: unitTm
                font: unit.font
                text: unit.text
            }
            P3Text {
                id: cd
                kind: "num"
                font.pixelSize: 72
                font.letterSpacing: -0.72
                text: ((1 - sideRoot.pc) * sideRoot.holdMs / 1000).toFixed(1)
                color: sideRoot.hot ? P3.accent : sideRoot.holding ? P3.tx : P3.dim
                x: meter.width - unitTm.advanceWidth - 4 - cdTm.advanceWidth
                y: (meter.height - cdFm.ascent - cdFm.descent) / 2 + cdFm.ascent - baselineOffset
                Behavior on color {
                    enabled: !sideRoot.still
                    ColorAnimation {
                        duration: 100
                    }
                }
            }
            P3Text {
                id: unit
                kind: "unit"
                text: "S"
                color: P3.dim
                x: meter.width - unitTm.advanceWidth
                y: cd.y + cd.baselineOffset - baselineOffset
            }
        }
        SequentialAnimation {
            id: nudgeAnim
            NumberAnimation {
                target: meter
                property: "dx"
                to: -7
                duration: 72
            }
            NumberAnimation {
                target: meter
                property: "dx"
                to: 7
                duration: 72
            }
            NumberAnimation {
                target: meter
                property: "dx"
                to: -7
                duration: 72
            }
            NumberAnimation {
                target: meter
                property: "dx"
                to: 7
                duration: 72
            }
            NumberAnimation {
                target: meter
                property: "dx"
                to: 0
                duration: 72
            }
        }
    }

    // 确认幕布（原型 .pw-curtain）：铺满整个舞台 1920×1080，盖住菜单、页面和日期。打开时挂到 ctx.overlay。
    //   show(act)  深蓝幕斜着从上落下（底边从 -2%/-14% 落到 124%/112%），红色斜条横扫，幕后压 50% 黑；
    //              中间是动作图标（84px）+ 名字（168px）。重启的图标持续旋转，关机的图标渐暗缩小
    //   lift()     幕收回顶部，内容上移淡出；结束后自动隐藏并发 lifted()
    //   hide()     立即隐藏
    // 显示期间吞掉左键，焦点不会在幕后移动。
    component PowerCurtain: Item {
        id: curtainRoot

        property bool still: false
        property var act: null            // { id, g, cur }
        property bool out: false
        signal lifted

        width: P3.stageW
        height: P3.stageH
        z: 5
        visible: false

        property real drop: 0             // 0 收起，1 盖满
        property real shade: 0            // 黑色压暗 0..0.5
        property real slashX: -300
        property real cgT: 0              // 图标入场 0..1（spring，会过冲）
        property real cnT: 0              // 名字入场 0..1
        property real offT: 0             // 关机图标渐暗 0..1
        property real ccOut: 0            // 收起时内容上移淡出 0..1

        readonly property string kind: act ? act.id : ""

        function show(a) {
            stopAll();
            act = a;
            out = false;
            ccOut = 0;
            spin.rotation = 0;
            visible = true;
            if (still) {
                drop = 1;
                shade = 0.5;
                slashX = 2200;
                cgT = 1;
                cnT = 1;
                offT = kind === "off" ? 1 : 0;
                return;
            }
            drop = 0;
            shade = 0;
            slashX = -300;
            cgT = 0;
            cnT = 0;
            offT = 0;
            inAnim.restart();
            if (kind === "reboot")
                spinAnim.restart();
        }
        function lift() {
            if (!visible || out)
                return;
            out = true;
            inAnim.stop();
            if (still) {
                hide();
                lifted();
                return;
            }
            outAnim.restart();
        }
        function hide() {
            stopAll();
            visible = false;
            out = false;
        }
        function stopAll() {
            inAnim.stop();
            outAnim.stop();
            spinAnim.stop();
        }

        MouseArea {
            anchors.fill: parent
            acceptedButtons: Qt.LeftButton
        }

        // ---------------------------------------------------------------- 深蓝幕 .pw-cv
        Shape {
            anchors.fill: parent
            preferredRendererType: Shape.CurveRenderer
            ShapePath {
                fillColor: P3.deep
                strokeColor: "transparent"
                startX: 0
                startY: 0
                PathLine {
                    x: curtainRoot.width
                    y: 0
                }
                PathLine {
                    x: curtainRoot.width
                    y: curtainRoot.height * (-0.14 + 1.26 * curtainRoot.drop)
                }
                PathLine {
                    x: 0
                    y: curtainRoot.height * (-0.02 + 1.26 * curtainRoot.drop)
                }
                PathLine {
                    x: 0
                    y: 0
                }
            }
        }

        // 压暗 .pw-cd2
        Rectangle {
            anchors.fill: parent
            color: "#000000"
            opacity: curtainRoot.shade
        }

        // 红色斜条 .pw-cs：90×1320，skewX(-14deg)，从 -300 扫到 2200
        Rectangle {
            id: slash
            y: -120
            width: 90
            height: 1320
            color: P3.accent
            visible: !curtainRoot.out && curtainRoot.slashX < curtainRoot.width
            transform: [
                Matrix4x4 {
                    // skewX(-14deg)，原点在中心：x' = x - tan14° × (y - h/2)
                    matrix: Qt.matrix4x4(1, -Math.tan(14 * Math.PI / 180), 0, Math.tan(14 * Math.PI / 180) * 660, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
                },
                Translate {
                    x: curtainRoot.slashX
                }
            ]
        }

        // ---------------------------------------------------------------- 图标 + 名字 .pw-cc（top 300，水平居中）
        Item {
            id: cc
            width: curtainRoot.width
            height: curtainRoot.height
            opacity: 1 - curtainRoot.ccOut
            transform: Translate {
                y: -34 * curtainRoot.ccOut
            }

            // 图标 .pw-cg：从 .4 倍、-50° 弹入
            Item {
                id: cg
                x: (curtainRoot.width - 84) / 2
                y: 300
                width: 84
                height: 84
                opacity: Math.max(0, Math.min(1, curtainRoot.cgT))
                scale: 0.4 + 0.6 * curtainRoot.cgT
                rotation: -50 * (1 - curtainRoot.cgT)
                Item {
                    id: spin
                    width: 84
                    height: 84
                    opacity: 1 - 0.8 * curtainRoot.offT
                    scale: 1 - 0.18 * curtainRoot.offT
                    P3Glyph {
                        name: curtainRoot.act ? curtainRoot.act.g : "x"
                        size: 84
                        stroke: 1.8
                        color: P3.fill
                    }
                }
            }

            // 名字 .pw-cn：168px，margin-top 26，padding-right .06em；从左 90px 弹入
            FontMetrics {
                id: cnFm
                font: cn.font
            }
            TextMetrics {
                id: cnTm
                font: cn.font
                text: cn.text
            }
            P3Text {
                id: cn
                kind: "title"
                font.pixelSize: 168
                font.letterSpacing: -1.68
                text: curtainRoot.act ? curtainRoot.act.cur : ""
                color: P3.tx
                opacity: Math.max(0, Math.min(1, curtainRoot.cnT))
                x: (curtainRoot.width - cnTm.advanceWidth - 168 * 0.06) / 2 - 90 * (1 - curtainRoot.cnT)
                y: 300 + 84 + 26 + (168 * 0.86 - cnFm.ascent - cnFm.descent) / 2 + cnFm.ascent - baselineOffset
            }
        }

        // ---------------------------------------------------------------- 动画
        ParallelAnimation {
            id: inAnim
            NumberAnimation {
                target: curtainRoot
                property: "drop"
                to: 1
                duration: 500
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.swoop
            }
            SequentialAnimation {
                PauseAnimation {
                    duration: 350
                }
                NumberAnimation {
                    target: curtainRoot
                    property: "shade"
                    to: 0.5
                    duration: 1300
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
            SequentialAnimation {
                PauseAnimation {
                    duration: 100
                }
                NumberAnimation {
                    target: curtainRoot
                    property: "slashX"
                    to: 2200
                    duration: 600
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.swoop
                }
            }
            SequentialAnimation {
                PauseAnimation {
                    duration: 300
                }
                NumberAnimation {
                    target: curtainRoot
                    property: "cgT"
                    to: 1
                    duration: 600
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.spring
                }
            }
            SequentialAnimation {
                PauseAnimation {
                    duration: 360
                }
                NumberAnimation {
                    target: curtainRoot
                    property: "cnT"
                    to: 1
                    duration: 620
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.spring
                }
            }
            SequentialAnimation {
                PauseAnimation {
                    duration: 800
                }
                NumberAnimation {
                    target: curtainRoot
                    property: "offT"
                    to: curtainRoot.kind === "off" ? 1 : 0
                    duration: 1000
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
        }
        // 重启：.7s 后图标持续旋转（1.1s 一圈）
        SequentialAnimation {
            id: spinAnim
            PauseAnimation {
                duration: 700
            }
            NumberAnimation {
                target: spin
                property: "rotation"
                from: 0
                to: 360
                duration: 1100
                loops: Animation.Infinite
            }
        }
        ParallelAnimation {
            id: outAnim
            NumberAnimation {
                target: curtainRoot
                property: "ccOut"
                to: 1
                duration: 280
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: curtainRoot
                property: "shade"
                to: 0
                duration: 300
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            SequentialAnimation {
                PauseAnimation {
                    duration: 100
                }
                NumberAnimation {
                    target: curtainRoot
                    property: "drop"
                    to: 0
                    duration: 450
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: [0.6, 0, 0.8, 0.4, 1, 1]
                }
            }
            onFinished: {
                curtainRoot.hide();
                curtainRoot.lifted();
            }
        }
    }
}
