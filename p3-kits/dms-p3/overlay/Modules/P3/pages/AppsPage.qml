import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "apps"

// APPS 页（原型 prototype/pages/apps.js）。
// 左侧 930px 应用区：TRAY · PINNED（+ ALL APPS）· FREQUENT，同一套 150px 列距，↑↓ 在各行之间直走。
// 右侧详情列跟随焦点；托盘应用的详情列出它的托盘菜单（变暗的预览），M / 右键让菜单变成可操作的列表。
// 数据和动作只经过 P3Sys：Apps（列表、使用次数、搜索、图标、启动）、Tray（托盘项、显示名、对应的应用、菜单、触发），
// Clash / Ime / Qq（对应托盘项的专属菜单行）、Keybinds（固定入口的快捷键）。
// 启动应用、激活托盘应用的窗口、执行会打开窗口的托盘菜单条目时关闭整个菜单。
// 按键（vim 式：应用区和搜索结果里字母不输入，i 或 / 才开始输入）
//   托盘格        Enter = 激活窗口（只有菜单的托盘项直接打开菜单）；M / 右键 = 托盘菜单
//   托盘菜单      ↑↓ / W S / j k 选择，Enter 执行（退出要按住），Esc / Backspace / ← / h / A / M 关闭
//   固定格、常用格 Enter = 启动；ALL APPS = 全部应用（A–Z），停在结果里
//   应用区        方向键、W A S D、h j k l、g g、G 移动（框架翻译）；i 或 / 开始搜索（输入）
//   搜索（输入）  字母都是输入，Backspace 删字（空了就退出），Enter 启动焦点上的应用；方向键、Ctrl+h/j/k/l、Ctrl+n/p 在结果里移动；
//                 Esc 离开输入（有结果时）
//   搜索（结果）  光标隐去，h j k l、g g、G 在结果里移动，Enter / Space 启动；i、/ 回到输入，Backspace 回到输入并删一个字；Esc 退出搜索
//   右键（合成的 Esc）在搜索里直接退出搜索
P3Page {
    id: page
    title: "APPS"

    readonly property bool still: !!ctx && ctx.still
    property bool alive: false
    property bool intro: true

    // ---------------------------------------------------------------- 视图状态
    property string menuOn: ""          // 菜单处于可操作状态的托盘项 id
    property int menuIdx: -1            // 菜单里焦点行的序号（菜单重建后回到同一行）
    property var qText: null            // 搜索文字；null = 应用区
    property bool qBrowse: false        // 搜索时离开了输入（字母不再输入，h j k l 在结果里移动）
    textEntry: qText !== null && !qBrowse
    property var hits: []               // 搜索结果的应用 id（最多 35 个）
    property int hitCount: 0
    property string lastRef: ""         // 应用区里最后一个焦点格
    property string backRef: ""         // 退出搜索后回到的格
    property string detailRef: ""       // 详情列显示的对象：tray:<id> | pin:<role> | fq:<id> | hit:<id> | all
    readonly property var menus: Tray.menus  // 托盘项 id → 通用菜单条目（Tray.menu 的结果）
    property var asked: ({})
    property var pendingK: ({})         // 动作进行中的单选 / 开关值，结束后回到真实状态
    property var tiles: ({})            // ref → 格子
    property var releaseKeybinds: null

    // ---------------------------------------------------------------- 托盘项
    readonly property var trayItems: Tray.state.items
    readonly property string trayKey: {
        const seen = {};
        const out = [];
        for (const t of trayItems) {
            if (t.id && !seen[t.id]) {
                seen[t.id] = true;
                out.push(t.id);
            }
        }
        return out.join("\u0001");
    }
    readonly property var trayIds: trayKey ? trayKey.split("\u0001") : []

    function trayItem(id) {
        return trayItems.find(t => t.id === id) || null;
    }
    // 这个托盘项属于哪类专属菜单（Clash / QQ 以各自后端认定的托盘项为准）
    function trayKind(t) {
        if (Clash.trayId && t.id === Clash.trayId)
            return "clash";
        if (Tray.isFcitx(t.id))
            return "fcitx";
        if (Qq.trayId && t.id === Qq.trayId)
            return "qq";
        return "";
    }
    // 应用在托盘里运行时对应的托盘项
    function trayOfApp(a) {
        return a ? trayItem(Tray.trayOfApp(a.id)) : null;
    }

    // 专属状态的中文短词（后端只给 id）
    readonly property var modeNames: ({
            "rule": "规则模式",
            "global": "全局模式",
            "direct": "直连模式"
        })
    readonly property var imeNames: ({
            "rime": ["中文", "中文 · Rime"],
            "keyboard-us": ["英文", "英文 · US"]
        })
    function imeShort(id) {
        if (imeNames[id])
            return imeNames[id][0];
        const x = Ime.state.list.find(i => i.id === id);
        return x ? x.name : id;
    }
    function imeLabel(x) {
        return imeNames[x.id] ? imeNames[x.id][1] : x.name;
    }
    function qqLabel(p) {
        const x = Qq.state.list.find(i => i[0] === p);
        return x ? x[1] : p;
    }
    // 托盘项的一行状态（只在它有话说的时候）
    function trayStatus(t) {
        const kind = trayKind(t);
        if (kind === "clash" && Clash.state.available)
            return (modeNames[Clash.state.mode] || Clash.state.mode) + (Clash.state.node ? " · " + Clash.state.node : "");
        if (kind === "fcitx")
            return Ime.state.available && Ime.state.im ? imeShort(Ime.state.im) : (t.item ? Tray.firstLine(t.item.tooltipTitle) : "");
        if (kind === "qq" && Qq.state.available)
            return qqLabel(Qq.state.presence);
        if (t.status)
            return Tray.firstLine(t.status);
        return String(t.title || "").split("\n").slice(1).map(s => s.trim()).find(s => s) || "";
    }

    // ---------------------------------------------------------------- 托盘菜单行
    // 行 = 专属行（Clash / 输入法 / QQ）+ 托盘项自己的通用条目（Tray.menu，异步）
    // t：h 分组标题 · radio（k = 状态键）· toggle · node（切换 Clash 节点）· act（执行）· quit（按住退出）
    // also：通用条目里和这一行重复的说法（归一化后相等或包含），这些条目不再单列
    function specificRows(kind) {
        const rows = [];
        if (kind === "clash" && Clash.state.available) {
            rows.push({
                "t": "h",
                "label": "代理模式"
            });
            for (const v in modeNames)
                rows.push({
                    "t": "radio",
                    "k": "clash.mode",
                    "v": v,
                    "label": modeNames[v]
                });
            if (Clash.state.nodes.length > 1)
                rows.push({
                    "t": "node",
                    "label": "节点"
                });
            rows.push({
                "t": "h",
                "label": "网络"
            });
            rows.push({
                "t": "toggle",
                "k": "clash.sysproxy",
                "label": "系统代理",
                "locked": !Clash.state.sysproxyWritable
            });
            rows.push({
                "t": "toggle",
                "k": "clash.tun",
                "label": "TUN 模式"
            });
        } else if (kind === "fcitx" && Ime.state.available && Ime.state.list.length) {
            rows.push({
                "t": "h",
                "label": "输入法"
            });
            for (const x of Ime.state.list)
                rows.push({
                    "t": "radio",
                    "k": "ime",
                    "v": x.id,
                    "label": imeLabel(x)
                });
            if (Apps.byId("fcitx5-configtool"))
                rows.push({
                    "t": "act",
                    "label": "配置",
                    "app": "fcitx5-configtool",
                    "also": ["设置", "settings", "configure"]
                });
        } else if (kind === "qq" && Qq.state.available) {
            rows.push({
                "t": "h",
                "label": "我的状态"
            });
            for (const p of Qq.state.list)
                rows.push({
                    "t": "radio",
                    "k": "qq",
                    "v": p[0],
                    "label": p[1]
                });
        }
        return rows;
    }
    function menuRows(id) {
        const t = trayItem(id);
        if (!t)
            return [];
        const kind = trayKind(t);
        const rows = specificRows(kind);
        const same = {};
        const also = [];
        for (const r of rows) {
            same[Tray.norm(r.label)] = r;
            for (const a of r.also || [])
                also.push([Tray.norm(a), r]);
        }
        // 输入法列表已经是专属单选行：fcitx 自己的单选条目就是同一份列表
        const imeRows = kind === "fcitx" && rows.some(r => r.k === "ime");
        const es = menus[id];
        if (es === undefined) {
            rows.push({
                "t": "h",
                "label": "读取菜单…"
            });
            return rows;
        }
        for (const e of es) {
            const text = String(e.text || "").trim();
            if (e.sep || !text || e.hasChildren)
                continue;
            const n = Tray.norm(text);
            if (same[n] || also.some(x => x[0] && n.includes(x[0])))
                continue;
            if (imeRows && e.buttonType === 2)
                continue;
            if (e.danger)
                rows.push({
                    "t": "quit",
                    "label": text,
                    "entryId": e.id
                });
            else
                rows.push({
                    "t": "act",
                    "label": text,
                    "entryId": e.id,
                    "checkable": e.buttonType > 0,
                    "checked": !!e.checked,
                    "locked": e.enabled === false
                });
        }
        return rows;
    }
    function rowsKey(rows) {
        return rows.map(r => [r.t, r.label, r.k || "", r.v || "", r.entryId || "", r.app || "", r.checked ? 1 : 0, r.locked ? 1 : 0].join("\u0002")).join("\u0001");
    }
    function stateOf(k) {
        if (k in pendingK)
            return pendingK[k];
        switch (k) {
        case "clash.mode":
            return Clash.state.mode;
        case "clash.sysproxy":
            return Clash.state.sysproxy;
        case "clash.tun":
            return Clash.state.tun;
        case "ime":
            return Ime.state.im;
        case "qq":
            return Qq.state.presence;
        }
        return undefined;
    }
    function rowOn(r) {
        if (r.t === "radio")
            return stateOf(r.k) === r.v;
        if (r.t === "toggle")
            return !!stateOf(r.k);
        return !!r.checked;
    }
    function setPending(k, v) {
        const p = Object.assign({}, pendingK);
        if (v === undefined)
            delete p[k];
        else
            p[k] = v;
        pendingK = p;
    }
    function prunePending() {
        const p = {};
        let changed = false;
        for (const k in pendingK) {
            const real = k === "clash.mode" ? Clash.state.mode : k === "clash.sysproxy" ? Clash.state.sysproxy : k === "clash.tun" ? Clash.state.tun : k === "ime" ? Ime.state.im : Qq.state.presence;
            if (real === pendingK[k])
                changed = true;
            else
                p[k] = pendingK[k];
        }
        if (changed)
            pendingK = p;
    }
    Connections {
        target: Clash
        function onStateChanged() {
            page.prunePending();
        }
    }
    function nextNode() {
        const ns = Clash.state.nodes;
        return ns[(ns.indexOf(Clash.state.node) + 1) % ns.length];
    }

    // ---------------------------------------------------------------- 应用
    readonly property var pinRoles: Object.keys(Apps.state.pinned)
    // FREQUENT：按使用次数，去掉固定入口和托盘里正在运行的，前 5 个
    readonly property string freqKey: {
        const usage = Apps.state.usage;
        const pinned = Object.values(Apps.state.pinned).filter(Boolean);
        const running = {};
        for (const t of trayItems) {
            if (t.appId)
                running[t.appId] = true;
        }
        return Apps.ranked().filter(a => (usage[a.id] || 0) > 0 && pinned.indexOf(a.id) < 0 && !running[a.id]).slice(0, 5).map(a => a.id).join("\u0001");
    }
    readonly property var freqIds: freqKey ? freqKey.split("\u0001") : []

    // 固定入口的快捷键：niri 里 spawn 这个程序的绑定（不带参数的优先）
    function bindKey(a) {
        if (!a)
            return "—";
        const e = a.entry;
        const cmd = e && e.command && e.command.length ? String(e.command[0]) : String((e && e.execString) || "").split(/\s+/)[0];
        const names = [a.id.toLowerCase(), cmd.split("/").pop().toLowerCase()].filter(Boolean);
        let best = null;
        for (const b of Keybinds.state.list) {
            const m = /^(?:spawn|spawn-sh|spawn_shell|exec)\s+["']?([^"'\s]+)["']?(.*)$/.exec(String(b.cmd || ""));
            if (!m || names.indexOf(m[1].split("/").pop().toLowerCase()) < 0)
                continue;
            const bare = m[2].trim() === "";
            if (!best || (bare && !best.bare) || (bare === best.bare && b.cmd.length < best.cmd.length))
                best = {
                    "key": b.key,
                    "cmd": b.cmd,
                    "bare": bare
                };
        }
        return best ? best.key.toUpperCase() : "—";
    }

    // A–Z：中文名按拼音首字母插进对应字母（依赖系统 zh 排序规则；不可用时排在最前）
    readonly property string pyLetters: "ABCDEFGHJKLMNOPQRSTWXYZ"
    readonly property string pyBounds: "阿八嚓哒妸发旮哈讥咔垃妈拏噢妑七呥仨他屲夕丫帀"
    readonly property bool pyOk: "阿".localeCompare("八") < 0 && "八".localeCompare("嚓") < 0
    function azKey(a) {
        const c = a.name.charAt(0);
        if (!/[㐀-鿿]/.test(c))
            return [c.toUpperCase(), 0];
        let l = "";
        if (pyOk) {
            for (let i = 0; i < pyBounds.length; i++) {
                if (pyBounds[i].localeCompare(c) <= 0)
                    l = pyLetters[i];
                else
                    break;
            }
        }
        return [l, 1];
    }
    function azCompare(a, b) {
        const x = azKey(a), y = azKey(b);
        if (x[0] !== y[0])
            return x[0] < y[0] ? -1 : 1;
        return x[1] - y[1] || a.name.localeCompare(b.name);
    }
    // 搜索：Apps.search（AppSearchService 的打分，不截断）；空串 = 全部应用 A–Z
    function searchApps(text) {
        const s = text.trim();
        if (!s)
            return Apps.state.all.slice().sort(azCompare);
        const seen = {};
        return Apps.search(s).filter(a => a && !seen[a.id] && (seen[a.id] = true));
    }

    // ---------------------------------------------------------------- 动作
    function run(promise, o) {
        if (!ctx)
            return promise;
        return ctx.run(promise, o || {});
    }
    Component {
        id: laterComp
        Timer {
            running: true
        }
    }
    function later(fn, ms) {
        const t = laterComp.createObject(page, {
            "interval": Math.max(0, ms)
        });
        t.triggered.connect(() => {
            t.destroy();
            if (page.alive)
                fn();
        });
    }

    function activateTile(tile) {
        const ref = tile.ref;
        if (ref === "all") {
            Qt.callLater(() => setSearch("", true));
            return;
        }
        const i = ref.indexOf(":");
        const kind = ref.slice(0, i), arg = ref.slice(i + 1);
        if (kind === "tray") {
            const t = trayItem(arg);
            if (t && t.item && t.item.onlyMenu) {
                openMenu(arg);
                return;
            }
            launch(tile, () => Tray.activate(arg));
        } else if (kind === "pin") {
            launch(tile, () => Apps.launch(Apps.state.pinned[arg]));
        } else {
            launch(tile, () => Apps.launch(arg));
        }
    }
    // 会打开窗口的动作：先关菜单（交还键盘焦点），再执行
    function launch(tile, act) {
        if (tile)
            ghost(tile);
        if (ctx)
            ctx.close();
        run(act());
    }
    function rowActivated(id, r) {
        if (r.t === "radio") {
            if (stateOf(r.k) === r.v)
                return;
            setPending(r.k, r.v);
            const p = r.k === "clash.mode" ? Clash.setMode(r.v) : r.k === "ime" ? Ime.set(r.v) : Qq.set(r.v);
            run(p, {
                "done": () => setPending(r.k, undefined)
            });
        } else if (r.t === "toggle") {
            const on = !stateOf(r.k);
            setPending(r.k, on);
            run(r.k === "clash.tun" ? Clash.setTun(on) : Clash.setSysProxy(on), {
                "done": () => setPending(r.k, undefined)
            });
        } else if (r.t === "node") {
            run(Clash.setNode(nextNode()));
        } else if (r.t === "act" && (r.app || !r.checkable)) {
            launch(null, () => r.app ? Apps.launch(r.app) : Tray.trigger(id, r.entryId));
        } else if (r.t === "act") {
            run(Tray.trigger(id, r.entryId), {
                "done": () => {
                    if (!still)
                        later(closeMenu, 320);
                }
            });
        }
    }
    function quitConfirmed(id, r) {
        run(Tray.trigger(id, r.entryId), {
            "done": () => later(closeMenu, still ? 0 : 380)
        });
    }

    // 启动时图标的残影：从原位飞向右上、放大、淡出
    Component {
        id: ghostComp
        Image {
            id: g
            z: 6
            fillMode: Image.PreserveAspectFit
            asynchronous: false
            mipmap: true
            ParallelAnimation {
                running: true
                NumberAnimation {
                    target: g
                    property: "opacity"
                    to: 0
                    duration: 600
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
                NumberAnimation {
                    target: g
                    property: "scale"
                    to: 1.6
                    duration: 600
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
                NumberAnimation {
                    target: g
                    property: "x"
                    to: g.x + 90
                    duration: 600
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
                NumberAnimation {
                    target: g
                    property: "y"
                    to: g.y - 30
                    duration: 600
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
                onFinished: g.destroy()
            }
        }
    }
    function ghost(tile) {
        const ic = tile.iconItem;
        if (still || !ic || !ic.hasImage)
            return;
        const p = ic.mapToItem(page, 0, 0);
        const q = ic.mapToItem(page, ic.width, ic.height);
        ghostComp.createObject(page, {
            "x": p.x,
            "y": p.y,
            "width": q.x - p.x,
            "height": q.y - p.y,
            "source": ic.source,
            "sourceSize": Qt.size(ic.s * 2, ic.s * 2)
        });
    }

    // ---------------------------------------------------------------- 焦点、详情列
    function reg(tile) {
        tiles[tile.ref] = tile;
    }
    function unreg(tile) {
        if (tiles[tile.ref] === tile)
            delete tiles[tile.ref];
    }
    function firstFieldTile() {
        const order = trayIds.map(i => "tray:" + i).concat(pinRoles.map(r => "pin:" + r), ["all"], freqIds.map(i => "fq:" + i));
        for (const r of order) {
            const el = tiles[r];
            if (el && !el.disabled)
                return el;
        }
        return null;
    }
    function focusRef(ref) {
        const el = tiles[ref] && !tiles[ref].disabled ? tiles[ref] : firstFieldTile();
        if (el && ctx)
            ctx.focus(el);
    }
    // 托盘项增减、常用列表变化后格子会重建：焦点回到原来那一格
    function restoreFocus() {
        if (!ctx || !ctx.live || menuOn || qText !== null)
            return;
        const f = ctx.focused();
        if (f && f.ref && tiles[f.ref] === f)
            return;
        focusRef(lastRef);
    }
    onTrayIdsChanged: {
        if (menuOn && trayIds.indexOf(menuOn) < 0)
            closeMenu();
        Qt.callLater(restoreFocus);
    }
    onFreqIdsChanged: Qt.callLater(restoreFocus)

    function showDetail(ref) {
        detLoader.sourceComponent = null;
        detailRef = ref || "";
        const kind = detailRef.split(":")[0];
        detLoader.sourceComponent = kind === "tray" ? detTray : kind === "pin" ? detPin : kind === "fq" ? detFq : kind === "hit" ? detHit : kind === "all" ? detAll : null;
    }
    function sync(item) {
        if (!item)
            return;
        if (item.isMenuRow === true) {
            menuIdx = menuRowItems().indexOf(item);
            return;
        }
        if (menuOn || item.ref === undefined)
            return;
        const ref = item.ref;
        if (qText === null)
            lastRef = ref;
        if (ref !== detailRef)
            showDetail(ref);
        if (ref.startsWith("tray:"))
            loadMenu(ref.slice(5));
    }
    onFocusMoved: item => sync(item)

    // ---------------------------------------------------------------- 托盘菜单
    // 通用条目是异步的（QsMenuOpener）：页面每次打开时每个托盘项重读一次，结果在 Tray.menus 里，到了就重画
    function loadMenu(id) {
        if (asked[id])
            return;
        asked[id] = true;
        Tray.menu(id);
    }
    function menuRowItems() {
        const out = [];
        const walk = n => {
            for (const c of n.children) {
                if (c.isMenuRow === true && c.visible && !c.disabled)
                    out.push(c);
                else
                    walk(c);
            }
        };
        if (detLoader.item)
            walk(detLoader.item);
        return out;
    }
    function focusMenu(idx) {
        if (!menuOn || !ctx || !ctx.live)
            return;
        const rows = menuRowItems();
        if (!rows.length)
            return;
        ctx.focus(rows[idx] || rows.find(r => r.kind === "radio" && r.on) || rows[0]);
        ctx.refocus();
    }
    function openMenu(id) {
        if (!trayItem(id))
            return;
        if (detailRef !== "tray:" + id)
            showDetail("tray:" + id);
        menuIdx = -1;
        menuOn = id;
        loadMenu(id);
        Qt.callLater(() => focusMenu(-1));
    }
    function closeMenu() {
        if (!menuOn)
            return;
        const id = menuOn;
        menuOn = "";
        menuIdx = -1;
        if (trayItem(id) && tiles["tray:" + id])
            focusRef("tray:" + id);
        else
            focusRef("");
    }

    // ---------------------------------------------------------------- 搜索
    // browse：停在结果里（字母不输入），ALL APPS 用
    function setSearch(text, browse) {
        if (qText === null)
            backRef = lastRef;
        qBrowse = !!browse;
        const res = searchApps(text);
        hitCount = res.length;
        hits = res.slice(0, 35).map(a => a.id);
        qText = text;
        Qt.callLater(focusSearch);
    }
    function focusSearch() {
        if (!ctx || !ctx.live || qText === null)
            return;
        const el = hits.length ? tiles["hit:" + hits[0]] : noneItem;
        if (el)
            ctx.focus(el);
        ctx.refocus();
    }
    function endSearch() {
        qBrowse = false;
        qText = null;
        hits = [];
        hitCount = 0;
        Qt.callLater(() => {
            if (ctx && ctx.live && qText === null)
                focusRef(backRef);
        });
    }

    // ---------------------------------------------------------------- 按键
    // 右键托盘格 = 打开它的托盘菜单；其余右键按返回处理（菜单打开时先关菜单）
    function handleRightClick(e) {
        if (menuOn || qText !== null)
            return false;
        const ref = e.item ? String(e.item.ref || "") : "";
        if (!ref.startsWith("tray:"))
            return false;
        openMenu(ref.slice(5));
        return true;
    }
    function handleKey(e) {
        const k = e.key;
        const ch = e.text || "";
        const printable = ch.length === 1 && (/[A-Za-z0-9\-+. ]/.test(ch) || ch.charCodeAt(0) > 0x9f);
        if (menuOn) {
            if (k === Qt.Key_Escape || k === Qt.Key_Backspace || k === Qt.Key_Left || k === Qt.Key_A || k === Qt.Key_M) {
                closeMenu();
                return true;
            }
            if (k === Qt.Key_Right || k === Qt.Key_D)
                return true;
            if (k === Qt.Key_W || k === Qt.Key_S)
                return false;
            return printable && ch !== " ";
        }
        // i / I / /：进入输入
        const insert = !e.synthetic && (ch === "/" || k === Qt.Key_I);
        if (qText !== null) {
            const f = ctx ? ctx.focused() : null;
            if (k === Qt.Key_Escape) {
                if (!qBrowse && !e.synthetic && hitCount > 0) {
                    qBrowse = true;
                    return true;
                }
                endSearch();
                return true;
            }
            if (k === Qt.Key_Backspace) {
                qBrowse = false;
                if (qText)
                    setSearch(qText.slice(0, -1));
                else
                    endSearch();
                return true;
            }
            if (k === Qt.Key_Left || (qBrowse && k === Qt.Key_A)) {
                if (!f || !(f.col > 0)) {
                    endSearch();
                    return true;
                }
                return false;
            }
            if ((k === Qt.Key_Return || k === Qt.Key_Enter || k === Qt.Key_Space) && f && f.ref === "none")
                return true;
            if (qBrowse) {
                if (insert) {
                    qBrowse = false;
                    return true;
                }
                return false;
            }
            if (ch === "/")
                return true;
            if (k === Qt.Key_Space && !qText)
                return true;
            if (printable) {
                if (qText.length < 24)
                    setSearch(qText + ch);
                return true;
            }
            return false;
        }
        const f = ctx ? ctx.focused() : null;
        if (k === Qt.Key_M && f && String(f.ref || "").startsWith("tray:")) {
            openMenu(f.ref.slice(5));
            return true;
        }
        if (insert) {
            setSearch("");
            return true;
        }
        return false;
    }

    onEntered: {
        alive = true;
        intro = false;
        asked = ({});
        Clash.addRef();
        Ime.addRef();
        releaseKeybinds = Keybinds.watch();
        for (const id of trayIds)
            loadMenu(id);
        sync(ctx.focused());
    }
    onLeaving: {
        alive = false;
        Clash.removeRef();
        Ime.removeRef();
        if (releaseKeybinds)
            releaseKeybinds();
        releaseKeybinds = null;
        menuOn = "";
        qText = null;
    }

    // ================================================================ 应用区
    Flickable {
        id: field
        width: 930
        height: P3.pageH
        visible: page.qText === null
        contentWidth: width
        contentHeight: fieldCol.height
        interactive: contentHeight > height
        boundsBehavior: Flickable.StopAtBounds
        clip: interactive

        Column {
            id: fieldCol
            width: 930
            spacing: 30

            Column {
                visible: page.trayIds.length > 0
                width: parent.width
                spacing: 14
                P3Sec {
                    width: parent.width
                    height: 15
                    text: "TRAY"
                    opacity: page.menuOn ? 0.22 : 1
                    Behavior on opacity {
                        NumberAnimation {
                            duration: 250
                        }
                    }
                }
                Grid {
                    columns: 6
                    columnSpacing: 18
                    rowSpacing: 6
                    Repeater {
                        model: page.trayIds
                        delegate: ApTile {
                            id: trayTile
                            required property string modelData
                            required property int index
                            readonly property var t: page.trayItem(modelData)
                            ref: "tray:" + modelData
                            iconSource: t ? t.icon : ""
                            label: t ? t.name : ""
                            badge: t ? t.badge : 0
                            s: 68
                            q: index
                            rise: page.intro
                            still: page.still
                            lit: page.menuOn === modelData
                            dimmed: page.menuOn !== "" && !lit
                            disabled: dimmed
                            onActivated: page.activateTile(trayTile)
                            Component.onCompleted: page.reg(trayTile)
                            Component.onDestruction: page.unreg(trayTile)
                        }
                    }
                }
            }

            Column {
                width: parent.width
                spacing: 14
                P3Sec {
                    width: parent.width
                    height: 15
                    text: "PINNED"
                    opacity: page.menuOn ? 0.22 : 1
                    Behavior on opacity {
                        NumberAnimation {
                            duration: 250
                        }
                    }
                }
                Grid {
                    columns: 6
                    columnSpacing: 18
                    rowSpacing: 6
                    Repeater {
                        model: page.pinRoles
                        delegate: ApTile {
                            id: pinTile
                            required property string modelData
                            required property int index
                            readonly property var app: Apps.byId(Apps.state.pinned[modelData])
                            ref: "pin:" + modelData
                            iconSource: app ? Apps.iconSource(app.icon) : ""
                            label: modelData
                            s: 88
                            q: page.trayIds.length + index
                            rise: page.intro
                            still: page.still
                            dimmed: page.menuOn !== ""
                            disabled: dimmed || !app
                            onActivated: page.activateTile(pinTile)
                            Component.onCompleted: page.reg(pinTile)
                            Component.onDestruction: page.unreg(pinTile)
                        }
                    }
                    ApTile {
                        id: allTile
                        ref: "all"
                        glyph: "apps"
                        label: "ALL APPS"
                        s: 88
                        q: page.trayIds.length + page.pinRoles.length
                        rise: page.intro
                        still: page.still
                        dimmed: page.menuOn !== ""
                        disabled: dimmed
                        onActivated: page.activateTile(allTile)
                        Component.onCompleted: page.reg(allTile)
                        Component.onDestruction: page.unreg(allTile)
                    }
                }
            }

            Column {
                visible: page.freqIds.length > 0
                width: parent.width
                spacing: 14
                P3Sec {
                    width: parent.width
                    height: 15
                    text: "FREQUENT"
                    opacity: page.menuOn ? 0.22 : 1
                    Behavior on opacity {
                        NumberAnimation {
                            duration: 250
                        }
                    }
                }
                Grid {
                    columns: 6
                    columnSpacing: 18
                    rowSpacing: 6
                    Repeater {
                        model: page.freqIds
                        delegate: ApTile {
                            id: fqTile
                            required property string modelData
                            required property int index
                            readonly property var app: Apps.byId(modelData)
                            ref: "fq:" + modelData
                            iconSource: app ? Apps.iconSource(app.icon) : ""
                            label: app ? app.name : modelData
                            rank: String(index + 1)
                            s: 60
                            q: page.trayIds.length + page.pinRoles.length + 1 + index
                            rise: page.intro
                            still: page.still
                            dimmed: page.menuOn !== ""
                            disabled: dimmed
                            onActivated: page.activateTile(fqTile)
                            Component.onCompleted: page.reg(fqTile)
                            Component.onDestruction: page.unreg(fqTile)
                        }
                    }
                }
            }
        }
    }

    // 菜单打开时点应用区任意处 = 关闭菜单
    MouseArea {
        z: 5
        width: 970
        height: P3.pageH
        enabled: page.menuOn !== ""
        visible: enabled
        acceptedButtons: Qt.LeftButton
        onClicked: page.closeMenu()
    }

    // ================================================================ 搜索视图
    Item {
        id: srch
        width: 930
        height: P3.pageH
        visible: page.qText !== null
        readonly property string q: page.qText === null ? "" : page.qText

        Item {
            id: qline
            width: parent.width
            height: 96
            Rectangle {
                anchors.bottom: parent.bottom
                width: parent.width
                height: 1
                color: P3.line
            }
            // 基线位置按原型的行盒（72px × .86，底边离细线 14px）算出
            P3Text {
                id: queryText
                visible: srch.q !== ""
                anchors.baseline: parent.top
                anchors.baselineOffset: 75
                kind: "h1"
                font.pixelSize: 72
                font.letterSpacing: -0.72
                lineHeight: 1
                rightPadding: 4
                width: Math.min(implicitWidth, 640)
                clip: true
                text: srch.q
                color: P3.tx
            }
            P3Text {
                id: qEmpty
                visible: srch.q === ""
                anchors.baseline: parent.top
                anchors.baselineOffset: 75
                kind: "zh"
                font.pixelSize: 22
                font.weight: Font.Bold
                font.letterSpacing: 2.2
                text: "输入名称搜索"
                color: P3.dim
            }
            Rectangle {
                x: srch.q !== "" ? queryText.width + 8 : qEmpty.width + 12
                anchors.bottom: parent.bottom
                anchors.bottomMargin: 14
                width: 5
                height: srch.q !== "" ? 62 : 30
                color: P3.fill
                visible: !page.qBrowse
            }
            P3Text {
                id: countText
                anchors.right: countUnit.left
                anchors.rightMargin: 1
                anchors.baseline: parent.top
                anchors.baselineOffset: 76
                kind: "numSm"
                rightPadding: 3
                text: String(page.hitCount)
                color: P3.tx
            }
            P3Text {
                id: countUnit
                anchors.right: parent.right
                anchors.baseline: countText.baseline
                kind: "unit"
                font.family: P3.fontZh
                text: srch.q ? "个匹配" : "个应用"
                color: P3.dim
            }
        }

        Grid {
            y: 96 + 18
            columns: 7
            columnSpacing: 16
            rowSpacing: 0
            Repeater {
                model: page.hits
                delegate: ApTile {
                    id: hitTile
                    required property string modelData
                    required property int index
                    readonly property var app: Apps.byId(modelData)
                    ref: "hit:" + modelData
                    iconSource: app ? Apps.iconSource(app.icon) : ""
                    label: app ? app.name : modelData
                    compact: true
                    s: 52
                    q: index
                    col: index % 7
                    hitIn: true
                    still: page.still
                    onActivated: page.activateTile(hitTile)
                    Component.onCompleted: page.reg(hitTile)
                    Component.onDestruction: page.unreg(hitTile)
                }
            }
        }

        P3Focusable {
            id: noneItem
            readonly property string ref: "none"
            visible: page.qText !== null && page.hitCount === 0
            cursor: "none"
            y: 96 + 40
            width: noneText.implicitWidth
            height: noneText.implicitHeight
            P3Text {
                id: noneText
                kind: "zh"
                font.pixelSize: 22
                text: "没有匹配「" + srch.q + "」的应用"
                color: P3.dim
            }
        }
    }

    // ================================================================ 详情列
    Item {
        id: det
        x: 970
        width: 440
        height: P3.pageH
        Rectangle {
            width: 1
            height: parent.height
            color: P3.line
        }
        Loader {
            id: detLoader
            x: 40
            width: 400
            height: parent.height
        }
    }

    Component {
        id: detTray
        Column {
            id: dt
            readonly property string arg: page.detailRef.slice(5)
            readonly property var t: page.trayItem(arg)
            readonly property bool live: page.menuOn !== "" && page.menuOn === arg
            width: 400
            onLiveChanged: if (!live)
                mflick.contentY = 0
            ApHead {
                id: head
                visible: !!dt.t
                iconSource: dt.t ? dt.t.icon : ""
                name: dt.t ? dt.t.name : ""
                sub: dt.t ? page.trayStatus(dt.t) : ""
                badge: dt.t ? dt.t.badge : 0
                ApDx {
                    j: 0
                    still: page.still
                }
            }
            // 菜单行多于一屏时在详情列里滚动（焦点行由框架滚进视野）
            Item {
                width: 400
                height: P3.pageH - (head.visible ? head.height : 0)
                ApDx {
                    j: 1
                    still: page.still
                }
                Flickable {
                    id: mflick
                    x: -20
                    width: 420
                    height: parent.height
                    contentWidth: width
                    contentHeight: mlist.height
                    interactive: contentHeight > height
                    boundsBehavior: Flickable.StopAtBounds
                    clip: true
                    Column {
                        id: mlist
                        x: 20
                        property var model: []
                        property string key: ""
                        readonly property var rowsNow: page.menuRows(dt.arg)
                        function sync() {
                            const k = page.rowsKey(rowsNow);
                            if (k === key)
                                return;
                            key = k;
                            model = rowsNow;
                            if (page.menuOn === dt.arg)
                                Qt.callLater(() => page.focusMenu(page.menuIdx));
                        }
                        onRowsNowChanged: sync()
                        Component.onCompleted: sync()
                        width: 400
                        Repeater {
                            model: mlist.model
                            delegate: Item {
                                id: rowBox
                                required property var modelData
                                required property int index
                                width: 400
                                height: row.height + (modelData.t === "quit" ? 10 : 0)
                                ApMenuRow {
                                    id: row
                                    y: rowBox.height - height
                                    kind: rowBox.modelData.t
                                    label: rowBox.modelData.label
                                    value: rowBox.modelData.t === "node" ? Clash.state.node : ""
                                    on: page.rowOn(rowBox.modelData)
                                    checkable: !!rowBox.modelData.checkable
                                    locked: !!rowBox.modelData.locked
                                    live: dt.live
                                    j: rowBox.index
                                    still: page.still
                                    onActivated: page.rowActivated(dt.arg, rowBox.modelData)
                                    onConfirmed: page.quitConfirmed(dt.arg, rowBox.modelData)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Component {
        id: detPin
        Column {
            id: dp
            readonly property string role: page.detailRef.slice(4)
            readonly property string appId: Apps.state.pinned[role] || ""
            readonly property var app: Apps.byId(appId)
            width: 400
            ApHead {
                iconSource: dp.app ? Apps.iconSource(dp.app.icon) : ""
                name: dp.role
                ApDx {
                    j: 0
                    still: page.still
                }
            }
            ApFact {
                label: "程序"
                value: dp.app ? dp.app.id : "—"
                ApDx {
                    j: 1
                    still: page.still
                }
            }
            ApFact {
                label: "快捷键"
                value: page.bindKey(dp.app)
                ApDx {
                    j: 2
                    still: page.still
                }
            }
        }
    }

    Component {
        id: detFq
        Column {
            id: df
            readonly property string appId: page.detailRef.slice(3)
            readonly property var app: Apps.byId(appId)
            readonly property int n: Apps.state.usage[appId] || 0
            readonly property int most: Math.max(1, ...Object.values(Apps.state.usage))
            width: 400
            ApHead {
                iconSource: df.app ? Apps.iconSource(df.app.icon) : ""
                name: df.app ? df.app.name : df.appId
                ApDx {
                    j: 0
                    still: page.still
                }
            }
            Item {
                width: 400
                height: 4 + big.height + 16 + 6
                Row {
                    id: big
                    y: 4
                    spacing: 10
                    P3Text {
                        id: bigNum
                        kind: "num"
                        rightPadding: 5
                        text: String(df.n)
                        color: P3.tx
                    }
                    P3Text {
                        anchors.baseline: bigNum.baseline
                        kind: "unit"
                        font.family: P3.fontZh
                        text: "次启动"
                        color: P3.dim
                    }
                }
                P3Bar {
                    y: big.y + big.height + 16
                    width: 400
                    value: df.n / df.most * 100
                }
                ApDx {
                    j: 1
                    still: page.still
                }
            }
        }
    }

    Component {
        id: detHit
        Column {
            id: dh
            readonly property string appId: page.detailRef.slice(4)
            readonly property var app: Apps.byId(appId)
            width: 400
            ApHead {
                iconSource: dh.app ? Apps.iconSource(dh.app.icon) : ""
                name: dh.app ? dh.app.name : dh.appId
                sub: page.trayOfApp(dh.app) ? "托盘中运行" : ""
                ApDx {
                    j: 0
                    still: page.still
                }
            }
            ApFact {
                label: "桌面项"
                value: dh.appId
                ApDx {
                    j: 1
                    still: page.still
                }
            }
        }
    }

    Component {
        id: detAll
        Column {
            width: 400
            ApHead {
                glyph: "apps"
                name: "ALL APPS"
                ApDx {
                    j: 0
                    still: page.still
                }
            }
            Item {
                width: 400
                height: 4 + allNum.height
                Row {
                    y: 4
                    spacing: 10
                    P3Text {
                        id: allNum
                        kind: "num"
                        rightPadding: 5
                        text: String(Apps.state.all.length)
                        color: P3.tx
                    }
                    P3Text {
                        anchors.baseline: allNum.baseline
                        kind: "unit"
                        font.family: P3.fontZh
                        text: "个应用"
                        color: P3.dim
                    }
                }
                ApDx {
                    j: 1
                    still: page.still
                }
            }
        }
    }
}
