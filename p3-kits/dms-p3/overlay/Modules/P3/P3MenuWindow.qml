import QtQuick
import Quickshell
import Quickshell.Wayland
import qs.Services
import qs.P3Sys

// P3 全屏菜单窗口（原型 menu-x.html + shared/menu.js 的框架部分）。
// 由 P3Menu 单例按需创建；开在当前聚焦的屏幕上，Overlay 层，显示期间独占键盘。
// 舞台是 1920×1080 原型像素，按 cover 缩放铺满屏幕。
PanelWindow {
    id: win

    property bool shouldShow: false
    // "closed" | "opening" | "open" | "closing"
    property string phase: "closed"
    readonly property bool busy: phase === "opening" || phase === "closing"
    readonly property bool still: Quickshell.env("P3_STILL") === "1"

    readonly property var items: [
        {
            "id": "apps",
            "t": "APPS",
            "x": 1190,
            "y": 238,
            "r": -12,
            "c": "c1",
            "file": "AppsPage.qml"
        },
        {
            "id": "status",
            "t": "STATUS",
            "x": 1138,
            "y": 376,
            "r": -6,
            "c": "c4",
            "file": "StatusPage.qml"
        },
        {
            "id": "calendar",
            "t": "CALENDAR",
            "x": 1088,
            "y": 512,
            "r": -8,
            "c": "c2",
            "file": "CalendarPage.qml"
        },
        {
            "id": "system",
            "t": "SYSTEM",
            "x": 1068,
            "y": 648,
            "r": -3,
            "c": "c1",
            "file": "SystemPage.qml"
        },
        {
            "id": "power",
            "t": "POWER",
            "x": 1030,
            "y": 784,
            "r": 4,
            "c": "c4",
            "file": "PowerPage.qml"
        }
    ]
    property int cur: 0
    property string page: ""          // 打开的页面 id，空 = 主列表
    readonly property bool paged: page !== ""
    property var focusEl: null
    property var ctx: null

    visible: false
    color: "transparent"

    WlrLayershell.namespace: "dms:p3-menu"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.exclusiveZone: -1
    // 收起动画开始时就交还键盘
    WlrLayershell.keyboardFocus: shouldShow ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None

    anchors {
        top: true
        bottom: true
        left: true
        right: true
    }

    function indexOf(id) {
        for (let i = 0; i < items.length; i++)
            if (items[i].id === id)
                return i;
        return -1;
    }

    // ================================================================ 打开 / 关闭
    function open(pageId) {
        const scr = CompositorService.getFocusedScreen() ?? Quickshell.screens[0];
        if (scr && screen !== scr && !visible)
            screen = scr;
        closeT.stop();
        openT.stop();
        pageOpenT.stop();
        const wasShown = shouldShow;
        shouldShow = true;
        visible = true;
        keys.forceActiveFocus();
        if (!wasShown) {
            if (page)
                dropPage(true);
            select(pageId ? Math.max(0, indexOf(pageId)) : 0, true);
            playOpen();
        }
        if (pageId) {
            if (still || wasShown)
                openPage(pageId);
            else {
                pendingPage = pageId;
                pageOpenT.restart();
            }
        }
    }
    property string pendingPage: ""
    Timer {
        id: pageOpenT
        interval: 650
        onTriggered: {
            win.phase = "open";
            win.openPage(win.pendingPage);
        }
    }

    function close() {
        if (!shouldShow)
            return;
        if (page)
            leaveHook();
        shouldShow = false;
        pageOpenT.stop();
        openT.stop();
        phase = "closing";
        for (let i = 0; i < menuRep.count; i++)
            menuRep.itemAt(i).playOut();
        page = "";
        dateOut.restart();
        tideOut.restart();
        closeT.interval = still ? 0 : 720;
        closeT.restart();
    }
    function toggle() {
        if (shouldShow)
            close();
        else
            open("");
    }
    Timer {
        id: closeT
        onTriggered: {
            win.phase = "closed";
            win.dropPage(true);
            win.visible = false;
        }
    }

    function playOpen() {
        dateOut.stop();
        tideOut.stop();
        if (still) {
            water.tide = 1;
            water.rise = 0;
            dateIn.opacity = 1;
            dateIn.dy = 0;
            for (let i = 0; i < menuRep.count; i++)
                menuRep.itemAt(i).playIn();
            phase = "open";
            return;
        }
        phase = "opening";
        water.tide = 0;
        water.rise = 1;
        dateIn.opacity = 0;
        dateIn.dy = -60;
        tideIn.restart();
        dateDrop.restart();
        for (let i = 0; i < menuRep.count; i++)
            menuRep.itemAt(i).playIn();
        openT.restart();
    }
    Timer {
        id: openT
        interval: 1300
        onTriggered: if (win.phase === "opening")
            win.phase = "open"
    }

    // ================================================================ 主列表
    function select(i, force) {
        i = (i + items.length) % items.length;
        if (i === cur && !force)
            return;
        cur = i;
    }
    function confirmItem() {
        const it = items[cur];
        const el = menuRep.itemAt(cur);
        if (el)
            el.hit();
        if (page === it.id)
            return;
        openPage(it.id);
    }

    // ================================================================ 页面
    function openPage(id) {
        const i = indexOf(id);
        if (i < 0)
            return false;
        select(i, true);
        const swap = page !== "";
        if (swap)
            leaveHook();
        page = id;
        if (swap && !still) {
            swapOut.restart();
            swapT.pendingFile = items[i].file;
            swapT.restart();
        } else {
            loadPage(items[i].file);
        }
        return true;
    }
    Timer {
        id: swapT
        property string pendingFile: ""
        interval: 150
        onTriggered: win.loadPage(pendingFile)
    }

    function loadPage(file) {
        focusEl = null;
        ctx = null;
        tide.on = false;
        wedge.on = false;
        pageLoader.source = "";
        pageLoader.setSource(Qt.resolvedUrl("pages/" + file), {});
        headTitle.text = pageLoader.item && pageLoader.item.title ? pageLoader.item.title : items[cur].t;
        playEnter();
    }

    function makeCtx(id, pg) {
        const c = {};
        const live = () => win.page === id && win.ctx === c && pageLoader.item === pg;
        c.still = still;
        Object.defineProperty(c, "live", {
            "get": live
        });
        Object.defineProperty(c, "overlay", {
            "get": () => live() ? overlay : null
        });
        c.back = () => {
            if (live())
                closePage();
        };
        c.focus = el => {
            if (live())
                setFocus(el, false);
        };
        c.focused = () => live() ? focusEl : null;
        c.refocus = () => {
            if (live())
                placeCursor(true);
        };
        c.toast = (text, bad) => {
            if (live())
                toast.show(text, bad);
        };
        c.run = (p, opts) => {
            opts = opts || {};
            if (!p || typeof p.then !== "function") {
                if (opts.done)
                    opts.done(true);
                return p;
            }
            p.then(r => {
                if (live() && r && r.msg)
                    toast.show(r.msg, false);
                if (opts.done)
                    opts.done(true, r);
            }, err => {
                if (live())
                    toast.show((err && err.message) || "失败", true);
                if (opts.revert)
                    opts.revert(err);
                if (opts.done)
                    opts.done(false, err);
            });
            return p;
        };
        return c;
    }

    function onPageLoaded() {
        const pg = pageLoader.item;
        if (!pg)
            return;
        if (pg.p3page !== true)
            console.warn("p3menu: " + pageLoader.source + " 的根元素不是 P3Page");
        headTitle.text = pg.title || items[cur].t;
        ctx = makeCtx(page, pg);
        pg._host = win;
        pg.ctx = ctx;
        // 等一帧让 Repeater / 布局就位再取初始焦点
        Qt.callLater(() => {
            if (pageLoader.item !== pg)
                return;
            const all = focusables();
            let first = null;
            for (let k = 0; k < all.length && !first; k++)
                if (all[k].autofocus)
                    first = all[k];
            if (!first && all.length)
                first = all[0];
            if (first)
                setFocus(first, true);
            try {
                pg.entered();
            } catch (err) {
                console.warn("p3menu: onEntered 出错 " + err);
            }
        });
    }

    function leaveHook() {
        const pg = pageLoader.item;
        if (focusEl && focusEl.p3hold === true)
            focusEl.cancel();
        if (pg) {
            try {
                pg.leaving();
            } catch (err) {
                console.warn("p3menu: onLeaving 出错 " + err);
            }
        }
        ctx = null;
    }
    function closePage() {
        if (!page)
            return;
        leaveHook();
        page = "";
        clearFocus();
        swapT.stop();
        pageOut.restart();
    }
    // 不播动画直接卸掉页面（关闭菜单 / 重新打开时）
    function dropPage(silent) {
        if (page && !silent)
            leaveHook();
        page = "";
        clearFocus();
        swapT.stop();
        pageOut.stop();
        pageLoader.source = "";
        pageBox.opacity = 1;
        pageBox.dx = 0;
    }
    function clearFocus() {
        if (focusEl)
            focusEl.focused = false;
        focusEl = null;
        tide.on = false;
        wedge.on = false;
    }

    // ================================================================ 焦点引擎
    function focusables() {
        const out = [];
        const root = pageLoader.item;
        if (!root)
            return out;
        const walk = n => {
            const kids = n.children;
            for (let i = 0; i < kids.length; i++) {
                const c = kids[i];
                if (!c || !c.visible || c.opacity <= 0)
                    continue;
                if (c.p3focusable === true && !c.disabled && c.width > 0 && c.height > 0)
                    out.push(c);
                walk(c);
            }
        };
        walk(root);
        return out;
    }
    function boxOf(el) {
        const p = el.mapToItem(bodyRoot, 0, 0);
        return {
            "x": p.x,
            "y": p.y,
            "w": el.width,
            "h": el.height
        };
    }
    // 焦点在 Flickable / ListView 里时把它滚进可视区
    function ensureVisible(el) {
        for (let n = el.parent; n && n !== pageLoader.item; n = n.parent) {
            if (n.contentItem !== undefined && n.contentY !== undefined && n.flickableDirection !== undefined) {
                const p = el.mapToItem(n.contentItem, 0, 0);
                if (n.contentHeight > n.height) {
                    if (p.y < n.contentY)
                        n.contentY = Math.max(0, p.y - 8);
                    else if (p.y + el.height > n.contentY + n.height)
                        n.contentY = Math.min(n.contentHeight - n.height, p.y + el.height - n.height + 8);
                }
                if (n.contentWidth > n.width) {
                    if (p.x < n.contentX)
                        n.contentX = Math.max(0, p.x - 8);
                    else if (p.x + el.width > n.contentX + n.width)
                        n.contentX = Math.min(n.contentWidth - n.width, p.x + el.width - n.width + 8);
                }
            }
        }
    }
    function placeCursor(instant) {
        if (!focusEl || !page) {
            tide.on = false;
            wedge.on = false;
            return;
        }
        const b = boxOf(focusEl);
        const mode = focusEl.cursor;
        const use = mode === "wedge" ? wedge : mode === "none" ? null : tide;
        if (use !== tide)
            tide.on = false;
        if (use !== wedge)
            wedge.on = false;
        if (!use)
            return;
        cursorSnap = instant || still;
        use.x = b.x;
        use.y = b.y;
        use.width = b.w;
        use.height = b.h;
        use.on = true;
        cursorSnap = false;
    }
    property bool cursorSnap: false

    function wob(el) {
        if (still || !el)
            return;
        if (wobT.el && wobT.el !== el)
            wobT.el.wob = false;
        wobT.el = el;
        el.wob = false;
        el.wob = true;
        if (el.cursor === "tide" || (el.cursor !== "wedge" && el.cursor !== "none"))
            tide.popSerial++;
        wobT.restart();
    }
    Timer {
        id: wobT
        property var el: null
        interval: 380
        onTriggered: {
            if (el)
                el.wob = false;
            el = null;
        }
    }

    function setFocus(el, instant) {
        if (!el) {
            return;
        }
        if (el === focusEl) {
            placeCursor(instant);
            return;
        }
        if (focusEl)
            focusEl.focused = false;
        focusEl = el;
        el.focused = true;
        ensureVisible(el);
        if (!instant && !still) {
            wedge.moving = true;
            wedge.moving = false;
            wob(el);
        }
        placeCursor(instant || still);
        const pg = pageLoader.item;
        if (pg && ctx) {
            try {
                pg.focusMoved(el);
            } catch (err) {
                console.warn("p3menu: onFocusMoved 出错 " + err);
            }
        }
    }

    function move(dir) {
        const all = focusables();
        if (!all.length)
            return false;
        if (!focusEl || all.indexOf(focusEl) < 0) {
            setFocus(all[0], false);
            return true;
        }
        const a = boxOf(focusEl);
        const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
        let best = null, bestS = Infinity;
        for (const el of all) {
            if (el === focusEl)
                continue;
            const b = boxOf(el);
            const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
            let prim, orth;
            if (dir === "down" || dir === "up") {
                prim = dir === "down" ? b.y - (a.y + a.h) : a.y - (b.y + b.h);
                const c = dir === "down" ? bcy - acy : acy - bcy;
                if (c <= 2)
                    continue;
                prim = Math.max(prim, 0);
                orth = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
                orth += Math.abs(bcx - acx) * 0.1;
            } else {
                prim = dir === "right" ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
                const c = dir === "right" ? bcx - acx : acx - bcx;
                if (c <= 2)
                    continue;
                prim = Math.max(prim, 0);
                orth = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
                orth += Math.abs(bcy - acy) * 0.1;
            }
            const s = prim + orth * 3;
            if (s < bestS) {
                bestS = s;
                best = el;
            }
        }
        if (best) {
            setFocus(best, false);
            return true;
        }
        return false;
    }

    function activate(el) {
        if (!el || el.disabled)
            return;
        el.pressed = false;
        el.pressed = true;
        pressT.el = el;
        pressT.restart();
        if (el.cursor === "wedge")
            wedge.popSerial++;
        else if (el.cursor !== "none")
            tide.popSerial++;
        el.activated();
    }
    Timer {
        id: pressT
        property var el: null
        interval: 260
        onTriggered: {
            if (el)
                el.pressed = false;
            el = null;
        }
    }

    // P3Focusable 被单击时（经 P3Page._pointerFocus）调用
    function pointerFocus(pg, el, doActivate) {
        if (pg !== pageLoader.item || !page || !el || el.disabled)
            return;
        if (focusEl && focusEl.p3hold === true && focusEl !== el)
            focusEl.cancel();
        setFocus(el, false);
        if (doActivate)
            activate(el);
    }

    // 页面打开期间定时重测焦点框（入场动画、滚动、布局变化后指示器跟上）
    Timer {
        interval: 120
        repeat: true
        running: win.visible && win.paged && win.focusEl !== null
        onTriggered: {
            if (!win.focusEl || !win.focusEl.visible || win.focusEl.disabled) {
                // 焦点元素没了：退到第一个
                const all = win.focusables();
                if (all.length)
                    win.setFocus(all[0], false);
                else
                    win.clearFocus();
                return;
            }
            const b = win.boxOf(win.focusEl);
            const use = win.focusEl.cursor === "wedge" ? wedge : tide;
            if (Math.abs(use.x - b.x) > 0.5 || Math.abs(use.y - b.y) > 0.5 || Math.abs(use.width - b.w) > 0.5 || Math.abs(use.height - b.h) > 0.5)
                win.placeCursor(false);
        }
    }

    // ================================================================ 按键
    function pageKey(e) {
        const pg = pageLoader.item;
        if (pg) {
            let r = false;
            try {
                r = pg.handleKey(e);
            } catch (err) {
                console.warn("p3menu: handleKey 出错 " + err);
            }
            if (r)
                return true;
        }
        return false;
    }
    // 页面 keyCapture 为 true 时：所有按下（含 Ctrl / Alt / Meta 组合、单独的修饰键、自动重复）原样交给 handleKey，
    // 框架不导航；松开全部吞掉；ShortcutInhibitor 让合成器把 Mod 组合也交给窗口。
    readonly property bool capturing: paged && !!pageLoader.item && pageLoader.item.keyCapture === true
    function onKeyPressed(e) {
        if (capturing) {
            e.accepted = true;
            pageKey(e);
            return;
        }
        if (e.modifiers & (Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier))
            return;
        if (page && pageKey(e)) {
            e.accepted = true;
            return;
        }
        const k = e.key;
        if (busy && !page) {
            e.accepted = true;
            return;
        }
        e.accepted = true;
        if (page) {
            const f = focusEl;
            if (f && f.keyHandler && f.keyHandler(e))
                return;
            switch (k) {
            case Qt.Key_Escape:
            case Qt.Key_Backspace:
                closePage();
                return;
            case Qt.Key_Up:
            case Qt.Key_W:
                move("up");
                return;
            case Qt.Key_Down:
            case Qt.Key_S:
                move("down");
                return;
            case Qt.Key_Left:
            case Qt.Key_A:
                if (!move("left"))
                    closePage();
                return;
            case Qt.Key_Right:
            case Qt.Key_D:
                move("right");
                return;
            case Qt.Key_Return:
            case Qt.Key_Enter:
            case Qt.Key_Space:
                if (!f || e.isAutoRepeat)
                    return;
                if (f.p3hold === true) {
                    f.start();
                    return;
                }
                activate(f);
                return;
            }
            e.accepted = false;
            return;
        }
        switch (k) {
        case Qt.Key_Down:
        case Qt.Key_S:
        case Qt.Key_Tab:
            select(cur + 1);
            return;
        case Qt.Key_Up:
        case Qt.Key_W:
        case Qt.Key_Backtab:
            select(cur - 1);
            return;
        case Qt.Key_Return:
        case Qt.Key_Enter:
        case Qt.Key_Space:
        case Qt.Key_Right:
        case Qt.Key_D:
            confirmItem();
            return;
        case Qt.Key_Escape:
            close();
            return;
        }
        e.accepted = false;
    }
    function onKeyReleased(e) {
        if (capturing) {
            e.accepted = true;
            return;
        }
        if ((e.key === Qt.Key_Return || e.key === Qt.Key_Enter || e.key === Qt.Key_Space) && !e.isAutoRepeat && focusEl && focusEl.p3hold === true)
            focusEl.cancel();
    }
    // 右键：页面打开时先交给 handleRightClick({ x, y, item })（页面坐标；item 是指针下最上层的可聚焦元素或 null），
    // 返回 true 表示已处理；否则等同返回（back）。
    function rightClick(sx, sy) {
        const pg = pageLoader.item;
        if (page && pg && ctx) {
            const p = stage.mapToItem(pg, sx, sy);
            let hit = null;
            for (const el of focusables()) {
                const q = el.mapFromItem(pg, p.x, p.y);
                if (q.x >= 0 && q.y >= 0 && q.x < el.width && q.y < el.height)
                    hit = el;
            }
            let r = false;
            try {
                r = pg.handleRightClick({
                    "x": p.x,
                    "y": p.y,
                    "item": hit
                });
            } catch (err) {
                console.warn("p3menu: handleRightClick 出错 " + err);
            }
            if (r)
                return;
        }
        back();
    }
    function back() {
        if (busy && !page)
            return;
        if (page) {
            if (pageKey({
                "key": Qt.Key_Escape,
                "text": "",
                "modifiers": 0,
                "isAutoRepeat": false,
                "synthetic": true,
                "accepted": false
            }))
                return;
            closePage();
        } else {
            close();
        }
    }

    // ================================================================ 画面
    Rectangle {
        anchors.fill: parent
        color: P3.stageBg
        opacity: water.tide
    }

    ShortcutInhibitor {
        window: win
        enabled: win.capturing
    }

    FocusScope {
        id: keys
        anchors.fill: parent
        focus: true
        Keys.onPressed: e => win.onKeyPressed(e)
        Keys.onReleased: e => win.onKeyReleased(e)

        Item {
            id: stage
            readonly property real s: Math.max(win.width / P3.stageW, win.height / P3.stageH)
            width: P3.stageW
            height: P3.stageH
            x: (win.width - P3.stageW * s) / 2
            y: (win.height - P3.stageH * s) / 2
            transform: Scale {
                xScale: stage.s
                yScale: stage.s
            }
            clip: true

            P3Water {
                id: water
                still: win.still
                running: win.visible
                property real diveT: win.paged ? 1 : 0
                dive: diveT
                Behavior on diveT {
                    enabled: !win.still
                    NumberAnimation {
                        duration: 900
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.ease
                    }
                }
            }
            ParallelAnimation {
                id: tideIn
                NumberAnimation {
                    target: water
                    property: "tide"
                    from: 0
                    to: 1
                    duration: 800
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
                NumberAnimation {
                    target: water
                    property: "rise"
                    from: 1
                    to: 0
                    duration: 900
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
            SequentialAnimation {
                id: tideOut
                PauseAnimation {
                    duration: win.still ? 0 : 180
                }
                NumberAnimation {
                    target: water
                    property: "tide"
                    to: 0
                    duration: win.still ? 0 : 500
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: [0.6, 0, 0.8, 0.4, 1, 1]
                }
            }

            // ------------------------------------------------------------ 日期块（.date）
            Item {
                id: date
                z: 4
                x: P3.stageW - 130 - width
                y: 54
                width: dateCol.implicitWidth
                height: dateCol.implicitHeight
                readonly property color fg: win.paged ? P3.tx : P3.ink
                transform: Scale {
                    origin.x: date.width
                    origin.y: 0
                    xScale: dateScale.v
                    yScale: dateScale.v
                }
                QtObject {
                    id: dateScale
                    property real v: win.paged ? 0.56 : 1
                    Behavior on v {
                        enabled: !win.still
                        NumberAnimation {
                            duration: 700
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.ease
                        }
                    }
                }
                Item {
                    id: dateIn
                    property real dy: 0
                    width: parent.width
                    height: parent.height
                    transform: Translate {
                        y: dateIn.dy
                    }
                    Column {
                        id: dateCol
                        anchors.right: parent.right
                        spacing: 8
                        Row {
                            anchors.right: parent.right
                            spacing: 6
                            P3Text {
                                kind: "title"
                                lineBox: true
                                font.pixelSize: 112
                                font.letterSpacing: -2.2
                                text: Clock.state.month + "/" + Clock.state.day
                                color: date.fg
                                Behavior on color {
                                    ColorAnimation {
                                        duration: 300
                                    }
                                }
                            }
                            P3Text {
                                kind: "title"
                                lineBox: true
                                font.pixelSize: 58
                                font.letterSpacing: -0.6
                                anchors.baseline: parent.children[0].baseline
                                text: Clock.state.dow
                                color: date.fg
                            }
                        }
                        Row {
                            anchors.right: parent.right
                            spacing: 14
                            Rectangle {
                                width: todT.implicitWidth + 24
                                height: todT.implicitHeight + 11
                                color: win.paged ? P3.fill : P3.ink
                                anchors.verticalCenter: parent.verticalCenter
                                P3Text {
                                    id: todT
                                    x: 12
                                    y: 6
                                    kind: "label"
                                    font.pixelSize: 18
                                    font.letterSpacing: 2.5
                                    text: Clock.state.tod
                                    color: win.paged ? P3.ink : P3.fill
                                }
                            }
                            P3Text {
                                kind: "label"
                                font.pixelSize: 22
                                font.letterSpacing: 2.2
                                anchors.verticalCenter: parent.verticalCenter
                                text: (Clock.state.h < 10 ? "0" : "") + Clock.state.h + ":" + (Clock.state.m < 10 ? "0" : "") + Clock.state.m
                                color: date.fg
                            }
                        }
                    }
                }
            }
            ParallelAnimation {
                id: dateDrop
                SequentialAnimation {
                    PauseAnimation {
                        duration: 280
                    }
                    ParallelAnimation {
                        NumberAnimation {
                            target: dateIn
                            property: "opacity"
                            to: 1
                            duration: 300
                        }
                        NumberAnimation {
                            target: dateIn
                            property: "dy"
                            to: 0
                            duration: 700
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.spring
                        }
                    }
                }
            }
            ParallelAnimation {
                id: dateOut
                NumberAnimation {
                    target: dateIn
                    property: "opacity"
                    to: 0
                    duration: win.still ? 0 : 350
                }
                NumberAnimation {
                    target: dateIn
                    property: "dy"
                    to: -50
                    duration: win.still ? 0 : 350
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }

            // ------------------------------------------------------------ 主列表 / rail（#menu）
            Item {
                id: menu
                z: 3
                anchors.fill: parent
                Repeater {
                    id: menuRep
                    model: win.items
                    delegate: P3MenuItem {
                        required property var modelData
                        required property int index
                        it: modelData
                        slot: index
                        count: win.items.length
                        on: index === win.cur
                        paged: win.paged
                        still: win.still
                        onClicked: {
                            if (win.busy)
                                return;
                            win.select(index, true);
                            win.confirmItem();
                        }
                    }
                }
            }

            // ------------------------------------------------------------ 页面面板（#pg）
            Item {
                id: pageBox
                z: 3
                anchors.fill: parent
                visible: pageLoader.status !== Loader.Null
                property real dx: 0
                transform: Translate {
                    x: pageBox.dx
                }

                // 标题 + 分隔线（.pg-head）
                Item {
                    id: head
                    x: P3.pageX
                    y: P3.headY
                    width: P3.pageW
                    height: P3.headH
                    P3Text {
                        id: headTitle
                        property real dx: 0
                        kind: "title"
                        lineBox: true
                        x: dx
                        anchors.bottom: parent.bottom
                        anchors.bottomMargin: 22
                        color: P3.tx
                    }
                    Rectangle {
                        id: rule
                        property real k: 1
                        anchors.bottom: parent.bottom
                        width: parent.width * k
                        height: 2
                        color: P3.line
                        Rectangle {
                            y: -2
                            width: 120
                            height: 6
                            color: P3.fill
                        }
                    }
                }

                // 正文 1410×680（.pg-body）：reveal 从左向右展开
                Item {
                    id: bodyClip
                    x: P3.pageX
                    y: P3.pageY
                    property real k: 1
                    width: P3.pageW * k
                    height: P3.pageH
                    clip: true
                    Item {
                        id: bodyRoot
                        width: P3.pageW
                        height: P3.pageH

                        P3Wedge {
                            id: wedge
                            z: 0
                            Behavior on x {
                                enabled: !win.cursorSnap
                                NumberAnimation {
                                    duration: 260
                                    easing.type: Easing.BezierSpline
                                    easing.bezierCurve: P3.soft
                                }
                            }
                            Behavior on y {
                                enabled: !win.cursorSnap
                                NumberAnimation {
                                    duration: 260
                                    easing.type: Easing.BezierSpline
                                    easing.bezierCurve: P3.soft
                                }
                            }
                            Behavior on width {
                                enabled: !win.cursorSnap
                                NumberAnimation {
                                    duration: 260
                                    easing.type: Easing.BezierSpline
                                    easing.bezierCurve: P3.soft
                                }
                            }
                            Behavior on height {
                                enabled: !win.cursorSnap
                                NumberAnimation {
                                    duration: 260
                                    easing.type: Easing.BezierSpline
                                    easing.bezierCurve: P3.soft
                                }
                            }
                        }
                        Item {
                            id: pageRise
                            z: 1
                            width: P3.pageW
                            height: P3.pageH
                            property real dy: 0
                            transform: Translate {
                                y: pageRise.dy
                            }
                            Loader {
                                id: pageLoader
                                width: P3.pageW
                                height: P3.pageH
                                asynchronous: false
                                onLoaded: win.onPageLoaded()
                                onStatusChanged: if (status === Loader.Error)
                                    console.warn("p3menu: 页面加载失败 " + source)
                            }
                        }
                        P3Tide {
                            id: tide
                            z: 3
                            still: win.still
                            Behavior on x {
                                enabled: !win.cursorSnap
                                NumberAnimation {
                                    duration: 260
                                    easing.type: Easing.BezierSpline
                                    easing.bezierCurve: P3.soft
                                }
                            }
                            Behavior on y {
                                enabled: !win.cursorSnap
                                NumberAnimation {
                                    duration: 260
                                    easing.type: Easing.BezierSpline
                                    easing.bezierCurve: P3.soft
                                }
                            }
                        }
                    }
                }

                // 斜切白条扫过（.pg-wipe）
                Rectangle {
                    id: wipe
                    z: 5
                    y: 70
                    width: 240
                    height: 900
                    color: P3.fill
                    visible: false
                    property real tx: 2400
                    transform: [
                        Matrix4x4 {
                            // skewX(-14deg)，以元素中心为原点：x' = x - tan14° × (y - 450)，上端偏右
                            matrix: Qt.matrix4x4(1, -Math.tan(14 * Math.PI / 180), 0, Math.tan(14 * Math.PI / 180) * 450, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
                        },
                        Translate {
                            x: wipe.tx
                        }
                    ]
                }
            }

            // 全舞台层（ctx.overlay）：1920×1080 舞台坐标，盖住主列表、页面和日期，在提示条之下。
            // 页面把自己声明的元素挂上来（el.parent = ctx.overlay），随页面一起销毁。
            Item {
                id: overlay
                z: 8
                anchors.fill: parent
            }

            // 提示条（ctx.run / ctx.toast），在全舞台层之上
            Rectangle {
                id: toast
                z: 9
                x: P3.pageX
                y: P3.pageY + P3.pageH + 28
                width: Math.min(P3.pageW, toastText.implicitWidth + 40)
                height: 44
                property bool bad: false
                color: bad ? P3.accent : P3.fill
                opacity: 0
                visible: opacity > 0
                function show(text, isBad) {
                    toastText.text = text;
                    bad = !!isBad;
                    toastAnim.restart();
                }
                P3Text {
                    id: toastText
                    anchors.verticalCenter: parent.verticalCenter
                    x: 20
                    kind: "zh"
                    color: toast.bad ? "#ffffff" : P3.ink
                }
                SequentialAnimation {
                    id: toastAnim
                    NumberAnimation {
                        target: toast
                        property: "opacity"
                        to: 1
                        duration: 120
                    }
                    PauseAnimation {
                        duration: 2600
                    }
                    NumberAnimation {
                        target: toast
                        property: "opacity"
                        to: 0
                        duration: 300
                    }
                }
            }

            // 右键 = 页面的 handleRightClick，否则返回（左键穿透给下面的控件）
            MouseArea {
                z: 10
                anchors.fill: parent
                acceptedButtons: Qt.RightButton
                onClicked: e => win.rightClick(e.x, e.y)
            }
            // 主列表滚轮切换
            WheelHandler {
                enabled: !win.paged && !win.busy
                property real lock: 0
                onWheel: e => {
                    const now = Date.now();
                    if (now < lock)
                        return;
                    lock = now + 90;
                    win.select(win.cur + (e.angleDelta.y < 0 ? 1 : -1));
                }
            }
        }
    }

    // ================================================================ 页面入场 / 退场
    function playEnter() {
        pageOut.stop();
        swapOut.stop();
        pageBox.opacity = 1;
        pageBox.dx = 0;
        if (still) {
            bodyClip.k = 1;
            rule.k = 1;
            headTitle.opacity = 1;
            headTitle.dx = 0;
            pageRise.opacity = 1;
            pageRise.dy = 0;
            return;
        }
        pageEnter.restart();
    }
    ParallelAnimation {
        id: pageEnter
        SequentialAnimation {
            ScriptAction {
                script: {
                    wipe.visible = true;
                    tide.visible = false;
                    wedge.visible = false;
                }
            }
            NumberAnimation {
                target: wipe
                property: "tx"
                from: 300
                to: 2400
                duration: 620
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.swoop
            }
            ScriptAction {
                script: wipe.visible = false
            }
        }
        NumberAnimation {
            target: bodyClip
            property: "k"
            from: 0
            to: 1
            duration: 620
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.swoop
        }
        SequentialAnimation {
            PauseAnimation {
                duration: 180
            }
            NumberAnimation {
                target: rule
                property: "k"
                from: 0
                to: 1
                duration: 700
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
        SequentialAnimation {
            ScriptAction {
                script: {
                    headTitle.opacity = 0;
                    headTitle.dx = -90;
                    rule.k = 0;
                    pageRise.opacity = 0;
                    pageRise.dy = 22;
                }
            }
            PauseAnimation {
                duration: 160
            }
            ParallelAnimation {
                NumberAnimation {
                    target: headTitle
                    property: "opacity"
                    to: 1
                    duration: 300
                }
                NumberAnimation {
                    target: headTitle
                    property: "dx"
                    to: 0
                    duration: 620
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.spring
                }
            }
        }
        // 原型里 [data-in] 元素按 45ms 错开上浮；这里整块正文一起上浮
        SequentialAnimation {
            PauseAnimation {
                duration: 300
            }
            ParallelAnimation {
                NumberAnimation {
                    target: pageRise
                    property: "opacity"
                    to: 1
                    duration: 520
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
                NumberAnimation {
                    target: pageRise
                    property: "dy"
                    to: 0
                    duration: 520
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
        }
        SequentialAnimation {
            PauseAnimation {
                duration: 520
            }
            ScriptAction {
                script: {
                    tide.visible = true;
                    wedge.visible = true;
                    win.placeCursor(true);
                }
            }
        }
    }
    // 返回主列表（pgOut .24s）
    SequentialAnimation {
        id: pageOut
        ParallelAnimation {
            NumberAnimation {
                target: pageBox
                property: "opacity"
                to: 0
                duration: win.still ? 0 : 240
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.exit
            }
            NumberAnimation {
                target: pageBox
                property: "dx"
                to: 60
                duration: win.still ? 0 : 240
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.exit
            }
        }
        ScriptAction {
            script: {
                if (!win.page) {
                    pageLoader.source = "";
                    pageBox.opacity = 1;
                    pageBox.dx = 0;
                }
            }
        }
    }
    // 切页时旧正文淡出（.swap .16s）
    NumberAnimation {
        id: swapOut
        target: pageRise
        property: "opacity"
        to: 0
        duration: 150
        easing.type: Easing.BezierSpline
        easing.bezierCurve: P3.exit
    }
}
