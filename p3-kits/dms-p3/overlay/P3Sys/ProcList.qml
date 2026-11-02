pragma Singleton

import QtQuick
import Quickshell
import qs.Services

// P3Sys.proc — 进程列表（原型命名空间 proc；文件名 ProcList 是为了不和 qs.Common 的 Proc 单例重名）。
// @dms DgopService.processes / setSortBy；结束进程 = Process ["kill", "-15"|"-9", pid]（同 ProcessContextMenu.qml）
//   规则：pid 1 一律拒绝；强制结束 pid ≤ 1000 拒绝。
//   结束成功后让 DgopService 立即重新采样一次，列表不用等下一个轮询周期。
//   watch() 返回 release()。
// state: { list: [{ pid, name, cpu, mem (MB) }], sort: "cpu"|"memory" }
Base {
    id: root
    ns: "proc"

    readonly property var list: (DgopService.processes || []).map(p => ({
                "pid": p.pid,
                "name": p.displayName || p.command || String(p.pid),
                "cpu": Math.round((p.cpu || 0) * 10) / 10,
                "mem": Math.round((p.memoryKB || 0) / 1024)
            }))
    readonly property var state: ({
            "list": list,
            "sort": DgopService.currentSort
        })
    onListChanged: notify()

    function watch() {
        DgopService.addRef(["processes", "cpu", "memory"]);
        let released = false;
        return () => {
            if (!released) {
                released = true;
                DgopService.removeRef(["processes", "cpu", "memory"]);
            }
        };
    }
    // k: "cpu" | "mem"（原型）| "memory"
    function sort(k) {
        DgopService.setSortBy(k === "mem" ? "memory" : k);
        notify();
    }
    function kill(pid, force) {
        const p = list.find(x => x.pid === pid);
        const name = p ? p.name : String(pid);
        if (pid === 1 || (force && pid <= 1000))
            return fail("kill", "denied", "不能强制结束系统进程 " + name + " (" + pid + ")");
        const r = exec("kill", ["kill", force ? "-9" : "-15", String(pid)], "已" + (force ? "强制" : "") + "结束 " + name + " (" + pid + ")", "结束 " + name + " 失败");
        r.then(() => refreshT.restart(), () => {});
        return r;
    }
    // 给进程一点退出时间再采样
    Timer {
        id: refreshT
        interval: 250
        onTriggered: DgopService.updateAllStats()
    }
}
