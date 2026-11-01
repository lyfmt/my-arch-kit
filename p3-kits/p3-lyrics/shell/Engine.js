// RIPTIDE 动效引擎：index.html 的 <script> 逐段移植，常量、时序、判定与原型一致。
// 不是 .pragma library：每个 LyricsLayer 实例各有一份状态，直接访问其中的 id（lay / lyr / *Comp）。
//
// 原型用 Web Animations（element.animate + fill + delay），这里用一条自己的时间轴代替：
//   clk         动画时钟（ms），暂停时不走 = 所有动画一起冻结（对应 anims.forEach(a => a.pause())）
//   anim()      与原型 anim() 同签名：关键帧、时长、整体缓动、延迟、fill（both / forwards / none）
//   目标 Tgt    每个字（tx/ty/sk）、翻译行的 .in（tx/ty）、浪刃（x/op）、水线容器与 .base（op）
//               合成规则 = WAAPI 的 replace：基础值上依次叠加所有生效中的动画，后建的覆盖先建的
// 时长单位 ms，歌词时间单位 s（与原型相同）。

// ---------------------------------------------------------------- 缓动
function bez(x1, y1, x2, y2) {
    function cx(t) { return 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t; }
    function cy(t) { return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t; }
    function dx(t) { return 3 * x1 * (1 - t) * (1 - t) + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t; }
    return function (x) {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        var t = x;
        for (var i = 0; i < 8; i++) {
            var e = cx(t) - x, d = dx(t);
            if (Math.abs(e) < 1e-6) return cy(t);
            if (Math.abs(d) < 1e-6) break;
            t -= e / d;
        }
        var lo = 0, hi = 1;
        t = x;
        for (var j = 0; j < 30; j++) {
            var v = cx(t);
            if (Math.abs(v - x) < 1e-6) break;
            if (v < x) lo = t; else hi = t;
            t = (lo + hi) / 2;
        }
        return cy(t);
    };
}
var EZ = {
    up: bez(.16, 1, .3, 1),        // 浮出：快起慢停
    down: bez(.6, 0, .86, .4),     // 沉下：慢起快走
    calm: bez(.45, 0, .75, .45),   // 间奏退场：更平的 ease-in
    out: bez(0, 0, .58, 1),        // CSS ease-out
    swell: bez(.37, 0, .63, 1),    // 停留浪的顶起 / 落回
};

// ---------------------------------------------------------------- 常量（与 index.html 相同）
var T = { enter: 700, exit: 300, row: 70, trans: 100, exitRow: 28, calmExit: 620, lead: .14 };
var INTERLUDE = 6, HOLD = 4.2;
var RIP = { L: 380, crest: .82, minEnter: 1.2, A: .1, push: .05, lean: -9, stand: -6, over: 120, hold: 120 };
var SURGE = { sweep: 420, rise: 560, dx: -.22, skew: -14, trDx: -.6 };
var WY = 18, WH = 24, BH = 9;
var SINK = { dur: 420, ease: bez(.55, 0, .8, .3), dx: .12, skew: -10, trLag: 80 };
var TR_ROOM = 560;
var SONG_EXIT = 260;   // 切歌：旧句 260ms 沉下（原型 show(…, 'song')）

// 字形（CSS 对应：.cjk .m / .lat .m / .tr / .tr.by）
var ST = {
    cjk: { fs: 58, lh: 1.22, ls: .06, w: 700, it: false },
    lat: { fs: 66, lh: 1.02, ls: -.005, w: 900, it: true },
    tr: { fs: 26, lh: 1.3, ls: .08, w: 500, it: false },
    by: { fs: 24, lh: 1.3, ls: .2, w: 700, it: false },
};
// 真实歌词没有手写的 '|' 换行：主句超过 MAXW（舞台像素，≈ 原型最长一行）时按宽度均分成多行
var MAXW = 980, MAXROWS = 3;

// ---------------------------------------------------------------- 时间轴
var clk = 0;
var paused = false;
var live = [];       // 还没播完的动画
var targets = [];    // 所有活着的目标

function Tgt(base, write) {
    var cur = {};
    for (var k in base) cur[k] = base[k];
    var t = { base: base, cur: cur, anims: [], write: write || null, dead: false, dirty: true };
    targets.push(t);
    return t;
}
function killTgt(t) {
    if (t.dead) return;
    t.dead = true;
    for (var i = 0; i < t.anims.length; i++) t.anims[i].st = 3;   // 静默作废，不触发回调
    t.anims = [];
}

// WAAPI：未写 offset 的关键帧在相邻已知 offset 之间均分，首帧 0、末帧 1
function normKf(kfs) {
    var n = kfs.length, out = [];
    for (var i = 0; i < n; i++) {
        var v = {}, src = kfs[i];
        for (var k in src) if (k !== "offset" && k !== "easing") v[k] = src[k];
        out.push({ o: src.offset !== undefined ? src.offset : (i === 0 ? 0 : i === n - 1 ? 1 : null), v: v, e: src.easing || null });
    }
    for (var a = 0; a < n; a++) {
        if (out[a].o !== null) continue;
        var b = a;
        while (out[b].o === null) b++;
        var o0 = out[a - 1].o, o1 = out[b].o;
        for (var c = a; c < b; c++) out[c].o = o0 + (o1 - o0) * (c - a + 1) / (b - a + 1);
        a = b;
    }
    return out;
}

// st：0 播放中，1 播完，2 被取消，3 随目标作废
function anim(tg, kfs, dur, ease, delay, fill) {
    var a = { tg: tg, kf: normKf(kfs), dur: Math.max(1, dur), ease: ease || null,
              start: clk + (delay || 0), fill: fill || "both", st: 0, fin: [], can: [] };
    tg.anims.push(a);
    live.push(a);
    return a;
}
function then(a, onFin, onCan) {
    if (a.st === 1) { if (onFin) onFin(); return; }
    if (a.st === 2) { if (onCan) onCan(); return; }
    if (onFin) a.fin.push(onFin);
    if (onCan) a.can.push(onCan);
}
function cancelAll(tg) {
    var list = tg.anims;
    tg.anims = [];
    tg.dirty = true;
    for (var i = 0; i < list.length; i++) {
        var a = list[i];
        if (a.st > 1) continue;
        a.st = 2;
        var cbs = a.can;
        a.fin = []; a.can = [];
        for (var j = 0; j < cbs.length; j++) cbs[j]();
    }
}
function sample(a, t) {
    var local = t - a.start, p;
    if (local < 0) {
        if (a.fill !== "both" && a.fill !== "backwards") return null;
        p = 0;
    } else if (local >= a.dur) {
        if (a.fill !== "both" && a.fill !== "forwards") return null;
        p = 1;
    } else {
        p = local / a.dur;
    }
    var ep = a.ease ? a.ease(p) : p, k = a.kf, i = 0;
    while (i < k.length - 2 && ep >= k[i + 1].o) i++;
    var A = k[i], B = k[i + 1], span = B.o - A.o;
    var f = span > 0 ? (ep - A.o) / span : 1;
    if (A.e) f = A.e(Math.max(0, Math.min(1, f)));
    var v = {};
    for (var key in A.v) v[key] = B.v[key] === undefined ? A.v[key] : A.v[key] + (B.v[key] - A.v[key]) * f;
    return v;
}
function evalT(tg) {
    var v = {};
    for (var k in tg.base) v[k] = tg.base[k];
    for (var i = 0; i < tg.anims.length; i++) {
        var s = sample(tg.anims[i], clk);
        if (s) for (var k2 in s) v[k2] = s[k2];
    }
    return v;
}
function settle() {
    var done = [];
    for (var i = live.length - 1; i >= 0; i--) {
        var a = live[i];
        if (a.st !== 0) { live.splice(i, 1); continue; }
        if (clk >= a.start + a.dur) {
            a.st = 1;
            a.tg.dirty = true;
            live.splice(i, 1);
            if (a.fill === "none" || a.fill === "backwards") {
                var j = a.tg.anims.indexOf(a);
                if (j >= 0) a.tg.anims.splice(j, 1);
            }
            done.push(a);
        }
    }
    // 先建的先回调（与 WAAPI finished 的顺序一致）
    for (var d = done.length - 1; d >= 0; d--) {
        var cbs = done[d].fin;
        done[d].fin = []; done[d].can = [];
        for (var c = 0; c < cbs.length; c++) cbs[c]();
    }
}
function render() {
    // 只算「有动画在走（含还在 delay 里的）」或刚有动画结束 / 被取消的目标；静止的字不重写
    for (var i = targets.length - 1; i >= 0; i--) {
        var t = targets[i];
        if (t.dead) { targets.splice(i, 1); continue; }
        var need = t.dirty;
        for (var j = 0; j < t.anims.length && !need; j++) need = t.anims[j].st === 0;
        if (!need) continue;
        t.dirty = false;
        t.cur = evalT(t);
        if (t.write) t.write(t.cur);
    }
    for (var b = 0; b < blocks.length; b++) writeWave(blocks[b]);
}

// ---------------------------------------------------------------- 歌词状态
var song = null;     // { lines: [{t, text, trans}], end, title, artist }
var gen = 0;         // 歌词换一次 +1，用于 key
var linesGen = -1;
var lastId = undefined;
var time = 0;
var shown = null;    // { key, kind: 'line' | 'title' | 'gap' | 'none', el }
var index = -1;
var transOn = true;
var blocks = [];

var reLat = /[　-鿿＀-￯]/;
var reKana = /[぀-ヿㇰ-ㇿ]/;
function isLat(s) { return !reLat.test(s); }
function isJa(s) { return reKana.test(s); }
function kOf(i) {
    var L = song.lines, nt = i + 1 < L.length ? L[i + 1].t : song.end;
    return Math.min(1, Math.max(.42, (nt - L[i].t) / 1.5));
}
function isPunch(i) {
    var L = song.lines;
    if (i < 0) return false;
    var l = L[i], nt = i + 1 < L.length ? L[i + 1].t : song.end;
    var bare = l.text.replace(/[\s？?！!、。,.]/g, "");
    return nt - l.t < 1.6 && l.text.indexOf("|") < 0 && (isLat(l.text) ? !/\s/.test(l.text.trim()) : bare.length <= 5);
}
function desired(t) {
    var L = song.lines;
    for (var i = L.length - 1; i >= 0; i--) {
        if (t >= L[i].t - T.lead * kOf(i)) {
            var nt = i + 1 < L.length ? L[i + 1].t : song.end;
            if (nt - L[i].t >= INTERLUDE && t >= L[i].t + HOLD) return { key: gen + ":gap" + i, kind: "gap", i: i, none: true };
            if (i === L.length - 1 && t >= song.end - .9) return { key: gen + ":gap" + i, kind: "gap", i: i, none: true };
            var l = L[i];
            var punch = isPunch(i) && !isPunch(i - 1);   // 连续的拍点只有第一句红
            return { key: gen + ":L" + i, kind: "line", i: i, lat: isLat(l.text), ja: song.ja,
                     main: l.text.split("|").map(function (s) { return s.trim(); }), sub: l.trans, punch: punch };
        }
    }
    return { key: gen + ":title", kind: "title", i: -1, lat: isLat(song.title), ja: song.ja,
             main: [song.title], sub: song.artist, by: true };
}
var NONE = { key: "none", kind: "none", i: -1, none: true };

// ---------------------------------------------------------------- 排版
// 舞台坐标：#lyr 原点在 (1800, 844)，块的右下角贴着原点。块内坐标以块左上角为原点。
var spaceCache = {};
function fontFor(st, fam) {
    return { family: fam, pixelSize: st.fs, weight: st.w, italic: st.it, letterSpacing: st.ls * st.fs };
}
function spaceW(st, fam) {
    var key = fam + "|" + st.fs + "|" + st.w + "|" + st.it;
    if (spaceCache[key] === undefined) {
        var t = glyphComp.createObject(lay, { text: " ", visible: false });
        t.font.family = fam; t.font.pixelSize = st.fs; t.font.weight = st.w; t.font.italic = st.it;
        t.font.letterSpacing = st.ls * st.fs;
        spaceCache[key] = t.implicitWidth;
        t.destroy();
    }
    return spaceCache[key];
}
// 文字 → 记号：每个字一个 Text（原型的 .g），空格只占宽度（原型里是文本节点）
function tokens(parent, text, st, fam, role) {
    var out = [], chars = Array.from(text.replace(/\s+/g, " ").trim()), sw = -1;
    for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        if (ch === " ") {
            if (sw < 0) sw = spaceW(st, fam);
            out.push({ sp: true, w: sw });
            continue;
        }
        var g = glyphComp.createObject(parent, { text: ch, role: role, visible: false });
        g.font.family = fam; g.font.pixelSize = st.fs; g.font.weight = st.w; g.font.italic = st.it;
        g.font.letterSpacing = st.ls * st.fs;
        g.height = st.fs * st.lh;
        g.width = g.implicitWidth;
        out.push({ sp: false, w: g.implicitWidth, g: g, ch: ch });
    }
    return out;
}
function sumW(tk) { var s = 0; for (var i = 0; i < tk.length; i++) s += tk[i].w; return s; }
function trimTk(tk) {
    var a = 0, b = tk.length;
    while (a < b && tk[a].sp) a++;
    while (b > a && tk[b - 1].sp) b--;
    return tk.slice(a, b);
}
var reBreakAfter = /[\s，。、！？；：,.!?;:）)」』】…~～—]/;
// 太宽的一行按宽度均分：英文只在空格处断；中日文可以在任意字后断，优先标点 / 空格
function splitTk(tk, lat) {
    var total = sumW(tk);
    if (total <= MAXW) return [tk];
    var n = Math.min(MAXROWS, Math.ceil(total / MAXW)), rows = [], from = 0, acc = 0, cut = [];
    var pos = [];   // 每个记号之后的累计宽度
    for (var i = 0; i < tk.length; i++) { acc += tk[i].w; pos.push(acc); }
    for (var r = 1; r < n; r++) {
        var goal = total * r / n, best = -1, bestScore = 1e9;
        for (var j = from; j < tk.length - 1; j++) {
            var ok = lat ? tk[j + 1].sp || tk[j].sp : true;
            if (!ok) continue;
            var d = Math.abs(pos[j] - goal);
            var prefer = !lat && (tk[j].sp || reBreakAfter.test(tk[j].ch || "")) ? .55 : 1;
            var score = d * prefer;
            if (score < bestScore) { bestScore = score; best = j; }
        }
        if (best < 0) break;
        cut.push(best);
        from = best + 1;
    }
    var s = 0;
    for (var c = 0; c < cut.length; c++) { rows.push(tk.slice(s, cut[c] + 1)); s = cut[c] + 1; }
    rows.push(tk.slice(s));
    return rows.map(trimTk).filter(function (x) { return x.length; });
}

// item: {key, main:[rows], sub, lat, ja, by, punch}
function build(item) {
    var st = item.lat ? ST.lat : ST.cjk, fs = st.fs, LH = fs * st.lh;
    var fam = item.lat ? lay.fontP3 : item.ja ? lay.fontJP : lay.fontSC;
    var bi = blockComp.createObject(lyr);
    var b = { item: bi, it: item, fs: fs, LH: LH, lat: item.lat, glyphs: [], tgts: [], tr: null, wv: null,
              gone: false, removed: false, cw: null, sinks: [], sunkDone: false, sinkTag: null, Wm: 0, Hm: 0 };
    var rows = [];
    for (var r = 0; r < item.main.length; r++) {
        var tk = trimTk(tokens(bi, item.main[r], st, fam, item.punch ? 1 : 0));
        var parts = splitTk(tk, item.lat);
        for (var p = 0; p < parts.length; p++) rows.push(parts[p]);
    }
    var Wm = 0;
    rows.forEach(function (rw) { Wm = Math.max(Wm, sumW(rw)); });
    var n = rows.length, Hm = n * LH + (n - 1) * .1 * fs;
    b.Wm = Wm; b.Hm = Hm;
    bi.x = -Wm; bi.y = -Hm; bi.width = Wm; bi.height = Hm;
    // 每行一个 .msk：上 .1em、左右 .3em、下 .22em 的裁切盒，下沿就是这一行的水面
    rows.forEach(function (rw, ri) {
        var rowW = sumW(rw), top = ri * (LH + .1 * fs);
        var m = mskComp.createObject(bi, { x: -.3 * fs, y: top - .1 * fs, width: Wm + .6 * fs, height: LH + .32 * fs });
        m.inner.x = .3 * fs + (Wm - rowW);
        m.inner.y = .1 * fs;
        var off = 0;
        rw.forEach(function (t) {
            if (!t.sp) {
                t.g.parent = m.inner;
                t.g.x = off;
                t.g.visible = true;
                addGlyph(b, t.g, Wm - rowW + off + t.w / 2, fs, LH, ri);
            }
            off += t.w;
        });
    });
    if (item.sub && (transOn || item.by)) addSub(b, item);
    addWave(b);
    blocks.push(b);
    return b;
}
function addGlyph(b, g, cx, fs, LH, row) {
    var tg = Tgt({ tx: 0, ty: 0, sk: 0 }, function (v) { g.tx = v.tx; g.ty = v.ty; g.sk = v.sk; });
    var o = { g: g, tg: tg, cx: cx, fs: fs, LH: LH, row: row };
    b.glyphs.push(o);
    b.tgts.push(tg);
    return o;
}
function addSub(b, item) {
    var st = item.by ? ST.by : ST.tr, fs = st.fs, LH = fs * st.lh;
    var fam = item.by ? lay.fontBarlow : lay.fontSC;
    var text = item.by ? item.sub.toUpperCase() : item.sub;
    var ti = trComp.createObject(b.item);
    var tk = trimTk(tokens(ti, text, st, fam, 2)), w = sumW(tk);
    var mt = item.by ? 30 : b.lat ? 34 : 30;
    ti.x = b.Wm - .6 * fs - w;
    ti.y = b.Hm + mt;
    ti.width = w; ti.height = LH;
    var m = mskComp.createObject(ti, { x: -.3 * fs, y: -.1 * fs, width: w + .6 * fs, height: LH + .32 * fs });
    m.inner.x = .3 * fs;
    m.inner.y = .1 * fs;
    var inT = Tgt({ tx: 0, ty: 0 }, function (v) { m.tx = v.tx; m.ty = v.ty; });
    var tr = { item: ti, inT: inT, w: w, fs: fs, LH: LH, recs: [] };
    b.tgts.push(inT);
    var off = 0;
    tk.forEach(function (t) {
        if (!t.sp) {
            t.g.parent = m.inner;
            t.g.x = off;
            t.g.visible = true;
            tr.recs.push(addGlyph(b, t.g, ti.x + off + t.w / 2, fs, LH, 9));
        }
        off += t.w;
    });
    b.tr = tr;
    return tr;
}
function removeTr(b) {
    var tr = b.tr;
    if (!tr) return;
    b.tr = null;
    tr.recs.forEach(function (o) { killTgt(o.tg); });
    killTgt(tr.inT);
    b.glyphs = b.glyphs.filter(function (o) { return tr.recs.indexOf(o) < 0; });
    tr.item.destroy();
}

// 水线 + 浪刃（Wave.qml，一个 ShaderEffect）
function addWave(b) {
    var it = waveComp.createObject(b.item, { z: 2 });
    var wv = { item: it, w: 0, run: 0, W: 0, x: 0, blades: [] };
    var flag = function () { wv.dirty = true; };
    wv.tg = Tgt({ op: 1 }, flag);
    wv.baseT = Tgt({ op: lay.baseOp }, flag);
    b.tgts.push(wv.tg, wv.baseT);
    b.wv = wv;
    wavePos(b);
    writeWave(b, true);
}
// 水线 = 主句最后一行 .msk 的下沿；左边伸出 run（≈ 1/3 宽）的跑道，右边越界 over
function wavePos(b) {
    var wv = b.wv;
    var w = Math.ceil(Math.max(b.Wm, b.tr ? b.tr.w + .6 * b.fs : 0));
    var run = Math.round(w / 3), W = run + w + RIP.over;
    wv.w = w; wv.run = run; wv.W = W; wv.x = b.Wm - w - run;
    wv.item.x = wv.x;
    wv.item.y = b.Hm + .22 * b.fs - WY;
    wv.item.width = W;
    wv.item.height = WH;
    wv.item.maskP = Qt.point(run, run + w);
}
function writeWave(b, force) {
    var wv = b.wv;
    if (!wv || b.removed) return;
    if (!force && !wv.blades.length && !wv.dirty) return;
    wv.item.opacity = wv.tg.cur.op;
    wv.item.baseOp = wv.baseT.cur.op;
    var slots = [], n = wv.blades.length;
    for (var i = Math.max(0, n - 4); i < n; i++) {
        var bl = wv.blades[i], v = bl.tg.cur;
        slots.push(Qt.vector4d(v.x, bl.h, v.op, bl.tone));
    }
    while (slots.length < 4) slots.push(Qt.vector4d(0, 0, -1, 0));
    wv.item.b0 = slots[0]; wv.item.b1 = slots[1]; wv.item.b2 = slots[2]; wv.item.b3 = slots[3];
    wv.dirty = n > 0;
}
function removeBlock(b) {
    if (b.removed) return;
    b.removed = true;
    b.tgts.forEach(killTgt);
    b.wv.blades.forEach(function (bl) { killTgt(bl.tg); });
    var i = blocks.indexOf(b);
    if (i >= 0) blocks.splice(i, 1);
    b.item.destroy();
}

// 字中心相对水线容器左缘的 x（舞台像素），含当前位移，与浪刃同一坐标系
function glyphs(b) {
    var inX = b.tr ? evalT(b.tr.inT).tx : 0;
    return b.glyphs.map(function (o) {
        return { o: o, g: o.tg, x: o.cx + evalT(o.tg).tx + (o.row === 9 ? inX : 0) - b.wv.x, fs: o.fs, row: o.row };
    });
}
// 沉没深度：从 .in 顶到 .msk 下沿，再多沉 .35em（盖住斜体 / 假名超出行框的笔画顶）
function depthG(o) { return Math.ceil(o.LH + .32 * o.fs - .1 * o.fs + .35 * o.fs); }
function depthIn(tr) { return Math.ceil(tr.LH + .32 * tr.fs - .1 * tr.fs + .35 * tr.fs); }

// ---------------------------------------------------------------- 浪
// 一片浪刃：浪峰从 x0 匀速走到 x1，用时 T0；到头后顶住 hold，再 160ms 淡掉。返回浪峰到达 x 的时刻函数
function sendBlade(b, tone, x0, x1, T0, delay, h, hold) {
    if (h === undefined) h = BH;
    hold = hold || 0;
    var bl = { tone: tone === "main" ? 0 : tone === "sub" ? 1 : 2, h: h, tg: Tgt({ x: -9999, op: 1 }, null) };
    b.wv.blades.push(bl);
    var fade = 160, tot = T0 + hold + fade;
    var a = anim(bl.tg, [
        { x: x0, op: 1 },
        { x: x1, op: 1, offset: T0 / tot },
        { x: x1, op: 1, offset: (T0 + hold) / tot },
        { x: x1, op: 0 }], tot, null, delay);
    then(a, function () {
        var i = b.wv.blades.indexOf(bl);
        if (i >= 0) b.wv.blades.splice(i, 1);
        killTgt(bl.tg);
        b.wv.dirty = true;
    });
    return function (x) { return delay + Math.max(0, (x - x0) / (x1 - x0)) * T0; };
}

// 停留浪：入场结束后才从跑道左端出发，room 毫秒走完整段水线
function current(b, delay, room) {
    if (b.removed || b.gone) return;
    var W = b.wv.W, L = RIP.L;
    // 浪要提前走完，让最后一个字（含晚 trLag 的翻译）也来得及「顶起—落回—沉下」，再交给下一句
    var D = Math.min(1400, .62 * L * Math.max(600, room) / W);
    var T0 = Math.max(600, room - .7 * D - SINK.dur - SINK.trLag);
    var at = sendBlade(b, "sub", 0, W, T0, delay);
    // 时钟：currentTime = 这道浪排期以来走过的时间（跟着暂停走）
    b.cw = { at: at, D: D, delay: delay, c0: clk, live: true };
    b.sinks = [];
    glyphs(b).forEach(function (o) { sinkG(b, o, 0); });
    watchSunk(b);
}
function cwStart(b, x, tr) {
    var w = b.cw;
    return Math.max(w.delay, w.at(x) - .3 * w.D + (tr ? SINK.trLag : 0));
}
function cwNow(b) { return b.cw && b.cw.live ? clk - b.cw.c0 : 0; }
// 第二道浪 = 退场：浪峰到达时字被顶起、落回，然后沉进水面下并留在那里。now = 排期以来已过的时间
function sinkG(b, o, now) {
    var D = b.cw.D, tot = D + SINK.dur, f = D / tot;
    var tr = o.row === 9, A = Math.max(1.6, o.fs * RIP.A * (tr ? .6 : 1)), px = o.fs * RIP.push;
    var from = tr ? 0 : RIP.stand;
    b.sinks.push(anim(o.g, [
        { tx: 0, ty: 0, sk: from, easing: EZ.swell },
        { tx: px, ty: -A, sk: RIP.lean, offset: .3 * f, easing: EZ.swell },
        { tx: 0, ty: A * .35, sk: 3, offset: .66 * f, easing: EZ.swell },
        { tx: 0, ty: 0, sk: 0, offset: f, easing: SINK.ease },
        { tx: SINK.dx * o.fs, ty: depthG(o.o), sk: SINK.skew }],
        tot, null, Math.max(0, cwStart(b, o.x, tr) - now), "forwards"));
}
// 当前这一组沉字全部播完才置 sunkDone；组被改过（翻译增删）就作废，由新的一轮统计
function watchSunk(b) {
    var list = b.sinks.slice(), tag = b.sinkTag = {};
    var n = list.length, c = 0, dead = false;
    function ok() {
        if (dead || ++c < n) return;
        if (b.sinkTag === tag) { b.sunkDone = true; if (b.cw) b.cw.live = false; }
    }
    if (!n) { c = -1; ok(); return; }
    list.forEach(function (a) { then(a, ok, function () { dead = true; }); });
}

// 入场：一道浪刃从跑道最左端冲过整句、越过右缘，字随浪峰浮起。返回入场总时长（ms）
function enter(b, k, delay, slow, tone) {
    var w = b.wv.w || 1, W = b.wv.W || w;
    var S = SURGE.sweep * k * slow, R = SURGE.rise * Math.max(.5, k) * slow;
    var hold = RIP.hold * (tone === "red" ? 2 : 1) * Math.max(.5, k);
    var at = sendBlade(b, tone, 0, W, S * W / w, delay, BH * 1.2, hold);
    var mfs = b.fs, end = 0;
    glyphs(b).forEach(function (o) {
        var y = depthG(o.o), tr = o.row === 9;
        var st = tr ? T.trans * k : o.row * T.row * k, d = Math.max(delay, at(o.x)) + st, dur = tr ? R * .9 : R;
        var from = tr ? { tx: SURGE.trDx * mfs, ty: y, sk: SURGE.skew } : { tx: SURGE.dx * o.fs, ty: y, sk: SURGE.skew };
        anim(o.g, [from, tr ? { tx: 0, ty: 0, sk: 0 } : { tx: 0, ty: 0, sk: RIP.stand }], dur, EZ.up, d);
        end = Math.max(end, d + dur);
    });
    anim(b.wv.baseT, [{ op: 0 }, { op: evalT(b.wv.baseT).op }], R, EZ.out, delay);
    return Math.max(end, delay + S * W / w + hold) - delay;
}
function exit(b, dur, ease) {
    b.gone = true;
    if (b.cw) b.cw.live = false;   // 停掉第二道浪的时钟；已沉的字从沉底姿态接着往下走，不会弹回
    var last = null;
    var done = function () { removeBlock(b); };
    anim(b.wv.tg, [{ op: evalT(b.wv.tg).op }, { op: 0 }], dur * .7, null);
    var gs = glyphs(b), x0 = Infinity, x1 = -Infinity;
    gs.forEach(function (o) { x0 = Math.min(x0, o.x); x1 = Math.max(x1, o.x); });
    x1 = Math.max(x0 + 1, x1);
    var each = dur * .58, spread = dur - each;
    gs.forEach(function (o) {
        var from = evalT(o.g);
        cancelAll(o.g);
        var a = anim(o.g, [{ tx: from.tx, ty: from.ty, sk: from.sk },
            { tx: .2 * o.fs, ty: depthG(o.o), sk: -12 }], each, ease, (o.x - x0) / (x1 - x0) * spread);
        if (!last || o.x >= x1 - .5) last = a;
    });
    if (last) then(last, done, done); else done();
}

// mode: 'auto' | 'seek' | 'song' | 'instant'
function show(item, mode) {
    index = item.i;
    var old = shown && shown.el;
    var k = item.none ? 1 : mode === "seek" ? .6 : item.i >= 0 ? kOf(item.i) : 1;
    var delay = 0;
    if (old) {
        if (mode === "instant") removeBlock(old);
        else if (item.none) {
            // 切歌 / 停播：顺浪方向沉下（同切歌）；间奏：缓慢沉下
            if (mode === "song") exit(old, SONG_EXIT, EZ.down);
            else exit(old, T.calmExit, EZ.calm);
        } else {
            // 已被第二道浪沉掉的句子：直接移走，新句只隔 40ms
            var ed = old.sunkDone ? 1 : mode === "song" ? SONG_EXIT : T.exit * k;
            exit(old, ed, EZ.down);
            delay = (old.sunkDone ? 0 : ed) + 40;   // 旧句最后一个字沉到底 + 40ms，新句的浪刃才出发
        }
    }
    var after = !shown || shown.kind !== "line";
    if (item.none) { shown = { key: item.key, kind: item.kind, el: null }; return; }
    var b = build(item);
    shown = { key: item.key, kind: item.kind, el: b };
    // 静默之后的第一句：入场浪刃用 --red，像发令；其余用 --main
    var tone = item.i >= 0 && after && mode !== "seek" ? "red" : "main";
    var inDur = 0;
    if (mode !== "instant") inDur = enter(b, k, delay, item.kind === "title" ? 1.15 : 1, tone) || 0;
    else b.glyphs.forEach(function (o) { if (o.row !== 9) { o.tg.base.sk = RIP.stand; o.tg.dirty = true; } });
    // 停留浪排期：可见时长 = 到下一次退场（或间奏淡出）为止
    var L = song.lines, i = item.i;
    var t0 = i >= 0 ? L[i].t : 0, nt = i + 1 < L.length ? L[i + 1].t : (i >= 0 ? song.end : L[0].t);
    var vis = Math.min(nt - t0, i >= 0 && nt - t0 >= INTERLUDE ? HOLD : Infinity, i === L.length - 1 ? song.end - .9 - t0 : Infinity);
    if (nt - t0 >= RIP.minEnter) {
        var d0 = mode === "instant" ? 0 : delay + inDur;
        var room = (t0 + vis - time) * 1000 - d0 - T.exit * k;
        current(b, d0, room);
    }
}

// 翻译开关：水线是主句的裁切边，不随翻译移动，只按新宽度重算跑道
// 第二道浪进行中不重算水线：浪刃的 at(x) 按旧坐标算，重算会让浪刃跳位、翻译字对不上浪峰
function toggleTrans() {
    transOn = !transOn;
    var b = shown && shown.el;
    if (!b || b.gone || b.removed || b.it.by || !b.it.sub) return;
    var old = b.tr, cw = b.cw;
    var relayout = function () { if (!cw && !b.removed) wavePos(b); };
    if (!transOn && old) {
        // 翻译的沉字不再算进 sunkDone；只看沉字动画（入场动画 fill both 也算播完，不能拿来判断）
        var sunk = b.sunkDone;
        if (cw) {
            var mineT = old.recs.map(function (o) { return o.tg; });
            var mine = b.sinks.filter(function (a) { return mineT.indexOf(a.tg) >= 0; });
            sunk = sunk || (mine.length > 0 && mine.every(function (a) { return a.st === 1; }));
            b.sinks = b.sinks.filter(function (a) { return mine.indexOf(a) < 0; });
            if (!b.sunkDone) watchSunk(b);
        }
        // 已经沉掉（或整句已沉）：水面上看不见了，直接拿掉
        if (sunk) { removeTr(b); relayout(); return; }
        var from = evalT(old.inT).ty;
        cancelAll(old.inT);
        then(anim(old.inT, [{ tx: 0, ty: from }, { tx: 0, ty: depthIn(old) }], 240, EZ.down),
             function () { if (b.tr === old && !b.removed) { removeTr(b); relayout(); } });
    } else if (transOn && !old) {
        // 整句已沉 / 正在沉：不给它补一条孤零零浮上来的翻译，下一句再带上
        if (b.sunkDone) return;
        var s = addSub(b, b.it);
        relayout();
        if (cw) {
            // 浪已经（或快要）到翻译头顶：来不及浮上来再被带下去，放弃
            var now = cwNow(b), tg = glyphs(b).filter(function (o) { return o.row === 9; });
            var first = Infinity;
            tg.forEach(function (o) { first = Math.min(first, cwStart(b, o.x, true)); });
            if (first - now < TR_ROOM) { removeTr(b); return; }
            tg.forEach(function (o) { sinkG(b, o, now); });
            watchSunk(b);
        }
        anim(s.inT, [{ tx: SURGE.trDx * b.fs, ty: depthIn(s) }, { tx: 0, ty: 0 }], 560, EZ.up);
    }
}

// ---------------------------------------------------------------- 时钟
function setTrans(on) { if (!!on !== transOn) toggleTrans(); }
function setPaused(p) {
    if (p === paused) return;
    paused = p;
    lay.frozen = p;
}
function clearAll() {
    blocks.slice().forEach(removeBlock);
    shown = null;
}

// 每帧（或空闲时的轮询）调用；dt 单位 s
function frame(dt) {
    var m = lay.music;
    // act：这一层此刻应该有歌词（IPC 没隐藏、在放歌、有歌词、没有暂停太久）
    var act = lay.wanted && m.active && !lay.idleHidden;
    setPaused(act && !m.playing);
    if (!paused) clk += Math.min(.25, Math.max(0, dt)) * 1000;

    var mode = "auto";
    var sid = m.song ? m.song.id : null;
    if (sid !== lastId) {
        if (lastId !== undefined && shown && shown.el) mode = "song";
        lastId = sid;
        time = m.pos();
    }
    if (m.linesGen !== linesGen) {
        linesGen = m.linesGen;
        gen++;
        var s = m.song || {}, L = m.lines || [];
        var end = s.duration > 0 ? s.duration / 1000 : 0;
        if (L.length) end = Math.max(end, L[L.length - 1].t + 1.5);
        var ja = isJa(s.name || "");
        for (var li = 0; li < L.length && !ja; li++) ja = isJa(L[li].text);
        song = { lines: L, end: end, title: s.name || "", artist: s.artist || "", ja: ja };
    }
    // 播放进度：本地插值，单调前进；跳动 > 1s 视为拖动进度（原型的 seek：k = .6，不出红浪）
    var p = m.pos();
    if (Math.abs(p - time) > 1) { time = p; if (mode === "auto") mode = "seek"; }
    else if (p > time) time = p;

    var item = act && song && song.lines.length ? desired(time) : NONE;
    if (!shown || item.key !== shown.key) {
        // 被隐藏 / 停播 / 没歌词：按切歌的方式顺浪沉下
        if (item.none && item.kind === "none") mode = "song";
        show(item, mode);
    }

    settle();
    render();
    lay.busy = !paused && live.length > 0;
    lay.hasContent = blocks.length > 0;
}
