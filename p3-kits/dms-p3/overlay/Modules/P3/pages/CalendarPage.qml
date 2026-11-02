import QtQuick
import Quickshell
import qs.Modules.P3
import qs.P3Sys
import "calendar"

// CALENDAR 页（原型 prototype/pages/calendar.js）。
//   左：月历（周一开头）。选中日跟随键盘和单击；右栏显示选中日的大号日期、星期、农历 / 节气 / 节日、相对今天的天数和日程。
//   数据：P3Sys/Calendar（农历 1900–2100、节气、holiday-cn 休/班、CalendarService 日程）；日程按月缓存在本页。
//   按键：←→ / h l 一天，↑↓ / k j 一周（跨月时翻页），PageUp/PageDown、[ ] 或 Ctrl+u / Ctrl+d 翻月，g g / G 本月第一天 / 最后一天，
//   T / Home 回到今天；滚轮在月历上翻月。指针移到格子上就选中那一天（不翻月）。
//   单击或 Enter 选中相邻月份的日期时翻到那个月。P3_CAL_DAY=YYYY-MM-DD 预选一天（截图用）。
P3Page {
    id: page

    title: "CALENDAR"

    readonly property bool still: !!ctx && ctx.still
    readonly property var dows: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

    readonly property var now: Clock.state.now
    readonly property string todayKey: keyOf(now)
    property var sel: new Date()
    property int viewY: 0
    property int viewM: 0
    property var sheet: null

    // 日程缓存，每个显示过的月一条：monKey → { a, b（6 周范围 YYYY-MM-DD）, st: "loading"|"ok"|"err", map, msg }
    property var evCache: ({})
    property int evRev: 0
    property int gen: 0
    property real wheelLock: 0
    // 页面销毁后晚到的 Promise 回调直接丢掉
    readonly property var _tok: ({
            "alive": true
        })
    Component.onDestruction: _tok.alive = false

    // ---------------------------------------------------------------- 工具
    function pad(n) {
        return (n < 10 ? "0" : "") + n;
    }
    function keyOf(d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }
    function parseKey(k) {
        const p = k.split("-");
        return new Date(+p[0], +p[1] - 1, +p[2]);
    }
    function monKey(y, m) {
        return y + "-" + pad(m + 1);
    }
    function sheetRange(y, m) {
        const off = (new Date(y, m, 1).getDay() + 6) % 7;
        return [new Date(y, m, 1 - off), new Date(y, m, 1 - off + 41)];
    }
    function dayNum(d) {
        return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    }
    function mins(s) {
        return +s.slice(0, 2) * 60 + +s.slice(3, 5);
    }

    // ---------------------------------------------------------------- 日程（按月异步加载）
    // 覆盖 k 的已加载月份里 k 那天的日程；还没有任何覆盖它的月份加载完时为 undefined
    function eventsOf(k) {
        for (const mk in evCache) {
            const e = evCache[mk];
            if (e.st === "ok" && k >= e.a && k <= e.b)
                return e.map[k] || [];
        }
        return undefined;
    }
    // 覆盖 k 的月份的状态（优先当前显示的月）
    function statusOf(k) {
        const cur = evCache[monKey(viewY, viewM)];
        if (cur && k >= cur.a && k <= cur.b)
            return cur;
        for (const mk in evCache) {
            const e = evCache[mk];
            if (k >= e.a && k <= e.b)
                return e;
        }
        return null;
    }
    // 已成功或正在加载的月份不重复请求；失败的月份再次显示时重试
    function loadMonth(y, m) {
        const mk = monKey(y, m), had = evCache[mk];
        if (had && had.st !== "err")
            return;
        const r = sheetRange(y, m), g = gen, tok = _tok;
        const e = {
            "a": keyOf(r[0]),
            "b": keyOf(r[1]),
            "st": "loading",
            "map": null,
            "msg": ""
        };
        evCache[mk] = e;
        evRev++;
        Calendar.events(r[0], r[1]).then(map => {
            e.st = "ok";
            e.map = map || {};
        }, err => {
            e.st = "err";
            e.msg = (err && err.message) || "日程加载失败";
        }).then(() => {
            if (tok.alive && g === page.gen)
                page.evRev++;
        });
    }
    // Calendar.pushed：重新切出最近一次请求的那个月；当前月加载失败过就重试（例如日历后端刚就绪）
    function refreshLive() {
        let hit = false;
        for (const mk in evCache) {
            const e = evCache[mk];
            if (e.st === "ok" && e.a === Calendar.lastFrom && e.b === Calendar.lastTo) {
                e.map = Calendar.slice(e.a, e.b);
                hit = true;
            }
        }
        if (hit)
            evRev++;
        loadMonth(viewY, viewM);
    }

    // ---------------------------------------------------------------- 月份与选中日
    function showMonth(y, m, dir) {
        viewY = y;
        viewM = m;
        loadMonth(y, m);
        const old = sheet;
        const nu = sheetComp.createObject(clipBox, {
            "host": page,
            "year": y,
            "month": m
        });
        sheet = nu;
        if (!old)
            return;
        if (still || !dir) {
            old.live = false;
            old.destroy();
        } else {
            old.leave(dir);
            nu.enter(dir);
        }
    }
    // 选中某天；不在当前月时翻过去（opts.noFlip：单击相邻月份的格子时只选中，Enter / 再次激活才翻）
    function select(d, opts) {
        opts = opts || {};
        const flip = d.getFullYear() !== viewY || d.getMonth() !== viewM;
        const changed = keyOf(d) !== keyOf(sel);
        if (changed)
            sel = d;
        if (flip && !opts.noFlip)
            showMonth(d.getFullYear(), d.getMonth(), d < new Date(viewY, viewM, 1) ? -1 : 1);
        const c = sheet ? sheet.cellAt(keyOf(d)) : null;
        if (ctx) {
            if (c && ctx.focused() !== c)
                ctx.focus(c);
            else if (flip)
                ctx.refocus();
        }
        if (changed)
            swapDay();
    }
    function shiftMonth(n) {
        const y = viewY, m = viewM + n;
        const last = new Date(y, m + 1, 0).getDate();
        select(new Date(y, m, Math.min(sel.getDate(), last)));
    }
    function selectToday() {
        select(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    }
    function swapDay() {
        if (still)
            return;
        swapAnim.restart();
    }

    function handleKey(e) {
        if (e.motion) {
            if (e.motion === "first")
                select(new Date(viewY, viewM, 1));
            else if (e.motion === "last")
                select(new Date(viewY, viewM + 1, 0));
            else
                shiftMonth(e.motion === "halfDown" ? 1 : -1);
            return true;
        }
        const k = e.key;
        const step = k === Qt.Key_Left || k === Qt.Key_A ? -1 : k === Qt.Key_Right || k === Qt.Key_D ? 1 : k === Qt.Key_Up || k === Qt.Key_W ? -7 : k === Qt.Key_Down || k === Qt.Key_S ? 7 : 0;
        if (step) {
            const d = new Date(sel);
            d.setDate(d.getDate() + step);
            select(d);
            return true;
        }
        if (k === Qt.Key_PageUp || k === Qt.Key_BracketLeft) {
            shiftMonth(-1);
            return true;
        }
        if (k === Qt.Key_PageDown || k === Qt.Key_BracketRight) {
            shiftMonth(1);
            return true;
        }
        if (k === Qt.Key_T || k === Qt.Key_Home) {
            selectToday();
            return true;
        }
        return false;
    }

    onFocusMoved: item => {
        if (item && item.calCell === true && item.sheet === sheet)
            select(item.date, {
                "noFlip": true
            });
    }
    onLeaving: {
        gen++;
        swapAnim.stop();
    }

    Component.onCompleted: {
        const pre = String(Quickshell.env("P3_CAL_DAY") || "");
        sel = /^\d{4}-\d\d-\d\d$/.test(pre) ? parseKey(pre) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        showMonth(sel.getFullYear(), sel.getMonth(), 0);
        const c = sheet.cellAt(keyOf(sel));
        if (c)
            c.autofocus = true;
    }

    Connections {
        target: Calendar
        function onPushed() {
            page.refreshLive();
        }
    }

    Component {
        id: sheetComp
        MonthSheet {}
    }

    // ---------------------------------------------------------------- 选中日的派生数据
    readonly property var selInfo: Calendar.day(sel)
    readonly property string lunarLine: {
        const l = selInfo.lunar;
        const lu = l ? l.month + l.dayZh : "";
        return [lu, selInfo.fest || selInfo.term || ""].filter(s => !!s).join(" · ");
    }
    readonly property var relChip: {
        const n = dayNum(sel) - dayNum(now);
        if (n === 0)
            return {
                "text": "TODAY",
                "hot": true,
                "ghost": false
            };
        if (n === 1)
            return {
                "text": "明天",
                "hot": false,
                "ghost": false
            };
        if (n === -1)
            return {
                "text": "昨天",
                "hot": false,
                "ghost": true
            };
        return n > 0 ? {
            "text": n + " 天后",
            "hot": false,
            "ghost": false
        } : {
            "text": -n + " 天前",
            "hot": false,
            "ghost": true
        };
    }
    // { head: "AGENDA · " 后面的部分, note: 加载中 / 出错 / 无日程, rows }
    readonly property var agenda: {
        evRev;
        const k = keyOf(sel), ev = eventsOf(k);
        if (!ev) {
            const s = statusOf(k);
            return s && s.st === "err" ? {
                "head": "—",
                "note": s.msg || "日程加载失败",
                "rows": []
            } : {
                "head": "…",
                "note": "正在加载日程…",
                "rows": []
            };
        }
        const nowM = now.getHours() * 60 + now.getMinutes();
        const isToday = k === todayKey, isPast = k < todayKey;
        let nextDone = false;
        const rows = ev.map(x => {
            const r = {
                "t": x.start,
                "e": x.end,
                "ti": x.title,
                "allDay": x.allDay,
                "past": isPast,
                "next": false,
                "chip": ""
            };
            if (x.allDay || isPast)
                return r;
            if (isToday && mins(x.end) <= nowM)
                r.past = true;
            else if (isToday && mins(x.start) <= nowM) {
                r.next = true;
                r.chip = "进行中";
                nextDone = true;
            } else if (isToday && !nextDone) {
                r.next = true;
                r.chip = (mins(x.start) - nowM) + " 分钟后";
                nextDone = true;
            }
            return r;
        });
        return {
            "head": String(ev.length),
            "note": ev.length ? "" : "无日程",
            "rows": rows
        };
    }

    // ================================================================ 左：月历（.cl-l）
    Item {
        id: left

        width: 860
        height: 680

        // 星期（.cl-wk）：不随翻月滑动
        Repeater {
            model: ["一", "二", "三", "四", "五", "六", "日"]
            delegate: P3Text {
                required property string modelData
                required property int index
                x: index * 860 / 7 + 16
                y: 104
                kind: "zh"
                font.pixelSize: 17
                font.letterSpacing: 1.02
                text: modelData
                color: index > 4 ? P3.sky : P3.dim
            }
        }

        // 月页容器（.cl-clip）：新旧两页在这里交错滑动
        Item {
            id: clipBox
            anchors.fill: parent
            clip: true
        }

        WheelHandler {
            target: null
            // Wayland 上滚轮事件常被标成 TouchPad 设备；120 = 一格，触摸板的小增量攒满一格才翻
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            property real acc: 0
            onWheel: e => {
                acc += e.angleDelta.y;
                const n = Math.trunc(acc / 120);
                if (!n)
                    return;
                acc -= n * 120;
                const t = Date.now();
                if (t < page.wheelLock)
                    return;
                page.wheelLock = t + 280;
                page.shiftMonth(n < 0 ? 1 : -1);
            }
        }
    }

    // ================================================================ 右：选中日（.cl-r）
    Item {
        id: right

        x: 950
        width: 460
        height: 680

        // 大号日期（.cl-big：宽 236，左移 6，右对齐，padding-right .06em，228px）
        Item {
            id: bigBox

            property real dy: 0
            property real sc: 1

            x: -6
            width: 236
            height: 228 * 0.86
            transform: [
                Scale {
                    origin.x: bigBox.width / 2
                    origin.y: bigBox.height / 2
                    xScale: bigBox.sc
                    yScale: bigBox.sc
                },
                Translate {
                    y: bigBox.dy
                }
            ]

            // Qt 的宽度不含末字的 letter-spacing（-.01em），右对齐时补回
            InkText {
                x: bigBox.width - 228 * 0.06 - implicitWidth + 2.28
                y: 228 * 0.759 - baselineOffset
                px: 228
                text: String(page.sel.getDate())
            }
        }

        // 星期 / 农历 / 相对天数（.cl-side：gap 22，padding-top 30，列间距 14）
        Item {
            id: side

            property real dx: 0

            x: 252
            width: 208
            height: 238
            transform: Translate {
                x: side.dx
            }

            P3Text {
                id: dowT
                y: 30 + 56 * 0.759 - baselineOffset
                kind: "num"
                font.pixelSize: 56
                font.letterSpacing: -0.56
                text: page.dows[page.sel.getDay()]
                color: P3.fill
            }
            P3Text {
                id: luT
                visible: text !== ""
                y: 30 + 56 * 0.86 + 14
                kind: "zh"
                font.pixelSize: 18
                text: page.lunarLine
                color: P3.dim
            }
            P3Chip {
                y: (luT.visible ? luT.y + luT.height : 30 + 56 * 0.86) + 14 + 2
                text: page.relChip.text
                hot: page.relChip.hot
                ghost: page.relChip.ghost
            }
        }

        // 日程（.cl-ag）
        Item {
            id: ag

            property real dx: 0

            y: 262
            width: 460
            height: 680 - 262
            transform: Translate {
                x: ag.dx
            }

            P3Sec {
                width: parent.width
                text: "AGENDA · " + page.agenda.head
            }
            P3Text {
                visible: page.agenda.note !== ""
                y: 27 + 22
                kind: "zh"
                font.pixelSize: 22
                font.letterSpacing: 1.32
                text: page.agenda.note
                color: P3.dim
            }
            Column {
                y: 27
                width: parent.width
                Repeater {
                    model: page.agenda.rows
                    delegate: EvRow {}
                }
            }
        }
    }

    // 一条日程（.cl-ev：64 高，下边线；时间 34px、结束 20px dim、标题 19px；今天的下一条 / 进行中带红色标签）
    component EvRow: Item {
        id: row

        required property var modelData
        readonly property color tColor: modelData.past ? P3.dim : modelData.next ? P3.fill : P3.tx

        width: 460
        height: 64

        P3Text {
            visible: !row.modelData.allDay
            y: 16.13 + 34 * 0.759 - baselineOffset
            kind: "num"
            font.pixelSize: 34
            font.letterSpacing: -0.34
            text: row.modelData.t
            color: row.tColor
        }
        P3Text {
            visible: !row.modelData.allDay
            x: 110
            y: 22.9 + 20 * 0.759 - baselineOffset
            kind: "num"
            font.pixelSize: 20
            font.letterSpacing: -0.2
            text: "–" + row.modelData.e
            color: P3.dim
        }
        P3Text {
            visible: row.modelData.allDay
            y: 23 + 17 * 0.9 - baselineOffset
            kind: "label"
            text: "ALL DAY"
            color: row.modelData.past ? P3.dim : P3.tx
        }
        P3Text {
            id: ti
            x: 192
            y: 17.74
            width: (chip.visible ? chip.x - 18 : row.width) - x
            kind: "zh"
            font.pixelSize: 19
            font.letterSpacing: 1.14
            elide: Text.ElideRight
            text: row.modelData.ti
            color: row.modelData.past ? P3.dim : P3.tx
        }
        // 划掉（line-through，rgba(fill,.4)）
        Rectangle {
            visible: row.modelData.past
            x: ti.x
            y: ti.y + ti.baselineOffset - 19 * 0.325 - 0.5
            width: Math.min(ti.contentWidth, ti.width)
            height: 1
            color: P3.alpha(P3.fill, 0.4)
        }
        P3Chip {
            id: chip
            visible: row.modelData.chip !== ""
            x: row.width - width
            y: (63 - height) / 2
            hot: true
            text: row.modelData.chip
        }
        Rectangle {
            y: 63
            width: row.width
            height: 1
            color: P3.line
        }
    }

    // 换选中日：大号日期弹起（.3s spring），右栏其余部分从右滑入（.22s）
    ParallelAnimation {
        id: swapAnim
        NumberAnimation {
            target: bigBox
            property: "opacity"
            from: 0
            to: 1
            duration: 300
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.spring
        }
        NumberAnimation {
            target: bigBox
            property: "dy"
            from: 18
            to: 0
            duration: 300
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.spring
        }
        NumberAnimation {
            target: bigBox
            property: "sc"
            from: 0.94
            to: 1
            duration: 300
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.spring
        }
        NumberAnimation {
            targets: [side, ag]
            property: "opacity"
            from: 0
            to: 1
            duration: 220
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
        NumberAnimation {
            targets: [side, ag]
            property: "dx"
            from: 14
            to: 0
            duration: 220
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
    }
}
