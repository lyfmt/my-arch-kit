import QtQuick
import qs.Modules.P3
import qs.P3Sys
import "status"

// STATUS：数字读数页，原型 prototype/pages/status.js。
// 数据：Stats（DgopService 读数；进入时 watch，离开时 release）、ProcList（进程列表 / 排序 / 结束进程，同样引用计数）、
//      Battery（电量、功率、剩余时间、健康度、充电上限、性能模式；性能模式与 SYSTEM 页共用）。
// 布局：左列 CPU / MEMORY / DISK 水箱 + CPU 历史曲线；右列电池水箱 + 性能模式三选一；底部一条读数 + PROCESSES 入口。
// PROCESSES（唯一入口，快捷键 P）把左列换成进程列表：Tab 切换 CPU / MEM 排序，按住 Enter 结束进程（SIGTERM），
//   Esc / ← 收起。列表行按 pid 固定，读数原地刷新；某个 pid 离开列表时该行滑出，焦点留在同一 pid 或顶上来的那一行。
// 动效：进入时液面上涨、数字从 0 数上来；液面表面慢慢漂移；每来一个 CPU 采样曲线滚动一格。截图模式直接显示终态。
P3Page {
    id: page
    title: "STATUS"

    // ---------------------------------------------------------------- 状态
    property bool stillMode: false
    property bool open: false
    property var fromEl: null
    property var rowPids: []
    property bool sorting: false
    property string optimistic: ""          // 性能模式：点下去立即高亮，出错时回滚
    readonly property int procRows: 8

    // 离开后（退场动画期间）冻结读数：release 之后 DgopService 会清空历史和网速
    property bool frozen: false
    property var stSnap: null
    property var procSnap: null
    property var releaseStats: null
    property var releaseProc: null

    readonly property var st: frozen && stSnap ? stSnap : Stats.state
    readonly property var bs: Battery.state
    readonly property bool statsOk: !!st.available
    readonly property bool batOk: !!bs.available

    readonly property var plist: frozen && procSnap ? procSnap : ProcList.list
    readonly property var procMap: {
        const m = {};
        for (const p of plist)
            m[p.pid] = p;
        return m;
    }
    readonly property string sortKey: ProcList.state.sort === "memory" ? "mem" : "cpu"

    // ---------------------------------------------------------------- 读数（null = 没有数据，显示 —）
    readonly property var hist: statsOk ? (st.cpuHist || []).map(v => +v || 0) : []
    readonly property var peak: hist.length ? Math.max(...hist) : null
    readonly property var avg: hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : null
    readonly property var load1: {
        const v = parseFloat(String(st.load || "").split(/\s+/)[0]);
        return statsOk && !isNaN(v) ? v : null;
    }
    // shortUptime："up 2d 3h 4m"，各段都可能缺；天折进小时
    readonly property var uptime: {
        const u = String(st.uptime || "");
        if (!statsOk || !/\d/.test(u))
            return null;
        const g = re => +((u.match(re) || [0, 0])[1]);
        return [g(/(\d+)\s*d/) * 24 + g(/(\d+)\s*h/), g(/(\d+)\s*m/)];
    }
    readonly property var downR: rate(st.down)
    readonly property var upR: rate(st.up)
    readonly property var gpuTemp: statsOk && st.gpuTemp > 0 ? st.gpuTemp : null

    // 电池：插着电 = 充电侧（CHARGE / TO LIMIT）；插着电但不在充 = 停在上限（HELD）
    readonly property int limitPct: bs.limit > 0 && bs.limit < 100 ? bs.limit : 0
    readonly property bool onAC: batOk && (!!bs.plugged || !!bs.charging)
    readonly property bool atLimit: onAC && (!bs.charging || (limitPct > 0 && bs.pct >= limitPct))
    readonly property string batState: !batOk ? "NO BATTERY" : atLimit ? "HELD" : onAC ? "CHARGING" : "ON BATTERY"
    readonly property string remainText: {
        if (!batOk || atLimit || !bs.remain)
            return "—";
        if (!onAC)
            return bs.remain;
        // 充电时 remain 是充满的时间；有充电上限时按剩余电量比例折算到上限
        const p = String(bs.remain).split(":"), mins = (+p[0] || 0) * 60 + (+p[1] || 0);
        const m = limitPct > 0 && bs.pct < limitPct && bs.pct < 100 ? Math.round(mins * (limitPct - bs.pct) / (100 - bs.pct)) : mins;
        return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
    }

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
            "t": "PERFORM",
            "g": "bolt"
        }
    ]
    readonly property string realProfile: bs.profile || "balanced"
    readonly property string curProfile: optimistic || realProfile
    onRealProfileChanged: optimistic = ""

    // ---------------------------------------------------------------- 入场计时：液面和数字按原型 [data-in] 的次序错开
    readonly property int introEnd: 1900
    property real clock: 0
    NumberAnimation {
        id: clockAnim
        target: page
        property: "clock"
        from: 0
        to: page.introEnd
        duration: page.introEnd
    }
    function at(k) {
        return 330 + k * 45;
    }
    function cu(v, k) {
        if (clock >= introEnd)
            return v;
        const x = Math.min(1, Math.max(0, (clock - at(k) - 60) / 950));
        return v * (1 - Math.pow(1 - x, 3));
    }
    function show(v, k, dec) {
        if (v === null || v === undefined || isNaN(v))
            return "—";
        const x = cu(+v, k);
        return dec ? x.toFixed(dec) : String(Math.round(x));
    }
    // 字节/秒 → [数值, 小数位, 单位]
    // "PEAK <数值>%"：数值用 tx 色；没有数据时不带 %
    function pct(lab, v) {
        return lab + " <font color=\"" + P3.tx + "\">" + v + "</font>" + (v === "—" ? "" : "%");
    }
    function rate(bps) {
        const kb = (+bps || 0) / 1024;
        if (kb >= 1048576)
            return [kb / 1048576, 1, "GB/S"];
        if (kb >= 1024)
            return [kb / 1024, 1, "MB/S"];
        return [kb, 0, "KB/S"];
    }

    onCtxChanged: if (ctx && ctx.still) {
        stillMode = true;
        clock = introEnd;
    }
    onEntered: {
        releaseStats = Stats.watch();
        releaseProc = ProcList.watch();
        if (!stillMode)
            clockAnim.start();
    }
    onLeaving: {
        stSnap = Stats.state;
        procSnap = ProcList.list;
        frozen = true;
        goneT.stop();
        rows().forEach(r => r.cancel());
        release();
    }
    Component.onDestruction: release()
    function release() {
        if (releaseStats)
            releaseStats();
        if (releaseProc)
            releaseProc();
        releaseStats = null;
        releaseProc = null;
    }

    // ---------------------------------------------------------------- 按键
    function handleKey(e) {
        const k = e.key;
        if (open) {
            if (k === Qt.Key_Escape || k === Qt.Key_Backspace || k === Qt.Key_Left || k === Qt.Key_A) {
                setOpen(false);
                return true;
            }
            if (k === Qt.Key_Tab || k === Qt.Key_Backtab) {
                setSort(sortKey === "cpu" ? "mem" : "cpu", true);
                return true;
            }
        }
        if (k === Qt.Key_Tab || k === Qt.Key_Backtab)
            return true;
        if (k === Qt.Key_P && !e.isAutoRepeat) {
            setOpen(!open);
            return true;
        }
        return false;
    }

    // ---------------------------------------------------------------- 进程列表
    function rows() {
        const out = [];
        for (let i = 0; i < rowRep.count; i++) {
            const r = rowRep.itemAt(i);
            if (r && r.pid >= 0)
                out.push(r);
        }
        return out;
    }
    function sortedPids() {
        const key = sortKey;
        return plist.slice().sort((a, b) => (b[key] - a[key]) || (a.pid - b.pid)).slice(0, procRows).map(p => p.pid);
    }
    // 重新取前 procRows 个并播放入场
    function rebuild() {
        goneT.stop();
        rowPids = sortedPids();
        for (let i = 0; i < rowRep.count; i++) {
            const r = rowRep.itemAt(i);
            if (!r)
                continue;
            if (r.pid >= 0)
                r.playIn();
            else
                r.reset();
        }
    }
    // 重建后焦点留在同一 pid，否则落在原位置顶上来的那一行
    function refreshKeep() {
        if (!ctx || !ctx.live)
            return;
        const f = ctx.focused(), inList = !!(f && f.p3procRow === true);
        const i = inList ? f.slot : -1, pid = inList ? f.pid : -1;
        rebuild();
        if (inList) {
            const r = rows();
            const nx = r.find(x => x.pid === pid) || r[Math.min(Math.max(0, i), r.length - 1)];
            ctx.focus(nx || link);
        }
        ctx.refocus();
    }
    // 列表变化：读数由绑定原地刷新；行的 pid 离开列表时滑出，再合拢重建
    function reconcile() {
        if (!open || sorting || frozen || !ctx || !ctx.live)
            return;
        const r = rows();
        const missing = r.filter(x => !x.gone && !procMap[x.pid]);
        if (!missing.length) {
            if (!goneT.running && r.length < Math.min(procRows, plist.length))
                refreshKeep();
            return;
        }
        if (stillMode) {
            refreshKeep();
            return;
        }
        const f = ctx.focused();
        if (f && missing.indexOf(f) >= 0) {
            const keep = r.filter(x => missing.indexOf(x) < 0 && !x.gone);
            const nx = keep.find(x => x.slot > f.slot) || keep[keep.length - 1];
            ctx.focus(nx || link);
        }
        missing.forEach(x => x.playOut());
        goneT.restart();
    }
    onProcMapChanged: reconcile()
    Timer {
        id: goneT
        interval: 300
        onTriggered: page.refreshKeep()
    }

    function setSort(k, focusFirst) {
        if (!ctx || !ctx.live)
            return;
        sorting = true;
        ProcList.sort(k);
        sorting = false;
        if (focusFirst) {
            rebuild();
            const r = rows();
            if (r.length)
                ctx.focus(r[0]);
            ctx.refocus();
        } else {
            refreshKeep();
        }
    }
    function setOpen(on) {
        if (!ctx || !ctx.live || on === open)
            return;
        if (on) {
            fromEl = ctx.focused();
            // 排序和 DMS 自带的进程列表共用；名称 / PID 排序时取的前 20 个不是占用最高的
            if (ProcList.state.sort !== "cpu" && ProcList.state.sort !== "memory") {
                sorting = true;
                ProcList.sort("cpu");
                sorting = false;
            }
            open = true;
            rebuild();
            const r = rows();
            ctx.focus(r.length ? r[0] : link);
        } else {
            rows().forEach(r => r.cancel());
            goneT.stop();
            open = false;
            const b = fromEl && fromEl.p3procRow !== true && fromEl.visible && !fromEl.disabled ? fromEl : null;
            fromEl = null;
            ctx.focus(b || link);
        }
        ctx.refocus();
    }
    // 按住确认后：SIGTERM。成功后该 pid 在下一次刷新时离开列表（reconcile 滑出）；被拒绝或已退出时行保留
    function kill(pid) {
        if (!ctx || !ctx.live || !procMap[pid])
            return;
        ctx.run(ProcList.kill(pid, false));
    }

    // ---------------------------------------------------------------- 性能模式
    function pickProfile(seg) {
        const id = seg.prof.id;
        if (id === curProfile || !ctx || !ctx.live)
            return;
        const c = ctx;
        optimistic = id;
        if (!stillMode)
            seg.pick();
        c.run(Battery.setProfile(id), {
            "revert": () => {
                if (c.live)
                    optimistic = "";
            }
        });
    }

    // ================================================================ 画面
    component Sec: Item {
        id: sec
        property string text: ""
        height: 15
        P3Text {
            id: secT
            kind: "sec"
            text: sec.text
            color: P3.dim
            font.letterSpacing: 1.5
            y: 13 - baselineOffset
        }
        Rectangle {
            x: secT.implicitWidth + 16
            y: 7
            width: Math.max(0, sec.width - x)
            height: 1
            color: P3.line
        }
    }
    component Meta: P3Text {
        kind: "meta"
        color: P3.dim
        font.pixelSize: 15
        font.letterSpacing: 0.9
    }

    // ---------------------------------------------------------------- 左列：PERFORMANCE
    Item {
        id: perf
        width: 880
        height: 572
        visible: !page.open

        Sec {
            width: 880
            text: "PERFORMANCE"
        }
        Tank {
            x: 0
            y: 29
            width: 280
            still: page.stillMode
            filled: page.clock >= page.at(1) + 40
            level: page.statsOk ? page.st.cpu : 0
            num: page.show(page.statsOk ? page.st.cpu : null, 1)
            label: "CPU"
            meta: page.statsOk ? page.show(page.st.cpuTemp > 0 ? page.st.cpuTemp : null, 1) + "°C · " + page.st.cores + " 核" : "—"
        }
        Tank {
            x: 300
            y: 29
            width: 280
            still: page.stillMode
            filled: page.clock >= page.at(2) + 40
            level: page.statsOk ? page.st.ram : 0
            num: page.show(page.statsOk ? page.st.ram : null, 2)
            label: "MEMORY"
            meta: page.statsOk ? page.show(page.st.ramUsed, 2, 1) + " / " + page.st.ramTotal + " GB" : "—"
        }
        Tank {
            x: 600
            y: 29
            width: 280
            still: page.stillMode
            filled: page.clock >= page.at(3) + 40
            level: page.statsOk ? page.st.disk : 0
            num: page.show(page.statsOk && page.st.diskTotal ? page.st.disk : null, 3)
            label: "DISK /"
            meta: page.statsOk && page.st.diskTotal ? page.st.diskUsed + " / " + page.st.diskTotal : "—"
        }

        Rectangle {
            id: histBox
            y: 332.5
            width: 880
            height: 239.5
            color: P3.panel

            P3Text {
                kind: "label"
                text: "CPU · 60 S"
                x: 22
                y: 33 - baselineOffset
            }
            Row {
                anchors.right: parent.right
                anchors.rightMargin: 22
                y: 33 - peakT.baselineOffset
                spacing: 22
                Meta {
                    id: peakT
                    textFormat: Text.StyledText
                    text: page.pct("PEAK", page.show(page.peak, 4))
                }
                Meta {
                    textFormat: Text.StyledText
                    text: page.pct("AVG", page.show(page.avg, 4))
                }
            }
            Spark {
                x: 22
                y: 71.5
                width: 836
                height: 150
                hist: page.hist
                still: page.stillMode
                drawn: page.clock >= page.at(4) + 80
            }
        }
    }

    // ---------------------------------------------------------------- 左列：TOP PROCESSES（打开时替换 PERFORMANCE）
    Item {
        id: procView
        width: 880
        height: 572
        visible: page.open

        Sec {
            width: 880
            text: "TOP PROCESSES"
        }
        Item {
            id: procHead
            y: 29
            width: 880
            height: 44
            Rectangle {
                y: 43
                width: parent.width
                height: 1
                color: P3.line
            }
            Meta {
                text: "NAME · PID"
                x: 18
                y: 27.3 - baselineOffset
            }
            Repeater {
                model: ["cpu", "mem"]
                delegate: Item {
                    id: col
                    required property string modelData
                    readonly property bool on: page.sortKey === modelData
                    x: (modelData === "cpu" ? 724 : 862) - 120
                    width: 120
                    height: 44
                    Item {
                        x: 120 - width
                        y: 6.8
                        width: colT.implicitWidth
                        height: 29.5
                        Meta {
                            id: colT
                            text: col.modelData === "cpu" ? "CPU" : "MEM"
                            color: col.on ? P3.fill : P3.dim
                            y: 21 - baselineOffset
                            Behavior on color {
                                enabled: !page.stillMode
                                ColorAnimation {
                                    duration: 200
                                }
                            }
                        }
                        Rectangle {
                            y: 27.5
                            width: parent.width
                            height: 2
                            color: P3.fill
                            opacity: col.on ? 1 : 0
                            Behavior on opacity {
                                enabled: !page.stillMode
                                NumberAnimation {
                                    duration: 250
                                    easing.type: Easing.BezierSpline
                                    easing.bezierCurve: P3.ease
                                }
                            }
                        }
                    }
                    TapHandler {
                        acceptedButtons: Qt.LeftButton
                        onTapped: page.setSort(col.modelData, false)
                    }
                }
            }
        }
        Column {
            y: 73
            width: 880
            Repeater {
                id: rowRep
                model: page.procRows
                delegate: ProcRow {
                    required property int index
                    slot: index
                    width: 880
                    pid: index < page.rowPids.length ? page.rowPids[index] : -1
                    proc: pid >= 0 ? (page.procMap[pid] || null) : null
                    sortKey: page.sortKey
                    still: page.stillMode
                    onConfirmed: page.kill(pid)
                }
            }
        }
        P3Text {
            visible: page.rowPids.length === 0
            kind: "label"
            text: "NO PROCESSES"
            color: P3.dim
            x: 18
            y: 110.3 - baselineOffset
        }
    }

    // ---------------------------------------------------------------- 右列：BATTERY + POWER PROFILE
    Item {
        id: side
        x: 928
        width: 482
        height: 572
        opacity: page.open ? 0.4 : 1
        // 整列合成后再整体变淡（液面里的 ink 读数、选中的 profile 文字不会透出底色）
        layer.enabled: opacity < 1
        // 舞台按屏幕缩放（同 P3MenuWindow 的 stage.s），纹理跟着放大，文字不发虚
        layer.textureSize: {
            const s = Math.max(Window.width / P3.stageW, Window.height / P3.stageH) || 1;
            return Qt.size(Math.ceil(width * s), Math.ceil(height * s));
        }
        Behavior on opacity {
            enabled: !page.stillMode
            NumberAnimation {
                duration: 250
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }

        Sec {
            width: 482
            text: "BATTERY"
        }
        Tank {
            y: 29
            width: 236
            glassH: 350
            numSize: 84
            numLow: true
            still: page.stillMode
            filled: page.clock >= page.at(6) + 40
            level: page.batOk ? page.bs.pct : 0
            num: page.show(page.batOk ? page.bs.pct : null, 6)
            label: page.batState
            limit: page.limitPct
        }
        Item {
            id: batList
            x: 262
            readonly property var items: [
                {
                    "lab": page.onAC ? "CHARGE" : "DRAW",
                    "num": page.show(page.batOk ? page.bs.watts : null, 7, 1),
                    "unit": "W"
                },
                {
                    "lab": page.onAC ? "TO LIMIT" : "REMAIN",
                    "num": page.remainText,
                    "unit": ""
                },
                {
                    "lab": "HEALTH",
                    "num": page.show(page.batOk && page.bs.health > 0 ? page.bs.health : null, 7),
                    "unit": "%"
                }
            ]
            Repeater {
                model: 3
                delegate: Item {
                    id: bl
                    required property int index
                    readonly property var it: batList.items[index]
                    readonly property real base: 49 + index * 125.15
                    Meta {
                        text: bl.it.lab
                        y: bl.base - baselineOffset
                    }
                    NumUnit {
                        text: bl.it.num
                        unit: bl.it.unit
                        size: 56
                        unitSize: 15
                        unitGap: 5
                        y: bl.base + 54.1 - baseY
                    }
                }
            }
        }

        Sec {
            y: 439
            width: 482
            text: "POWER PROFILE"
        }
        Repeater {
            model: page.profiles
            delegate: P3Focusable {
                id: seg
                required property var modelData
                required property int index
                readonly property var prof: modelData
                readonly property bool avail: !!page.bs.profileAvailable && (page.bs.profiles || []).indexOf(prof.id) >= 0
                readonly property bool cur: page.curProfile === prof.id
                readonly property color segFg: cur ? P3.ink : fg
                x: index * (466 / 3 + 8)
                y: 468
                width: 466 / 3
                height: 104
                disabled: page.open || !avail
                opacity: avail ? 1 : 0.4
                onActivated: page.pickProfile(seg)

                function pick() {
                    pickAnim.restart();
                }

                Item {
                    id: segBody
                    width: seg.width
                    height: seg.height
                    Rectangle {
                        anchors.fill: parent
                        color: seg.cur ? P3.fill : P3.panel
                        Behavior on color {
                            enabled: !page.stillMode
                            ColorAnimation {
                                duration: 220
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: P3.ease
                            }
                        }
                    }
                    P3Glyph {
                        x: 17
                        y: 17
                        size: 22
                        name: seg.prof.g
                        color: seg.segFg
                    }
                    P3Text {
                        kind: "label"
                        text: seg.prof.t
                        color: seg.segFg
                        font.pixelSize: 16
                        font.letterSpacing: 2.24
                        x: 16
                        y: 84 - baselineOffset
                    }
                }
                // 原型 stPick：.45s spring，35% 处上移 5px
                SequentialAnimation {
                    id: pickAnim
                    NumberAnimation {
                        target: segBody
                        property: "y"
                        from: 0
                        to: -5
                        duration: 158
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.spring
                    }
                    NumberAnimation {
                        target: segBody
                        property: "y"
                        to: 0
                        duration: 292
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.spring
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------- 底部：读数条 + PROCESSES
    Rectangle {
        y: 594
        width: P3.pageW
        height: 1
        color: P3.line
    }
    Item {
        id: strip
        y: 611
        width: 880
        height: 65
        readonly property var cells: [
            {
                "lab": "↓ DOWN",
                "nums": [[page.show(page.statsOk ? page.downR[0] : null, 10, page.downR[1]), page.downR[2]]]
            },
            {
                "lab": "↑ UP",
                "nums": [[page.show(page.statsOk ? page.upR[0] : null, 10, page.upR[1]), page.upR[2]]]
            },
            {
                "lab": "GPU",
                "nums": [[page.show(page.gpuTemp, 10), "°C"]]
            },
            {
                "lab": "LOAD",
                "nums": [[page.show(page.load1, 10, 2), ""]]
            },
            {
                "lab": "UPTIME",
                "nums": page.uptime ? [[page.show(page.uptime[0], 10), "H"], [page.show(page.uptime[1], 10), "M"]] : [["—", ""]]
            }
        ]
        Repeater {
            model: 5
            delegate: Item {
                id: cell
                required property int index
                readonly property var c: strip.cells[index]
                x: index * 176
                width: 176
                height: 65
                Rectangle {
                    visible: cell.index > 0
                    width: 1
                    height: 65
                    color: P3.line
                }
                Meta {
                    x: cell.index > 0 ? 19 : 0
                    y: 14 - baselineOffset
                    text: cell.c.lab
                }
                Row {
                    x: cell.index > 0 ? 19 : 0
                    spacing: 9.4
                    Repeater {
                        model: cell.c.nums
                        delegate: NumUnit {
                            required property var modelData
                            text: modelData[0]
                            unit: modelData[1]
                            size: 40
                            unitSize: 15
                            unitGap: 5
                            y: 59 - baseY
                        }
                    }
                }
            }
        }
    }

    P3Focusable {
        id: link
        x: 928
        y: 607
        width: 482
        height: 72
        onActivated: page.setOpen(!page.open)

        P3Glyph {
            x: 19
            y: 25
            size: 22
            name: "list"
            color: link.fg
        }
        P3Text {
            kind: "label"
            text: "PROCESSES"
            color: link.fg
            x: 58
            y: 42.5 - baselineOffset
        }
        NumUnit {
            text: page.show(page.statsOk ? page.st.procs : null, 11)
            size: 34
            color: link.fg
            x: 424 - width
            y: 46.7 - baseY
        }
        P3Glyph {
            x: 444
            y: 26
            size: 20
            name: "chev"
            color: link.fg
            rotation: page.open ? 90 : 0
            Behavior on rotation {
                enabled: !page.stillMode
                NumberAnimation {
                    duration: 300
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.spring
                }
            }
        }
    }
}
