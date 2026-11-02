pragma Singleton

import QtQuick
import Quickshell
import qs.Services

// 点一条通知 = 直接去它那儿：有默认动作（identifier "default"，没有就第一个）先调用；
// 再把发通知的应用窗口聚焦（niri，按 desktop entry / StartupWMClass / 应用名对 app_id）；
// 没有动作、也没有开着的窗口时启动这个应用。清掉通知由调用方做。
Singleton {
    id: root

    function defaultAction(w) {
        const actions = w?.actions ?? [];
        for (const a of actions) {
            if (a && a.identifier === "default")
                return a;
        }
        return actions[0] ?? null;
    }

    function norm(s) {
        return String(s || "").toLowerCase().trim().replace(/\.desktop$/, "");
    }

    function entryFor(w) {
        for (const k of [w.desktopEntry, w.appName]) {
            if (!k)
                continue;
            const e = DesktopEntries.heuristicLookup(String(k));
            if (e)
                return e;
        }
        return null;
    }

    function stamp(win) {
        const t = win.focus_timestamp;
        return t ? (t.secs || 0) * 1e3 + (t.nanos || 0) / 1e6 : 0;
    }

    // 同一个应用有多个窗口时取最近聚焦过的那个
    function windowFor(w, entry) {
        const wins = NiriService.windows || [];
        if (!wins.length)
            return null;
        const keys = [];
        for (const k of [w.desktopEntry, entry?.id, entry?.startupClass, w.appName]) {
            const n = root.norm(k);
            if (n.length >= 2 && keys.indexOf(n) === -1)
                keys.push(n);
        }
        for (const k of keys) {
            const tail = k.split(".").pop();
            let best = null;
            for (const win of wins) {
                const id = root.norm(win.app_id);
                if (!id || (id !== k && id.split(".").pop() !== tail))
                    continue;
                if (!best || root.stamp(win) > root.stamp(best))
                    best = win;
            }
            if (best)
                return best;
        }
        return null;
    }

    function open(w) {
        if (!w)
            return false;
        const action = root.defaultAction(w);
        const entry = root.entryFor(w);
        const win = root.windowFor(w, entry);
        if (action)
            action.invoke();
        if (win)
            CompositorService.focusWindow(win.id);
        else if (!action && entry)
            SessionService.launchDesktopEntry(entry, false, []);
        return !!(action || win || entry);
    }
}
