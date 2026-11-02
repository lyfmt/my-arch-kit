import QtQuick
import Quickshell
import qs.Modules.P3
import qs.P3Sys
import "system"
import "system/memo.js" as Memo
import "../../../Common/KeyUtils.js" as KeyUtils

// SYSTEM（原型 pages/system.js）：两级「分类栏 330px + 详情 998px」。
//   TOP   NETWORK · BLUETOOTH · SOUND · DISPLAY · MODE，底部 MORE（详情是 MORE 各分类的入口块）
//   MORE  INPUT · KEYBINDS · LOOK · POWER · NOTICES · GENERAL
// 按键
//   （h j k l 和方向键相同，由框架翻译）
//   分类栏  ↑↓ 换分类（详情即时换）· g g / G 第一个 / 最后一个分类 · → / Enter 进详情（MORE 上 Enter 进 MORE 层）·
//           Esc / ←：TOP 离开页面，MORE 回 TOP
//   详情    ↑↓←→ 只在详情里移动 · g g / G / Ctrl+d / Ctrl+u 由框架沿当前列走 · Enter 激活 · Esc / Backspace，或最左侧再按 ← 回分类栏
//           滑块 / 循环选择 ←→ 调值 · 按键行 Enter 录键（必须带修饰键，Esc 取消，冲突时继续录）
//   搜索    （KEYBINDS）直接输入过滤（字母都是输入）· ⌫ 删字 · ↓ / Ctrl+j / Enter 到结果
//   密码    输入 · ⌫ · Enter 连接 · Esc 收起
// 状态（层级、当前分类、各分类最后的焦点）在页面实例之间保留（memo.js）。
// 截图 / 调试：P3_SYSTEM_VIEW=network|bluetooth|sound|display|mode|more|more:<input|keys|look|power|notify|general>
//   选定打开时的视图；P3_SYSTEM_FOCUS=N 进入详情并聚焦第 N 个可聚焦元素。
P3Page {
    id: page
    title: "SYSTEM"

    readonly property var cats: [
        {
            "id": "network",
            "t": "NETWORK"
        },
        {
            "id": "bluetooth",
            "t": "BLUETOOTH"
        },
        {
            "id": "sound",
            "t": "SOUND"
        },
        {
            "id": "display",
            "t": "DISPLAY"
        },
        {
            "id": "mode",
            "t": "MODE"
        }
    ]
    readonly property var mcats: [
        {
            "id": "input",
            "t": "INPUT",
            "g": "kbd"
        },
        {
            "id": "keys",
            "t": "KEYBINDS",
            "g": "list"
        },
        {
            "id": "look",
            "t": "LOOK",
            "g": "display"
        },
        {
            "id": "power",
            "t": "POWER",
            "g": "sleep"
        },
        {
            "id": "notify",
            "t": "NOTICES",
            "g": "bell"
        },
        {
            "id": "general",
            "t": "GENERAL",
            "g": "gear"
        }
    ]
    readonly property var profiles: [
        {
            "id": "power-saver",
            "t": "SAVER",
            "g": "bat"
        },
        {
            "id": "balanced",
            "t": "BALANCED",
            "g": "gauge"
        },
        {
            "id": "performance",
            "t": "PERFORMANCE",
            "g": "bolt"
        }
    ]
    readonly property var minOpts: ["1 分钟", "3 分钟", "5 分钟", "10 分钟", "15 分钟", "30 分钟", "从不"]
    readonly property var apprOpts: ["弹窗 + 声音", "仅弹窗", "静默", "关闭"]

    // ---------------------------------------------------------------- 界面状态
    property string lvl: Memo.S.lvl
    property string cat: Memo.S.cat
    property string mcat: Memo.S.mcat
    readonly property string curCat: lvl === "more" ? mcat : cat
    onLvlChanged: Memo.S.lvl = lvl
    onCatChanged: Memo.S.cat = cat
    onMcatChanged: Memo.S.mcat = mcat

    readonly property bool still: !!(ctx && ctx.still)
    property bool railMode: true
    property bool switching: false
    property bool live: false
    // Wi-Fi 密码行（pwSsid 为空 = 收起）；pwShakeN 每加一次密码行抖一下
    property string pwSsid: ""
    property string pwVal: ""
    property int pwShakeN: 0
    // 录键：capKey = "bind:<uid>" | "imeKey"；录键期间 keyCapture 打开，所有按键原样进 handleKey
    property string capKey: ""
    keyCapture: capKey !== ""
    property bool capBusy: false
    // KEYBINDS 搜索
    property string bq: ""

    // ---------------------------------------------------------------- 分类摘要（左栏右侧）
    function catMeta(id) {
        switch (id) {
        case "network":
            {
                const n = Net.state;
                if (n.wifi && n.ssid)
                    return n.ssid;
                if (n.ethernet)
                    return "ETHERNET";
                return n.wifi ? "ON" : "OFF";
            }
        case "bluetooth":
            {
                const b = Bt.state;
                return b.on ? b.devices.filter(x => x.connected).length + " ON" : "OFF";
            }
        case "sound":
            return Audio.state.muted ? "MUTED" : Math.round(Audio.state.vol) + "%";
        case "display":
            return Math.round(Display.state.bright) + "%" + (Display.state.night ? " · NIGHT" : "");
        case "mode":
            {
                const b = Battery.state, p = profiles.find(x => x.id === b.profile), out = [];
                if (b.profileAvailable && p)
                    out.push(p.t);
                if (Mode.state.dnd)
                    out.push("DND");
                return out.join(" · ");
            }
        }
        return "";
    }

    // ---------------------------------------------------------------- 树遍历
    function focusIn(root) {
        const out = [];
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
        if (root)
            walk(root);
        return out;
    }
    function findKey(root, key) {
        if (!root || !key)
            return null;
        const walk = n => {
            const kids = n.children;
            for (let i = 0; i < kids.length; i++) {
                const c = kids[i];
                if (!c)
                    continue;
                if (c.syKey === key && c.visible)
                    return c;
                const r = walk(c);
                if (r)
                    return r;
            }
            return null;
        };
        return walk(root);
    }
    // 换入动画：按文档顺序给可见的 SyIn / SySec 编号播放，返回下一个序号
    function stagger(root, n) {
        const walk = it => {
            const kids = it.children;
            for (let i = 0; i < kids.length; i++) {
                const c = kids[i];
                if (!c || !c.visible)
                    continue;
                if (c.syIn === true) {
                    c.play(n++);
                    continue;
                }
                walk(c);
            }
        };
        if (root && !still)
            walk(root);
        return n;
    }
    function catItem(id) {
        if (id === "more" && lvl === "top")
            return moreCat;
        for (let i = 0; i < catRep.count; i++) {
            const w = catRep.itemAt(i);
            if (w && w.cat && w.cat.catId === id)
                return w.cat;
        }
        return null;
    }
    function railItems() {
        const out = [];
        for (let i = 0; i < catRep.count; i++) {
            const w = catRep.itemAt(i);
            if (w && w.cat)
                out.push(w.cat);
        }
        if (lvl === "top")
            out.push(moreCat);
        return out;
    }
    function inDetail(el) {
        for (let n = el; n; n = n.parent)
            if (n === detailBox)
                return true;
        return false;
    }

    // ---------------------------------------------------------------- 视图切换
    function showCat(id) {
        if (curCat === id)
            return;
        endCapture(false);
        pwSsid = "";
        pwVal = "";
        if (lvl === "more")
            mcat = id;
        else
            cat = id;
    }
    function enterDetail() {
        const box = detail.item;
        if (!box || !ctx)
            return;
        const lk = Memo.S.last[curCat];
        let n = lk ? findKey(box, lk) : null;
        if (!n || n.disabled || focusIn(box).indexOf(n) < 0)
            n = focusIn(box)[0] || null;
        if (n)
            ctx.focus(n);
    }
    function toRail() {
        const f = ctx ? ctx.focused() : null;
        if (f && f.syKey)
            Memo.S.last[curCat] = f.syKey;
        const c = catItem(curCat);
        if (c)
            ctx.focus(c);
    }
    // 只在详情里做空间导航（原型 lockRail）：与框架同一套打分
    function moveIn(dir) {
        const f = ctx.focused();
        const all = focusIn(detailBox);
        if (!f || all.indexOf(f) < 0) {
            if (all.length)
                ctx.focus(all[0]);
            return all.length > 0;
        }
        const box = el => {
            const p = el.mapToItem(page, 0, 0);
            return {
                "x": p.x,
                "y": p.y,
                "w": el.width,
                "h": el.height
            };
        };
        const a = box(f), acx = a.x + a.w / 2, acy = a.y + a.h / 2;
        let best = null, bestS = Infinity;
        for (const el of all) {
            if (el === f)
                continue;
            const b = box(el), bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
            let prim, orth;
            if (dir === "down" || dir === "up") {
                prim = dir === "down" ? b.y - (a.y + a.h) : a.y - (b.y + b.h);
                if ((dir === "down" ? bcy - acy : acy - bcy) <= 2)
                    continue;
                orth = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)) + Math.abs(bcx - acx) * 0.1;
            } else {
                prim = dir === "right" ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
                if ((dir === "right" ? bcx - acx : acx - bcx) <= 2)
                    continue;
                orth = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)) + Math.abs(bcy - acy) * 0.1;
            }
            const s = Math.max(prim, 0) + orth * 3;
            if (s < bestS) {
                bestS = s;
                best = el;
            }
        }
        if (best)
            ctx.focus(best);
        return !!best;
    }
    // 层级切换：整块向左淡出 150ms，重画后分类和详情一起错落滑入
    function goLevel(to, sub) {
        endCapture(false);
        const from = lvl;
        const fin = () => {
            // 淡出动画可能比计时器晚一帧结束，先停掉，免得它把下面复位的 opacity / dx 又写回终值
            levelOut.stop();
            // 先把焦点放到常驻的 MORE 入口，旧分类 / 入口块随后被销毁
            if (ctx)
                ctx.focus(moreCat);
            pwSsid = "";
            pwVal = "";
            if (sub)
                mcat = sub;
            if (to === "top")
                cat = "more";
            lvl = to;
            frame.opacity = 1;
            frame.dx = 0;
            let n = stagger(railCol, 0);
            if (moreWrap.visible && !still)
                moreWrap.play(n++);
            stagger(detail.item, n);
            const c = catItem(curCat);
            if (c && ctx)
                ctx.focus(c);
            switching = false;
            if (to === "more" && sub)
                enterDetail();
        };
        if (still || from === to) {
            switching = true;
            fin();
            return;
        }
        switching = true;
        levelOut.start();
        levelT.fin = fin;
        levelT.restart();
    }
    Timer {
        id: levelT
        property var fin: null
        interval: 150
        onTriggered: if (fin)
            fin()
    }
    ParallelAnimation {
        id: levelOut
        NumberAnimation {
            target: frame
            property: "opacity"
            to: 0
            duration: 160
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.exit
        }
        NumberAnimation {
            target: frame
            property: "dx"
            to: -50
            duration: 160
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.exit
        }
    }

    // ---------------------------------------------------------------- 焦点保护
    // 焦点元素变成不可用 / 隐藏时，先挪到它前面最近的可用元素（框架默认会退到第一个分类）
    function rescue(el) {
        if (!ctx || !el || switching)
            return;
        const all = focusIn(detailBox);
        if (all.indexOf(el) >= 0 && !el.disabled)
            return;
        let prev = null;
        for (const c of all) {
            const a = c.mapToItem(page, 0, 0), b = el.mapToItem(page, 0, 0);
            if (a.y < b.y || (a.y === b.y && a.x < b.x))
                prev = c;
        }
        const n = prev || all[0] || catItem(curCat);
        if (n)
            ctx.focus(n);
    }
    // 委托即将删除：焦点在它上面时先挪开（util.sync 的 beforeRemove）
    function aboutToRemove(key) {
        const f = ctx ? ctx.focused() : null;
        if (!f || f.syKey !== key)
            return;
        const all = focusIn(detailBox).filter(x => x !== f && x.syKey !== key);
        const i = focusIn(detailBox).indexOf(f);
        const n = all[Math.max(0, Math.min(all.length - 1, i - 1))] || catItem(curCat);
        if (n)
            ctx.focus(n);
    }
    property var focusEl: null
    Connections {
        target: page.focusEl
        ignoreUnknownSignals: true
        function onDisabledChanged() {
            if (page.focusEl && page.focusEl.disabled)
                page.rescue(page.focusEl);
        }
        function onVisibleChanged() {
            if (page.focusEl && !page.focusEl.visible)
                page.rescue(page.focusEl);
        }
    }
    onFocusMoved: item => {
        focusEl = item;
        railMode = !!(item && item.syCat === true);
    }

    // ---------------------------------------------------------------- Wi-Fi
    function focusKey(key) {
        const n = findKey(detail.item, key);
        if (n && ctx)
            ctx.focus(n);
        return n;
    }
    // 选了要密码的网络：密码行展开并直接进入输入
    function openPw(ssid) {
        pwSsid = ssid;
        pwVal = "";
        Qt.callLater(() => {
            if (!live || pwSsid !== ssid || !ctx)
                return;
            const n = findKey(detail.item, "pw");
            if (n)
                ctx.edit(n);
        });
    }
    function closePw() {
        const s = pwSsid;
        focusKey("ap:" + s);
        pwSsid = "";
        pwVal = "";
    }
    // 后端置 connecting（该行显示 CONNECTING，其余行变暗）；认证失败重新展开空的密码行并抖动
    function connectAp(ssid, pw) {
        focusKey("ap:" + ssid);
        pwSsid = "";
        pwVal = "";
        ctx.run(Net.connect(ssid, pw || ""), {
            "revert": e => {
                try {
                    if (!live)
                        return;
                    if (e && e.code === "auth" && curCat === "network" && lvl === "top") {
                        openPw(ssid);
                        pwShakeN++;
                    }
                } catch (err) {}
            }
        });
    }
    function activateAp(w) {
        if (!w || Net.state.connecting || w.on)
            return;
        if (!w.sec || w.saved)
            connectAp(w.ssid, "");
        else
            openPw(w.ssid);
    }
    // typing：密码框在输入（Esc 先由框架退出输入；不在输入时 Esc / Backspace 收起密码行，字母不输入）
    function pwKey(e, typing) {
        const k = e.key;
        if (k === Qt.Key_Escape || (!typing && k === Qt.Key_Backspace)) {
            closePw();
            return true;
        }
        if (k === Qt.Key_Return || k === Qt.Key_Enter) {
            if (!e.isAutoRepeat)
                connectAp(pwSsid, pwVal);
            return true;
        }
        if (!typing)
            return false;
        if (k === Qt.Key_Backspace) {
            pwVal = pwVal.slice(0, -1);
            return true;
        }
        const t = e.text || "";
        if (t.length === 1 && t >= " " && t !== "\u007f") {
            if (pwVal.length < 32)
                pwVal += t;
            return true;
        }
        return false;
    }

    // ---------------------------------------------------------------- KEYBINDS 搜索
    function firstBind() {
        const all = focusIn(detail.item);
        return all.find(x => x.syKey.indexOf("bind:") === 0) || null;
    }
    // typing：搜索框在输入；不在输入时字母不输入（i 或单击进入输入，任意处 / 直接跳到这里输入）
    function searchKey(e, typing) {
        const k = e.key;
        if (k === Qt.Key_Down || k === Qt.Key_Return || k === Qt.Key_Enter) {
            const f = firstBind();
            if (f)
                ctx.focus(f);
            return true;
        }
        if (!typing)
            return false;
        if (k === Qt.Key_Backspace) {
            if (!bq)
                return false;
            bq = bq.slice(0, -1);
            return true;
        }
        const t = e.text || "";
        if (t.length === 1 && t !== "\u007f" && (t > " " || (t === " " && bq))) {
            if (bq.length < 24)
                bq += t;
            return true;
        }
        return false;
    }

    // ---------------------------------------------------------------- 录键
    // 单独的修饰键和自动重复忽略；Esc（含右键合成的 Esc）取消；要求带 Ctrl / Alt / Super / Shift。
    // 组合写成 niri 的写法：配置里的 Mod 键记作 modSymbol（输入法触发键由 Ime.setTrigger 换回实际按键）。
    function startCapture(key) {
        if (capKey || capBusy)
            return;
        capKey = key;
    }
    function endCapture(ok) {
        capKey = "";
    }
    function captureKey(e) {
        if (e.isAutoRepeat || KeyUtils.isModifierKey(e.key) || e.key === Qt.Key_Super_L || e.key === Qt.Key_Super_R || e.key === Qt.Key_Hyper_L || e.key === Qt.Key_Hyper_R || e.key === 0)
            return;
        const strong = e.modifiers & (Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier);
        if (e.key === Qt.Key_Escape && !strong) {
            endCapture(false);
            return;
        }
        if (!(strong || (e.modifiers & Qt.ShiftModifier)) || capBusy)
            return;
        const k = capKey, ime = k === "imeKey";
        const mods = KeyUtils.modsFromEvent(e.modifiers);
        const token = KeyUtils.chordToken(e.key, e.modifiers, mods, e.nativeScanCode, Keybinds.state.modKey, Keybinds.state.modSymbol);
        if (!token)
            return;
        let p;
        if (ime) {
            p = Ime.setTrigger(token);
        } else {
            const b = bindOf(k);
            if (!b) {
                endCapture(false);
                return;
            }
            p = Keybinds.rebind(b.key, token);
        }
        capBusy = true;
        ctx.run(p, {
            "done": (ok, r) => {
                try {
                    capBusy = false;
                    if (capKey !== k)
                        return;
                    // 冲突：留在录键状态，换一个组合再试
                    if (ok || !(r && r.code === "conflict"))
                        endCapture(ok);
                } catch (err) {}
            }
        });
    }
    function bindOf(k) {
        const i = parseInt(String(k).slice(5));
        return Keybinds.state.list[i] || null;
    }
    // 录键期间不响应单击（右键由框架合成 Esc 交给 handleKey）
    MouseArea {
        anchors.fill: parent
        z: 10
        enabled: page.capKey !== ""
        acceptedButtons: Qt.LeftButton
    }

    // ---------------------------------------------------------------- 按键
    function handleKey(e) {
        if (switching)
            return true;
        if (capKey) {
            captureKey(e);
            return true;
        }
        const f = ctx ? ctx.focused() : null;
        const sk = f && f.syKey ? f.syKey : "";
        const typing = !!f && f.textEntry === true && f.editing === true;
        if (!typing && !e.synthetic && e.text === "/") {
            const s = findKey(detail.item, "search");
            if (s) {
                ctx.edit(s);
                return true;
            }
        }
        if (sk === "pw" && pwSsid && pwKey(e, typing))
            return true;
        if (sk === "search" && searchKey(e, typing))
            return true;
        return keyNav(e, f);
    }
    function keyNav(e, f) {
        const k = e.key;
        const up = k === Qt.Key_Up || k === Qt.Key_W, dn = k === Qt.Key_Down || k === Qt.Key_S;
        const lt = k === Qt.Key_Left || k === Qt.Key_A, rt = k === Qt.Key_Right || k === Qt.Key_D;
        const esc = k === Qt.Key_Escape || k === Qt.Key_Backspace;
        const go = rt || k === Qt.Key_Return || k === Qt.Key_Enter || k === Qt.Key_Space;
        if (!f || f.syCat === true) {
            if (!f)
                return false;
            if (e.motion) {
                const list = railItems(), i = list.indexOf(f), h = Math.ceil(list.length / 2);
                const j = e.motion === "first" ? 0 : e.motion === "last" ? list.length - 1 : i + (e.motion === "halfDown" ? h : -h);
                const n = list[Math.max(0, Math.min(list.length - 1, j))];
                if (n && n !== f) {
                    ctx.focus(n);
                    showCat(n.catId);
                }
                return true;
            }
            if (up || dn) {
                const list = railItems(), i = list.indexOf(f);
                const n = list[Math.max(0, Math.min(list.length - 1, i + (up ? -1 : 1)))];
                if (n && n !== f) {
                    ctx.focus(n);
                    showCat(n.catId);
                }
                return true;
            }
            if (go) {
                if (e.isAutoRepeat)
                    return true;
                if (curCat !== f.catId)
                    showCat(f.catId);
                if (f.catId === "more" && lvl === "top" && !rt) {
                    goLevel("more");
                    return true;
                }
                enterDetail();
                return true;
            }
            if ((esc || lt) && lvl === "more") {
                goLevel("top");
                return true;
            }
            return false;
        }
        if (!inDetail(f))
            return false;
        if (esc) {
            toRail();
            return true;
        }
        // 滑块 / 循环选择自己处理 ←→
        if ((lt || rt) && f.syLR === true)
            return false;
        if (lt) {
            if (!moveIn("left"))
                toRail();
            return true;
        }
        if (up && keyOf(f).indexOf("bind:") === 0 && f === firstBind()) {
            focusKey("search");
            return true;
        }
        if (up || dn || rt) {
            moveIn(up ? "up" : dn ? "down" : "right");
            return true;
        }
        return false;
    }
    function keyOf(f) {
        return f && f.syKey ? f.syKey : "";
    }

    // ---------------------------------------------------------------- 引用计数（离开时释放）
    property var _release: []
    function acquire() {
        Clash.addRef();
        Ime.addRef();
        const kb = Keybinds.watch(), up = Update.watch();
        _release = [() => Clash.removeRef(), () => Ime.removeRef(), kb, up];
        Autostart.refresh();
        Defaults.refresh();
    }
    function release() {
        const r = _release;
        _release = [];
        for (const f of r)
            f();
    }
    onEntered: {
        live = true;
        acquire();
        const fN = parseInt(Quickshell.env("P3_SYSTEM_FOCUS") || "");
        if (!isNaN(fN)) {
            const list = focusIn(detail.item);
            if (list.length)
                ctx.focus(list[Math.max(0, Math.min(list.length - 1, fN))]);
        }
    }
    onLeaving: {
        live = false;
        endCapture(false);
        pwSsid = "";
        release();
    }
    Component.onDestruction: release()
    Component.onCompleted: {
        const v = String(Quickshell.env("P3_SYSTEM_VIEW") || "");
        if (!v)
            return;
        const [a, b] = v.split(":");
        if (a === "more" && b && mcats.some(c => c.id === b)) {
            mcat = b;
            lvl = "more";
        } else if (a === "more" || cats.some(c => c.id === a)) {
            cat = a;
            lvl = "top";
        }
    }

    // ---------------------------------------------------------------- 详情
    Component {
        id: cNetwork
        NetworkDetail {
            sys: page
        }
    }
    Component {
        id: cBluetooth
        BluetoothDetail {
            sys: page
        }
    }
    Component {
        id: cSound
        SoundDetail {
            sys: page
        }
    }
    Component {
        id: cDisplay
        DisplayDetail {
            sys: page
        }
    }
    Component {
        id: cMode
        ModeDetail {
            sys: page
        }
    }
    Component {
        id: cMore
        MoreTiles {
            sys: page
        }
    }
    Component {
        id: cInput
        InputDetail {
            sys: page
        }
    }
    Component {
        id: cKeys
        KeysDetail {
            sys: page
        }
    }
    Component {
        id: cLook
        LookDetail {
            sys: page
        }
    }
    Component {
        id: cPower
        PowerDetail {
            sys: page
        }
    }
    Component {
        id: cNotify
        NotifyDetail {
            sys: page
        }
    }
    Component {
        id: cGeneral
        GeneralDetail {
            sys: page
        }
    }
    function compFor(id) {
        return ({
                "network": cNetwork,
                "bluetooth": cBluetooth,
                "sound": cSound,
                "display": cDisplay,
                "mode": cMode,
                "more": cMore,
                "input": cInput,
                "keys": cKeys,
                "look": cLook,
                "power": cPower,
                "notify": cNotify,
                "general": cGeneral
            })[id] || null;
    }

    // ---------------------------------------------------------------- 画面（.sy：上 10 / 右 8 / 左 18 内边距）
    Item {
        id: frame
        x: 18
        y: 10
        width: page.width - 26
        height: page.height - 10
        property real dx: 0
        transform: Translate {
            x: frame.dx
        }

        Item {
            id: rail
            width: 330
            height: parent.height

            // 当前分类的标记（只在详情模式出现）
            Rectangle {
                id: mark
                x: 0
                width: 6
                height: 34
                color: P3.fill
                y: {
                    const l = page.lvl === "more" ? page.mcats : page.cats;
                    const i = l.findIndex(c => c.id === page.curCat);
                    return (i >= 0 ? i * 64 : rail.height - 30 - 64) + 15;
                }
                opacity: page.railMode ? 0 : 1
                transform: Scale {
                    id: markScale
                    xScale: page.railMode ? 0 : 1
                    Behavior on xScale {
                        NumberAnimation {
                            duration: 300
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.ease
                        }
                    }
                }
                Behavior on y {
                    enabled: !page.switching
                    NumberAnimation {
                        duration: 500
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.spring
                    }
                }
                Behavior on opacity {
                    NumberAnimation {
                        duration: 200
                    }
                }
            }
            Column {
                id: railCol
                width: parent.width
                Repeater {
                    id: catRep
                    model: page.lvl === "more" ? page.mcats : page.cats
                    delegate: SyIn {
                        id: catWrap
                        required property var modelData
                        readonly property alias cat: c
                        width: 330
                        SyCat {
                            id: c
                            width: 330
                            catId: catWrap.modelData.id
                            title: catWrap.modelData.t
                            meta: page.lvl === "top" ? page.catMeta(catId) : ""
                            cur: page.curCat === catId
                            autofocus: cur
                            onActivated: page.showCat(catId)
                        }
                    }
                }
            }
            // MORE 入口：钉在栏底，上方一条细线（随入口一起滑入）
            Rectangle {
                visible: moreWrap.visible
                x: 18 + moreWrap.dx
                y: moreWrap.y - 14
                width: 330 - 18 - 16
                height: 1
                color: P3.line
                opacity: moreWrap.opacity
            }
            SyIn {
                id: moreWrap
                visible: page.lvl === "top"
                y: rail.height - 30 - 64
                width: 330
                SyCat {
                    id: moreCat
                    width: 330
                    catId: "more"
                    title: "MORE"
                    more: true
                    cur: page.lvl === "top" && page.cat === "more"
                    autofocus: cur
                    onActivated: {
                        if (page.lvl === "top" && page.cat === "more")
                            page.goLevel("more");
                        else
                            page.showCat("more");
                    }
                }
            }
            Rectangle {
                x: 330 + 28
                y: 4
                width: 1
                height: parent.height - 34
                color: P3.line
            }
        }

        Item {
            id: detailBox
            x: 330 + 56
            width: parent.width - x
            height: parent.height
            opacity: page.railMode ? 0.78 : 1
            Behavior on opacity {
                NumberAnimation {
                    duration: 250
                }
            }
            Loader {
                id: detail
                anchors.fill: parent
                sourceComponent: page.compFor(page.curCat)
                onLoaded: if (page.live && !page.switching)
                    page.stagger(item, 0)
            }
        }
    }
}
