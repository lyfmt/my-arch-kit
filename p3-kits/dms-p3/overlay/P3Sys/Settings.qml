pragma Singleton

import QtQuick
import Quickshell
import qs.Common

// P3Sys.settings — 通用键值，表驱动（对应原型 backend.js 的 SET 表）。页面只用原型的 UI 键和 UI 值。
// @dms SettingsData.set(key, value)（SettingsSpec 负责类型转换；输入类键触发 updateCompositorInput → 写 niri 输入配置）
//      theme → Theme.switchTheme(name, true, true)
// 缺口（@gap，没有接口或需要 root）：
//   dndSchedule / dndFrom / dndTo：值存 ~/.cache/p3/settings.json，由本文件末尾的定时器每分钟按时段开关勿扰。
//   lid：只能读（P3Sys.Power.state.lid），set("lid") 返回 unsupported；不在 state 里。
// state: { <uiKey>: uiValue }；describe(k, v) → { dmsKey, value } 或 { gap }
Base {
    id: root
    ns: "settings"

    readonly property var minS: [60, 180, 300, 600, 900, 1800, 0]
    function idxOf(arr, v, dflt) {
        const i = arr.indexOf(v);
        return i < 0 ? dflt : i;
    }
    function nearestIdx(arr, v) {
        let best = 0;
        for (let i = 1; i < arr.length; i++)
            if (Math.abs(arr[i] - v) < Math.abs(arr[best] - v))
                best = i;
        return best;
    }

    // uiKey: [dmsKey | null, toDms(v), fromDms(dmsValue)]
    readonly property var table: ({
            "repeatDelay": ["keyboardRepeatDelay", v => v, d => d || 300],
            "repeatRate": ["keyboardRepeatRate", v => v, d => d || 40],
            "tapToClick": ["touchpadTapToClick", v => !!v, d => !!d],
            "naturalScroll": ["touchpadNaturalScroll", v => !!v, d => !!d],
            "touchSpeed": ["touchpadAccelSpeed", v => Math.round((v - 50) / 50 * 100) / 100, d => Math.round((d || 0) * 50 + 50)],
            "font": ["fontFamily", v => fonts[v] || fonts[0], d => idxOf(fonts, d, 0)],
            "fontScale": ["fontScale", v => v / 100, d => Math.round((d || 1) * 100)],
            "motion": ["animationDuration", v => [125, 250, 350][v] ?? 250, d => nearestIdx([125, 250, 350], d || 250)],
            "popupAlpha": ["popupTransparency", v => v, d => Math.round((d ?? 1) * 100)],
            "acOff": ["acMonitorTimeout", v => minS[v], d => idxOf(minS, d, 6)],
            "acLock": ["acLockTimeout", v => minS[v], d => idxOf(minS, d, 6)],
            "acSus": ["acSuspendTimeout", v => minS[v], d => idxOf(minS, d, 6)],
            "btOff": ["batteryMonitorTimeout", v => minS[v], d => idxOf(minS, d, 6)],
            "btLock": ["batteryLockTimeout", v => minS[v], d => idxOf(minS, d, 6)],
            "btSus": ["batterySuspendTimeout", v => minS[v], d => idxOf(minS, d, 6)],
            "lockBeforeSuspend": ["lockBeforeSuspend", v => !!v, d => !!d],
            "popTimeout": ["notificationTimeoutNormal", v => [3000, 5000, 8000, 0][v], d => idxOf([3000, 5000, 8000, 0], d, 1)],
            // SettingsData.Position：0 Top(右上) · 4 TopCenter · 1 Bottom(右下)
            "popPos": ["notificationPopupPosition", v => [0, 4, 1][v] ?? 0, d => idxOf([0, 4, 1], d, 0)]
        })
    readonly property var fonts: ["Barlow Condensed", "Inter", "Noto Sans CJK SC"]
    readonly property var themes: ["blue", "dynamic"]
    readonly property var gapNotes: ({
            "lid": "合盖动作由 logind HandleLidSwitch 决定（P3Sys.Power.state.lid 只读），改它需要 root（/etc/systemd/logind.conf.d），暂不支持",
            "dndSchedule": "DMS 2.0 没有勿扰计划：dms-p3 每分钟检查一次时间，调用 SessionData.setDoNotDisturb(on, 0, \"p3-schedule\")"
        })

    // gap 键的本地值（~/.cache/p3/settings.json）
    property var local: ({
            "dndSchedule": false,
            "dndFrom": 23,
            "dndTo": 7
        })
    readonly property string localPath: cacheDir + "/settings.json"

    readonly property var state: {
        const o = {};
        for (const k in table) {
            const t = table[k];
            o[k] = t[2](SettingsData[t[0]]);
        }
        o.theme = idxOf(themes, Theme.currentTheme, 0);
        o.dndSchedule = !!local.dndSchedule;
        o.dndFrom = local.dndFrom;
        o.dndTo = local.dndTo;
        return o;
    }
    onStateChanged: notify()

    Component.onCompleted: readFile(localPath, t => {
        try {
            if (t)
                local = Object.assign({}, local, JSON.parse(t));
        } catch (e) {}
    })

    function describe(k, v) {
        if (v === undefined)
            v = state[k];
        if (table[k])
            return {
                "dmsKey": table[k][0],
                "value": table[k][1](v)
            };
        if (k === "theme")
            return {
                "gap": "Theme.switchTheme(\"" + themes[v] + "\", true, true)"
            };
        if (k === "lid")
            return {
                "gap": gapNotes.lid
            };
        if (k === "dndSchedule" || k === "dndFrom" || k === "dndTo")
            return {
                "gap": gapNotes.dndSchedule
            };
        return null;
    }

    function set(k, v) {
        if (table[k]) {
            SettingsData.set(table[k][0], table[k][1](v));
            return ok("set", null);
        }
        if (k === "theme") {
            const name = themes[v];
            if (!name)
                return fail("set", "bad", "无效主题");
            Theme.switchTheme(name, true, true);
            return ok("set", null);
        }
        if (k === "lid")
            return fail("set", "unsupported", gapNotes.lid);
        if (k === "dndSchedule" || k === "dndFrom" || k === "dndTo") {
            const next = Object.assign({}, local);
            next[k] = k === "dndSchedule" ? !!v : Math.max(0, Math.min(23, Math.round(v)));
            local = next;
            Quickshell.execDetached(["mkdir", "-p", cacheDir]);
            return later("set", (resolve, reject) => Qt.callLater(() => writeFile(localPath, JSON.stringify(local), okw => okw ? resolve(null) : reject("write", "保存失败"))));
        }
        return fail("set", "bad", "未知设置 " + k);
    }

    // 勿扰计划（gap 实现）：每分钟看一次，进入时段开勿扰，离开时段关（只关自己开的）
    property bool scheduleHolding: false
    Timer {
        interval: 60000
        repeat: true
        triggeredOnStart: true
        running: !!root.local.dndSchedule || root.scheduleHolding
        onTriggered: {
            const h = new Date().getHours();
            const a = root.local.dndFrom, b = root.local.dndTo;
            const inside = !!root.local.dndSchedule && (a <= b ? (h >= a && h < b) : (h >= a || h < b));
            if (inside && !SessionData.doNotDisturb) {
                SessionData.setDoNotDisturb(true, 0, "p3-schedule");
                root.scheduleHolding = true;
            } else if (!inside && root.scheduleHolding) {
                if (SessionData.doNotDisturb)
                    SessionData.setDoNotDisturb(false, 0, "p3-schedule");
                root.scheduleHolding = false;
            }
        }
    }
}
