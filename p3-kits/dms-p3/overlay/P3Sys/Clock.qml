pragma Singleton

import QtQuick
import Quickshell

// P3Sys.clock — 时钟。@dms Quickshell SystemClock { precision: Minutes }
// state: { now: Date, h, m, month, day, dow ("FRI"), dowZh ("周五"), tod ("AFTERNOON") }
Base {
    id: root
    ns: "clock"

    readonly property var dows: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    readonly property var dowsZh: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
    readonly property date nowDate: clock.date
    readonly property var state: {
        const n = clock.date;
        const h = n.getHours();
        return {
            "now": n,
            "h": h,
            "m": n.getMinutes(),
            "month": n.getMonth() + 1,
            "day": n.getDate(),
            "dow": dows[n.getDay()],
            "dowZh": dowsZh[n.getDay()],
            "tod": tod(h)
        };
    }
    onStateChanged: notify()

    function now() {
        return new Date();
    }
    function tod(h) {
        return h < 5 ? "DARK HOUR" : h < 9 ? "EARLY MORNING" : h < 12 ? "MORNING" : h < 13 ? "LUNCHTIME" : h < 17 ? "AFTERNOON" : h < 19 ? "AFTER SCHOOL" : "EVENING";
    }

    SystemClock {
        id: clock
        precision: SystemClock.Minutes
    }
}
