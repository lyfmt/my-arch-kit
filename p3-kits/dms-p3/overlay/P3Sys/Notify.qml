pragma Singleton

import QtQuick
import Quickshell
import qs.Common
import qs.Services

// P3Sys.notify — 通知中心。@dms NotificationService：notifications（NotifWrapper）、dismissNotification(w)、
//   clearAllNotifications()、markNotificationsSeen()；点击 = 默认 action（identifier "default" 或第一个）invoke() 后 dismiss，
//   与 NotificationPopup.invokeDefaultAction 相同。新通知 = popups 里新出现的 wrapper → newItem(item)（勿扰时不发）。
// 发过通知的应用记在 ~/.cache/p3/notify-apps.json（新出现的在前，最多 60 个），按应用的通知规则从这里列应用。
// item: { id, app, icon（url）, title, body, t ("HH:MM"), urgency, actions: [{ id, text }], w（原始 wrapper） }
// state: { items, dnd, unread, apps: [{ app, icon（图标名或路径，交给 Apps.iconSource） }] }
Base {
    id: root
    ns: "notify"

    // 原型的 P3Sys.on('notify:new', fn)：灵动岛卡片用
    signal newItem(var item)

    property var _ids: new Map()
    property int _next: 1
    function idOf(w) {
        let id = _ids.get(w);
        if (!id) {
            id = _next++;
            _ids.set(w, id);
        }
        return id;
    }
    function project(w) {
        const img = w.displayImage || "";
        return {
            "id": idOf(w),
            "app": w.appName || "",
            "icon": img ? img : Apps.iconSource(w.appIcon || w.desktopEntry || ""),
            "title": w.summary || "",
            "body": w.body || "",
            "t": Qt.formatTime(w.time, "HH:mm"),
            "urgency": w.urgency,
            "actions": (w.actions || []).map(a => ({
                        "id": a.identifier,
                        "text": a.text
                    })),
            "w": w
        };
    }

    readonly property var items: (NotificationService.notifications || []).map(project)
    readonly property var state: ({
            "items": items,
            "dnd": SessionData.doNotDisturb,
            "unread": NotificationService.unreadCount,
            "apps": apps
        })
    onStateChanged: notify()

    // ---------------------------------------------------------------- 应用历史
    property var apps: []
    property bool _appsLoaded: false
    readonly property string appsPath: cacheDir + "/notify-apps.json"
    function remember() {
        if (!_appsLoaded)
            return;
        const next = apps.slice();
        let changed = false;
        for (const w of NotificationService.notifications || []) {
            const app = w.appName || "";
            if (!app)
                continue;
            const icon = w.appIcon || w.desktopEntry || "";
            const i = next.findIndex(x => x.app === app);
            if (i < 0) {
                next.unshift({
                    "app": app,
                    "icon": icon
                });
                changed = true;
            } else if (icon && !next[i].icon) {
                next[i] = {
                    "app": app,
                    "icon": icon
                };
                changed = true;
            }
        }
        if (!changed)
            return;
        apps = next.slice(0, 60);
        writeFile(appsPath, JSON.stringify(apps));
    }
    onItemsChanged: remember()
    Component.onCompleted: readFile(appsPath, t => {
        try {
            const v = t ? JSON.parse(t) : [];
            if (Array.isArray(v))
                apps = v.filter(x => x && typeof x.app === "string");
        } catch (e) {}
        _appsLoaded = true;
        remember();
    })

    property var _seenPopups: []
    Connections {
        target: NotificationService
        function onPopupsChanged() {
            const now = NotificationService.popups.slice();
            for (const w of now)
                if (root._seenPopups.indexOf(w) < 0 && !SessionData.doNotDisturb)
                    root.newItem(root.project(w));
            root._seenPopups = now;
        }
    }

    function find(id) {
        return (NotificationService.notifications || []).find(w => _ids.get(w) === id) || null;
    }
    function dismiss(id) {
        const w = find(id);
        if (w)
            NotificationService.dismissNotification(w);
        return ok("dismiss", null);
    }
    function clearAll() {
        const n = items.length;
        NotificationService.clearAllNotifications();
        return ok("clearAll", n ? "已清除 " + n + " 条通知" : null);
    }
    function activate(id) {
        const w = find(id);
        if (!w)
            return fail("activate", "gone", "通知已失效");
        const acts = w.actions || [];
        const a = acts.find(x => x.identifier === "default") || acts[0] || null;
        const app = w.appName;
        if (a && a.invoke)
            a.invoke();
        NotificationService.dismissNotification(w);
        return ok("activate", "打开 " + app);
    }
    // 调用某个具体 action（按钮）
    function invoke(id, actionId) {
        const w = find(id);
        const a = w ? (w.actions || []).find(x => x.identifier === actionId) : null;
        if (!a)
            return fail("invoke", "gone", "通知已失效");
        a.invoke();
        NotificationService.dismissNotification(w);
        return ok("invoke", null);
    }
    function markSeen() {
        NotificationService.markNotificationsSeen();
    }
    function setDnd(on) {
        return Mode.setDnd(on, 0);
    }
}
