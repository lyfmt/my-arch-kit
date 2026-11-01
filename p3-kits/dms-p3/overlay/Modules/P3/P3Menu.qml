pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io

// P3 全屏菜单的入口单例。窗口按需创建（LazyLoader），第一次打开前不占资源。
// DMSShell.qml 里引用一次（patches/DMSShell.qml.patch）让单例和 IPC 在启动时就绪。
//
// IPC（niri 的 Mod+Z 调 toggle）：
//   dms ipc call p3menu toggle
//   dms ipc call p3menu open <apps|status|calendar|system|power>   空字符串 = 主列表
//   dms ipc call p3menu close
//   dms ipc call p3menu status        → "closed" | "open" | "open:<page>"
Singleton {
    id: root

    readonly property var pages: ["apps", "status", "calendar", "system", "power"]
    readonly property var win: loader.item
    readonly property bool shown: !!win && win.shouldShow
    readonly property string page: win ? win.page : ""
    // 菜单所在的屏幕（ShellScreen；窗口还没创建时为 null）
    readonly property var screen: win ? win.screen : null

    function open(pageId) {
        loader.active = true;
        if (!win)
            return false;
        win.open(pageId || "");
        return true;
    }
    function close() {
        if (win)
            win.close();
    }
    function toggle() {
        if (shown)
            close();
        else
            open("");
    }
    function status() {
        if (!shown)
            return "closed";
        return page ? "open:" + page : "open";
    }

    LazyLoader {
        id: loader
        active: false
        P3MenuWindow {}
    }

    IpcHandler {
        target: "p3menu"

        function toggle(): string {
            root.toggle();
            return root.status();
        }
        function open(page: string): string {
            const p = (page || "").trim().toLowerCase();
            if (p && root.pages.indexOf(p) < 0)
                return "unknown page: " + p + " (apps|status|calendar|system|power)";
            root.open(p);
            return root.status();
        }
        function close(): string {
            root.close();
            return "closed";
        }
        function status(): string {
            return root.status();
        }
    }
}
