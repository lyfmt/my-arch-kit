pragma Singleton

import QtQuick
import Quickshell
import qs.Services

// P3Sys.bt — 蓝牙。@dms BluetoothService（Quickshell.Bluetooth）
//   已配对：device.connect() / disconnect()；未配对：pairDevice(dev, cb) 再 connectDeviceWithTrust(dev)
// state: { available, on, scanning, devices: [{ name, addr, kind, connected, paired, nearby, battery }], busy }
Base {
    id: root
    ns: "bt"

    property string busy: ""
    readonly property var raw: BluetoothService.devices ? BluetoothService.devices.values.filter(d => BluetoothService.hasRealName(d)) : []
    readonly property var devices: raw.map(d => ({
                "name": d.name || d.deviceName || d.address,
                "addr": d.address,
                "kind": kind(BluetoothService.getDeviceIcon(d)),
                "connected": d.connected,
                "paired": d.paired,
                "nearby": !d.paired,
                "battery": d.batteryAvailable ? Math.round(d.battery * 100) : null
            }))
    readonly property var state: ({
            "available": BluetoothService.available,
            "on": BluetoothService.enabled,
            "scanning": BluetoothService.discovering,
            "devices": devices,
            "busy": busy || null
        })
    onStateChanged: notify()

    // DMS 的 material 图标名 → 原型的设备类型
    function kind(icon) {
        if (/headset|headphone/.test(icon))
            return "headphones";
        if (/mouse/.test(icon))
            return "mouse";
        if (/keyboard/.test(icon))
            return "kbd";
        if (/phone|smartphone/.test(icon))
            return "phone";
        if (/speaker/.test(icon))
            return "speaker";
        return "other";
    }
    function find(name) {
        return raw.find(d => d.address === name || (d.name || d.deviceName) === name) || null;
    }

    function setPower(on) {
        if (!BluetoothService.available)
            return fail("setPower", "unavailable", "没有蓝牙适配器");
        BluetoothService.setBluetoothEnabled(!!on);
        return waitFor("setPower", () => BluetoothService.enabled === !!on, 8000, on ? "蓝牙已开启" : "蓝牙已关闭");
    }
    function setScan(on) {
        if (!BluetoothService.adapter)
            return fail("setScan", "unavailable", "没有蓝牙适配器");
        BluetoothService.adapter.discovering = !!on;
        return ok("setScan", on ? "正在搜索附近设备" : "已停止搜索");
    }
    // name：设备名或地址。已连接 → 断开；已配对 → 连接；未配对 → 配对后连接
    function toggle(name) {
        const d = find(name);
        if (!d)
            return fail("connect", "notfound", name + " 不在范围内");
        const label = d.name || d.address;
        busy = label;
        notify();
        const clear = r => {
            busy = "";
            notify();
            return r;
        };
        const clearErr = e => {
            busy = "";
            notify();
            throw e;
        };
        if (d.connected) {
            d.disconnect();
            return waitFor("connect", () => !d.connected, 10000, "已断开 " + label).then(clear, clearErr);
        }
        if (d.paired) {
            d.connect();
            return waitFor("connect", () => d.connected, 20000, "已连接 " + label).then(clear, clearErr);
        }
        return later("connect", (resolve, reject) => BluetoothService.pairDevice(d, res => {
                if (res && res.error) {
                    reject("pair", label + " 配对失败：" + res.error);
                    return;
                }
                BluetoothService.connectDeviceWithTrust(d);
                resolve("已配对 " + label);
            })).then(() => waitFor("connect", () => d.connected, 20000, "已连接 " + label)).then(clear, clearErr);
    }
}
