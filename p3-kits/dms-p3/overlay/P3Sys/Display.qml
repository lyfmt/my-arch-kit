pragma Singleton

import QtQuick
import Quickshell
import qs.Common
import qs.Services

// P3Sys.display — 亮度、夜间模式、显示器（只读）。
// @dms DisplayService.setBrightness(pct, device, true) · NightModeService.enableNightMode/disableNightMode
//      SessionData.setNightModeTemperature / setNightModeAutoEnabled / setNightModeAutoMode / setNightModeStartHour / EndHour
//      显示器：NiriService.outputs（只读）；拿不到时（非 niri）用 Quickshell.screens，尺寸为逻辑像素
// sched：0 手动 · 1 日落到日出（location 模式）· 2 22:00–07:00（time 模式）
// state: { available, bright, night, temp, sched, monitors: [{ name, w, h, scale, primary }] }
Base {
    id: root
    ns: "display"

    readonly property int sched: !SessionData.nightModeAutoEnabled ? 0 : (SessionData.nightModeAutoMode === "location" ? 1 : 2)
    readonly property var monitors: {
        const o = NiriService.outputs || {};
        const focused = CompositorService.getFocusedScreen()?.name;
        if (!Object.keys(o).length)
            return Quickshell.screens.map(s => ({
                        "name": s.name,
                        "w": s.width,
                        "h": s.height,
                        "scale": s.devicePixelRatio || 1,
                        "primary": focused === s.name
                    }));
        return Object.keys(o).map(k => {
            const out = o[k];
            const m = out.modes && out.current_mode !== undefined && out.current_mode !== null ? out.modes[out.current_mode] : null;
            return {
                "name": k,
                "w": out.logical ? out.logical.width : (m ? m.width : 0),
                "h": out.logical ? out.logical.height : (m ? m.height : 0),
                "scale": out.logical ? out.logical.scale : 1,
                "primary": focused === k
            };
        });
    }
    readonly property var state: ({
            "available": BrightnessService.brightnessAvailable,
            "bright": DisplayService.brightnessLevel,
            "night": DisplayService.nightModeEnabled,
            "temp": SessionData.nightModeTemperature || 4000,
            "sched": sched,
            "monitors": monitors
        })
    onStateChanged: notify()

    function clamp(v, a, b) {
        return Math.max(a, Math.min(b, Math.round(v)));
    }

    function setBrightness(v) {
        if (!BrightnessService.brightnessAvailable)
            return fail("setBrightness", "unavailable", "没有可调亮度的屏幕");
        DisplayService.setBrightness(clamp(v, 1, 100), "", true);
        return ok("setBrightness", "亮度 " + clamp(v, 1, 100) + "%");
    }
    function setNight(on) {
        if (on)
            NightModeService.enableNightMode();
        else
            NightModeService.disableNightMode();
        return ok("setNight", on ? "夜间模式 " + (SessionData.nightModeTemperature || 4000) + "K" : "夜间模式已关");
    }
    function setTemp(k) {
        const t = clamp(k, 2500, 6500);
        SessionData.setNightModeTemperature(t);
        return ok("setTemp", "色温 " + t + "K");
    }
    function setSchedule(i) {
        if (i === 0) {
            SessionData.setNightModeAutoEnabled(false);
        } else if (i === 1) {
            SessionData.setNightModeAutoMode("location");
            SessionData.setNightModeAutoEnabled(true);
        } else if (i === 2) {
            SessionData.setNightModeAutoMode("time");
            SessionData.setNightModeStartHour(22);
            SessionData.setNightModeEndHour(7);
            SessionData.setNightModeAutoEnabled(true);
        } else {
            return fail("setSchedule", "bad", "无效的计划");
        }
        return ok("setSchedule", ["夜间模式 · 手动", "夜间模式 · 日落到日出", "夜间模式 · 22:00 – 07:00"][i]);
    }
}
