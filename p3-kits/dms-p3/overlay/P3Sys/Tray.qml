pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Services.SystemTray
import qs.Common

// P3Sys.tray — 系统托盘。
// @dms Quickshell.Services.SystemTray（SystemTray.items）；item.activate()；菜单 QsMenuOpener { menu: item.menu }
// item 投影：{ id, name（显示名）, title（托盘自报的标题原文，可能多行）, appId（对上的桌面项 id 或 ""）,
//             icon（url）, status, badge: 0, needsAttention, item（原始 SystemTrayItem） }
//   显示名 / 应用：按托盘项的标题、id（去掉 "tray-icon tray app "、"_status_icon_N"、"-tray"）和菜单自报的名字
//   （「打开飞书」「退出 QQ」「Open Sunshine」）在桌面项的名字 / id 里找；fcitx 的托盘项对应 fcitx5-configtool。
//   菜单自报的名字要先读过菜单（menu(id) / probe()）。
// 菜单：menu(id) → Promise<[{ id, text, enabled, checked, sep, danger, hasChildren, buttonType, entry }]>，
//   结果也存在 menus[id]（可绑定）；buttonType 0 普通 / 1 复选 / 2 单选；danger = 文字以 退出 / Quit / Exit 开头。
//   trigger(id, entryId | "quit")；triggerText(id, 正则)；probe() 读一遍还没读过的菜单。
Base {
    id: root
    ns: "tray"

    readonly property var raw: TrayMenuManager.filterEnvHidden(SystemTray.items.values)
    property var menus: ({})
    readonly property var items: raw.map(t => {
        const title = t.tooltipTitle || t.title || "";
        const app = appFor(t.id, title, t);
        return {
            "id": t.id || "",
            "name": displayName(t.id, title, app),
            "title": title,
            "appId": app ? app.id : "",
            "icon": TrayMenuManager.iconSourceFor(t),
            "status": t.tooltipDescription || "",
            "badge": 0,
            "needsAttention": t.status === Status.NeedsAttention,
            "item": t
        };
    })
    readonly property var state: ({
            "items": items
        })
    onItemsChanged: notify()

    function find(id) {
        return raw.find(t => t.id === id) || null;
    }
    function itemOf(id) {
        return items.find(t => t.id === id) || null;
    }
    // 有托盘项在运行的应用 → 托盘项 id
    function trayOfApp(appId) {
        const t = appId ? items.find(x => x.appId === appId) : null;
        return t ? t.id : "";
    }

    // ---------------------------------------------------------------- 显示名与应用
    function norm(s) {
        return String(s || "").toLowerCase().replace(/[^a-z0-9　-鿿]/g, "");
    }
    function firstLine(s) {
        return String(s || "").split("\n")[0].trim();
    }
    function cleanId(id) {
        return String(id || "").replace(/^tray-icon tray app /, "").replace(/_status_icon_\d+$/, "").replace(/[-_]tray$/, "");
    }
    // 菜单里自报的名字
    function menuNames(id) {
        const out = [];
        for (const e of menus[id] || []) {
            const m = /^(?:退出|打开|显示|quit|exit|open|show)\s*(.+)$/i.exec(String(e.text || "").trim());
            if (m)
                out.push(m[1]);
        }
        return out;
    }
    // 桌面项名字 / id 的归一化索引
    readonly property var appIndex: {
        const m = {};
        for (const a of Apps.state.all) {
            for (const k of [norm(a.name), norm(a.id), norm(a.id.split(".").pop())]) {
                if (k.length >= 2 && !(k in m))
                    m[k] = a;
            }
        }
        return m;
    }
    function isFcitx(id) {
        return /^fcitx/i.test(String(id || ""));
    }
    function appFor(id, title, t) {
        if (isFcitx(id))
            return Apps.byId("fcitx5-configtool");
        const cands = [firstLine(title), t ? t.title : "", t ? t.tooltipTitle : "", id, cleanId(id)].concat(menuNames(id));
        for (const c of cands) {
            const k = norm(c);
            if (k && appIndex[k])
                return appIndex[k];
        }
        return null;
    }
    function displayName(id, title, app) {
        if (isFcitx(id))
            return "Fcitx5";
        if (app)
            return app.name;
        const first = firstLine(title);
        if (first && first !== id)
            return first;
        const named = menuNames(id);
        return named.length ? named[0] : cleanId(id) || String(id || "");
    }

    // ---------------------------------------------------------------- 动作
    function activate(id) {
        const t = find(id);
        if (!t)
            return fail("activate", "gone", "托盘项已退出");
        if (t.onlyMenu)
            return fail("activate", "menuonly", "该托盘项只有菜单");
        t.activate();
        const it = itemOf(id);
        return ok("activate", "已打开 " + (it ? it.name : t.id));
    }

    // 打开菜单读取条目。QsMenuOpener 的 children 是异步填充的，等 150ms 收集一次。
    function menu(id) {
        const t = find(id);
        if (!t || !t.hasMenu)
            return Promise.resolve([]);
        return new Promise(res => {
            const op = openerComp.createObject(root, {
                "menu": t.menu
            });
            const timer = tickComp.createObject(root);
            timer.triggered.connect(() => {
                const list = (op.children?.values ?? []).map((e, i) => ({
                            "id": String(i),
                            "text": e.text || "",
                            "enabled": e.enabled,
                            "checked": e.checkState === Qt.Checked,
                            "sep": e.isSeparator,
                            "danger": /^(退出|quit|exit)/i.test((e.text || "").trim()),
                            "hasChildren": !!e.hasChildren,
                            "buttonType": e.buttonType || 0,
                            "entry": e
                        }));
                timer.destroy();
                // opener 留着，trigger 时 entry 才有效；下次 menu() 替换
                if (_openers[id] && _openers[id] !== op)
                    _openers[id].destroy();
                _openers[id] = op;
                const m = Object.assign({}, menus);
                m[id] = list;
                menus = m;
                res(list);
            });
            timer.start();
        });
    }
    property var _openers: ({})
    onRawChanged: {
        const live = {};
        for (const t of raw)
            live[t.id] = true;
        let dropped = false;
        const m = {};
        for (const k in menus) {
            if (live[k])
                m[k] = menus[k];
            else
                dropped = true;
        }
        for (const k in _openers) {
            if (!live[k]) {
                _openers[k].destroy();
                delete _openers[k];
            }
        }
        if (dropped)
            menus = m;
    }

    // 读一遍还没读过菜单的托盘项（all = true 时全部重读）
    function probe(all) {
        return Promise.all(raw.filter(t => all || !(t.id in menus)).map(t => menu(t.id)));
    }

    // entryId：menu() 返回的 id，或 "quit"（第一个 danger 条目）
    function trigger(id, entryId) {
        const list = menus[id] || [];
        const e = entryId === "quit" ? list.find(x => x.danger) : list.find(x => x.id === entryId);
        if (!e || !e.entry)
            return fail("trigger", "gone", "菜单项不存在，先调用 menu()");
        e.entry.triggered();
        return ok("trigger", e.text);
    }
    // 重读菜单后按条目文字触发（QQ 状态、Clash 系统代理等用）
    function triggerText(id, pattern) {
        return menu(id).then(list => {
            const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
            const e = list.find(x => !x.sep && re.test(String(x.text).trim()));
            if (!e)
                return fail("trigger", "notfound", "托盘菜单里没有该项");
            if (e.enabled === false)
                return fail("trigger", "disabled", "“" + e.text + "”当前不可用");
            e.entry.triggered();
            return ok("trigger", e.text);
        });
    }

    Component {
        id: openerComp
        QsMenuOpener {}
    }
    Component {
        id: tickComp
        Timer {
            interval: 150
        }
    }
}
