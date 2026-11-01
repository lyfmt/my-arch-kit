pragma Singleton

import QtQuick
import Quickshell
import qs.Common
import qs.Services

// P3Sys.mode — 勿扰与保持唤醒。
// @dms SessionData.setDoNotDisturb(on, minutes, "p3menu") · SessionService.enableIdleInhibit / disableIdleInhibit
// state: { dnd, dndUntil (ms, 0 = 不限时), caffeine }
Base {
    id: root
    ns: "mode"

    readonly property var state: ({
            "dnd": SessionData.doNotDisturb,
            "dndUntil": SessionData.doNotDisturbUntil,
            "caffeine": SessionService.idleInhibited
        })
    onStateChanged: notify()

    function setDnd(on, minutes) {
        SessionData.setDoNotDisturb(!!on, minutes || 0, "p3menu");
        return ok("setDnd", on ? (minutes ? "勿扰 " + minutes + " 分钟" : "勿扰已开启") : "勿扰已关闭");
    }
    function setCaffeine(on) {
        if (on)
            SessionService.enableIdleInhibit(0);
        else
            SessionService.disableIdleInhibit();
        return ok("setCaffeine", on ? "保持唤醒已开启" : "保持唤醒已关闭");
    }
}
