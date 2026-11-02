pragma Singleton

import QtQuick
import Quickshell
import qs.Services
import "lunar.js" as Lunar

// P3Sys.calendar — 日历：农历、节气、节假日、日程。
// @dms CalendarService.loadEvents(from, to) → eventsByDate（khal / dankcal）
//   农历：QML 没有 Intl，用 lunar.js 预计算表（1900–2100，scripts/mklunar.js 从 ICU 生成）；节气按太阳黄经计算。
//   节假日（@gap，国务院每年公布）：holiday-cn（github.com/NateScarlet/holiday-cn）的 <year>.json，
//     缓存在 ~/.cache/p3/holiday-<year>.json。只请求 2007 年到明年；没有缓存、空表缓存超过 1 天、
//     今年及以后的缓存超过 7 天时从 jsDelivr 重新拉取，拉取失败保留已有缓存。
//   公历节日：教师节、国庆节、万圣夜、圣诞节等固定日期。
//
// day(date) → { key, lunar, term, fest, off, work, holiday }（同步）。12 月 20 日起同时查下一年的文件
//   （元旦的放假和调休写在下一年里）。holiday 是休 / 班对应的节日名。
// events(from, to) → Promise<{ 'YYYY-MM-DD': [{ start: "HH:MM", end, title, allDay }] }>
//   请求排队串行执行（CalendarService 同一时间只保留一个范围）：
//     khal     等 isLoading 结束且 eventsByDate 有更新
//     dankcal  等 eventsByDate 更新
//   都最多等 15 秒。失败 { code, message }：unavailable 未连接日历 / offline 日历服务未连接 / timeout / failed。
// slice(from, to) → 同步取 eventsByDate 里这一段（格式同 events）
// pushed()：不是由 events() 引起的日程变化（dankcal 推送），或日历后端刚变为可用。
//   lastFrom / lastTo 是最近一次请求的范围（YYYY-MM-DD）；页面重新切出已显示的范围，并重试失败的范围。
Base {
    id: root
    ns: "calendar"

    readonly property var state: ({
            "available": CalendarService.calendarAvailable,
            "loading": CalendarService.isLoading,
            "error": CalendarService.lastError
        })
    property var holidays: ({})       // year → { off: { key: 名称 }, work: { key: 名称 }, count }
    property var _pending: ({})
    property string lastFrom: ""
    property string lastTo: ""
    property var _queue: []
    property var _job: null

    signal pushed

    readonly property var solarFest: ({
            "01-01": "元旦",
            "02-14": "情人节",
            "03-08": "妇女节",
            "05-01": "劳动节",
            "05-04": "青年节",
            "06-01": "儿童节",
            "09-10": "教师节",
            "10-01": "国庆节",
            "10-31": "万圣夜",
            "12-24": "平安夜",
            "12-25": "圣诞节"
        })

    function pad(n) {
        return (n < 10 ? "0" : "") + n;
    }
    function ymd(d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }
    function lunar(d) {
        return Lunar.lunar(d);
    }

    // ---------------------------------------------------------------- 日信息
    function day(d) {
        const k = ymd(d), y = d.getFullYear();
        const l = Lunar.lunar(d);
        const late = d.getMonth() === 11 && d.getDate() >= 20;
        loadHolidays(y);
        if (late)
            loadHolidays(y + 1);
        const H = holidays;
        const hy = H[y] || null;
        const hn = late ? (H[y + 1] || null) : null;
        const offName = (hy && hy.off[k]) || (hn && hn.off[k]) || "";
        const workName = (hy && hy.work[k]) || (hn && hn.work[k]) || "";
        const isOff = !!hy && k in hy.off || !!hn && k in hn.off;
        const isWork = !!hy && k in hy.work || !!hn && k in hn.work;
        return {
            "key": k,
            "lunar": l,
            "term": Lunar.termsOfYear(y)[k] || null,
            "fest": solarFest[k.slice(5)] || (l && l.fest) || null,
            "off": isOff,
            "work": isWork,
            "holiday": offName || workName || null
        };
    }

    // ---------------------------------------------------------------- 节假日（holiday-cn）
    function _parseHoliday(text) {
        const j = JSON.parse(text);
        if (!j || !Array.isArray(j.days))
            throw new Error("bad holiday json");
        const out = {
            "off": {},
            "work": {},
            "count": j.days.length
        };
        for (const x of j.days)
            (x.isOffDay ? out.off : out.work)[x.date] = x.name || "";
        return out;
    }
    function _setHoliday(y, h) {
        const n = Object.assign({}, holidays);
        n[y] = h;
        holidays = n;
        notify();
    }
    function loadHolidays(y) {
        const thisYear = new Date().getFullYear();
        if (y < 2007 || y > thisYear + 1 || holidays[y] || _pending[y])
            return;
        _pending[y] = true;
        const path = cacheDir + "/holiday-" + y + ".json";
        readFile(path, text => {
            let h = null;
            try {
                if (text)
                    h = _parseHoliday(text);
            } catch (e) {
                h = null;
            }
            if (!h) {
                _fetchHoliday(y, path);
                return;
            }
            _setHoliday(y, h);
            if (y < thisYear && h.count > 0)
                return;
            run(["stat", "-c", "%Y", path], (code, out) => {
                const age = Date.now() / 1000 - parseInt(out);
                if (!(age < (h.count > 0 ? 7 : 1) * 86400))
                    _fetchHoliday(y, path);
            });
        });
    }
    function _fetchHoliday(y, path) {
        const x = new XMLHttpRequest();
        x.onreadystatechange = () => {
            if (x.readyState !== XMLHttpRequest.DONE)
                return;
            let h = null;
            if (x.status === 200) {
                try {
                    h = _parseHoliday(x.responseText);
                } catch (e) {
                    h = null;
                }
            }
            if (h) {
                _setHoliday(y, h);
                writeFile(path, x.responseText);
            } else if (!holidays[y]) {
                _setHoliday(y, {
                    "off": {},
                    "work": {},
                    "count": 0
                });
            }
        };
        x.open("GET", "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/" + y + ".json");
        x.send();
    }

    // ---------------------------------------------------------------- 日程（CalendarService）
    function events(from, to) {
        return new Promise((res, rej) => {
            _queue = _queue.concat([
                {
                    "from": from,
                    "to": to,
                    "res": res,
                    "rej": rej
                }
            ]);
            Qt.callLater(_pump);
        });
    }
    function _finish(job, err, map) {
        if (_job === job)
            _job = null;
        done(!err, err ? err.message : "", ns + ".events");
        if (err)
            job.rej(err);
        else
            job.res(map);
        Qt.callLater(_pump);
    }
    function _pump() {
        if (_job || !_queue.length)
            return;
        const job = _queue[0];
        _queue = _queue.slice(1);
        _job = job;
        job.be = CalendarService.activeBackend;
        if (job.be === "none")
            return _finish(job, {
                "code": "unavailable",
                "message": "未连接日历"
            });
        if (job.be === "dankcal" && !CalendarService.dankConnected)
            return _finish(job, {
                "code": "offline",
                "message": "日历服务未连接"
            });
        job.changed = false;
        job.t0 = Date.now();
        lastFrom = ymd(job.from);
        lastTo = ymd(job.to);
        CalendarService.loadEvents(job.from, job.to);
        poll.start();
    }
    function _tick() {
        const job = _job;
        if (!job) {
            poll.stop();
            return;
        }
        const t = Date.now() - job.t0;
        const settled = job.be === "khal" ? !CalendarService.isLoading : job.changed;
        if (!settled && t < 15000)
            return;
        poll.stop();
        if (!settled)
            return _finish(job, {
                "code": "timeout",
                "message": "日程加载超时"
            });
        if (!job.changed)
            return _finish(job, {
                "code": "failed",
                "message": CalendarService.lastError || "日程加载失败"
            });
        _finish(job, null, slice(job.from, job.to));
    }
    function hm(t) {
        return t instanceof Date ? Qt.formatTime(t, "HH:mm") : "";
    }
    function slice(from, to) {
        const a = typeof from === "string" ? from : ymd(from);
        const b = typeof to === "string" ? to : ymd(to);
        const src = CalendarService.eventsByDate || {};
        const out = {};
        for (const k in src) {
            if (k < a || k > b)
                continue;
            out[k] = (src[k] || []).map(e => ({
                        "start": e.allDay ? "" : hm(e.start),
                        "end": e.allDay ? "" : hm(e.end),
                        "title": e.title || "",
                        "allDay": !!e.allDay
                    }));
        }
        return out;
    }

    Timer {
        id: poll
        interval: 100
        repeat: true
        onTriggered: root._tick()
    }
    Connections {
        target: CalendarService
        function onEventsByDateChanged() {
            if (root._job)
                root._job.changed = true;
            else if (root.lastFrom)
                root.pushed();
        }
        function onCalendarAvailableChanged() {
            root.notify();
            if (CalendarService.calendarAvailable)
                root.pushed();
        }
    }
}
