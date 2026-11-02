pragma Singleton

import QtQuick
import Quickshell
import qs.Services

// P3Sys.net — Wi-Fi。@dms NetworkService（经 DMS 后端 / NetworkManager）
//   connect 的结果是异步的：等 currentWifiSSID === ssid（成功）或 connectionError / passwordDialogShouldReopen（失败）。
//   密码错误（后端 lastError "bad-credentials"）时 reject { code: "auth" }，页面据此重新展开密码行。
//   企业网 / 隐藏网络的凭据请求走 credentialsNeeded(token, …) → submitCredentials(token, fields, save)，页面可直接连这个信号。
//   频段：后端网络条目的 frequency（MHz）；加密方式：NetworkManager 在时读 `nmcli -t -f SSID,SECURITY,FREQ device wifi list --rescan no`
//   （只读、不触发扫描，列表变化后读一次），没有 nmcli 时按 secured / enterprise 给出 WPA / 802.1X。
// state: { available, wifi, ssid, signal, ip, ethernet, vpn, down, up, scanning, connecting, error,
//          list: [{ ssid, sig, sec, on, saved, security（"WPA2" "WPA3" "802.1X" "OPEN"…）, band（"2.4 GHZ" "5 GHZ" "6 GHZ" 或 ""）}] }
Base {
    id: root
    ns: "net"

    signal credentialsNeeded(string token, string ssid, var fields)

    // ssid → { security, freq }，来自 nmcli
    property var _nm: ({})
    function bandOf(mhz) {
        const f = Number(mhz) || 0;
        if (f >= 2400 && f < 2500)
            return "2.4 GHZ";
        if (f >= 4900 && f < 5925)
            return "5 GHZ";
        if (f >= 5925 && f < 7200)
            return "6 GHZ";
        return "";
    }
    function securityOf(w, nm) {
        const t = nm ? nm.security : "";
        if (t) {
            if (/802\.1X/i.test(t))
                return "802.1X";
            for (const k of ["WPA3", "WPA2", "WPA", "OWE", "WEP"])
                if (t.toUpperCase().indexOf(k) >= 0)
                    return k;
        }
        if (w.enterprise)
            return "802.1X";
        return w.secured ? "WPA" : "OPEN";
    }
    readonly property var list: (NetworkService.wifiNetworks || []).map(w => {
        const nm = _nm[w.ssid] || null;
        return {
            "ssid": w.ssid,
            "sig": w.signal,
            "sec": !!w.secured,
            "on": !!w.connected,
            "saved": !!w.saved,
            "security": securityOf(w, nm),
            "band": bandOf(w.frequency || (nm ? nm.freq : 0))
        };
    }).sort((a, b) => b.on - a.on || b.sig - a.sig)
    readonly property string vpn: (DMSNetworkService.vpnActive || []).map(v => v.name || "").filter(n => n).join(" · ")
    readonly property var state: ({
            "available": NetworkService.wifiAvailable,
            "wifi": NetworkService.wifiEnabled,
            "ssid": NetworkService.currentWifiSSID || null,
            "signal": NetworkService.wifiSignalStrength,
            "ip": NetworkService.wifiIP || null,
            "ethernet": NetworkService.ethernetConnected,
            "vpn": vpn,
            "down": Stats.rate(DgopService.networkRxRate),
            "up": Stats.rate(DgopService.networkTxRate),
            "list": list,
            "scanning": NetworkService.isScanning,
            "connecting": NetworkService.isConnecting ? (NetworkService.connectingSSID || null) : null,
            "error": NetworkService.connectionError || ""
        })
    onStateChanged: notify()

    Connections {
        target: NetworkService
        function onCredentialsNeeded(token, ssid, setting, fields, hints, reason, connType, connName, vpnService, fieldsInfo) {
            root.credentialsNeeded(token, ssid, fields);
        }
        function onWifiNetworksChanged() {
            nmT.restart();
        }
    }
    Timer {
        id: nmT
        interval: 400
        onTriggered: root.readNm()
    }
    function readNm() {
        if (!(NetworkService.wifiNetworks || []).length)
            return;
        run(["nmcli", "-t", "-f", "SSID,SECURITY,FREQ", "device", "wifi", "list", "--rescan", "no"], (code, out) => {
            if (code !== 0)
                return;
            const o = {};
            for (const line of String(out || "").split("\n")) {
                if (!line)
                    continue;
                // -t 模式下字段里的 ":" 写成 "\:"
                const f = line.split(/(?<!\\):/).map(x => x.replace(/\\([:\\])/g, "$1"));
                if (f.length < 3 || !f[0] || o[f[0]])
                    continue;
                o[f[0]] = {
                    "security": f[1] === "--" ? "" : f[1],
                    "freq": parseInt(f[2]) || 0
                };
            }
            _nm = o;
        });
    }
    Component.onCompleted: readNm()

    function setWifi(on) {
        if (NetworkService.wifiEnabled === !!on)
            return ok("setWifi", on ? "Wi-Fi 已开启" : "Wi-Fi 已关闭");
        NetworkService.toggleWifiRadio();
        return waitFor("setWifi", () => NetworkService.wifiEnabled === !!on, 8000, on ? "Wi-Fi 已开启" : "Wi-Fi 已关闭");
    }
    function scan() {
        NetworkService.scanWifi();
        return waitFor("scan", () => !NetworkService.isScanning, 20000, () => "找到 " + list.length + " 个网络");
    }
    function connect(ssid, password) {
        const w = list.find(x => x.ssid === ssid);
        if (!w)
            return fail("connect", "notfound", ssid + " 不在范围内");
        if (w.sec && !w.saved && (password || "").length < 8)
            return fail("connect", "auth", "密码至少 8 位");
        NetworkService.connectToWifi(ssid, password || "", "", "", "", false, "", "");
        let auth = false;
        return waitFor("connect", () => NetworkService.currentWifiSSID === ssid && !NetworkService.isConnecting, 30000, () => "已连接 " + ssid + (NetworkService.wifiIP ? " · " + NetworkService.wifiIP : ""), () => {
            if (NetworkService.isConnecting)
                return "";
            const e = NetworkService.connectionError || "";
            if (e === "bad-credentials" || NetworkService.connectionStatus === "invalid_password") {
                auth = true;
                return ssid + " 密码错误";
            }
            if (e === "user-canceled")
                return "已取消连接 " + ssid;
            return e ? "连接 " + ssid + " 失败：" + e : "";
        }).catch(err => Promise.reject(auth ? {
                "code": "auth",
                "message": err.message
            } : err));
    }
    function disconnect() {
        const s = NetworkService.currentWifiSSID;
        NetworkService.disconnectWifi();
        return waitFor("disconnect", () => !NetworkService.currentWifiSSID, 10000, "已断开 " + s);
    }
    function forget(ssid) {
        NetworkService.forgetWifiNetwork(ssid);
        return ok("forget", "已忘记 " + ssid);
    }
    function submitCredentials(token, secrets, save) {
        NetworkService.submitCredentials(token, secrets, save !== false);
        return ok("submitCredentials", null);
    }
}
