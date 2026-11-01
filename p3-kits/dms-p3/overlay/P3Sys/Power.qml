pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Io
import qs.Common
import qs.Services

// P3Sys.power — 会话动作。
// @dms lock = IdleService.lockRequested()（Modules/Lock/Lock.qml 接收，等同 `dms ipc call lock lock`）
//      suspend / hibernate / logout / reboot / poweroff = SessionService.*（logout/reboot/poweroff 照 DMS 设置可能先确认）
//      restartShell = `dms restart`（SystemUpdateService.restartShell）
// 合盖动作（只读，@gap DMS 没有接口）：logind 的 HandleLidSwitch / HandleLidSwitchExternalPower，
//   `busctl get-property org.freedesktop.login1 … Manager` 读出（suspend lock ignore poweroff hibernate …；读不到为空串）。
//   第一次用到时读一次，refreshLid() 重读。
// state: { supported: { lock, suspend, hibernate, logout, reboot, poweroff }, last, lid, lidExternal }
Base {
    id: root
    ns: "power"

    property string last: ""
    readonly property var supported: ({
            "lock": true,
            "suspend": SessionService.isPowerActionSupported("suspend"),
            "hibernate": SessionService.hibernateSupported,
            "logout": true,
            "reboot": true,
            "poweroff": true
        })
    property string lid: ""
    property string lidExternal: ""
    readonly property var state: ({
            "supported": supported,
            "last": last,
            "lid": lid,
            "lidExternal": lidExternal
        })
    onStateChanged: notify()

    // run(a) 是会话动作，所以这里不用 Base.run，自带一个 Process
    function refreshLid() {
        lidProc.running = true;
    }
    Process {
        id: lidProc
        running: true
        command: ["busctl", "get-property", "org.freedesktop.login1", "/org/freedesktop/login1", "org.freedesktop.login1.Manager", "HandleLidSwitch", "HandleLidSwitchExternalPower"]
        stdout: StdioCollector {
            // 每个属性一行：s "suspend"
            onStreamFinished: {
                const v = text.split("\n").map(l => (/"([^"]*)"/.exec(l) || [])[1]).filter(x => x !== undefined);
                root.lid = v[0] || "";
                root.lidExternal = v[1] || "";
            }
        }
    }

    readonly property var labels: ({
            "lock": "已锁屏",
            "suspend": "正在睡眠",
            "hibernate": "正在休眠",
            "logout": "正在注销",
            "reboot": "正在重启",
            "poweroff": "正在关机",
            "restartShell": "Shell 正在重启"
        })

    // a: lock|suspend|hibernate|logout|reboot|poweroff|restartShell
    // 调用前页面应先关掉菜单（P3Menu.close()），否则锁屏会盖在菜单下面
    function run(a) {
        if (!labels[a])
            return fail("run", "bad", "未知操作 " + a);
        if (a !== "restartShell" && !supported[a])
            return fail("run", "unsupported", "本机不支持该操作");
        last = a;
        switch (a) {
        case "lock":
            IdleService.lockRequested();
            break;
        case "suspend":
            SessionService.suspend();
            break;
        case "hibernate":
            SessionService.hibernate();
            break;
        case "logout":
            SessionService.logout();
            break;
        case "reboot":
            SessionService.reboot();
            break;
        case "poweroff":
            SessionService.poweroff();
            break;
        case "restartShell":
            Quickshell.execDetached(["dms", "restart"]);
            break;
        }
        return ok("run", labels[a]);
    }
}
