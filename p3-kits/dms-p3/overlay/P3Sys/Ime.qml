pragma Singleton

import QtQuick
import Quickshell

// P3Sys.ime — fcitx5 输入法。DMS 2.0 没有 fcitx 服务（@gap），这里直接用 fcitx5-remote 和配置文件：
//   当前：fcitx5-remote -n；切换：fcitx5-remote -s <id>
//   列表：~/.config/fcitx5/profile 的 [Groups/0/Items/N] Name=
//   切换键：~/.config/fcitx5/config [Hotkey/TriggerKeys] 0=…；改完 fcitx5-remote -r 重载
// state: { available, im, list: [{ id, name }], trigger }
Base {
    id: root
    ns: "ime"

    readonly property var names: ({
            "keyboard-us": "英语 (美国)",
            "rime": "中州韵 RIME",
            "pinyin": "拼音",
            "shuangpin": "双拼"
        })
    readonly property string fcitxDir: configHome + "/fcitx5"
    property bool available: false
    property string im: ""
    property var list: []
    property string trigger: ""
    property int refs: 0

    // 页面可见时 addRef()（立即刷新，之后每 3s 读一次当前输入法），离开时 removeRef()
    function addRef() {
        refs++;
        refresh();
    }
    function removeRef() {
        refs = Math.max(0, refs - 1);
    }

    readonly property var state: ({
            "available": available,
            "im": im,
            "list": list,
            "trigger": trigger
        })

    function refresh() {
        run(["fcitx5-remote", "-n"], (code, out) => {
            available = code === 0;
            im = available ? out.trim() : "";
            notify();
        });
        readFile(fcitxDir + "/profile", text => {
            if (!text)
                return;
            const ids = [];
            const re = /^\[Groups\/0\/Items\/\d+\][^\[]*?^Name=(.+)$/gm;
            let m;
            while ((m = re.exec(text)) !== null)
                ids.push(m[1].trim());
            list = ids.map(id => ({
                        "id": id,
                        "name": names[id] || id
                    }));
            notify();
        });
        readFile(fcitxDir + "/config", text => {
            const m = text ? /^\[Hotkey\/TriggerKeys\]\s*\n0=(.*)$/m.exec(text) : null;
            trigger = m ? m[1].trim().replace(/\bspace\b/, "Space").replace("Control", "Ctrl") : "";
            notify();
        });
    }

    function set(id) {
        if (!list.some(x => x.id === id))
            return fail("set", "notfound", "没有这个输入法");
        const name = (list.find(x => x.id === id) || {}).name || id;
        return later("set", (resolve, reject) => run(["fcitx5-remote", "-s", id], code => {
                if (code !== 0) {
                    reject("exit" + code, "fcitx5 未运行");
                    return;
                }
                im = id;
                notify();
                resolve("输入法 → " + name);
            }));
    }

    // k 用原型写法（Ctrl+Space / Super+Space / Shift），也可以是带 niri 符号修饰键的录键结果（Mod+Space）：
    // Mod 换成它实际对应的键（Keybinds.modKey，默认 Super），写入 fcitx 的写法（Control+space）
    function setTrigger(k) {
        const sym = Keybinds.state.modSymbol || "Mod";
        const mod = Keybinds.state.modKey || "Super";
        k = String(k).split("+").map(p => p === sym || p === "Mod" ? mod : p).join("+");
        const fk = k.replace(/\bCtrl\b/, "Control").replace(/\bSpace\b/, "space");
        return later("setTrigger", (resolve, reject) => readFile(fcitxDir + "/config", text => {
                if (!text) {
                    reject("noconfig", "找不到 fcitx5 配置");
                    return;
                }
                let next;
                if (/^\[Hotkey\/TriggerKeys\]\s*\n0=.*$/m.test(text))
                    next = text.replace(/^(\[Hotkey\/TriggerKeys\]\s*\n)0=.*$/m, "$10=" + fk);
                else
                    next = text.replace(/\s*$/, "\n\n[Hotkey/TriggerKeys]\n0=" + fk + "\n");
                writeFile(fcitxDir + "/config", next, ok => {
                    if (!ok) {
                        reject("write", "写入 fcitx5 配置失败");
                        return;
                    }
                    run(["fcitx5-remote", "-r"], () => {
                        trigger = k;
                        notify();
                        resolve("切换键 → " + k);
                    });
                });
            }));
    }

    Component.onCompleted: refresh()
    // 输入法会被键盘切换：有引用时低频轮询
    Timer {
        interval: 3000
        repeat: true
        running: root.available && root.refs > 0
        onTriggered: root.run(["fcitx5-remote", "-n"], (code, out) => {
            const v = code === 0 ? out.trim() : "";
            if (v !== root.im) {
                root.im = v;
                root.notify();
            }
        })
    }
}
