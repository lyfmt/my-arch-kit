pragma Singleton

import QtQuick
import Quickshell

// P3Sys.about — 本机信息（只读）。@gap DMS 2.0 没有对应服务：第一次用到时跑一次 `uname -nr`。
// state: { host, kernel }（读到之前是空串）
Base {
    id: root
    ns: "about"

    property string host: ""
    property string kernel: ""
    readonly property var state: ({
            "host": host,
            "kernel": kernel
        })
    onStateChanged: notify()

    function refresh() {
        run(["uname", "-nr"], (code, out) => {
            if (code !== 0)
                return;
            const p = String(out || "").trim().split(/\s+/);
            host = p[0] || "";
            kernel = p[1] || "";
        });
    }
    Component.onCompleted: refresh()
}
