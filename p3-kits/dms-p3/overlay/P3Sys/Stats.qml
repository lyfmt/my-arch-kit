pragma Singleton

import QtQuick
import Quickshell
import qs.Services

// P3Sys.stats — 系统读数。@dms DgopService（dgop 经 DMS 后端；DMS_SOCKET 未连接时全为 0，available=false）
//   watch() 引用计数打开轮询，返回 release()；页面在 onLeave 里调用 release。
// state: { available, cpu, cpuTemp, cpuGhz, cores, ram, ramUsed, ramTotal (GB), swap, disk, diskUsed, diskTotal,
//          uptime, load, procs, down, up (B/s), cpuHist: [..], gpuTemp }
//   gpuTemp：DgopService.availableGpus 里最高的正温度（°C，取整），没有读数时为 null。
//            只读 DgopService 已有的 GPU 元数据，不为某块 GPU 开监控（避免唤醒独显）。
Base {
    id: root
    ns: "stats"

    readonly property var modules: ["cpu", "memory", "system", "diskmounts", "network"]
    readonly property var rootMount: (DgopService.diskMounts || []).find(m => m.mount === "/" || m.mountpoint === "/") || null
    readonly property var gpuTemp: {
        const t = (DgopService.availableGpus || []).map(g => +g.temperature || 0).filter(x => x > 0);
        return t.length ? Math.round(Math.max(...t)) : null;
    }
    readonly property var state: ({
            "available": DgopService.dgopAvailable,
            "cpu": Math.round(DgopService.cpuUsage),
            "cpuTemp": Math.round(DgopService.cpuTemperature),
            "cpuGhz": Math.round(DgopService.cpuFrequency / 100) / 10,
            "cores": DgopService.cpuCores,
            "ram": Math.round(DgopService.memoryUsage),
            "ramUsed": Math.round(DgopService.usedMemoryMB / 102.4) / 10,
            "ramTotal": Math.round(DgopService.totalMemoryMB / 102.4) / 10,
            "swap": DgopService.totalSwapKB > 0 ? Math.round(DgopService.usedSwapKB * 100 / DgopService.totalSwapKB) : 0,
            "disk": rootMount ? parseInt(rootMount.percent) || 0 : 0,
            "diskUsed": rootMount ? rootMount.used || "" : "",
            "diskTotal": rootMount ? rootMount.size || "" : "",
            "uptime": DgopService.shortUptime || DgopService.uptime,
            "load": DgopService.loadAverage,
            "procs": DgopService.processCount,
            "down": DgopService.networkRxRate,
            "up": DgopService.networkTxRate,
            "cpuHist": (DgopService.cpuHistory || []).slice(-20),
            "gpuTemp": gpuTemp
        })
    onStateChanged: notify()

    function watch() {
        DgopService.addRef(modules);
        let released = false;
        return () => {
            if (released)
                return;
            released = true;
            DgopService.removeRef(modules);
        };
    }
    // 字节/秒 → "2.4 MB/s"
    function rate(bps) {
        const u = ["B/s", "KB/s", "MB/s", "GB/s"];
        let v = bps || 0, i = 0;
        while (v >= 1024 && i < u.length - 1) {
            v /= 1024;
            i++;
        }
        return (i ? v.toFixed(1) : Math.round(v)) + " " + u[i];
    }
}
