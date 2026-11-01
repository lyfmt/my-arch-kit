pragma Singleton

import QtQuick
import Quickshell
import qs.Common
import qs.Services

// P3Sys.apps — 应用列表、搜索、图标与启动。
// @dms AppSearchService.getVisibleApplications() · AppUsageHistoryData.getRankedApps()
//      搜索：AppSearchService 的打分（名字 / 通用名 / id / 关键词 / 注释 / 模糊 + 使用频率），不截断条数
//      图标：Paths.resolveIconPath（主题图标 + appIdSubstitutions + DesktopService 的桌面项查找）
//      启动：SessionService.launchDesktopEntry(entry, false, []) + AppUsageHistoryData.addAppUsage(entry)
// 应用对象 = DesktopEntry 的投影：{ id, name, icon（主题图标名或 file://）, keys（genericName + keywords）, entry }
Base {
    id: root
    ns: "apps"

    // 原型的三个固定入口（TERMINAL / BROWSER / FILES）；按 desktop id 在已安装应用里找，找不到的槽位为 null
    readonly property var pinnedIds: ({
            "TERMINAL": ["kitty", "foot", "Alacritty", "org.wezfurlong.wezterm"],
            "BROWSER": ["chromium", "firefox", "google-chrome"],
            "FILES": ["thunar", "org.gnome.Nautilus", "org.kde.dolphin"]
        })

    // getVisibleApplications() 会写服务内部缓存，放进绑定里会成环；所以在列表变化时命令式刷新
    property var all: []
    function refresh() {
        all = AppSearchService.getVisibleApplications().map(project);
    }
    Component.onCompleted: refresh()
    Connections {
        target: AppSearchService
        function onApplicationsChanged() {
            Qt.callLater(root.refresh);
        }
    }
    readonly property var usage: {
        const r = AppUsageHistoryData.appUsageRanking || {};
        const out = {};
        for (const k in r)
            out[k] = r[k].usageCount || 0;
        return out;
    }
    readonly property var pinned: {
        const out = {};
        for (const role in pinnedIds) {
            const hit = pinnedIds[role].map(id => byId(id)).find(a => !!a);
            out[role] = hit ? hit.id : null;
        }
        return out;
    }
    readonly property var state: ({
            "all": all,
            "pinned": pinned,
            "usage": usage
        })

    onAllChanged: {
        _iconMiss = ({});
        notify();
    }
    onUsageChanged: notify()

    function project(e) {
        return {
            "id": e.id || "",
            "name": e.name || e.id || "",
            "icon": e.icon || "",
            "keys": [(e.genericName || ""), ...(e.keywords || [])].join(" "),
            "entry": e
        };
    }
    // 图标名 / 路径 / 应用名 → 可直接给 Image.source 的 url；解析不出来时返回 ""（调用方画自己的占位）。
    // 也接受 PipeWire 流的 application.name 这类名字（"Chromium"、"ALSA plug-in [mpv]"）：
    //   先按原名走 Paths.resolveIconPath，再试括号里的名字、第一个词、去掉 -bin；
    //   最后按桌面项的 id / 名字 / StartupWMClass / Exec 程序名（不分大小写）找到应用，用它的图标。
    property var _iconMiss: ({})
    function iconSource(icon) {
        if (!icon)
            return "";
        const s = String(icon);
        if (s.startsWith("/"))
            return "file://" + s;
        if (s.includes("://"))
            return s;
        if (s.startsWith("~"))
            return "file://" + home + s.slice(1);
        const direct = Paths.resolveIconPath(s);
        if (direct)
            return direct;
        if (_iconMiss[s])
            return "";
        for (const c of iconNames(s)) {
            const p = Paths.resolveIconPath(c);
            if (p)
                return p;
        }
        const a = matchName(s);
        const p = a && a.icon && a.icon !== s ? (a.icon.startsWith("/") ? "file://" + a.icon : Paths.resolveIconPath(a.icon)) : "";
        if (!p)
            _iconMiss[s] = true;
        return p;
    }
    // 名字的几种写法：括号里的程序名、第一个词、去掉 -bin / 非字母数字
    function iconNames(s) {
        const out = [];
        const add = x => {
            x = String(x || "").trim();
            if (x && x !== s && out.indexOf(x) < 0)
                out.push(x);
        };
        const br = /\[([^\]]+)\]/.exec(s);
        if (br)
            add(br[1]);
        const first = s.split(/[\s:]+/)[0];
        add(first);
        add(first.toLowerCase());
        add(s.toLowerCase().replace(/-bin$/, ""));
        add(s.toLowerCase().replace(/[^a-z0-9.\-]/g, ""));
        return out;
    }
    // 名字 → 应用：id（含末段）、名字、StartupWMClass、Exec 的程序名，不分大小写
    function matchName(name) {
        const keys = [String(name || "")].concat(iconNames(String(name || ""))).map(k => k.toLowerCase()).filter(k => k.length >= 2);
        if (!keys.length)
            return null;
        for (const a of all) {
            const e = a.entry || {};
            const cmd = e.command && e.command.length ? String(e.command[0]) : String(e.execString || "").split(/\s+/)[0];
            const cands = [a.id, a.id.replace(/\.desktop$/, "").split(".").pop(), a.name, e.startupClass || "", cmd.split("/").pop()].map(x => String(x || "").toLowerCase());
            if (keys.some(k => cands.indexOf(k) >= 0))
                return a;
        }
        return null;
    }

    function byId(id) {
        if (!id)
            return null;
        const low = String(id).toLowerCase();
        return all.find(a => a.id === id || a.id.toLowerCase() === low || a.id.toLowerCase() === low + ".desktop") || null;
    }
    // 按使用次数降序，同次数按名字
    function ranked() {
        const u = usage;
        return all.slice().sort((a, b) => (u[b.id] || 0) - (u[a.id] || 0) || a.name.localeCompare(b.name, "zh"));
    }
    // AppSearchService.searchApplications 的同一套打分，只取应用（不含桌面动作），不截断
    function search(q) {
        const s = String(q || "").toLowerCase().trim();
        if (!s)
            return ranked();
        const svc = AppSearchService;
        const words = svc.tokenize(s);
        const scored = [];
        for (const en of svc._visibleSearchIndex().entries) {
            const t = textScore(svc, en, s, words);
            if (t <= 0)
                continue;
            const f = svc.calculateFrecency(en.app);
            const bonus = (f.frecency > 0 ? Math.min(f.frecency, 2000) : 0) + (f.daysSinceUsed < 1 ? 1500 : f.daysSinceUsed < 7 ? 1000 : f.daysSinceUsed < 30 ? 500 : 0);
            scored.push([en.app, t + bonus]);
        }
        scored.sort((a, b) => b[1] - a[1]);
        return scored.map(x => project(x[0]));
    }
    function textScore(svc, en, s, words) {
        if (en.name === s)
            return 10000;
        if (en.name.startsWith(s))
            return 5000;
        if (svc.wordBoundaryMatchWords(en.nameWords, words))
            return 3000;
        if (en.name.includes(s))
            return 500;
        if (en.genericName && en.genericName.startsWith(s))
            return 800;
        if (en.genericName && en.genericName.includes(s))
            return 400;
        if (en.id && en.id.includes(s))
            return 350;
        for (const k of en.keywords) {
            if (k.startsWith(s))
                return 300;
            if (k.includes(s))
                return 150;
        }
        if (en.comment && en.comment.includes(s))
            return 50;
        const fz = svc.fuzzyMatchScore(en.name, s, en.nameWords);
        return fz > 0 ? fz * 100 : 0;
    }

    function launch(id) {
        const a = byId(id);
        if (!a)
            return fail("launch", "notfound", "找不到应用 " + id);
        SessionService.launchDesktopEntry(a.entry, false, []);
        AppUsageHistoryData.addAppUsage(a.entry);
        return ok("launch", "已启动 " + a.name);
    }
}
