pragma Singleton

import QtQuick
import Quickshell

// P3Sys.clash — Clash Verge（mihomo）控制器。DMS 2.0 没有接口（@gap），这里直接走 mihomo 的 REST API：
//   控制器地址与 secret 从 Clash Verge 的 config.yaml 读（external-controller / secret），不写进任何日志。
//   GET /configs → mode、tun.enable；PATCH /configs {"mode"} / {"tun":{"enable"}}
//   GET /proxies → 第一个 Selector 组（GLOBAL 之外）的 now / all；PUT /proxies/<组> {"name"}
// 系统代理：mihomo 没有这个接口，状态读 Clash Verge 的 verge.yaml（enable_system_proxy）；
//   切换 = 触发 Clash Verge 托盘菜单里的「系统代理」条目，然后重读 verge.yaml 直到变成目标值（最多 5 秒）。
//   托盘项按 id / 标题含 "clash" 认定；条目要先读过菜单（Tray.menu / Tray.probe），sysproxyWritable 表示条目可用。
// state: { available, mode: rule|global|direct, node, nodes: [..], group, sysproxy, sysproxyWritable, tun }
Base {
    id: root
    ns: "clash"

    readonly property string vergeDir: home + "/.local/share/io.github.clash-verge-rev.clash-verge-rev"
    property string controller: ""
    property string secret: ""
    property bool available: false
    property string mode: "rule"
    property string node: ""
    property var nodes: []
    property string group: ""
    property bool sysproxy: false
    property bool tun: false
    property int refs: 0

    readonly property string trayId: (Tray.items.find(t => /clash/i.test(t.id + " " + t.title + " " + (t.item ? t.item.title || "" : ""))) || {}).id || ""
    readonly property var sysproxyEntry: trayId ? ((Tray.menus[trayId] || []).find(e => !e.sep && /^系统代理/.test(String(e.text).trim())) || null) : null
    readonly property bool sysproxyWritable: !!sysproxyEntry && sysproxyEntry.enabled !== false
    onSysproxyWritableChanged: notify()

    readonly property var state: ({
            "available": available,
            "mode": mode,
            "node": node,
            "nodes": nodes,
            "group": group,
            "sysproxy": sysproxy,
            "sysproxyWritable": sysproxyWritable,
            "tun": tun
        })

    // 页面可见时 addRef()，离开时 removeRef()；有引用时每 5s 刷新
    function addRef() {
        refs++;
        refresh();
    }
    function removeRef() {
        refs = Math.max(0, refs - 1);
    }

    function _loadConfig(cb) {
        readFile(vergeDir + "/config.yaml", text => {
            if (text) {
                const c = /^external-controller:\s*['"]?([^'"\s]+)/m.exec(text);
                const s = /^secret:\s*['"]?([^'"\n]*?)['"]?\s*$/m.exec(text);
                controller = c ? c[1] : "";
                secret = s ? s[1] : "";
            }
            readFile(vergeDir + "/verge.yaml", v => {
                if (v) {
                    const m = /^enable_system_proxy:\s*(true|false)/m.exec(v);
                    if (m)
                        sysproxy = m[1] === "true";
                }
                cb();
            });
        });
    }

    function _req(method, path, body, cb) {
        if (!controller) {
            cb(0, null);
            return;
        }
        const x = new XMLHttpRequest();
        x.onreadystatechange = () => {
            if (x.readyState !== XMLHttpRequest.DONE)
                return;
            let j = null;
            try {
                j = x.responseText ? JSON.parse(x.responseText) : null;
            } catch (e) {}
            cb(x.status, j);
        };
        x.open(method, "http://" + controller + path);
        if (secret)
            x.setRequestHeader("Authorization", "Bearer " + secret);
        x.setRequestHeader("Content-Type", "application/json");
        x.send(body ? JSON.stringify(body) : null);
    }

    function refresh() {
        _loadConfig(() => _req("GET", "/configs", null, (st, j) => {
                available = st === 200 && !!j;
                if (!available) {
                    notify();
                    return;
                }
                mode = String(j.mode || "rule").toLowerCase();
                tun = !!(j.tun && j.tun.enable);
                _req("GET", "/proxies", null, (st2, p) => {
                    const all = p && p.proxies ? p.proxies : {};
                    const names = Object.keys(all).filter(k => all[k].type === "Selector");
                    const g = mode === "global" ? "GLOBAL" : (names.find(k => k !== "GLOBAL") || "");
                    group = g;
                    node = g && all[g] ? (all[g].now || "") : "";
                    nodes = g && all[g] ? (all[g].all || []) : [];
                    notify();
                });
            }));
    }

    function _patch(action, body, okMsg, apply) {
        if (!available)
            return fail(action, "unavailable", "Clash Verge 未运行或控制器不可用");
        return later(action, (resolve, reject) => _req("PATCH", "/configs", body, st => {
                if (st >= 200 && st < 300) {
                    apply();
                    notify();
                    resolve(okMsg);
                } else {
                    reject("http" + st, "Clash 控制器拒绝了请求（" + st + "）");
                }
            }));
    }

    function setMode(m) {
        if (["rule", "global", "direct"].indexOf(m) < 0)
            return fail("setMode", "bad", "未知代理模式 " + m);
        return _patch("setMode", {
            "mode": m
        }, "代理模式 → " + m.toUpperCase(), () => {
            mode = m;
            refresh();
        });
    }
    function setTun(on) {
        return _patch("setTun", {
            "tun": {
                "enable": !!on
            }
        }, on ? "TUN 已开启" : "TUN 已关闭", () => tun = !!on);
    }
    function setNode(n) {
        if (!available || !group)
            return fail("setNode", "unavailable", "没有可切换的代理组");
        return later("setNode", (resolve, reject) => _req("PUT", "/proxies/" + encodeURIComponent(group), {
                "name": n
            }, st => {
                if (st >= 200 && st < 300) {
                    node = n;
                    notify();
                    resolve("节点 → " + n);
                } else {
                    reject("http" + st, "切换节点失败（" + st + "）");
                }
            }));
    }
    function setSysProxy(on) {
        on = !!on;
        if (!trayId)
            return fail("setSysProxy", "unavailable", "Clash Verge 未运行");
        if (on === sysproxy)
            return ok("setSysProxy", null);
        return Tray.triggerText(trayId, /^系统代理/).then(() => later("setSysProxy", (resolve, reject) => {
                const t0 = Date.now();
                const timer = pollComp.createObject(root);
                timer.triggered.connect(() => readFile(vergeDir + "/verge.yaml", v => {
                        const m = v ? /^enable_system_proxy:\s*(true|false)/m.exec(v) : null;
                        if (m && (m[1] === "true") === on) {
                            timer.destroy();
                            sysproxy = on;
                            notify();
                            resolve(on ? "系统代理已开启" : "系统代理已关闭");
                        } else if (Date.now() - t0 > 5000) {
                            timer.destroy();
                            reject("timeout", "Clash Verge 没有切换系统代理");
                        } else {
                            timer.start();
                        }
                    }));
                timer.start();
            }), e => fail("setSysProxy", e.code || "notfound", e.code === "disabled" ? "Clash Verge 的系统代理当前不可切换" : "Clash Verge 托盘菜单里没有“系统代理”"));
    }
    Component {
        id: pollComp
        Timer {
            interval: 400
        }
    }

    Timer {
        interval: 5000
        repeat: true
        running: root.refs > 0
        onTriggered: root.refresh()
    }
}
