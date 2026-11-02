.pragma library
// SYSTEM 页的纯函数工具

// 把数组按键同步进 ListModel：原地 move / set / insert / remove，已有的委托不会重建（焦点不丢）。
// rows 里同名字段的类型要固定（ListModel 的角色类型由第一次写入决定）。
// beforeRemove(key) 在删除一行之前调用（页面借此把焦点挪开）。
function sync(model, rows, keyOf, beforeRemove) {
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const k = keyOf(r);
        let j = -1;
        for (let n = i; n < model.count; n++) {
            if (model.get(n).uid === k) {
                j = n;
                break;
            }
        }
        const row = Object.assign({ "uid": k }, r);
        if (j < 0) {
            model.insert(i, row);
            continue;
        }
        if (j !== i)
            model.move(j, i, 1);
        const cur = model.get(i);
        for (const f in row) {
            if (cur[f] !== row[f])
                model.setProperty(i, f, row[f]);
        }
    }
    while (model.count > rows.length) {
        if (beforeRemove)
            beforeRemove(model.get(model.count - 1).uid);
        model.remove(model.count - 1);
    }
}

// 信号格：阈值 1 / 30 / 55 / 75
function bars(v) {
    return [1, 30, 55, 75].filter(t => v >= t).length;
}

// 色温色块（近似黑体，暖 → 中性）
function kelvin(k) {
    const t = Math.max(0, Math.min(1, (k - 2500) / 4000));
    return Qt.rgba(1, (160 + 85 * t) / 255, (70 + 170 * t) / 255, 1);
}

// niri 的 spawn 动作 → argv（`spawn "qs" "-c" "wallpaper"` → ["qs","-c","wallpaper"]）
function spawnArgs(cmd) {
    const m = /^spawn\s+(.*)$/.exec(String(cmd || "").trim());
    if (!m)
        return [];
    const out = [];
    const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
    let a;
    while ((a = re.exec(m[1])) !== null)
        out.push(a[1] !== undefined ? a[1].replace(/\\(.)/g, "$1") : a[2]);
    return out;
}

// logind HandleLidSwitch 的值 → 显示文字
function lidLabel(v) {
    return ({
            "suspend": "挂起",
            "lock": "锁屏",
            "ignore": "无操作",
            "poweroff": "关机",
            "hibernate": "休眠",
            "hybrid-sleep": "混合睡眠",
            "suspend-then-hibernate": "挂起后休眠",
            "halt": "停机",
            "reboot": "重启"
        })[v] || v || "";
}
