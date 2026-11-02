// 运动引擎：从 preview/index.html 移植，常量与时序保持一致。
// 不是 .pragma library：可以直接访问 shell.qml 里的 id（root / titleBox / titleText …）。

// 每级外观，下标 = 与中心的距离（0 主卡 … 4 细条，5 屏外）
var SX = [1, .36, .2, .1, .03, .02], SY = [1, .72, .56, .44, .36, .32];
var DROP = [0, .03, .07, .11, .15, .17];   // ×H：越远越低
var TINT = [0, .30, .50, .66, .78, .82];   // ink 染色
var DIM = [0, .16, .28, .38, .42, .42];    // 压暗
var BLUR = [0, .4, .8, 1, 1, 1];
var GLOW = [1, .6, .35, .15, 0, 0];        // 接触阴影
var DS = [1, .55, .3, .12, 0, 0];          // 卡片投影
var SH = [1, .5, .3, .15, 0, 0];           // 地面阴影
var TILT = -6.5 * Math.PI / 180, TAN = Math.tan(TILT);  // 轴线向右上升
var K = 280, C = 27, K2 = 300, C2 = 30, MAXLEAD = 3, KA = 260, CA = 17;
var RIP = .022;
var POOL_RANGE = 6;  // 目标附近 ±6 张提前分配卡片、加载图片

function lerpT(T, a) { var i = Math.min(T.length - 2, Math.floor(a)), f = Math.min(1, a - i); return T[i] + (T[i + 1] - T[i]) * f; }
function clamp(v, a, b) { if (a === undefined) a = 0; if (b === undefined) b = 1; return v < a ? a : v > b ? b : v; }
function mod(a, n) { return ((a % n) + n) % n; }
function wrapD(x, n) { if (!n) return 0; var r = mod(x, n); if (r > n / 2) r -= n; return r; }
function eio(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function eoc(t) { return 1 - Math.pow(1 - t, 3); }
function ein(t) { return t * t * t; }
function eob(t) { var c = 1.15; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }  // 约 6% 过冲
function now() { return Date.now(); }

function Tw(v) { return { v: v, from: v, to: v, t0: 0, dur: 1, ease: eio, act: false }; }
function tw(o, to, delay, dur, ease) {
    delay *= o.act && o.to !== to ? 0 : clamp(Math.abs(to - o.v));
    o.from = o.v; o.to = to; o.t0 = now() + delay; o.dur = Math.max(1, dur); o.ease = ease; o.act = true;
}
function stepTw(o, t) {
    if (!o.act) return false;
    var k = clamp((t - o.t0) / o.dur);
    if (t < o.t0) { o.v = o.from; return true; }
    o.v = o.from + (o.to - o.from) * o.ease(k);
    if (k >= 1) { o.v = o.to; o.act = false; }
    return o.act;
}

var G = {};
function geom() {
    var vw = root.vw, vh = root.vh, u = Math.min(vw / 1920, vh / 1080);
    var W = Math.min(vw * .4, vh * .8), H = W / 1.6, g = vw * .0055;
    var cx = vw / 2, by = vh * .625;
    var XS = [0];
    for (var k = 1; k < SX.length; k++) XS[k] = XS[k - 1] + (SX[k - 1] + SX[k]) * W / 2 + g;
    XS[5] = XS[4] + vw * .05;
    G = { vw: vw, vh: vh, u: u, W: W, H: H, cx: cx, by: by, XS: XS };
    G.tx = cx - W / 2 + 4 * u;
    G.ty = by + 10 * u + W * .78 * Math.sin(-TILT);
    G.srcW = Math.ceil(W * 1.12 * root.dpr);  // 主卡解码宽度；所有卡片共用，换位时不必重新解码
    root.u = u; root.cardW = W;
}

// ---------- 卡片池 ----------
// 卡片由 Repeater 创建时登记一次；之后只在 grab / release 之间流转，每张卡同一时刻只属于一个条目。
var cards = [], free = [];
function addCard(c) { cards.push(c); free.push(c); }
function grab(it) {
    if (it.card) return it.card;
    var c = free.pop();
    if (!c) return null;
    it.card = c; c.item = it; c.srcW = G.srcW; c.src = it.url;
    return c;
}
function release(it) {
    var c = it.card;
    if (!c) return;
    c.visible = false; c.item = null; c.src = ""; it.card = null; it.shown = false;  // 清空图源：还没解码的请求随之取消
    free.push(c);
}
function releaseAll() {
    for (var i = 0; i < items.length; i++) release(items[i]);
    for (var j = 0; j < ghosts.length; j++) release(ghosts[j].it);
    ghosts = [];
}

// ---------- 条目 ----------
var uid = 0;
function fileUrl(p) { return "file://" + p.split("/").map(encodeURIComponent).join("/"); }
function mkItem(w) {
    return { id: ++uid, w: w, url: fileUrl(w.path), card: null, r: null, dvR: 9, pulse: -1, shift: 0, sv: 0, hold: 0, hv: 0, hov: false,
        app: 1, appT0: 0, shown: false, o: Tw(0), om: "open", selK: 0 };
}
var items = [];
var applied = null;

// ---------- 状态 ----------
var pos = 0, vel = 0, target = 0;
var acc = { r: 0, v: 0, id: null };   // 选中弹簧：0 = 静止，1 = 选中卡抬起（放大 + 投影加深）
var open = false;
var chrome = { acc: Tw(0), lab: Tw(0) };
var ghosts = [], undo = [];
var last = 0;
var shownCid = null, pendCid = null, accTgt = 1;
var hist = [], lastMoveT = 0;
var S = null;
var tTw = Tw(0), tWant = 0, lastN = -1;

function kick() { if (!root.running) { last = now(); root.running = true; } }
function n() { return items.length; }
function capLead() { var d = target - pos; if (Math.abs(d) > MAXLEAD) target = Math.round(pos + Math.sign(d) * MAXLEAD); }
function posAt(tq) {
    if (!hist.length || tq >= hist[hist.length - 1][0]) return pos;
    if (tq <= hist[0][0]) return hist[0][1];
    for (var i = hist.length - 1; i > 0; i--) {
        var a = hist[i - 1], b = hist[i];
        if (tq >= a[0]) { var f = (tq - a[0]) / Math.max(1e-6, b[0] - a[0]); return a[1] + (b[1] - a[1]) * f; }
    }
    return hist[0][1];
}
function shiftAll(off) { pos -= off; target -= off; for (var i = 0; i < hist.length; i++) hist[i][1] -= off; }
function spr(o, k, c, to, h) { o.v += (k * (to - o.r) - c * o.v) * h; o.r += o.v * h; }

function tick() {
    var t = now();
    var dt = Math.min(.05, (t - last) / 1000); last = t;
    var busy = false;
    var steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
    var p0 = pos, i, it;
    for (var s = 0; s < steps; s++) {
        vel += (K * (target - pos) - C * vel) * h; pos += vel * h;
        spr(acc, KA, CA, accTgt, h);
        for (i = 0; i < items.length; i++) {
            it = items[i];
            if ((it.shift || it.sv) && t >= it.hold) { it.sv += (-K2 * it.shift - C2 * it.sv) * h; it.shift += it.sv * h; }
        }
    }
    if (Math.abs(target - pos) < 4e-4 && Math.abs(vel) < 2e-3) { pos = target; vel = 0; } else busy = true;
    if (Math.abs(accTgt - acc.r) < 1e-3 && Math.abs(acc.v) < 3e-3) { acc.r = accTgt; acc.v = 0; } else busy = true;
    if (pos !== p0) lastMoveT = t;
    hist.push([t, pos]); while (hist.length > 2 && hist[1][0] < t - 260) hist.shift();
    if (t - lastMoveT < RIP * 5000 + 20) busy = true;
    for (i = 0; i < items.length; i++) {
        it = items[i];
        if (it.shift || it.sv) { if (Math.abs(it.shift) < 4e-4 && Math.abs(it.sv) < 2e-3 && t >= it.hold) { it.shift = 0; it.sv = 0; } else busy = true; }
        var ht = it.hov && open ? 1 : 0;
        it.hv += (ht - it.hv) * (1 - Math.exp(-dt * 14));
        if (Math.abs(ht - it.hv) < .003) it.hv = ht; else busy = true;
        if (it.app < 1) { it.app = clamp((t - it.appT0) / 560); busy = true; }
        if (stepTw(it.o, t)) busy = true;
        if (it.pulse >= 0) { if (t - it.pulse > 320) it.pulse = -1; else busy = true; }
    }
    for (var k in chrome) if (stepTw(chrome[k], t)) busy = true;
    for (i = ghosts.length - 1; i >= 0; i--) {
        var g = ghosts[i];
        g.k = clamp((t - g.t0) / 560);
        if (g.k >= 1) { release(g.it); ghosts.splice(i, 1); } else busy = true;
    }
    if (stepLabel(t)) busy = true;
    render(t);
    if (!busy) {
        root.running = false;
        if (!open) { releaseAll(); root.shown = false; }
    }
}

// 速度响应：沿运动方向轻微倾斜、拉伸
function lean() { return clamp(-vel * .34, -5, 5); }
function stretch() { return 1 + Math.min(.06, Math.abs(vel) * .004); }

function cardTf(it, dv, gk) {
    var a = Math.abs(dv), s = dv < 0 ? -1 : 1, o = it.o.v, H = G.H;
    var sx = lerpT(SX, a), sy = lerpT(SY, a);
    var fan = 1, sc = 1, y = 0, op = a > 4 ? clamp(1 - (a - 4)) : 1, rot = 0;
    if (it.om === "close") { fan = .55 + .45 * o; sc *= .9 + .1 * o; y += (1 - o) * H * .32; op *= clamp((o - .08) / .5); }  // 下沉、收拢
    else if (a < .5) { sc *= .86 + .14 * o; y += (1 - o) * H * .42; op *= clamp(o * 2.6); }                          // 主卡最后浮起
    else { fan = .5 + .5 * o; y += (1 - o) * H * .5; op *= clamp(o * 2.2); }                                           // 两侧从中间向外浮现
    var x = s * lerpT(G.XS, a) * fan;
    y += x * TAN + lerpT(DROP, a) * H;
    y -= it.hv * H * (a > .5 ? .05 * clamp(a * 2) : .014);  // 悬停上浮
    var sk = 0, st = 1;
    if (gk === null) { sk = lean(); st = stretch(); }
    if (it.app < 1) { var e = eob(it.app); y += (1 - e) * H * .22; sc *= .88 + .12 * e; op *= clamp(it.app * 4); }
    it.selK = 0;
    if (gk === null && it === S) { var q = acc.r * chrome.acc.v * clamp(1 - a * 2); it.selK = q; sc *= 1 + .022 * q; y -= q * H * .018; }
    if (it.pulse >= 0) { var pk = clamp((now() - it.pulse) / 320); sc *= 1 + .035 * Math.sin(Math.PI * pk); y -= Math.sin(Math.PI * pk) * H * .02; }
    if (gk !== null) {  // 删除：轻轻一抬，然后带着重量落下
        var lift = gk < .16 ? Math.sin(gk / .16 * Math.PI) * G.vh * .012 : 0;
        y += gk * gk * G.vh * .46 - lift; rot = gk * gk * (s >= 0 ? 6 : -6) + gk * gk * 4; sc *= 1 - .1 * gk; op *= 1 - clamp((gk - .28) / .6);
    }
    return { X: G.cx + x, Y: G.by + y, sx: sx * sc * st, sy: sy * sc / Math.sqrt(st), sk: sk, rot: rot, op: op, a: a };
}

function hide(it) { if (it.card && it.shown) { it.card.visible = false; it.shown = false; } it.dvR = 9; }

function paint(it, dv, z, gk) {
    if (Math.abs(dv) > 5.2 && gk === null) { hide(it); return; }
    var c = grab(it);
    if (!c) return;
    var r = cardTf(it, dv, gk), a = r.a, hv = it.hv;
    if (gk === null) { it.r = r; it.dvR = dv; }
    var W = G.W, H = G.H, m = Math.max(r.sx, r.sy), sq = Math.sqrt(r.sx * r.sy);
    var px = gk === null ? clamp(vel * .55, -3.5, 3.5) : 0;  // 视差：图片逆着运动方向错开
    c.cx = r.X; c.cy = r.Y; c.cw = W * r.sx; c.ch = H * r.sy; c.sk = r.sk; c.rot = r.rot;
    c.opacity = r.op; c.z = z; c.u = G.u;
    c.imgW = W * m * 1.08; c.imgH = H * m * 1.08; c.imgDx = px / 100 * W * r.sx;
    c.blurOp = lerpT(BLUR, a) * (1 - hv * .7);
    c.tintOp = Math.max(0, lerpT(TINT, a) - hv * .3);
    c.dimOp = lerpT(DIM, a) * (1 - hv * .6);
    c.glowOp = lerpT(GLOW, a);
    c.shOp = lerpT(SH, a) * (1 + hv * .3);
    c.shY = hv * H * .04;
    c.flShadowBlur = 68 * sq;
    c.dsOp = gk !== null ? 0 : lerpT(DS, a) * (.8 + .2 * it.selK + hv * .15);
    c.dsY = (16 + 12 * it.selK) * r.sy;
    c.dsBlur = 52 * sq;
    c.killOp = gk !== null ? (gk < .2 ? gk / .2 * .8 : .8) : 0;
    c.nowOp = it.w.path === applied && gk === null ? clamp(1 - a * 1.6) : 0;
    if (!it.shown) { c.visible = true; it.shown = true; }
}

function render(t) {
    var N = n(), i, it;
    t = t || now();
    S = null;
    for (i = 0; i < N; i++) { it = items[i]; if (it.shown && it.r && (!S || Math.abs(it.dvR) < Math.abs(S.dvR))) S = it; }
    if (S && S.id !== acc.id) { acc.id = S.id; acc.r = 0; acc.v = 0; }
    if (S) { var spd = Math.abs(vel) + Math.abs(S.sv); accTgt = clamp(1 - (spd - .4) / 2.2); }
    // 目标附近 ±POOL_RANGE 张提前分配卡片、开始解码。由远到近申请：Qt 的图片读取线程后进先出，离中心越近越先解码
    var tc = Math.round(target);
    for (var d = POOL_RANGE + 1; d >= 0 && N; d--)
        for (var sg = -1; sg <= 1; sg += 2) {
            var j = mod(tc + sg * d, N);
            if (Math.abs(wrapD(j - target, N)) <= POOL_RANGE) grab(items[j]);
        }
    for (i = 0; i < N; i++) {
        it = items[i];
        var a0 = Math.abs(wrapD(i - pos, N));
        var a5 = Math.min(a0, 5);  // 涟漪：远处卡片取稍早的位置；延迟有上限，快速甩动时整排仍然连贯
        var p = posAt(t - Math.min(RIP * a5 * 1000, 250 * a5 / Math.max(Math.abs(vel), 1)));
        var dv = wrapD(i - p, N) + it.shift;
        if (Math.abs(wrapD(i - target, N)) > POOL_RANGE && Math.abs(dv) > 5.2) { release(it); continue; }
        paint(it, dv, 1000 - Math.round(Math.abs(dv) * 100), null);
    }
    for (i = 0; i < ghosts.length; i++) { var g = ghosts[i]; paint(g.it, g.dv, 1000 - Math.round(100 * clamp((g.k - .22) / .1)) - 1, g.k); }
    root.empty = N === 0;
    // 标题：在主卡下方，随轴线旋转
    var lv = chrome.lab.v, av = Math.abs(vel);
    var lean2 = clamp(-vel * G.u * 6, -G.u * 30, G.u * 30);
    var ty = (1 - lv) * G.H * .28, lo = clamp(lv * 1.4) * (N ? 1 : 0) * (1 - .45 * clamp((av - 6) / 4));
    titleBox.x = G.tx + lean2; titleBox.y = G.ty + ty * .8; titleBox.opacity = lo;
}

// 标题：中心在变化时隐藏，停稳后再淡入（不会在快速切换时闪出色块）
function fillTitle(ci) {
    if (ci < 0) { titleText.text = "—"; return; }
    var w = items[ci].w, tt = String(w.title || "").trim();
    titleText.text = Array.from(tt).length < 2 ? (w.pid ? "PIXIV " + w.pid : w.path.split("/").pop()) : tt;
}
function stepLabel(t) {
    var N = n(), ci = N ? mod(Math.round(pos), N) : -1, cid = ci < 0 ? null : items[ci].id;
    if (cid !== pendCid || N !== lastN) { pendCid = cid; lastN = N; }
    if (shownCid === null && N) { fillTitle(ci); shownCid = cid; tTw.v = tTw.to = 1; tTw.act = false; tWant = 1; }
    var tci = N ? mod(Math.round(target), N) : -1;
    var settled = !N || (tci === ci && Math.abs(target - pos) < .06 && Math.abs(vel) < .6 && Math.abs(items[ci].shift) < .06 && Math.abs(items[ci].sv) < .6);
    var want = settled && cid === shownCid ? 1 : 0;
    if (want !== tWant) { tWant = want; if (want) tw(tTw, 1, 0, 200, eoc); else tw(tTw, 0, 0, 90, eoc); }
    var busy = stepTw(tTw, t);
    if (settled && cid !== shownCid && tTw.v === 0 && !tTw.act) { fillTitle(ci); shownCid = cid; tWant = 1; tw(tTw, 1, 0, 200, eoc); busy = true; }
    if (!settled || cid !== shownCid) busy = true;
    var v = tTw.v;
    titleInner.opacity = v;
    titleInner.x = tWant === 1 ? (1 - v) * -12 * G.u : 0;  // 进入：从左滑入；离开：只淡出
    return busy;
}

// ---------- 打开 / 关闭 ----------
function load(list, current) {
    releaseAll();
    items = list.map(mkItem);
    applied = current;
    var ci = 0;
    for (var i = 0; i < items.length; i++) if (items[i].w.path === current) { ci = i; break; }
    pos = target = ci; vel = 0; hist = []; lastMoveT = 0;
    acc.r = 0; acc.v = 0; acc.id = null;
    shownCid = null; pendCid = null; tWant = 0; tTw = Tw(0); lastN = -1;
    undo = []; S = null;
    for (var k in chrome) chrome[k] = Tw(0);
    geom();
}

function setOpen(v) {
    if (v === open) return;
    open = v; root.open = v;
    var N = n(), i, it, a;
    if (v) {
        root.shown = true;
        for (i = 0; i < N; i++) {
            it = items[i]; a = Math.abs(wrapD(i - target, N)); it.om = "open";
            if (a < .5) tw(it.o, 1, 90, 560, eob);              // 主卡最后浮起，带轻微过冲
            else if (a <= 5.2) tw(it.o, 1, (a - 1) * 42, 480, eob);  // 两侧从中间向外依次浮现
            else { it.o.v = 1; it.o.act = false; }
        }
        tw(chrome.acc, 1, 420, 360, eoc);
        tw(chrome.lab, 1, 430, 480, eob);
    } else {
        for (var k in chrome) tw(chrome[k], 0, 0, 130, ein);
        for (i = 0; i < N; i++) {
            it = items[i]; a = Math.abs(wrapD(i - pos, N)); it.om = "close";
            if (a < .5) tw(it.o, 0, 200, 240, ein);                           // 主卡最后沉下
            else if (a <= 5.2) tw(it.o, 0, (5 - Math.min(a, 5)) * 28, 240, ein);  // 外侧先沉，向内收拢
            else { it.o.v = 0; it.o.act = false; }
        }
    }
    kick();
}
function isOpen() { return open; }

// ---------- 应用：设为当前显示器的壁纸，覆盖层照常收起 ----------
function applyCur() {
    if (!open) return;
    if (!n()) { root.toast("没有可应用的壁纸", true); return; }
    target = Math.round(target); capLead();
    var it = items[mod(Math.round(target), n())];
    if (it.w.path === applied) { it.pulse = now(); root.toast("已是当前壁纸", false); kick(); return; }  // 不会有变化：只做一下脉冲
    root.setWallpaper(it.w.path, function (d) {
        if (d.ok) applied = it.w.path;
        else root.toast("设置失败：" + (d.error || "未知错误"), true);
    });
    setOpen(false);
}

// ---------- 删除 / 撤销 ----------
function reindex(mut) {
    var N0 = n(), before = new Map();
    items.forEach(function (it, i) { before.set(it, wrapD(i - pos, N0) + it.shift); });
    mut();
    var N = n();
    items.forEach(function (it, i) {
        if (!before.has(it)) return;
        var s = before.get(it) - wrapD(i - pos, N);
        if (Math.abs(s) > 3) { s = 0; it.sv = 0; }
        it.shift = s;
    });
}
function stagger(base, per) {
    var t = now(), N = n();
    items.forEach(function (it, i) { if (it.shift) { var a = Math.abs(wrapD(i - pos, N)); it.hold = t + base + Math.min(a, 5) * per; } });
}
function del() {
    if (!n() || !open) return;
    var N0 = n(), ci = mod(Math.round(target), N0);
    shiftAll(target - ci);
    var it = items[ci], dv = wrapD(ci - pos, N0) + it.shift;
    reindex(function () { items.splice(ci, 1); });
    ghosts.push({ it: it, dv: dv, t0: now(), k: 0 }); it.hov = false;
    var entry = { w: it.w, idx: ci, key: null, pending: true };
    undo.push(entry);
    if (!n()) { target = 0; pos = 0; }
    stagger(90, 45);  // 邻居等它落下，再由近及远合拢
    root.toast("已移入回收站", true);
    root.trash(it.w.path, function (d) {
        entry.pending = false;
        if (d.ok) { entry.key = d.key; return; }
        undo.splice(undo.indexOf(entry), 1);
        root.toast("删除失败：" + (d.error || "未知错误"), true);
        if (open) reinsert(entry);
    });
    kick();
}
function reinsert(entry) {
    var it = mkItem(entry.w); it.app = 0; it.appT0 = now() + 140; it.o.v = 1; it.om = "open";
    var N0 = n();
    if (N0) shiftAll(target - mod(Math.round(target), N0));
    var ins = Math.min(entry.idx, N0);
    reindex(function () { items.splice(ins, 0, it); });
    var d = wrapD(ins - mod(target, n()), n()); target += d;
    if (N0 === 0) pos = target = ins;
    stagger(0, 30);  // 邻居先让开，卡片再弹进空位
    kick();
}
function restore() {
    if (!undo.length || !open) return;
    var entry = undo[undo.length - 1];
    if (entry.pending) return;  // 回收站还没返回结果，等一下再按
    undo.pop();
    if (!entry.key) { root.toast("这张无法撤销", true); return; }
    reinsert(entry);
    root.toast("已恢复 · " + (entry.w.title || entry.w.path.split("/").pop()), false);
    root.restore(entry.key, function (d) { if (!d.ok) root.toast("恢复失败：" + (d.error || "未知错误"), true); });
}

// ---------- 输入 ----------
function go(d) { if (!n() || !open) return; target += d; capLead(); kick(); }
function goIdx(i) { if (!n() || !open) return; target += wrapD(i - mod(target, n()), n()); kick(); }
function first() { goIdx(0); }
function lastIdx() { goIdx(n() - 1); }
function hover(card, on) { if (card.item) { card.item.hov = on; kick(); } }
function clickCard(card) {
    var it = card.item;
    if (!it || !open) return;
    var i = items.indexOf(it);
    if (i < 0) return;
    if (Math.abs(wrapD(i - pos, n())) < .5) applyCur(); else goIdx(i);
}
function resize() {
    geom();
    for (var i = 0; i < cards.length; i++) cards[i].srcW = G.srcW;
    if (root.shown) { render(); kick(); }
}
