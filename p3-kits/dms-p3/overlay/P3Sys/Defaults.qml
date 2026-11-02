pragma Singleton

import QtQuick
import Quickshell

// P3Sys.defaults — 默认应用。DMS 2.0 只有面板没有 setter（@gap），这里直接用 xdg 工具（不需要 root）：
//   browser  xdg-settings get/set default-web-browser <desk>
//   files    xdg-mime query/default inode/directory
//   music    xdg-mime default <desk> audio/mpeg audio/flac audio/ogg
//   term     没有 xdg 标准：只读（显示 Mod+T 绑定的命令），set 返回 unsupported
// 候选 = 已安装应用里能处理对应类型的（按 desktop 的 Categories / MimeType 粗筛），state[role] = 候选里的下标（-1 = 不在候选里）
// state: { browser, files, term, music }，options: { role: [desktopId] }，current: { role: desktopId }
Base {
    id: root
    ns: "defaults"

    property var current: ({
            "browser": "",
            "files": "",
            "term": "",
            "music": ""
        })
    readonly property var options: {
        const has = (a, re) => re.test(((a.entry && a.entry.categories) || []).join(";"));
        const pick = re => Apps.all.filter(a => has(a, re)).map(a => a.id);
        const add = (list, id) => id && list.indexOf(id) < 0 ? list.concat([id]) : list;
        return {
            "browser": add(pick(/WebBrowser/), current.browser),
            "files": add(pick(/FileManager/), current.files),
            "term": add(pick(/TerminalEmulator/), current.term),
            "music": add(pick(/Audio|Music|Player/), current.music)
        };
    }
    readonly property var state: ({
            "browser": options.browser.indexOf(current.browser),
            "files": options.files.indexOf(current.files),
            "term": options.term.indexOf(current.term),
            "music": options.music.indexOf(current.music)
        })
    onStateChanged: notify()

    function strip(s) {
        return (s || "").trim().replace(/\.desktop$/, "");
    }
    function refresh() {
        run(["xdg-settings", "get", "default-web-browser"], (c, o) => _put("browser", strip(o)));
        run(["xdg-mime", "query", "default", "inode/directory"], (c, o) => _put("files", strip(o)));
        run(["xdg-mime", "query", "default", "audio/mpeg"], (c, o) => _put("music", strip(o)));
        const t = (Keybinds.list.find(b => b.key === "Mod+T") || {}).cmd || "";
        const m = /spawn\s+"([^"]+)"/.exec(t);
        _put("term", m ? m[1] : "");
    }
    function _put(k, v) {
        const n = Object.assign({}, current);
        n[k] = v;
        current = n;
    }

    function set(role, i) {
        const id = (options[role] || [])[i];
        if (!id)
            return fail("set", "bad", "无效选项");
        const desk = id + ".desktop";
        let argv;
        if (role === "browser")
            argv = ["xdg-settings", "set", "default-web-browser", desk];
        else if (role === "files")
            argv = ["xdg-mime", "default", desk, "inode/directory"];
        else if (role === "music")
            argv = ["xdg-mime", "default", desk, "audio/mpeg", "audio/flac", "audio/ogg", "audio/x-wav"];
        else
            return fail("set", "unsupported", "默认终端没有统一的设置方法，请改 Mod+T 快捷键");
        return exec("set", argv, () => {
            _put(role, id);
            return "默认 → " + ((Apps.byId(id) || {}).name || id);
        }, "设置默认应用失败");
    }

    Component.onCompleted: refresh()
}
