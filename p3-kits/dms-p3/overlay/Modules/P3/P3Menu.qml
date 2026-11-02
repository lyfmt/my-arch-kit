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
//   dms ipc call p3menu focus         → 焦点元素：页面、名字、页面坐标的盒子（调试和无头自测用）
Singleton {
    id: root

    readonly property var pages: ["apps", "status", "calendar", "system", "power"]
    readonly property var win: loader.item
    readonly property bool shown: !!win && win.shouldShow
    // 窗口还在屏幕上（含收场动画）
    readonly property bool present: !!win && win.visible
    // "closed" | "opening" | "open" | "closing"
    readonly property string phase: win ? win.phase : "closed"
    readonly property string page: win ? win.page : ""
    // 菜单所在的屏幕（ShellScreen；窗口还没创建时为 null）
    readonly property var screen: win ? win.screen : null

    // 灵动岛（P3IslandLayer）登记在这里：菜单打开时岛吸成水滴，P3MenuReveal 从水滴中心破开（岛的 drop()）
    property var islands: []

    function registerIsland(island) {
        if (island && root.islands.indexOf(island) === -1)
            root.islands.push(island);
    }
    function unregisterIsland(island) {
        const i = root.islands.indexOf(island);
        if (i !== -1)
            root.islands.splice(i, 1);
    }
    // 这块屏幕上能接手出场动画的岛；没有时菜单用自己的水位渐显
    function islandOn(screenName) {
        for (const island of root.islands) {
            if (island && island.dropReady && island.screenName === screenName)
                return island;
        }
        return null;
    }

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
        function focus(): string {
            return root.win ? root.win.describeFocus() : "closed";
        }
    }
}
