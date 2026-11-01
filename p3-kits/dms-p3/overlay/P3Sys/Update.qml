pragma Singleton

import QtQuick
import Quickshell
import qs.Services

// P3Sys.update — 系统更新。@dms SystemUpdateService：availableUpdates、checkForUpdates()、runUpdates()（打开终端跑 paru/yay）
//   watch() → SystemUpdateService.addRef/removeRef，返回 release()
// state: { available, count, running, checking, checked ("HH:MM" | ""), error }
Base {
    id: root
    ns: "update"

    readonly property var state: ({
            "available": SystemUpdateService.distributionSupported,
            "count": (SystemUpdateService.availableUpdates || []).length,
            "running": SystemUpdateService.isUpgrading,
            "checking": SystemUpdateService.isChecking,
            "checked": SystemUpdateService.lastCheckUnix > 0 ? Qt.formatTime(new Date(SystemUpdateService.lastCheckUnix * 1000), "HH:mm") : "",
            "error": SystemUpdateService.hasError ? SystemUpdateService.errorMessage : ""
        })
    onStateChanged: notify()

    function watch() {
        SystemUpdateService.addRef(["updates"]);
        let released = false;
        return () => {
            if (!released) {
                released = true;
                SystemUpdateService.removeRef(["updates"]);
            }
        };
    }
    function check() {
        SystemUpdateService.checkForUpdates();
        return waitFor("check", () => !SystemUpdateService.isChecking, 120000, () => {
            const n = (SystemUpdateService.availableUpdates || []).length;
            return n ? n + " 个更新可用" : "已是最新";
        }, () => SystemUpdateService.hasError ? SystemUpdateService.errorMessage || "检查更新失败" : "");
    }
    // 在终端里执行，结果由用户在终端里看；这里只确认已经开始
    function run() {
        const n = (SystemUpdateService.availableUpdates || []).length;
        if (!n)
            return fail("run", "none", "没有可用更新");
        SystemUpdateService.runUpdates({});
        return ok("run", "正在更新 " + n + " 个包");
    }
}
