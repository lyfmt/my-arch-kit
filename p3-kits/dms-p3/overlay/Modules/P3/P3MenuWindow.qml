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
    readonly property bool closing: phase === "closing"
    // 入场动画期间（还没开页面）的按键、对主列表的单击和右键不丢：先记下，动画结束（phase 变 "open"）时按顺序补上。
    // 只补给主列表：补上的按键打开了页面，剩下的丢掉（不把 Enter 补进页面，免得在 POWER 上开始按住确认）
    // 函数而不是绑定：onPhaseChanged 里补按键时绑定还没更新
    function gated() {
        return phase === "opening" && !page;
    }
    property var held: ({
            "q": []
        })
    function holdInput(fn) {
        held.q.push(fn);
    }
    function dropHeld() {
        held.q = [];
    }
    function flushHeld() {
        const q = held.q;
        held.q = [];
        for (const fn of q) {
            if (!shouldShow || page)
                break;
            fn();
        }
    }
    onPhaseChanged: if (phase === "open")
        flushHeld()
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
            dropHeld();
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
            win.dropHeld();
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
        dropHeld();
        pageOpenT.stop();
        openT.stop();
        phase = "closing";
        for (let i = 0; i < menuRep.count; i++)
            menuRep.itemAt(i).playOut();
        page = "";
        dateOut.restart();
        tideOut.restart();
        // 从水滴破开的：缩回水滴（reveal.close() 的毫秒数）；否则水位渐隐
        const shrink = reveal.close(P3Menu.islandOn(win.screen?.name ?? ""));
        closeT.interval = still ? 0 : shrink > 0 ? shrink : 720;
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
            reveal.finish();
        }
    }

    function playOpen() {
        dateOut.stop();
        tideOut.stop();
        if (still) {
            reveal.finish();
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
        // 屏幕上有灵动岛：岛吸成水滴，菜单从水滴中心破开（P3MenuReveal）；内容的入场照常，在圆里进行
        reveal.open(P3Menu.islandOn(win.screen?.name ?? ""));
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
    function pickItem(i) {
        select(i, true);
        confirmItem();
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
        pageOpenT.stop();
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
        c.close = () => {
            if (live())
                close();
        };
        c.focus = el => {
            if (live())
                setFocus(el, false);
        };
        c.edit = el => {
            if (!live() || !el || el.textEntry !== true)
                return;
            setFocus(el, false);
            if (focusEl === el)
                el.editing = true;
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
        if (focusEl) {
            focusEl.focused = false;
            focusEl.editing = false;
        }
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
    // el 外面最近的、内容比视口高的 Flickable；没有为 null
    function scroller(el) {
        for (let n = el ? el.parent : null; n && n !== pageLoader.item; n = n.parent)
            if (n.contentItem !== undefined && n.contentY !== undefined && n.flickableDirection !== undefined && n.contentHeight > n.height)
                return n;
        return null;
    }
    // el 的左上角（焦点光点所在处）是否在页面内所有裁剪祖先之内；滚出列表视口时不画焦点指示
    function cornerShown(el) {
        for (let n = el.parent; n && n !== bodyRoot; n = n.parent) {
            if (!n.clip)
                continue;
            const p = el.mapToItem(n, 0, 0);
            if (p.x < -2 || p.y < -2 || p.x >= n.width || p.y >= n.height)
                return false;
        }
        return true;
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
        use.on = cornerShown(focusEl);
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

    // noScroll：指针给的焦点不滚动列表（元素已经在指针下；滚动会让内容在指针下移动）
    function setFocus(el, instant, noScroll) {
        if (!el) {
            return;
        }
        if (el === focusEl) {
            placeCursor(instant);
            return;
        }
        if (focusEl) {
            focusEl.focused = false;
            focusEl.editing = false;
        }
        focusEl = el;
        el.focused = true;
        if (!noScroll)
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

    // 候选 cands（[{ el, b }]）里离盒子 a 最近的一个（原型的打分：主方向距离 + 3 × 侧向距离），skip 除外；没有为 null
    function pick(dir, a, cands, skip) {
        const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
        let best = null, bestS = Infinity;
        for (const c of cands) {
            if (c.el === skip)
                continue;
            const b = c.b;
            const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
            let prim, orth;
            if (dir === "down" || dir === "up") {
                prim = dir === "down" ? b.y - (a.y + a.h) : a.y - (b.y + b.h);
                const d = dir === "down" ? bcy - acy : acy - bcy;
                if (d <= 2)
                    continue;
                prim = Math.max(prim, 0);
                orth = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
                orth += Math.abs(bcx - acx) * 0.1;
            } else {
                prim = dir === "right" ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
                const d = dir === "right" ? bcx - acx : acx - bcx;
                if (d <= 2)
                    continue;
                prim = Math.max(prim, 0);
                orth = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
                orth += Math.abs(bcy - acy) * 0.1;
            }
            const s = prim + orth * 3;
            if (s < bestS) {
                bestS = s;
                best = c;
            }
        }
        return best;
    }

    function move(dir) {
        const all = focusables();
        if (!all.length)
            return false;
        if (!focusEl || all.indexOf(focusEl) < 0) {
            setFocus(all[0], false);
            return true;
        }
        const best = pick(dir, boxOf(focusEl), all.map(el => ({
                    "el": el,
                    "b": boxOf(el)
                })), focusEl);
        if (best) {
            setFocus(best.el, false);
            return true;
        }
        return false;
    }

    // g g / G / Ctrl+u / Ctrl+d 的默认走法：只在焦点所在的列里（与焦点元素横向重叠的元素）沿 ↑ / ↓ 一格格走，
    // first / last 走到头，halfUp / halfDown 走过半个视口（焦点在可滚动列表里时是列表视口，否则是页面）就停；
    // 半页时列表跟着滚同样的距离，焦点停在视口里的同一高度。
    function motion(kind) {
        const all = focusables();
        if (!all.length)
            return false;
        const f = focusEl;
        if (!f || all.indexOf(f) < 0) {
            setFocus(all[0], false);
            return true;
        }
        const up = kind === "first" || kind === "halfUp";
        const half = kind === "halfUp" || kind === "halfDown";
        const sc = half ? scroller(f) : null;
        const span = (sc ? sc.height : P3.pageH) / 2;
        const a0 = boxOf(f);
        const col = [];
        for (const el of all) {
            if (el === f)
                continue;
            const b = boxOf(el);
            if (Math.min(a0.x + a0.w, b.x + b.w) - Math.max(a0.x, b.x) > 0)
                col.push({
                    "el": el,
                    "b": b
                });
        }
        let cur = {
            "el": f,
            "b": a0
        };
        for (let n = 0; n < col.length; n++) {
            const nx = pick(up ? "up" : "down", cur.b, col, cur.el);
            if (!nx)
                break;
            cur = nx;
            if (half && Math.abs(cur.b.y - a0.y) >= span)
                break;
        }
        if (cur.el === f)
            return false;
        if (sc && scroller(cur.el) === sc)
            sc.contentY = Math.max(0, Math.min(sc.contentHeight - sc.height, sc.contentY + cur.b.y - a0.y));
        setFocus(cur.el, false);
        return true;
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
        ptr.el = el;
        setFocus(el, false);
        if (el.textEntry === true) {
            el.editing = true;
            return;
        }
        if (doActivate)
            activate(el);
    }

    // ================================================================ 指针
    // 指针移到可聚焦元素上就把焦点移过去（原型 mouseover → setFocus，播放进入果冻和光点弹跳）；
    // 指针离开焦点元素再移回来时再抖一下。主列表上只移动选中项，不打开页面；页面打开后左侧 rail 不跟随指针。
    // 只认真实的指针移动：坐标没变的悬停事件（内容在静止的指针下滚动、切页、开菜单时合成器补发的）不算；
    // 键盘按键之后指针要离开按键时的位置 6px 才重新接管，所以键盘导航总是从当前焦点继续。
    // 按着鼠标键、按住 Enter / Space（按住确认）、录键、菜单开合期间不跟随；指针给的焦点不滚动列表。
    property var ptr: ({
            "last": null,
            "anchor": null,
            "armed": false,
            "el": null,
            "pending": false
        })
    property bool keyHeld: false
    function pointerReset() {
        ptr.last = null;
        ptr.anchor = null;
        ptr.armed = false;
        ptr.el = null;
        ptr.pending = false;
        ptrT.stop();
    }
    // 键盘按下：指针先交出控制
    function pointerDisarm() {
        ptr.armed = false;
        ptr.anchor = ptr.last;
    }
    function pointerMoved(x, y, buttons) {
        const last = ptr.last;
        ptr.last = {
            "x": x,
            "y": y
        };
        if (!last || (Math.abs(x - last.x) < 0.5 && Math.abs(y - last.y) < 0.5))
            return;
        if (buttons)
            return;
        if (!ptr.armed) {
            if (!ptr.anchor)
                ptr.anchor = last;
            if (Math.hypot(x - ptr.anchor.x, y - ptr.anchor.y) < 6)
                return;
            ptr.armed = true;
        }
        ptr.pending = true;
        if (!ptrT.running) {
            pointerFlush();
            ptrT.start();
        }
    }
    // 一帧最多处理一次
    Timer {
        id: ptrT
        interval: 16
        onTriggered: if (win.ptr.pending) {
            win.pointerFlush();
            start();
        }
    }
    function pointerFlush() {
        ptr.pending = false;
        if (!visible || !shouldShow || closing || gated() || capturing || keyHeld || !ptr.last)
            return;
        const s = stage.mapFromItem(ptrLayer, ptr.last.x, ptr.last.y);
        if (!page) {
            for (let i = 0; i < menuRep.count; i++) {
                const it = menuRep.itemAt(i);
                if (it && it.hitAt(stage, s.x, s.y)) {
                    select(i);
                    return;
                }
            }
            return;
        }
        const el = hoverTarget(s.x, s.y);
        const prev = ptr.el;
        ptr.el = el;
        if (!el)
            return;
        if (el !== focusEl)
            setFocus(el, false, true);
        else if (prev !== el)
            wob(el);
    }
    // a 是否画在 b 上面（同一父项下比 z、再比子项顺序；后代画在祖先上面）
    function above(a, b) {
        const ca = [], cb = [];
        for (let n = a; n; n = n.parent)
            ca.unshift(n);
        for (let n = b; n; n = n.parent)
            cb.unshift(n);
        let i = 0;
        while (i < ca.length && i < cb.length && ca[i] === cb[i])
            i++;
        if (i === ca.length)
            return false;
        if (i === cb.length)
            return true;
        const x = ca[i], y = cb[i];
        if (x.z !== y.z)
            return x.z > y.z;
        const kids = ca[i - 1] ? ca[i - 1].children : [];
        let ix = -1, iy = -1;
        for (let k = 0; k < kids.length; k++) {
            if (kids[k] === x)
                ix = k;
            else if (kids[k] === y)
                iy = k;
        }
        return ix > iy;
    }
    // 舞台坐标 (sx, sy) 下最上层的可交互元素（可聚焦元素或接左键的 MouseArea，按绘制顺序，裁剪区外的不算），
    // 再取它所在的可聚焦元素；盖在上面、不属于任何可聚焦元素的 MouseArea（托盘菜单的点击关闭区、录键遮罩、ctx.overlay 上的幕布）挡住下面的元素。
    function hoverTarget(sx, sy) {
        const pg = pageLoader.item;
        if (!pg || !ctx)
            return null;
        let top = null;
        const walk = n => {
            const kids = n.children;
            for (let i = 0; i < kids.length; i++) {
                const c = kids[i];
                if (!c || !c.visible || c.opacity <= 0)
                    continue;
                const fo = c.p3focusable === true;
                const ma = !fo && c.pressAndHoldInterval !== undefined && c.acceptedButtons !== undefined;
                if (c.clip || fo || ma) {
                    const p = c.mapFromItem(stage, sx, sy);
                    const inside = p.x >= 0 && p.y >= 0 && p.x < c.width && p.y < c.height;
                    if (c.clip && !inside)
                        continue;
                    if (inside && ((fo && !c.disabled) || (ma && c.enabled && (c.acceptedButtons & Qt.LeftButton))) && (!top || above(c, top)))
                        top = c;
                }
                walk(c);
            }
        };
        const pb = bodyClip.mapFromItem(stage, sx, sy);
        if (pb.x >= 0 && pb.y >= 0 && pb.x < bodyClip.width && pb.y < bodyClip.height)
            walk(pg);
        walk(overlay);
        for (let n = top; n && n !== pg && n !== overlay; n = n.parent)
            if (n.p3focusable === true)
                return n.disabled ? null : n;
        return null;
    }
    Connections {
        target: win
        function onShouldShowChanged() {
            win.pointerReset();
            win.keyHeld = false;
            gWait.stop();
        }
    }

    // 调试（p3menu focus）：焦点元素的名字、页面坐标里的盒子，输入状态和光点是否显示
    function describeFocus() {
        if (!shouldShow)
            return "closed";
        if (!page)
            return "list " + items[cur].id;
        const f = focusEl;
        if (!f)
            return page + " none";
        const name = [f.ref, f.syKey, f.key, f.act ? f.act.id : "", f.label, f.title, f.pid >= 0 ? "pid:" + f.pid : ""].find(v => typeof v === "string" && v !== "") || String(f).replace(/(_QMLTYPE_\d+)?\(.*$/, "");
        const b = boxOf(f);
        return page + " " + name + " @" + Math.round(b.x) + "," + Math.round(b.y) + " " + Math.round(b.w) + "x" + Math.round(b.h) + (typingNow() ? " typing" : "") + (tide.on ? " tide" : "");
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
    // 字母是输入：页面 textEntry（APPS 搜索的输入状态），或焦点在输入框上且处于输入状态（editing）。
    // 输入框（textEntry 元素）拿到焦点时不输入，h j k l 照常移动；i 或单击进入输入，Esc 退出输入（焦点留在框上）
    function typingNow() {
        const pg = pageLoader.item;
        return paged && !!pg && (pg.textEntry === true || (!!focusEl && focusEl.textEntry === true && focusEl.editing === true));
    }

    // vim 键（在页面 handleKey 之前翻译，所有页面、keyHandler 都按方向键处理）：
    //   h j k l = ← ↓ ↑ →；Ctrl+h/j/k/l、Ctrl+n/p 也是方向键，输入时照样可用
    //   g g / G = 第一个 / 最后一个，Ctrl+d / Ctrl+u = 下 / 上半页：先以 { key: Qt.Key_unknown, motion } 交给 handleKey，
    //   页面不处理时 motion() 沿当前列走；主列表上 g g / G 选第一项 / 最后一项
    // 输入时（typingNow()）h j k l g G 原样交给页面。单独一个 g 等第二个键 1 秒：等来的不是 g 时先把 g 当普通按键补上。
    function arrowOf(k, ctrl) {
        switch (k) {
        case Qt.Key_H:
            return Qt.Key_Left;
        case Qt.Key_J:
            return Qt.Key_Down;
        case Qt.Key_K:
            return Qt.Key_Up;
        case Qt.Key_L:
            return Qt.Key_Right;
        case Qt.Key_N:
            return ctrl ? Qt.Key_Down : 0;
        case Qt.Key_P:
            return ctrl ? Qt.Key_Up : 0;
        }
        return 0;
    }
    // 合成的按键对象（和 back() 里合成的 Escape 同一形状）
    function synthKey(key, text, auto, extra) {
        const o = {
            "key": key,
            "text": text,
            "modifiers": 0,
            "isAutoRepeat": !!auto,
            "nativeScanCode": 0,
            "synthetic": true,
            "vim": true,
            "accepted": false
        };
        return extra ? Object.assign(o, extra) : o;
    }
    function isModifierKey(k) {
        return k === Qt.Key_Shift || k === Qt.Key_Control || k === Qt.Key_Alt || k === Qt.Key_AltGr || k === Qt.Key_Meta || k === Qt.Key_Super_L || k === Qt.Key_Super_R || k === Qt.Key_Hyper_L || k === Qt.Key_Hyper_R || k === Qt.Key_CapsLock;
    }
    Timer {
        id: gWait
        interval: 1000
        onTriggered: win.dispatchKey(win.synthKey(Qt.Key_G, "g", false))
    }
    function runMotion(kind, auto) {
        if (!page) {
            if (closing)
                return;
            if (kind === "first")
                select(0);
            else if (kind === "last")
                select(items.length - 1);
            return;
        }
        if (pageKey(synthKey(Qt.Key_unknown, "", auto, {
            "motion": kind
        })))
            return;
        motion(kind);
    }

    function onKeyPressed(e) {
        if (capturing) {
            e.accepted = true;
            pageKey(e);
            return;
        }
        const k = e.key;
        if (isModifierKey(k))
            return;
        if (gated()) {
            e.accepted = true;
            if (!e.isAutoRepeat) {
                const c = {
                    "key": k,
                    "text": e.text,
                    "modifiers": e.modifiers,
                    "isAutoRepeat": false,
                    "nativeScanCode": e.nativeScanCode,
                    "replay": true,
                    "accepted": false
                };
                holdInput(() => onKeyPressed(c));
            }
            return;
        }
        pointerDisarm();
        if ((k === Qt.Key_Return || k === Qt.Key_Enter || k === Qt.Key_Space) && !e.isAutoRepeat && !e.replay)
            keyHeld = true;
        const mods = e.modifiers & (Qt.ShiftModifier | Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier);
        if (gWait.running) {
            gWait.stop();
            if (k === Qt.Key_G && !mods && !typingNow()) {
                e.accepted = true;
                runMotion("first", false);
                return;
            }
            dispatchKey(synthKey(Qt.Key_G, "g", false));
        }
        const typing = typingNow();
        let ev = e;
        if (mods === Qt.ControlModifier) {
            if (k === Qt.Key_D || k === Qt.Key_U) {
                e.accepted = true;
                runMotion(k === Qt.Key_D ? "halfDown" : "halfUp", e.isAutoRepeat);
                return;
            }
            const a = arrowOf(k, true);
            if (a)
                ev = synthKey(a, "", e.isAutoRepeat);
        } else if (!typing && !mods) {
            const a = arrowOf(k, false);
            if (a) {
                ev = synthKey(a, "", e.isAutoRepeat);
            } else if (k === Qt.Key_G) {
                e.accepted = true;
                if (!e.isAutoRepeat)
                    gWait.restart();
                return;
            }
        } else if (!typing && mods === Qt.ShiftModifier && k === Qt.Key_G) {
            e.accepted = true;
            runMotion("last", e.isAutoRepeat);
            return;
        }
        e.accepted = dispatchKey(ev);
    }
    // 一次按下的处理（真实事件或上面合成的对象）；返回是否已处理
    function dispatchKey(e) {
        if (e.modifiers & (Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier))
            return false;
        if (page && fieldKey(e))
            return true;
        if (page && pageKey(e))
            return true;
        const k = e.key;
        if (closing && !page)
            return true;
        if (page) {
            const f = focusEl;
            if (f && f.keyHandler && f.keyHandler(e))
                return true;
            switch (k) {
            case Qt.Key_Escape:
            case Qt.Key_Backspace:
                closePage();
                return true;
            case Qt.Key_Up:
            case Qt.Key_W:
                move("up");
                return true;
            case Qt.Key_Down:
            case Qt.Key_S:
                move("down");
                return true;
            case Qt.Key_Left:
            case Qt.Key_A:
                if (!move("left"))
                    closePage();
                return true;
            case Qt.Key_Right:
            case Qt.Key_D:
                move("right");
                return true;
            case Qt.Key_Return:
            case Qt.Key_Enter:
            case Qt.Key_Space:
                if (!f || e.isAutoRepeat)
                    return true;
                if (f.p3hold === true) {
                    f.start();
                    return true;
                }
                activate(f);
                return true;
            }
            return false;
        }
        switch (k) {
        case Qt.Key_Down:
        case Qt.Key_S:
        case Qt.Key_Tab:
            select(cur + 1);
            return true;
        case Qt.Key_Up:
        case Qt.Key_W:
        case Qt.Key_Backtab:
            select(cur - 1);
            return true;
        case Qt.Key_Return:
        case Qt.Key_Enter:
        case Qt.Key_Space:
        case Qt.Key_Right:
        case Qt.Key_D:
            confirmItem();
            return true;
        case Qt.Key_Escape:
            close();
            return true;
        }
        return false;
    }
    // 输入框的两种状态（先于页面）：不在输入时 i 进入输入；输入时 Esc 退出输入、焦点留在框上
    function fieldKey(e) {
        const f = focusEl;
        if (!f || f.textEntry !== true || e.synthetic)
            return false;
        if (!f.editing && e.key === Qt.Key_I) {
            if (!e.isAutoRepeat)
                f.editing = true;
            return true;
        }
        if (f.editing && e.key === Qt.Key_Escape) {
            f.editing = false;
            return true;
        }
        return false;
    }
    function onKeyReleased(e) {
        if ((e.key === Qt.Key_Return || e.key === Qt.Key_Enter || e.key === Qt.Key_Space) && !e.isAutoRepeat)
            keyHeld = false;
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
        if (closing && !page)
            return;
        if (gated()) {
            holdInput(() => back());
            return;
        }
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
    // 出场 / 收场的圆形开口期间底色由 reveal 在圆里画
    Rectangle {
        anchors.fill: parent
        color: P3.stageBg
        opacity: water.tide
        visible: !reveal.active
    }

    P3MenuReveal {
        id: reveal
        anchors.fill: parent
        baseA: water.tide
    }

    ShortcutInhibitor {
        window: win
        enabled: win.capturing
    }

    FocusScope {
        id: keys
        anchors.fill: parent
        focus: true
        layer.enabled: reveal.active
        layer.effect: reveal.effect
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
                            if (win.closing)
                                return;
                            const i = index;
                            if (win.gated())
                                win.holdInput(() => win.pickItem(i));
                            else
                                win.pickItem(i);
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

            // 提示条（ctx.run 的失败 / ctx.toast），在全舞台层之上
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
            // 主列表滚轮切换：Wayland 上滚轮事件常被标成 TouchPad 设备；120 = 一格，触摸板的小增量攒满一格才换
            WheelHandler {
                enabled: !win.paged && win.phase === "open"
                acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
                property real lock: 0
                property real acc: 0
                onWheel: e => {
                    acc += e.angleDelta.y;
                    const n = Math.trunc(acc / 120);
                    if (!n)
                        return;
                    acc -= n * 120;
                    const now = Date.now();
                    if (now < lock)
                        return;
                    lock = now + 90;
                    win.select(win.cur + (n < 0 ? 1 : -1));
                }
            }
        }

        // 指针跟随（见「指针」一节）：最上层的空层，HoverHandler 不挡点击、滚轮和下面的悬停
        Item {
            id: ptrLayer
            anchors.fill: parent
            z: 100
            HoverHandler {
                onPointChanged: if (hovered)
                    win.pointerMoved(point.position.x, point.position.y, point.pressedButtons)
                onHoveredChanged: if (!hovered)
                    win.ptr.last = null
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
