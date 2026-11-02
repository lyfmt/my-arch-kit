pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import qs.Common
import qs.Services
import qs.Modules.P3
import "P3IslandLayout.js" as P3L

// 灵动岛气泡串（prototype/island-b.html）的内容层：每个气泡跟着 P3IslandSprings 的弹簧走，里面放时间、音频、
// 通知计数、电量、通知卡、媒体控制和通知中心面板；点击区按气泡的目标位置摆。形状由 P3IslandShape 在下面一层画。
// 坐标：气泡 x = 中心相对 centerX，y = 顶边相对岛窗口顶边；screenX / screenY = 本层原点在屏幕上的位置。
Item {
    id: root

    required property var controller
    required property var mediaModel
    required property var systemModel
    required property var notificationModel
    property bool active: false
    property bool reducedMotion: false
    property real centerX: width / 2
    property real screenX: 0
    property real screenY: 0
    property color surfaceColor: P3.isl

    readonly property alias springs: springs
    readonly property bool hovered: hover.hovered
    readonly property string screenName: root.controller.screen?.name ?? ""
    // 菜单窗口还在（含收场）时岛保持水滴；收场完才长回来
    readonly property bool menuHere: P3Menu.present && (P3Menu.screen?.name ?? "") === root.screenName
    readonly property string mode: !root.active ? "" : root.menuHere && root.controller.p3Mode !== "" && !root.controller.expanded ? "menu" : root.controller.p3Mode
    // P3 菜单从这里的水滴破开（P3Menu.islandOn → drop()）
    readonly property bool dropReady: root.active && !root.reducedMotion

    // 刚到的那条通知滚进计数之前不算数
    property bool arriving: false
    readonly property int shownCount: Math.max(0, root.controller.p3Data.count - (root.arriving ? 1 : 0))
    readonly property bool dnd: SessionData.doNotDisturb
    readonly property bool unread: NotificationService.unreadCount > 0 && !root.arriving && !root.dnd && root.shownCount > 0

    readonly property var player: root.mediaModel?.player ?? null
    // playing：当前播放器（播放 / 暂停图标）；anyPlaying：任何一个播放器在放（可视化柱子、云朵浮动）
    readonly property bool playing: root.mediaModel?.playing ?? false
    readonly property bool anyPlaying: {
        const players = MprisController.availablePlayers;
        for (let i = 0; i < players.length; i++) {
            if (players[i]?.isPlaying)
                return true;
        }
        return false;
    }
    readonly property real progress: {
        const p = root.player;
        if (!p || !(p.length > 0))
            return 0;
        return Math.max(0, Math.min(1, p.position / p.length));
    }

    readonly property real batteryLevel: Math.max(0, Math.min(100, BatteryService.batteryLevel))
    readonly property bool batteryLow: BatteryService.isLowBattery && !BatteryService.isCharging
    property real slosh: 0

    property string shown: ""
    property bool grown: false
    property bool dropping: false
    property bool committing: false
    // 通知卡被点开：收场时卡片原地化掉，不滚进计数
    property bool opened: false
    property int lastCount: 0
    property var pending: []

    // 有媒体在放：气泡像云一样慢慢浮着（P3IslandSprings.cloudT / cloudA，形状和内容共用这一个相位）
    readonly property var cloudModes: ["home", "peek", "pw", "media", "mediaOpen", "osd", "state", "charging"]
    readonly property bool cloudOn: root.active && root.anyPlaying && !root.reducedMotion && root.cloudModes.indexOf(root.shown) !== -1
    property real cloudA: root.cloudOn ? 1 : 0
    property real cloudT: 0

    Behavior on cloudA {
        NumberAnimation {
            duration: 1400
            easing.type: Easing.InOutSine
        }
    }

    NumberAnimation on cloudT {
        from: 0
        to: 1
        duration: P3L.CLOUD_MS
        loops: Animation.Infinite
        running: root.cloudA > 0
    }

    // 指针下的气泡（悬停时鼓一下、邻居往它那边靠）
    property string hoverName: ""
    // 悬停胀开 / 收回让气泡在没动的指针下面换了位置：这时点击算指针原来指着的气泡（aimed()）
    property bool hoverShifted: false
    readonly property var hoverOrder: ["prev", "play", "next", "card", "notif", "batt", "audio", "time"]
    readonly property var rowNames: ["time", "audio", "notif", "batt"]

    visible: root.active

    function layoutData() {
        const d = Object.assign({}, root.controller.p3Data);
        d.count = root.shownCount;
        return d;
    }

    function schedule() {
        Qt.callLater(root.apply);
    }

    // ---------------------------------------------------------------- 计时
    function later(ms, fn) {
        if (root.reducedMotion || ms <= 0) {
            fn();
            return;
        }
        const t = laterComponent.createObject(root, {
            "interval": ms
        });
        t.fn = fn;
        root.pending.push(t);
        t.start();
    }

    function clearLater() {
        for (const t of root.pending) {
            if (t) {
                t.stop();
                t.destroy();
            }
        }
        root.pending = [];
        root.dropping = false;
    }

    Component {
        id: laterComponent

        Timer {
            id: timer

            property var fn: null

            repeat: false
            onTriggered: {
                const i = root.pending.indexOf(timer);
                if (i !== -1)
                    root.pending.splice(i, 1);
                const f = timer.fn;
                timer.fn = null;
                timer.destroy();
                if (f)
                    f();
            }
        }
    }

    // ---------------------------------------------------------------- 摆放
    function put(name, r, extra) {
        const o = Object.assign({}, r, extra || {});
        o.face = r.w > 0 && r.h > 0 ? (r.face || "") : "";
        springs.to(springs[name], r.x, r.y, r.w, r.h, o);
    }

    function placeAll(L, skip, extra) {
        for (const name of P3L.NAMES) {
            if (skip && skip.indexOf(name) !== -1)
                continue;
            root.put(name, L[name], extra ? extra[name] : null);
        }
    }

    // 开场：分子从时间胶囊里依次长出来
    function seed() {
        springs.to(springs.time, 0, 4, 0, 0, {
            "snap": true,
            "face": ""
        });
        for (const name of P3L.NAMES) {
            if (name !== "time")
                springs.to(springs[name], 0, 20, 0, 0, {
                    "snap": true,
                    "face": ""
                });
        }
    }

    function apply() {
        if (!root.active) {
            if (root.grown) {
                root.clearLater();
                root.arriving = false;
                root.seed();
                root.grown = false;
            }
            root.shown = "";
            return;
        }
        const m = root.mode;
        const prev = root.shown;
        const L = P3L.layout(m, root.layoutData());
        if (m === prev) {
            root.update(m, L);
            return;
        }
        root.clearLater();
        root.shown = m;
        if (!root.grown && m !== "") {
            root.seed();
            root.grown = true;
        }
        switch (m) {
        case "notify":
            root.notifySeq(L);
            break;
        case "center":
            root.openCenter(L);
            break;
        case "menu":
            root.menuSeq(L);
            break;
        case "mediaOpen":
            for (const n of ["prev", "play", "next"]) {
                if (springs[n].w < 2)
                    springs.to(springs[n], 0, 70, 0, 0, {
                        "snap": true
                    });
            }
            root.placeAll(L);
            break;
        default:
            root.placeAll(L);
            break;
        }
        if (prev === "notify" && m !== "notify")
            root.afterNotify(m, L);
        if (prev === "menu" && !root.reducedMotion) {
            springs.audio.at += 0.06;
            springs.notif.at += 0.06;
            springs.batt.at += 0.17;
        }
        if (m === "charging" && BatteryService.isPluggedIn)
            root.later(280, () => {
                root.ring("batt", false, 1);
                root.startSlosh();
            });
    }

    // 同一个状态里数据变了（计数、勿扰、播放器、低电……）：重排这一串
    function update(m, L) {
        switch (m) {
        case "notify":
        case "menu":
            return;
        case "center":
            root.placeAll(L, root.dropping ? ["panel"] : null, {
                "panel": {
                    "k": 260,
                    "c": 24
                }
            });
            return;
        }
        root.placeAll(L);
    }

    // 通知中心：先滴下一颗小水滴，90ms 后横向摊开成面板；内容等面板大致成形再进
    function openCenter(L) {
        root.placeAll(L, ["panel"]);
        const p = springs.panel;
        if (root.reducedMotion) {
            root.put("panel", L.panel);
            return;
        }
        if (p.w < 2)
            springs.to(p, L.notif.x, P3L.CY, 16, 12, {
                "snap": true
            });
        springs.to(p, L.notif.x, P3L.NC.y - 2, 34, 34, {
            "k": 320,
            "c": 19
        });
        springs.kick(springs.notif, 90, 70);
        root.dropping = true;
        root.later(90, () => {
            root.dropping = false;
            root.put("panel", P3L.layout("center", root.layoutData()).panel, {
                "k": 260,
                "c": 28,
                "fd": 220
            });
        });
    }

    // 新通知：气泡从下方水里浮上来，撞进时间胶囊，胀开成通知卡，邻居被挤开再粘回来
    function notifySeq(L) {
        root.arriving = true;
        root.placeAll(L, ["card"]);
        const card = springs.card;
        if (root.reducedMotion) {
            root.put("card", L.card);
            return;
        }
        springs.to(card, -26, 120, 10, 10, {
            "snap": true,
            "face": ""
        });
        root.later(30, () => springs.to(card, 18, 150, 18, 18, {
                "k": 90,
                "c": 11
            }));
        root.later(380, () => springs.to(card, -6, 52, 26, 26, {
                "k": 160,
                "c": 12
            }));
        for (let t = 70; t < 860; t += 70)
            root.later(t, () => {
                if (card.y > 60)
                    root.trail(card.x, card.y + card.h);
            });
        root.later(720, () => {
            springs.to(springs.time, 0, 5, 110, 36, {
                "k": 520,
                "c": 22
            });
            root.ring("time", false, 1.1);
        });
        root.later(860, () => {
            const A = P3L.layout("notify", root.layoutData());
            root.put("card", A.card);
            if (A.audio.w > 0)
                springs.to(springs.audio, A.audio.x - 23, 10, A.audio.w, A.audio.h, {
                    "k": 420,
                    "c": 19
                });
            springs.to(springs.notif, A.notif.x + 22, 10, A.notif.w, A.notif.h, {
                "k": 420,
                "c": 19
            });
            if (A.batt.w > 0)
                springs.to(springs.batt, A.batt.x + 34, 12, A.batt.w, A.batt.h, {
                    "k": 380,
                    "c": 18,
                    "d": 40
                });
        });
        root.later(900, () => springs.to(springs.time, 0, 7, 100, 34, {
                "k": 300,
                "c": 18
            }));
        root.later(1700, () => {
            const A = P3L.layout("notify", root.layoutData());
            root.put("time", A.time);
            root.put("audio", A.audio, {
                "k": 260,
                "c": 16
            });
            root.put("notif", A.notif, {
                "k": 260,
                "c": 16
            });
            root.put("batt", A.batt, {
                "k": 240,
                "c": 15
            });
        });
    }

    // 通知卡收成一颗，滚进计数气泡，计数 +1；被点开的卡原地化掉
    function afterNotify(m, L) {
        const card = springs.card;
        if (root.opened) {
            root.opened = false;
            root.commitArrival();
            if (!root.reducedMotion && m !== "" && m !== "menu") {
                root.ring("card", false, 1.05);
                springs.to(card, card.tx, card.ty + 14, 0, 0, {
                    "k": 420,
                    "c": 26,
                    "face": ""
                });
            }
            return;
        }
        if (m === "" || m === "center" || m === "menu" || root.reducedMotion) {
            root.commitArrival();
            return;
        }
        springs.to(card, L.notif.x - 23, 30, 26, 26, {
            "k": 260,
            "c": 20,
            "face": ""
        });
        root.later(350, () => springs.to(card, springs.notif.tx - 2, 17, 14, 14, {
                "k": 300,
                "c": 20
            }));
        root.later(600, () => {
            springs.to(card, springs.notif.tx, 24, 0, 0, {
                "k": 400,
                "c": 26
            });
            root.commitArrival();
            const A = P3L.layout(root.shown, root.layoutData());
            root.placeAll(A, ["card"]);
            const n = springs.notif;
            springs.to(n, n.tx, n.ty - 4, n.tw + 8, n.th + 8, {
                "k": 480,
                "c": 20
            });
            root.ring("notif", false, 1);
        });
        root.later(900, () => {
            const A = P3L.layout(root.shown, root.layoutData());
            root.put("notif", A.notif, {
                "k": 260,
                "c": 16
            });
        });
    }

    function commitArrival() {
        if (!root.arriving)
            return;
        root.committing = true;
        root.arriving = false;
        root.committing = false;
    }

    // P3 菜单：所有气泡被吸进时间胶囊，缩成一颗水滴，蓄力下坠；P3MenuReveal 在 300ms 时从水滴中心破开
    function menuSeq(L) {
        root.placeAll(L);
        root.later(180, () => {
            for (const n of ["batt", "notif", "audio"])
                springs.to(springs[n], 0, 20, 0, 0, {
                    "k": 500,
                    "c": 30
                });
            springs.to(springs.time, 0, 6, 54, 58, {
                "k": 260,
                "c": 14
            });
        });
    }

    function lowPulse() {
        if (root.reducedMotion)
            return;
        for (const t of [500, 2200, 3900])
            root.later(t, () => {
                if (root.shown !== "home" && root.shown !== "media")
                    return;
                const b = springs.batt;
                springs.to(b, b.tx + 11, b.ty + 1, b.tw - 4, b.th - 2, {
                    "k": 520,
                    "c": 26
                });
                root.later(200, () => {
                    root.put("batt", P3L.layout(root.shown, root.layoutData()).batt, {
                        "k": 340,
                        "c": 16,
                        "d": 0
                    });
                    root.ring("batt", true, 1.05);
                });
            });
    }

    function startSlosh() {
        if (!root.reducedMotion)
            sloshAnimation.restart();
    }

    // ---------------------------------------------------------------- 点击
    function tap(name) {
        const c = root.controller;
        const m = root.shown;
        SettingsData.recordBarInteraction(c.screen, c.barConfig?.id);
        switch (name) {
        case "time":
            if (c.expanded)
                c.requestCollapse();
            P3Menu.toggle();
            return;
        case "audio":
            if (m === "mediaOpen")
                c.requestCollapse();
            else if (m === "osd" || m === "state" || m === "level")
                c.requestToggle(false);
            else if (c.mediaAvailable)
                c.requestActivity("media", true, false);
            return;
        case "card":
            if (m === "notify") {
                root.openNotification();
                return;
            }
            c.requestNotificationCenter(false);
            return;
        case "notif":
            if (m === "center")
                c.requestCollapse();
            else
                c.requestNotificationCenter(false);
            return;
        case "batt":
            if (m === "center" || m === "mediaOpen" || m === "level")
                c.requestCollapse();
            c.p3BatteryInfo = !c.p3BatteryInfo;
            if (c.p3BatteryInfo)
                infoTimer.restart();
            return;
        case "prev":
        case "next":
            if (!root.player)
                return;
            if (name === "next")
                root.player.next();
            else
                root.player.previous();
            root.press(name);
            springs.nudge(springs.audio, name === "next" ? 240 : -240, 0);
            return;
        case "play":
            if (root.player)
                root.player.togglePlaying();
            root.press(name);
            return;
        }
    }

    function press(name) {
        springs.kick(springs[name], -260, -260);
        root.ring(name, false, 1.2);
    }

    // 通知卡：一下就去发通知的应用（P3IslandOpen），通知清掉，岛收回
    function openNotification() {
        const nm = root.notificationModel;
        const w = nm?.currentWrapper ?? null;
        if (!w) {
            root.controller.requestNotificationCenter(false);
            return;
        }
        root.opened = true;
        root.committing = true;
        root.arriving = false;
        P3IslandOpen.open(w);
        nm.dismiss();
        root.committing = false;
    }

    // ---------------------------------------------------------------- 悬停
    function bubbleAt(px, py) {
        const x = px - root.centerX;
        for (const n of root.hoverOrder) {
            const b = springs[n];
            if (b.tw < 4 || b.th < 4 || Math.abs(x - b.tx) > b.tw / 2)
                continue;
            if (root.rowNames.indexOf(n) !== -1 ? py <= b.ty + b.th : Math.abs(py - b.ty - b.th / 2) <= b.th / 2)
                return n;
        }
        return "";
    }

    function aimed(name) {
        const n = root.hoverName;
        return root.hoverShifted && n && springs[n].tw > 4 && springs[n].th > 4 ? n : name;
    }

    // 指针经过的气泡鼓一下，同一排的邻居往它那边靠
    function lean(name) {
        if (root.reducedMotion || !name || root.shown === "menu")
            return;
        const b = springs[name];
        springs.kick(b, 90, 60);
        for (const n of root.rowNames) {
            const o = springs[n];
            if (n !== name && o.tw > 2)
                springs.nudge(o, b.tx > o.tx ? 50 : -50, 0);
        }
    }

    // 指针离开：整排一胀一缩地晃一下
    function wobble() {
        if (root.reducedMotion || root.shown === "menu" || root.shown === "")
            return;
        let s = 1;
        for (const n of root.rowNames) {
            const o = springs[n];
            if (o.tw < 2)
                continue;
            springs.kick(o, 70 * s, -50 * s);
            s = -s;
        }
    }

    // ---------------------------------------------------------------- P3 菜单的水滴
    // 水滴在屏幕上的中心和半径（屏幕逻辑像素）；不在水滴状态时为 null
    function drop() {
        const t = springs.time;
        if (root.shown !== "menu" || t.tw < 2)
            return null;
        return {
            "x": root.screenX + root.centerX + t.tx,
            "y": root.screenY + t.ty + t.th / 2,
            "r": Math.max(t.tw, t.th) / 2
        };
    }

    function focusCenter() {
        const c = centerLoader.item;
        return c ? c.focusFace() : false;
    }

    // ---------------------------------------------------------------- 波纹
    function ring(name, red, grow) {
        if (root.reducedMotion)
            return;
        const b = springs[name];
        const s = Math.max(b.tw, b.th) * (grow || 1);
        if (s < 2)
            return;
        ringComponent.createObject(effects, {
            "x": root.centerX + b.tx - s / 2,
            "y": b.ty + b.th / 2 - s / 2,
            "size": s,
            "red": !!red
        });
    }

    function trail(x, y) {
        if (root.reducedMotion)
            return;
        const s = 3 + Math.random() * 4;
        trailComponent.createObject(effects, {
            "x": root.centerX + x - s / 2 + (Math.random() - 0.5) * 10,
            "y": y,
            "size": s,
            "dx": (Math.random() - 0.5) * 16,
            "duration": 700 + Math.random() * 300
        });
    }

    Component {
        id: ringComponent

        Rectangle {
            id: ringItem

            property real size: 20
            property bool red: false

            width: size
            height: size
            radius: size / 2
            color: "transparent"
            border.width: 1.5
            border.color: red ? P3.accent : P3.fill

            ParallelAnimation {
                running: true
                onFinished: ringItem.destroy()

                NumberAnimation {
                    target: ringItem
                    property: "scale"
                    from: 1
                    to: 1.9
                    duration: 900
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: [0.2, 0.7, 0.3, 1, 1, 1]
                }
                NumberAnimation {
                    target: ringItem
                    property: "opacity"
                    from: 0.8
                    to: 0
                    duration: 900
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: [0.2, 0.7, 0.3, 1, 1, 1]
                }
            }
        }
    }

    Component {
        id: trailComponent

        Rectangle {
            id: trailItem

            property real size: 4
            property real dx: 0
            property int duration: 800
            property real ox: 0
            property real oy: 0

            width: size
            height: size
            radius: size / 2
            color: "transparent"
            border.width: 1
            border.color: P3.fill
            transform: Translate {
                x: trailItem.ox
                y: trailItem.oy
            }

            ParallelAnimation {
                running: true
                onFinished: trailItem.destroy()

                NumberAnimation {
                    target: trailItem
                    property: "ox"
                    to: trailItem.dx
                    duration: trailItem.duration
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: [0.3, 0.6, 0.5, 1, 1, 1]
                }
                NumberAnimation {
                    target: trailItem
                    property: "oy"
                    to: -34
                    duration: trailItem.duration
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: [0.3, 0.6, 0.5, 1, 1, 1]
                }
                NumberAnimation {
                    target: trailItem
                    property: "opacity"
                    from: 0.8
                    to: 0
                    duration: trailItem.duration
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: [0.3, 0.6, 0.5, 1, 1, 1]
                }
            }
        }
    }

    // ---------------------------------------------------------------- 触发
    onModeChanged: root.schedule()
    onActiveChanged: root.schedule()
    onShownCountChanged: {
        const n = root.shownCount;
        const up = n > root.lastCount;
        root.lastCount = n;
        if (!root.grown || root.committing || root.shown === "notify")
            return;
        springs.kick(springs.notif, up ? 120 : -120, up ? 80 : -120);
    }
    onDndChanged: {
        if (root.grown)
            springs.kick(springs.notif, 140, 60);
    }
    onBatteryLowChanged: {
        if (root.batteryLow)
            root.lowPulse();
    }
    // 菜单在这块屏幕上打开时，岛上展开着的东西先收起来，好吸成水滴
    onMenuHereChanged: {
        if (root.menuHere && root.active && root.controller.expanded)
            root.controller.requestCollapse();
    }
    Component.onCompleted: {
        root.lastCount = root.shownCount;
        root.schedule();
        P3Menu.registerIsland(root);
    }
    Component.onDestruction: P3Menu.unregisterIsland(root)

    Connections {
        target: root.controller

        function onP3DataChanged() {
            root.schedule();
        }
        function onP3PeekChanged() {
            root.hoverShifted = hover.hovered && root.hoverName !== "";
        }
    }

    Connections {
        target: root.systemModel

        function onValueChanged() {
            if (root.shown === "osd" && Math.abs(springs.audio.vw) < 260)
                springs.kick(springs.audio, 160, 0);
        }
        function onKindChanged() {
            if (root.shown === "osd")
                springs.kick(springs.audio, 0, 120);
        }
    }

    Binding {
        target: root.controller
        property: "p3CenterHold"
        value: centerLoader.item ? centerLoader.item.hold : 0
        when: root.active
    }

    SystemClock {
        id: clock
        precision: SystemClock.Minutes
    }

    // 呼吸：静置（没有在放的媒体）时每 5.2s 给时间胶囊一点速度，弹簧自己回来
    Timer {
        interval: 5200
        repeat: true
        running: root.active && root.shown === "home" && !root.cloudOn && !root.reducedMotion
        onTriggered: springs.kick(springs.time, 30, 10)
    }

    // 电源信息停一会儿自己收回
    Timer {
        id: infoTimer
        interval: 6000
        onTriggered: root.controller.p3BatteryInfo = false
    }

    // MprisPlayer.position 不会自己刷新
    Timer {
        interval: 1000
        repeat: true
        running: root.active && root.playing && (root.shown === "media" || root.shown === "mediaOpen")
        onTriggered: root.player?.positionChanged()
    }

    // 插上电：水位冲高再回落
    SequentialAnimation {
        id: sloshAnimation

        NumberAnimation {
            target: root
            property: "slosh"
            to: 0.5
            duration: 385
            easing.type: Easing.BezierSpline
            easing.bezierCurve: [0.3, 0.7, 0.3, 1, 1, 1]
        }
        NumberAnimation {
            target: root
            property: "slosh"
            to: -0.04
            duration: 385
            easing.type: Easing.BezierSpline
            easing.bezierCurve: [0.3, 0.7, 0.3, 1, 1, 1]
        }
        NumberAnimation {
            target: root
            property: "slosh"
            to: 0
            duration: 330
            easing.type: Easing.BezierSpline
            easing.bezierCurve: [0.3, 0.7, 0.3, 1, 1, 1]
        }
    }

    P3IslandSprings {
        id: springs
        reducedMotion: root.reducedMotion
        cloudT: root.cloudT
        cloudA: root.cloudA
    }

    // ---------------------------------------------------------------- 组件
    // 一个气泡：跟弹簧走，自己裁剪内容；小于 16px 时内容跟着淡掉
    component Bubble: Item {
        required property var b
        required property real originX

        x: originX + b.x + b.fx - width / 2
        y: b.y + b.fy
        width: Math.max(0, b.w)
        height: Math.max(0, b.h)
        opacity: Math.min(1, Math.min(width, height) / 16)
        visible: width > 0.5 && height > 0.5
        clip: true
    }

    // 同一个气泡里的一面内容：形状先动，内容晚 fd 毫秒再淡入、上浮、放大
    component Face: Item {
        id: face

        required property var b
        required property string key
        property bool still: false
        property real offLift: 5
        property real offScale: 0.96
        readonly property bool on: b.face === key
        property real lift: offLift
        property real grow: offScale

        anchors.fill: parent
        opacity: 0
        visible: opacity > 0.001
        transform: [
            Scale {
                origin.x: face.width / 2
                origin.y: face.height / 2
                xScale: face.grow
                yScale: face.grow
            },
            Translate {
                y: face.lift
            }
        ]

        function sync() {
            if (face.on) {
                hideFace.stop();
                showPause.duration = face.still ? 0 : face.b.fd;
                showFace.restart();
            } else {
                showFace.stop();
                hideFace.restart();
            }
        }

        onOnChanged: face.sync()
        Component.onCompleted: {
            if (face.on)
                face.sync();
        }

        SequentialAnimation {
            id: showFace

            PauseAnimation {
                id: showPause
                duration: 60
            }
            ParallelAnimation {
                NumberAnimation {
                    target: face
                    property: "opacity"
                    to: 1
                    duration: face.still ? 0 : 220
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: [0.25, 0.1, 0.25, 1, 1, 1]
                }
                NumberAnimation {
                    target: face
                    property: "lift"
                    to: 0
                    duration: face.still ? 0 : 460
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.soft
                }
                NumberAnimation {
                    target: face
                    property: "grow"
                    to: 1
                    duration: face.still ? 0 : 460
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.soft
                }
            }
        }

        ParallelAnimation {
            id: hideFace

            NumberAnimation {
                target: face
                property: "opacity"
                to: 0
                duration: face.still ? 0 : 100
            }
            NumberAnimation {
                target: face
                property: "lift"
                to: face.offLift
                duration: face.still ? 0 : 180
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: face
                property: "grow"
                to: face.offScale
                duration: face.still ? 0 : 180
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
    }

    // 媒体标题 + 歌手：标题优先，歌手用剩下的宽度
    component TrackText: Item {
        id: track

        required property var media
        property real room: 100
        property bool column: false
        property real titleSize: 13.5
        property real gap: 9
        // 窄气泡：歌名先占满，剩下的地方够 artistMin 才露歌手
        property bool titleFirst: false
        property real artistMin: 18

        readonly property real artistWant: titleFirst ? 0 : Math.min(artist.implicitWidth, 60)
        readonly property real titleWidth: column ? room : Math.min(title.implicitWidth, Math.max(0, room - (titleFirst ? 0 : track.gap) - track.artistWant))
        readonly property real artistWidth: column ? room : Math.max(0, room - track.titleWidth - track.gap)

        width: room
        height: column ? title.height + gap + artist.height : Math.max(title.height, artist.height)

        P3IslandText {
            id: title

            width: track.titleWidth
            face: "zh"
            size: track.titleSize
            elide: Text.ElideRight
            text: track.media?.title ?? ""
        }

        P3IslandText {
            id: artist

            x: track.column ? 0 : track.titleWidth + track.gap
            y: track.column ? title.height + track.gap : 0
            anchors.baseline: track.column ? undefined : title.baseline
            width: track.artistWidth
            visible: track.artistWidth >= track.artistMin
            face: "zh"
            size: 12
            color: P3.dim
            elide: Text.ElideRight
            text: track.media?.artist ?? ""
        }
    }

    // 播放进度：细线
    component Progress: Rectangle {
        id: progressBar

        property real value: 0
        property bool still: false

        height: 2
        radius: 1
        color: P3.line

        Rectangle {
            width: parent.width * progressBar.value
            height: parent.height
            radius: 1
            color: P3.fill

            Behavior on width {
                NumberAnimation {
                    duration: progressBar.still ? 0 : 600
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
        }
    }

    // 音量 / 亮度：图标点一下静音，条上按住拖动调
    component Level: Item {
        id: level

        property real iconSize: 15
        property real barHeight: 8
        property real numberSize: 17
        property real gap: 10
        property real minNumber: 22
        property var sys: null
        property bool still: false

        readonly property string iconName: {
            switch (level.sys?.kind) {
            case "brightness":
                return "sun";
            case "mic":
                return level.sys.muted ? "micoff" : "mic";
            }
            return level.sys?.muted ? "mute" : "vol";
        }
        readonly property int number: !level.sys ? 0 : level.sys.kind === "brightness" ? Math.round(level.sys.ratio * 100) : Math.round(level.sys.value)

        implicitHeight: Math.max(iconSize, number_.height)

        P3IslandIcon {
            id: icon

            anchors.verticalCenter: parent.verticalCenter
            width: level.iconSize
            height: level.iconSize
            name: level.iconName

            MouseArea {
                anchors.fill: parent
                anchors.margins: -6
                enabled: level.sys?.mutable ?? false
                cursorShape: Qt.PointingHandCursor
                onClicked: level.sys.toggleMute()
            }
        }

        Rectangle {
            id: bar

            anchors.left: icon.right
            anchors.leftMargin: level.gap
            anchors.right: number_.left
            anchors.rightMargin: level.gap
            anchors.verticalCenter: parent.verticalCenter
            height: level.barHeight
            radius: height / 2
            color: P3.line
            clip: true

            Rectangle {
                width: bar.width * (level.sys?.ratio ?? 0)
                height: parent.height
                radius: parent.radius
                color: P3.fill

                Behavior on width {
                    enabled: !drag.pressed
                    NumberAnimation {
                        duration: level.still ? 0 : 500
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.spring
                    }
                }
            }

            MouseArea {
                id: drag

                anchors.fill: parent
                anchors.topMargin: -10
                anchors.bottomMargin: -10
                preventStealing: true
                cursorShape: Qt.PointingHandCursor
                function set(x) {
                    if (level.sys)
                        level.sys.setRatio(Math.max(0, Math.min(1, x / bar.width)));
                }
                onPressed: mouse => set(mouse.x)
                onPositionChanged: mouse => {
                    if (pressed)
                        set(mouse.x);
                }
            }
        }

        P3IslandText {
            id: number_

            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: 1
            width: Math.max(level.minNumber, implicitWidth)
            horizontalAlignment: Text.AlignRight
            face: "d"
            size: level.numberSize
            text: String(level.number)
        }
    }

    // ---------------------------------------------------------------- 悬停区（= 岛的输入区域：IslandController.targetDescriptor）
    Item {
        id: hoverZone

        readonly property var t: root.controller.targetDescriptor

        x: root.centerX - root.controller.alongOffset + (t?.offsetAlong ?? 0) - (t?.width ?? 0) / 2
        y: 0
        width: t?.width ?? 0
        height: (t?.offsetCross ?? 0) + (t?.height ?? 0)
        enabled: root.active

        HoverHandler {
            id: hover

            // 指针在窗口里的位置；悬停区自己挪动时 point 也会变，只有这里变了才算指针动过
            property real px: -1
            property real py: -1

            onHoveredChanged: {
                if (hover.hovered)
                    return;
                hover.px = -1;
                root.hoverName = "";
                root.hoverShifted = false;
                root.wobble();
            }
            onPointChanged: {
                if (!hover.hovered)
                    return;
                const sp = hover.point.scenePosition;
                if (Math.abs(sp.x - hover.px) < 1 && Math.abs(sp.y - hover.py) < 1)
                    return;
                hover.px = sp.x;
                hover.py = sp.y;
                root.hoverShifted = false;
                const n = root.bubbleAt(hoverZone.x + hover.point.position.x, hoverZone.y + hover.point.position.y);
                if (n === root.hoverName)
                    return;
                root.hoverName = n;
                root.lean(n);
            }
        }
    }

    // ---------------------------------------------------------------- 点击区（按目标位置；顶栏那一排一直延伸到屏幕边）
    Repeater {
        model: ["time", "audio", "notif", "batt", "card", "prev", "play", "next"]

        MouseArea {
            id: hit

            required property string modelData
            required property int index
            readonly property var b: springs[modelData]
            readonly property bool rowBubble: ["time", "audio", "notif", "batt"].indexOf(modelData) !== -1

            x: root.centerX + b.tx - b.tw / 2 - 3
            y: rowBubble ? 0 : b.ty - 3
            width: b.tw + 6
            height: rowBubble ? b.ty + b.th + 3 : b.th + 6
            z: index
            enabled: root.active && root.shown !== "" && root.shown !== "menu" && b.tw > 4 && b.th > 4
            acceptedButtons: Qt.LeftButton
            cursorShape: Qt.PointingHandCursor
            onClicked: root.tap(root.aimed(modelData))
        }
    }

    // ---------------------------------------------------------------- 气泡
    Item {
        id: bubbles

        anchors.fill: parent
        z: 10

        // 时间
        Bubble {
            b: springs.time
            originX: root.centerX

            Face {
                b: springs.time
                key: "t"

                still: root.reducedMotion

                // peek：时间右边展开日期
                Row {
                    anchors.centerIn: parent
                    anchors.verticalCenterOffset: 0.5

                    P3IslandText {
                        id: timeText

                        anchors.verticalCenter: parent.verticalCenter
                        face: "d"
                        size: 21
                        spacing: 0.005
                        text: Qt.formatTime(clock.date, SettingsData.use24HourClock ? "HH:mm" : "h:mm")
                    }

                    Item {
                        id: dateBox

                        readonly property bool on: root.shown === "peek"

                        anchors.verticalCenter: parent.verticalCenter
                        width: on ? 10 + Math.min(60, dateText.implicitWidth) : 0
                        height: dateText.implicitHeight
                        clip: true

                        Behavior on width {
                            NumberAnimation {
                                duration: root.reducedMotion ? 0 : dateBox.on ? 550 : 450
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: dateBox.on ? P3.soft : P3.ease
                            }
                        }

                        P3IslandText {
                            id: dateText

                            x: 10
                            y: 1.5
                            opacity: dateBox.on ? 1 : 0
                            face: "d"
                            size: 15
                            color: P3.dim
                            text: (clock.date.getMonth() + 1) + "/" + clock.date.getDate()

                            Behavior on opacity {
                                NumberAnimation {
                                    duration: root.reducedMotion ? 0 : dateBox.on ? 300 : 200
                                }
                            }
                        }
                    }
                }
            }
        }

        // 音频：可视化 / 媒体 / OSD / 状态
        Bubble {
            id: audioBubble

            b: springs.audio
            originX: root.centerX

            Face {
                b: springs.audio
                key: "viz"

                still: root.reducedMotion

                P3IslandViz {
                    anchors.centerIn: parent
                    playing: root.anyPlaying
                    reducedMotion: root.reducedMotion
                }
            }

            Face {
                b: springs.audio
                key: "peek"

                still: root.reducedMotion

                Row {
                    x: 13
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 8

                    P3IslandViz {
                        anchors.verticalCenter: parent.verticalCenter
                        playing: root.anyPlaying
                        reducedMotion: root.reducedMotion
                    }

                    TrackText {
                        anchors.verticalCenter: parent.verticalCenter
                        media: root.mediaModel
                        room: springs.audio.tw - 13 - 16 - 8 - 14
                        titleSize: 13
                        gap: 8
                        titleFirst: true
                        artistMin: 30
                    }
                }
            }

            Face {
                b: springs.audio
                key: "media"

                still: root.reducedMotion

                Row {
                    x: 14
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.verticalCenterOffset: -2
                    spacing: 11

                    P3IslandViz {
                        anchors.verticalCenter: parent.verticalCenter
                        playing: root.anyPlaying
                        reducedMotion: root.reducedMotion
                    }

                    TrackText {
                        anchors.verticalCenter: parent.verticalCenter
                        media: root.mediaModel
                        room: springs.audio.tw - 14 - 16 - 11 - 18
                    }
                }

                Progress {
                    value: root.progress
                    still: root.reducedMotion
                    x: 44
                    y: parent.height - 6 - height
                    width: parent.width - 44 - 22
                }
            }

            Face {
                b: springs.audio
                key: "media2"

                still: root.reducedMotion

                Row {
                    x: 18
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.verticalCenterOffset: -4
                    spacing: 13

                    P3IslandViz {
                        anchors.verticalCenter: parent.verticalCenter
                        playing: root.anyPlaying
                        reducedMotion: root.reducedMotion
                    }

                    TrackText {
                        anchors.verticalCenter: parent.verticalCenter
                        media: root.mediaModel
                        room: springs.audio.tw - 18 - 16 - 13 - 22
                        column: true
                        titleSize: 15
                        gap: 2
                    }
                }

                Progress {
                    value: root.progress
                    still: root.reducedMotion
                    x: 50
                    y: parent.height - 9 - height
                    width: parent.width - 50 - 26
                }
            }

            Face {
                b: springs.audio
                key: "osd"

                still: root.reducedMotion

                Level {
                    sys: root.systemModel
                    still: root.reducedMotion
                    x: 13
                    width: parent.width - 13 - 14
                    anchors.verticalCenter: parent.verticalCenter
                }
            }

            Face {
                id: stateFace

                b: springs.audio
                key: "state"

                still: root.reducedMotion

                readonly property var sys: root.systemModel

                Row {
                    id: stateRow

                    x: 13
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 10

                    P3IslandIcon {
                        anchors.verticalCenter: parent.verticalCenter
                        width: 15
                        height: 15
                        name: {
                            switch (stateFace.sys?.kind) {
                            case "capslock":
                                return "caps";
                            case "idleinhibitor":
                                return "eye";
                            case "charging":
                                return "plug";
                            }
                            return "gauge";
                        }
                    }

                    P3IslandText {
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.verticalCenterOffset: 1
                        face: "l"
                        size: 12
                        color: P3.dim
                        text: stateFace.sys?.title ?? ""
                    }

                    P3IslandText {
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.verticalCenterOffset: 1
                        face: "d"
                        size: 16
                        text: stateFace.sys?.displayValue ?? ""
                    }
                }

                readonly property real wanted: 13 + stateRow.implicitWidth + 14 + P3L.OV
                onWantedChanged: {
                    if (root.active && stateFace.sys?.kind && root.controller.systemStateActivities.indexOf(stateFace.sys.kind) !== -1)
                        root.controller.setSystemStateContentLength(stateFace.wanted);
                }
            }
        }

        // 通知计数
        Bubble {
            b: springs.notif
            originX: root.centerX

            Face {
                id: notifFace

                b: springs.notif
                key: "n"

                still: root.reducedMotion

                property int prevCount: root.shownCount

                Row {
                    anchors.centerIn: parent
                    spacing: 3

                    P3IslandIcon {
                        anchors.verticalCenter: parent.verticalCenter
                        width: root.dnd ? 12 : 0
                        height: 10
                        visible: root.dnd
                        name: "moon"
                        color: P3.dim
                    }

                    Item {
                        id: counter

                        anchors.verticalCenter: parent.verticalCenter
                        visible: root.shownCount > 0
                        width: Math.max(9, current.implicitWidth, leaving.opacity > 0 ? leaving.implicitWidth : 0)
                        height: 18
                        clip: true

                        P3IslandText {
                            id: leaving

                            width: parent.width
                            horizontalAlignment: Text.AlignHCenter
                            y: 1
                            opacity: 0
                            face: "d"
                            size: root.shown === "peek" ? 18 : 17
                            color: root.dnd ? P3.dim : P3.fill
                        }

                        P3IslandText {
                            id: current

                            width: parent.width
                            horizontalAlignment: Text.AlignHCenter
                            y: 1
                            face: "d"
                            size: root.shown === "peek" ? 18 : 17
                            color: root.dnd ? P3.dim : P3.fill
                            text: String(root.shownCount)
                        }
                    }
                }

                Connections {
                    target: root

                    function onShownCountChanged() {
                        const old = notifFace.prevCount;
                        notifFace.prevCount = root.shownCount;
                        if (root.reducedMotion || root.committing || old === root.shownCount || !old || !root.shownCount)
                            return;
                        leaving.text = String(old);
                        roll.restart();
                    }
                }

                ParallelAnimation {
                    id: roll

                    NumberAnimation {
                        target: leaving
                        property: "y"
                        from: 1
                        to: -17
                        duration: 300
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.ease
                    }
                    NumberAnimation {
                        target: leaving
                        property: "opacity"
                        from: 1
                        to: 0
                        duration: 300
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.ease
                    }
                    NumberAnimation {
                        target: current
                        property: "y"
                        from: 19
                        to: 1
                        duration: 500
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.spring
                    }
                }

                // 唯一的强调：有还没看过的新通知时右上角一颗红点
                Rectangle {
                    x: parent.width - 4 - width
                    y: 4
                    width: 6
                    height: 6
                    radius: 3
                    color: P3.accent
                    opacity: root.unread ? 1 : 0
                    scale: root.unread ? 1 : 0

                    Behavior on opacity {
                        NumberAnimation {
                            duration: root.reducedMotion ? 0 : 200
                        }
                    }
                    Behavior on scale {
                        NumberAnimation {
                            duration: root.reducedMotion ? 0 : 400
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.spring
                        }
                    }
                }
            }
        }

        // 电量：墨底上一条半透明的海蓝内胶囊 = 电量
        Bubble {
            id: battBubble

            b: springs.batt
            originX: root.centerX

            readonly property string f: springs.batt.face
            readonly property bool chg: f === "chg"
            readonly property bool low: root.batteryLow && !chg
            readonly property bool big: f === "pct" || f === "chg"
            property real lvBase: root.batteryLevel / 100
            readonly property real lv: Math.max(0, Math.min(1, battBubble.lvBase + root.slosh))

            Behavior on lvBase {
                NumberAnimation {
                    duration: root.reducedMotion ? 0 : 900
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.soft
                }
            }

            Rectangle {
                readonly property real w: battBubble.width
                readonly property real inset: Math.max(4, Math.min(4 + (w - 16) * (1 - battBubble.lv), w - (battBubble.chg ? 44 : 24)))

                x: battBubble.low ? 14 : 12
                y: battBubble.low ? 7 : 4
                width: battBubble.low ? 4 : Math.max(0, w - x - inset)
                height: Math.max(0, battBubble.height - 2 * y)
                radius: Math.min(width, height) / 2
                color: battBubble.low ? P3.accent : battBubble.chg ? P3.alpha(P3.fill, 0.45) : P3.alpha(P3.sky, 0.75)
                opacity: battBubble.f === "info" ? 0 : 1

                Behavior on color {
                    ColorAnimation {
                        duration: root.reducedMotion ? 0 : 400
                    }
                }
                Behavior on opacity {
                    NumberAnimation {
                        duration: root.reducedMotion ? 0 : 250
                    }
                }
            }

            Row {
                readonly property real pad: battBubble.low ? 22 : battBubble.chg ? 14 : 8

                anchors.centerIn: parent
                anchors.horizontalCenterOffset: pad / 2
                anchors.verticalCenterOffset: 0.5
                spacing: 2
                opacity: battBubble.f === "" || battBubble.f === "info" ? 0 : 1

                Behavior on opacity {
                    NumberAnimation {
                        duration: root.reducedMotion ? 0 : 200
                    }
                }

                Item {
                    anchors.verticalCenter: parent.verticalCenter
                    width: battBubble.chg ? 13 : 0
                    height: 12
                    clip: true

                    Behavior on width {
                        NumberAnimation {
                            duration: root.reducedMotion ? 0 : 400
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.soft
                        }
                    }

                    P3IslandIcon {
                        width: 10
                        height: 12
                        name: "bolt"
                    }
                }

                P3IslandText {
                    id: battNumber

                    anchors.verticalCenter: parent.verticalCenter
                    face: "d"
                    size: battBubble.big ? 16 : 13
                    text: String(Math.round(root.batteryLevel))

                    Behavior on size {
                        NumberAnimation {
                            duration: root.reducedMotion ? 0 : 450
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.soft
                        }
                    }
                }

                Item {
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.verticalCenterOffset: 1
                    width: battBubble.big ? Math.min(12, percent.implicitWidth) : 0
                    height: percent.height
                    clip: true

                    Behavior on width {
                        NumberAnimation {
                            duration: root.reducedMotion ? 0 : 400
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.ease
                        }
                    }

                    P3IslandText {
                        id: percent

                        face: "l"
                        size: 12
                        spacing: 0
                        color: P3.dim
                        text: "%"
                    }
                }
            }

            // 充电：几颗小气泡往上冒
            Repeater {
                model: [
                    {
                        "at": 0.22,
                        "delay": 0,
                        "size": 4
                    },
                    {
                        "at": 0.48,
                        "delay": 550,
                        "size": 3
                    },
                    {
                        "at": 0.70,
                        "delay": 1100,
                        "size": 4
                    },
                    {
                        "at": 0.86,
                        "delay": 300,
                        "size": 3
                    }
                ]

                Rectangle {
                    id: fizz

                    required property var modelData
                    property real rise: 0
                    readonly property bool running_: battBubble.chg && root.shown === "charging" && !root.reducedMotion

                    x: battBubble.width * modelData.at + rise * 2
                    y: battBubble.height + 4 - height - rise * 26
                    width: modelData.size
                    height: modelData.size
                    radius: width / 2
                    color: "transparent"
                    border.width: 1.2
                    border.color: P3.fill
                    opacity: 0
                    visible: running_

                    SequentialAnimation {
                        running: fizz.running_
                        loops: Animation.Infinite

                        PauseAnimation {
                            duration: fizz.modelData.delay
                        }
                        ParallelAnimation {
                            NumberAnimation {
                                target: fizz
                                property: "rise"
                                from: 0
                                to: 1
                                duration: 1600
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: [0.3, 0.6, 0.5, 1, 1, 1]
                            }
                            SequentialAnimation {
                                NumberAnimation {
                                    target: fizz
                                    property: "opacity"
                                    from: 0
                                    to: 0.9
                                    duration: 320
                                }
                                NumberAnimation {
                                    target: fizz
                                    property: "opacity"
                                    to: 0
                                    duration: 1280
                                }
                            }
                        }
                    }
                }
            }

            // 点电量：气泡横向胀开成电源信息
            Face {
                id: infoFace

                b: springs.batt
                key: "info"
                still: root.reducedMotion

                readonly property var cells: {
                    const secs = BatteryService.estimatedSeconds();
                    const h = Math.floor(secs / 3600);
                    const m = Math.floor(secs % 3600 / 60);
                    const rate = Math.abs(BatteryService.changeRate);
                    const health = parseInt(BatteryService.batteryHealth);
                    return [
                        {
                            "v": String(Math.round(root.batteryLevel)),
                            "u": "%"
                        },
                        {
                            "v": secs > 0 ? h + ":" + String(m).padStart(2, "0") : "--",
                            "u": BatteryService.isCharging ? "full" : "left"
                        },
                        {
                            "v": rate >= 0.05 ? (rate >= 10 ? String(Math.round(rate)) : rate.toFixed(1)) : "0",
                            "u": "W"
                        },
                        {
                            "v": isNaN(health) ? "--" : String(health),
                            "u": "% health"
                        }
                    ];
                }

                Row {
                    anchors.centerIn: parent
                    anchors.horizontalCenterOffset: 5
                    spacing: 16

                    Repeater {
                        model: infoFace.cells

                        Item {
                            id: cell

                            required property var modelData

                            width: value.implicitWidth + 3 + unit.implicitWidth
                            height: value.height

                            P3IslandText {
                                id: value

                                y: 1
                                face: "d"
                                size: 16
                                text: cell.modelData.v
                            }

                            P3IslandText {
                                id: unit

                                x: value.implicitWidth + 3
                                anchors.baseline: value.baseline
                                face: "l"
                                size: 12
                                color: P3.dim
                                text: cell.modelData.u
                            }
                        }
                    }
                }
            }
        }

        // 通知卡（升上来的气泡胀开）/ 展开的音量亮度
        Bubble {
            b: springs.card
            originX: root.centerX

            Face {
                id: cardFace

                b: springs.card
                key: "card"

                still: root.reducedMotion

                readonly property var nm: root.notificationModel

                onOnChanged: {
                    if (cardFace.on)
                        lines.restart();
                    else
                        linesOut.restart();
                }

                Row {
                    x: 16
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 12

                    P3IslandAppIcon {
                        anchors.verticalCenter: parent.verticalCenter
                        size: 32
                        radius: 16
                        image: cardFace.nm?.imageSource ?? ""
                        iconName: cardFace.nm?.fallbackIcon ?? ""
                        label: cardFace.nm?.appName ?? ""
                    }

                    Column {
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.verticalCenterOffset: 1
                        width: springs.card.tw - 16 - 32 - 12 - 22
                        spacing: 0

                        Row {
                            id: cardHead

                            spacing: 8
                            opacity: 0
                            property real shift: -10
                            transform: Translate {
                                x: cardHead.shift
                            }

                            P3IslandText {
                                id: cardApp

                                face: "zh"
                                size: 12
                                spacing: 0.1
                                color: P3.fill
                                text: cardFace.nm?.appName ?? ""
                            }

                            P3IslandText {
                                anchors.baseline: cardApp.baseline
                                face: "d"
                                size: 12
                                color: P3.dim
                                text: cardFace.nm?.timeText ?? ""
                            }
                        }

                        P3IslandText {
                            id: cardTitle

                            property real shift: -10

                            width: parent.width
                            opacity: 0
                            transform: Translate {
                                x: cardTitle.shift
                            }
                            face: "zh"
                            size: 14
                            elide: Text.ElideRight
                            text: (cardFace.nm?.summary ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ")
                        }

                        P3IslandText {
                            id: cardBody

                            property real shift: -10

                            width: parent.width
                            opacity: 0
                            transform: Translate {
                                x: cardBody.shift
                            }
                            face: "zh"
                            size: 12
                            color: P3.dim
                            elide: Text.ElideRight
                            text: (cardFace.nm?.body ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ")
                        }
                    }
                }

                ParallelAnimation {
                    id: lines

                    SequentialAnimation {
                        PauseAnimation {
                            duration: root.reducedMotion ? 0 : 100
                        }
                        ParallelAnimation {
                            NumberAnimation {
                                target: cardHead
                                property: "opacity"
                                to: 1
                                duration: root.reducedMotion ? 0 : 300
                            }
                            NumberAnimation {
                                target: cardHead
                                property: "shift"
                                to: 0
                                duration: root.reducedMotion ? 0 : 500
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: P3.spring
                            }
                        }
                    }
                    SequentialAnimation {
                        PauseAnimation {
                            duration: root.reducedMotion ? 0 : 160
                        }
                        ParallelAnimation {
                            NumberAnimation {
                                target: cardTitle
                                property: "opacity"
                                to: 1
                                duration: root.reducedMotion ? 0 : 300
                            }
                            NumberAnimation {
                                target: cardTitle
                                property: "shift"
                                to: 0
                                duration: root.reducedMotion ? 0 : 500
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: P3.spring
                            }
                        }
                    }
                    SequentialAnimation {
                        PauseAnimation {
                            duration: root.reducedMotion ? 0 : 220
                        }
                        ParallelAnimation {
                            NumberAnimation {
                                target: cardBody
                                property: "opacity"
                                to: 1
                                duration: root.reducedMotion ? 0 : 300
                            }
                            NumberAnimation {
                                target: cardBody
                                property: "shift"
                                to: 0
                                duration: root.reducedMotion ? 0 : 500
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: P3.spring
                            }
                        }
                    }
                }

                ParallelAnimation {
                    id: linesOut

                    NumberAnimation {
                        targets: [cardHead, cardTitle, cardBody]
                        property: "opacity"
                        to: 0
                        duration: root.reducedMotion ? 0 : 150
                    }
                    NumberAnimation {
                        targets: [cardHead, cardTitle, cardBody]
                        property: "shift"
                        to: -10
                        duration: root.reducedMotion ? 0 : 200
                    }
                }
            }

            Face {
                b: springs.card
                key: "level"

                still: root.reducedMotion

                Level {
                    sys: root.systemModel
                    still: root.reducedMotion
                    x: 18
                    width: parent.width - 18 - 22
                    anchors.verticalCenter: parent.verticalCenter
                    iconSize: 20
                    barHeight: 10
                    numberSize: 22
                    gap: 14
                    minNumber: 34
                }
            }
        }

        // 媒体控制小气泡
        Bubble {
            b: springs.prev
            originX: root.centerX

            Face {
                b: springs.prev
                key: "k"

                still: root.reducedMotion

                P3IslandIcon {
                    anchors.centerIn: parent
                    width: 12
                    height: 12
                    name: "prev"
                    color: P3.tx
                }
            }
        }

        Bubble {
            b: springs.play
            originX: root.centerX

            Face {
                b: springs.play
                key: "k"

                still: root.reducedMotion

                P3IslandIcon {
                    anchors.centerIn: parent
                    width: 14
                    height: 14
                    name: root.playing ? "pause" : "play"
                }
            }
        }

        Bubble {
            b: springs.next
            originX: root.centerX

            Face {
                b: springs.next
                key: "k"

                still: root.reducedMotion

                P3IslandIcon {
                    anchors.centerIn: parent
                    width: 12
                    height: 12
                    name: "next"
                    color: P3.tx
                }
            }
        }

        // 通知中心：从计数气泡垂下来的面板
        Bubble {
            id: panelBubble

            b: springs.panel
            originX: root.centerX

            // 面板里的空白处不算点到岛上
            MouseArea {
                anchors.fill: parent
                enabled: root.shown === "center"
                acceptedButtons: Qt.LeftButton | Qt.RightButton
            }

            Face {
                b: springs.panel
                key: "nc"

                still: root.reducedMotion
                offLift: -6
                offScale: 1

                Loader {
                    id: centerLoader

                    x: Math.round((parent.width - P3L.NC.w) / 2)
                    active: root.mode === "center" || springs.panel.w > 2
                    sourceComponent: P3IslandCenter {
                        controller: root.controller
                        live: root.shown === "center"
                        reducedMotion: root.reducedMotion
                        surfaceColor: root.surfaceColor
                    }
                }
            }
        }
    }

    // 波纹、小气泡
    Item {
        id: effects

        anchors.fill: parent
        z: 20
    }
}
