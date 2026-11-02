pragma Singleton

import QtQuick
import Quickshell
import qs.Common
import qs.Services

// P3Sys.battery — 电池与性能模式。
// @dms BatteryService（UPower）· PowerProfileWatcher.applyProfile(PowerProfile.*)
// 充电上限（@gap，需要 root）：读 /sys/class/power_supply/BAT0/charge_control_end_threshold，只读。
//   setLimit 返回 unsupported；写入要 polkit helper 或 udev 规则放开写权限，见 prototype/INTEGRATION.md 第 3 节。
// state: { available, pct, charging, plugged, remain, watts, health, limit, limitWritable:false,
//          profile: power-saver|balanced|performance, profiles: [..], profileAvailable }
Base {
    id: root
    ns: "battery"

    property int limit: 0
    // "3:42"；未知为空串。依赖 batteryEnergy/changeRate，随读数刷新
    readonly property string remain: {
        void (BatteryService.batteryEnergy + BatteryService.changeRate + BatteryService.isCharging);
        const s = BatteryService.estimatedSeconds();
        if (!s)
            return "";
        const m = Math.round(s / 60);
        return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
    }
    readonly property var state: ({
            "available": BatteryService.batteryAvailable,
            "pct": Math.round(BatteryService.batteryLevel),
            "charging": BatteryService.isCharging,
            "plugged": BatteryService.isPluggedIn,
            "remain": remain,
            "watts": Math.round(Math.abs(BatteryService.changeRate) * 10) / 10,
            "health": parseInt(BatteryService.batteryHealth) || 0,
            "limit": limit,
            "limitWritable": false,
            "profile": PowerProfileWatcher.profileSlug(PowerProfileWatcher.currentProfile),
            "profiles": (PowerProfileWatcher.availableProfiles || []).map(p => PowerProfileWatcher.profileSlug(p)),
            "profileAvailable": PowerProfileWatcher.available
        })
    onStateChanged: notify()

    Component.onCompleted: readFile("/sys/class/power_supply/BAT0/charge_control_end_threshold", t => {
        limit = t ? parseInt(t) || 0 : 0;
    })

    function setProfile(id) {
        const p = PowerProfileWatcher.parseProfileSlug(id);
        if (p < 0 || !PowerProfileWatcher.available)
            return fail("setProfile", "unsupported", "power-profiles-daemon 不可用");
        if (!PowerProfileWatcher.applyProfile(p))
            return fail("setProfile", "failed", "切换性能模式失败");
        return ok("setProfile", "性能模式 → " + ({
                "power-saver": "省电",
                "balanced": "均衡",
                "performance": "性能"
            }[id] || id));
    }
    function setLimit(pct) {
        return fail("setLimit", "unsupported", "充电上限需要 root 权限，暂不支持修改");
    }
}
