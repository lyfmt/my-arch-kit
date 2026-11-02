pragma Singleton

import QtQuick
import Quickshell
import qs.Services
import "../Common/KeyUtils.js" as KeyUtils

// P3Sys.keybinds — niri 快捷键。@dms KeybindsService（写 ~/.config/niri/dms/binds.kdl，niri 自己重载）
//   getFlatBinds() → [{ category, action, desc, keys: [{ key, source, … }] }]
//   saveBind(origKey, { key, action, desc }, false, cb) · resetBind(key, false, cb)
//   watch() 引用计数（KeybindsService.addRef/removeRef），返回 release()
//   modKey = niri 配置里 Mod 实际对应的键（KeybindsService.modKey，默认 Super）；modSymbol = 绑定里代表它的写法（"Mod"）。
//   录键时把 Qt 事件交给 KeyUtils.chordToken(…, modKey, modSymbol)，按下 modKey 的组合写成 "Mod+…"；冲突按展开后的键比较。
// state: { list: [{ key, key0, label, cmd, category }], modKey, modSymbol }（key0 = 本次会话里第一次见到的键，resetAll 用）
Base {
    id: root
    ns: "keybinds"

    property var _orig: ({})
    readonly property var list: {
        const out = [];
        for (const g of KeybindsService.getFlatBinds() || []) {
            for (const k of g.keys || []) {
                if (!k.key)
                    continue;
                const id = g.action + "\u0000" + (g.desc || "");
                out.push({
                    "key": k.key,
                    "key0": _orig[id] || k.key,
                    "label": g.desc || g.action,
                    "cmd": g.action,
                    "category": g.category || ""
                });
            }
        }
        return out;
    }
    readonly property string modKey: KeybindsService.modKey || "Super"
    readonly property string modSymbol: KeybindsService.modSymbol || "Mod"
    readonly property var state: ({
            "list": list,
            "modKey": modKey,
            "modSymbol": modSymbol
        })
    onListChanged: {
        const o = Object.assign({}, _orig);
        let changed = false;
        for (const g of KeybindsService.getFlatBinds() || []) {
            const id = g.action + "\u0000" + (g.desc || "");
            if (!(id in o) && g.keys && g.keys[0]) {
                o[id] = g.keys[0].key;
                changed = true;
            }
        }
        if (changed)
            _orig = o;
        notify();
    }

    function watch() {
        KeybindsService.addRef();
        let released = false;
        return () => {
            if (!released) {
                released = true;
                KeybindsService.removeRef();
            }
        };
    }

    // niri 下 saveBind 不调回调，结果看 KeybindsService.bindSaveCompleted(success)。一次只存一个，排队执行。
    property var _queue: []
    property var _current: null
    function _save(oldKey, data, resolve) {
        _queue = _queue.concat([{
                "oldKey": oldKey,
                "data": data,
                "resolve": resolve
            }]);
        _pump();
    }
    function _pump() {
        if (_current || !_queue.length)
            return;
        _current = _queue[0];
        _queue = _queue.slice(1);
        guard.restart();
        KeybindsService.saveBind(_current.oldKey, _current.data, false, null);
        if (!KeybindsService.saving)
            _finish(false);
    }
    function _finish(success) {
        guard.stop();
        const c = _current;
        _current = null;
        if (c)
            c.resolve(success);
        _pump();
    }
    Connections {
        target: KeybindsService
        function onBindSaveCompleted(success) {
            root._finish(success);
        }
    }
    Timer {
        id: guard
        interval: 10000
        onTriggered: root._finish(false)
    }

    function rebind(oldKey, newKey) {
        const b = list.find(x => x.key === oldKey);
        if (!b)
            return fail("rebind", "gone", oldKey + " 不存在");
        const norm = k => KeyUtils.normalizeKeyCombo(k, modKey, modSymbol);
        const dup = list.find(x => x !== b && norm(x.key) === norm(newKey));
        if (dup)
            return fail("rebind", "conflict", newKey + " 已被「" + dup.label + "」占用");
        return later("rebind", (resolve, reject) => _save(oldKey, {
                "key": newKey,
                "action": b.cmd,
                "desc": b.label
            }, success => success ? resolve(b.label + " · " + oldKey + " → " + newKey) : reject("save", "保存快捷键失败")));
    }
    function resetAll() {
        const changed = list.filter(b => b.key !== b.key0);
        if (!changed.length)
            return ok("resetAll", "没有改动");
        return Promise.all(changed.map(b => new Promise(res => _save(b.key, {
                        "key": b.key0,
                        "action": b.cmd,
                        "desc": b.label
                    }, res)))).then(r => {
            const n = r.filter(x => x).length;
            return n === changed.length ? ok("resetAll", "已恢复 " + n + " 个快捷键") : fail("resetAll", "partial", "有 " + (changed.length - n) + " 个快捷键没能恢复");
        });
    }
}
