pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io
import qs.Services

// P3Sys.autostart — 开机自启。@dms 照 Modules/Settings/AutoStartTab.qml：~/.config/autostart/<id>.desktop，
//   用 Hidden=true|false 开关（不删文件）。第一次开启某个还没有自启文件的应用时，复制它的 desktop 文件过去。
// state: { list: [{ id, name, icon, on, path }] }（id = 文件名去掉 .desktop）
Base {
    id: root
    ns: "autostart"

    readonly property string dir: configHome + "/autostart"
    property var list: []
    readonly property var state: ({
            "list": list
        })

    function refresh() {
        run(["sh", "-c", "for f in \"$1\"/*.desktop; do [ -f \"$f\" ] || continue; printf '\\036%s\\n' \"$f\"; cat \"$f\"; done", "sh", dir], (code, out) => {
            const items = [];
            for (const chunk of out.split("\u001e")) {
                if (!chunk.trim())
                    continue;
                const nl = chunk.indexOf("\n");
                const path = chunk.slice(0, nl);
                const body = chunk.slice(nl + 1);
                const get = k => {
                    const m = new RegExp("^" + k + "=(.*)$", "m").exec(body);
                    return m ? m[1].trim() : "";
                };
                const id = path.replace(/^.*\//, "").replace(/\.desktop$/, "");
                items.push({
                    "id": id,
                    "name": get("Name") || id,
                    "icon": Apps.iconSource(get("Icon") || (Apps.byId(id) || {}).icon || ""),
                    "on": get("Hidden") !== "true" && get("X-GNOME-Autostart-enabled") !== "false",
                    "path": path,
                    "content": body
                });
            }
            list = items.sort((a, b) => a.name.localeCompare(b.name, "zh"));
            notify();
        });
    }

    function setHiddenIn(content, hidden) {
        const lines = content.split("\n");
        let found = false;
        const merged = lines.map(l => {
            if (/^Hidden=(true|false)\s*$/.test(l)) {
                found = true;
                return "Hidden=" + (hidden ? "true" : "false");
            }
            if (/^X-GNOME-Autostart-enabled=/.test(l))
                return "X-GNOME-Autostart-enabled=" + (hidden ? "false" : "true");
            return l;
        });
        if (!found) {
            const i = merged.findIndex(l => l.trim() === "[Desktop Entry]");
            merged.splice(i >= 0 ? i + 1 : 0, 0, "Hidden=" + (hidden ? "true" : "false"));
        }
        return merged.join("\n");
    }

    // id：现有自启项的 id，或应用的 desktop id（没有自启文件时从应用目录复制）
    function set(id, on) {
        const a = list.find(x => x.id === id);
        if (a) {
            return later("set", (resolve, reject) => writeFile(a.path, setHiddenIn(a.content, !on), okw => {
                    if (!okw) {
                        reject("write", "写入自启文件失败");
                        return;
                    }
                    refresh();
                    resolve(a.name + (on ? " 开机自启" : " 不再自启"));
                }));
        }
        if (!on)
            return ok("set", null);
        const app = Apps.byId(id);
        if (!app || !app.entry)
            return fail("set", "notfound", "找不到应用 " + id);
        const src = app.entry.id ? app.entry.id : id;
        return later("set", (resolve, reject) => run(["sh", "-c", "mkdir -p \"$1\" && for d in \"${XDG_DATA_HOME:-$HOME/.local/share}/applications\" /usr/share/applications; do [ -f \"$d/$2.desktop\" ] && cp \"$d/$2.desktop\" \"$1/$2.desktop\" && exit 0; done; exit 1", "sh", dir, src], code => {
                if (code !== 0) {
                    reject("copy", "找不到 " + src + ".desktop");
                    return;
                }
                refresh();
                resolve(app.name + " 开机自启");
            }));
    }

    Component.onCompleted: refresh()
}
