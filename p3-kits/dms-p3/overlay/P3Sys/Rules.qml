pragma Singleton

import QtQuick
import Quickshell
import qs.Common

// P3Sys.rules — 按应用的通知级别。@dms SettingsData.notificationRules（规则按 appName exact 匹配）
//   级别 → action：0 弹窗+声音 default · 1 仅弹窗 default（+ 单应用静音提示音 = @gap）· 2 静默 mute · 3 关闭 ignore
//   单应用提示音（级别 1）需要给 NotificationService.qml 的播放条件加一个判断，属于上游补丁，还没有做：
//   级别 1 写成 default 并在 ~/.cache/p3/silent-apps.json 记下，提示音照常播放。
// state: { <appName>: level }
Base {
    id: root
    ns: "rules"

    readonly property var actions: ["default", "default", "mute", "ignore"]
    readonly property var labels: ["弹窗 + 声音", "仅弹窗", "静默", "关闭"]
    property var silent: []
    readonly property string silentPath: cacheDir + "/silent-apps.json"

    readonly property var state: {
        const o = {};
        for (const r of SettingsData.notificationRules || []) {
            if (r.enabled === false || (r.matchType || "contains") !== "exact" || (r.field && r.field !== "appName"))
                continue;
            const a = (r.action || "default").toLowerCase();
            const lvl = a === "ignore" ? 3 : a === "mute" ? 2 : -1;
            if (lvl >= 0)
                o[r.pattern] = lvl;
        }
        for (const app of silent)
            if (!(app in o))
                o[app] = 1;
        return o;
    }
    onStateChanged: notify()

    Component.onCompleted: readFile(silentPath, t => {
        try {
            if (t)
                silent = JSON.parse(t) || [];
        } catch (e) {}
    })

    function set(app, level) {
        if (level < 0 || level > 3)
            return fail("set", "bad", "无效级别");
        const rules = JSON.parse(JSON.stringify(SettingsData.notificationRules || []));
        const i = rules.findIndex(r => (r.field || "appName") === "appName" && (r.matchType || "contains") === "exact" && r.pattern === app && ["mute", "ignore"].indexOf((r.action || "").toLowerCase()) >= 0);
        const action = actions[level];
        if (action === "default") {
            if (i >= 0)
                rules.splice(i, 1);
        } else if (i >= 0) {
            rules[i].action = action;
            rules[i].enabled = true;
        } else {
            rules.push({
                "enabled": true,
                "field": "appName",
                "pattern": app,
                "matchType": "exact",
                "action": action,
                "urgency": "default",
                "bypassDnd": false
            });
        }
        SettingsData.set("notificationRules", rules);
        const s = silent.filter(x => x !== app);
        if (level === 1)
            s.push(app);
        if (s.length !== silent.length || level === 1) {
            silent = s;
            Quickshell.execDetached(["mkdir", "-p", cacheDir]);
            Qt.callLater(() => writeFile(silentPath, JSON.stringify(silent)));
        }
        return ok("set", app + " · " + labels[level]);
    }
}
