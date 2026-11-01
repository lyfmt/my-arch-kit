pragma Singleton

import QtQuick
import Quickshell

// P3Sys.qq — QQ 在线状态。NTQQ 没有状态接口（@gap）：只能找托盘菜单里文字匹配的条目触发。
//   QQ 的托盘项是 Electron 的 chrome_status_icon_N，按菜单里的「退出 QQ」认定（菜单要先读过：probe() / Tray.probe()）。
//   菜单里没有状态条目时 available=false，页面应隐藏这一行。
//   QQ 不会告诉我们当前状态，presence 是我们最后一次设置的值（初始 "online"）。
// state: { available, presence, list: [[id, 中文]] }
Base {
    id: root
    ns: "qq"

    readonly property var list: [["online", "在线"], ["away", "离开"], ["busy", "忙碌"], ["invisible", "隐身"]]
    readonly property var patterns: ({
            "online": /^(我在线上|在线)/,
            "away": /^离开/,
            "busy": /^(忙碌|请勿打扰)/,
            "invisible": /^隐身/
        })
    readonly property string trayId: {
        const m = Tray.menus;
        const t = Tray.items.find(x => (m[x.id] || []).some(e => /^退出\s*QQ$/i.test(String(e.text).trim())));
        return t ? t.id : "";
    }
    readonly property bool available: !!trayId && (Tray.menus[trayId] || []).some(e => patterns.online.test(e.text) || patterns.away.test(e.text))
    property string presence: "online"

    readonly property var state: ({
            "available": available,
            "presence": presence,
            "list": list
        })

    onAvailableChanged: notify()

    // 读还没读过的托盘菜单（找出 QQ）；已认定时重读 QQ 的菜单
    function probe() {
        return trayId ? Tray.menu(trayId) : Tray.probe(false);
    }

    function set(p) {
        if (!trayId)
            return fail("set", "gone", "QQ 没有运行");
        if (!patterns[p])
            return fail("set", "bad", "未知状态 " + p);
        const label = (list.find(x => x[0] === p) || [p, p])[1];
        return Tray.triggerText(trayId, patterns[p]).then(() => {
            presence = p;
            notify();
            return ok("set", "QQ 状态 → " + label);
        }, e => fail("set", e.code || "notfound", "QQ 托盘菜单里没有“" + label + "”"));
    }
}
