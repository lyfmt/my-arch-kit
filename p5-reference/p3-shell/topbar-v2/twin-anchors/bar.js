(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement, body = document.body;
const Q = new URLSearchParams(location.search);
if (Q.get('theme') === 'lavender') html.dataset.theme = 'lavender';
const STILL = Q.has('static') || matchMedia('(prefers-reduced-motion: reduce)').matches;
if (STILL) { html.classList.add('static'); body.classList.add('static', 'noanim'); }
else body.classList.add('enter');

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const retrig = (el, c) => { if (!el) return; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad = n => String(n).padStart(2, '0');
const isZh = s => /[぀-ヿ㐀-鿿＀-￯]/.test(s);
const zc = s => isZh(s) ? ' zh' : '';
const copy = t => { try { navigator.clipboard && navigator.clipboard.writeText(String(t)).catch(() => {}); } catch (e) { /* offline preview */ } };
const isOpen = d => d.classList.contains('open');
const WALL = '../../../p3-miku/bg.png';

const sv = (p, f) => `<svg viewBox="0 0 24 24" fill="${f ? 'currentColor' : 'none'}" stroke="${f ? 'none' : 'currentColor'}" stroke-width="2.2" stroke-linecap="square">${p}</svg>`;
const G = {
  x: sv('<path d="M6 6l12 12M18 6 6 18"/>'),
  back: sv('<path d="M15 5l-7 7 7 7"/>'),
  chev: sv('<path d="M9 5l7 7-7 7"/>'),
  prev: sv('<path d="M5 5h2.6v14H5zM20 5v14L9 12z"/>', 1),
  next: sv('<path d="M16.4 5H19v14h-2.6zM4 5v14l11-7z"/>', 1),
  play: sv('<path d="M7 4v16l13-8z"/>', 1),
  pause: sv('<path d="M6 4h4.4v16H6zM13.6 4H18v16h-4.4z"/>', 1),
  lock: sv('<path d="M5.5 11h13v9h-13z"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>'),
  power: sv('<path d="M12 3v9"/><path d="M6.3 6.6a8 8 0 1 0 11.4 0"/>'),
  pin: sv('<path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8"/>'),
  vol: sv('<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  volOff: sv('<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" stroke="none"/><path d="M15.5 9l6 6M21.5 9l-6 6"/>'),
  wifiOff: sv('<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><path d="M3 3l18 18"/><path d="M11 18.5h2v2h-2z" fill="currentColor"/>'),
  cast: sv('<path d="M3 8V5h18v14h-7"/><path d="M3 12a8 8 0 0 1 8 8M3 16a4 4 0 0 1 4 4"/><path d="M3 19h1.6v1.6H3z" fill="currentColor"/>'),
};

const AP = {
  kitty: { n: 'KITTY', ic: 'img:kitty.png', id: 'kitty' },
  buffin: { n: 'BUFFIN', ic: 'fb:B', id: 'buffin-desktop' },
  firefox: { n: 'FIREFOX', ic: 'img:firefox.svg', id: 'firefox' },
  code: { n: 'VS CODE', ic: 'img:vscode.png', id: 'code' },
  feishu: { n: 'FEISHU', ic: 'img:feishu.png', id: 'bytedance-feishu' },
  wechat: { n: 'WECHAT', ic: 'img:wechat.png', id: 'wechat' },
  music: { n: '网易云音乐', ic: 'img:netease-cloud-music-gtk-symbolic.svg', id: 'netease-cloud-music-gtk' },
  thunar: { n: 'THUNAR', ic: 'img:org.xfce.thunar.svg', id: 'thunar' },
  clash: { n: 'CLASH', ic: 'img:clash.png' },
  sunshine: { n: 'SUNSHINE', ic: 'img:sunshine.svg' },
  rime: { n: 'RIME', ic: 'img:fcitx.svg' },
  magpie: { n: 'MAGPIE', ic: 'fb:M' },
  pacman: { n: 'PACMAN', ic: 'fb:P' },
};
const icon = k => {
  const i = k.indexOf(':'), t = k.slice(0, i), v = k.slice(i + 1);
  if (t === 'img') return `<img class="ic" src="icons/${v}" alt="">`;
  if (t === 'mask') return `<i class="ic mask" style="--m:url('icons/${v}')"></i>`;
  return `<i class="ic fb d">${v}</i>`;
};

/* one persistent white wedge + red echo per container; moves between targets on --e-snap */
function slide(box, target, from) {
  box.classList.add('hlh');
  let hl = box.querySelector(':scope > .hl');
  if (!hl) { hl = document.createElement('div'); hl.className = 'hl'; hl.innerHTML = '<i class="e"></i><i class="w"></i>'; box.prepend(hl); }
  if (!target) { hl.style.opacity = 0; return hl; }
  let x = 0, y = 0, n = target;
  while (n && n !== box) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  const tf = `translate(${x}px, ${y}px) scale(${target.offsetWidth / 100}, ${target.offsetHeight / 100})`;
  const hidden = hl.style.opacity === '0';
  hl.style.opacity = '';
  $$('i', hl).forEach(p => {
    const st = from || (STILL || hidden || !p.style.transform ? tf : null);
    if (st) { p.style.transition = 'none'; p.style.transform = st; void p.offsetWidth; p.style.transition = ''; }
    p.style.transform = tf;
  });
  return hl;
}
const hlTf = box => { const p = box && box.querySelector(':scope > .hl .w'); return p ? p.style.transform : ''; };

/* ---------- state ---------- */
const S = {
  ws: 2,
  wss: [
    { n: 'TERM', w: [{ a: 'kitty', t: 'nvim ~/.config/niri', pid: 2214, sz: '1680×1012', m: 'TILED' }, { a: 'buffin', t: 'Buffin', pid: 2290, sz: '1680×1012', m: 'TILED' }] },
    { n: 'WEB', w: [{ a: 'firefox', t: 'Arch Wiki — Niri', pid: 3102, sz: '3392×1012', m: 'TILED' }] },
    { n: 'CODE', w: [{ a: 'code', t: 'bar.js — my-arch-kit', pid: 4410, sz: '3392×1012', m: 'TILED' }, { a: 'thunar', t: 'twin-anchors', pid: 4620, sz: '960×640', m: 'FLOAT' }] },
    { n: 'CHAT', w: [{ a: 'feishu', t: '飞书', pid: 5120, sz: '1680×1012', m: 'TILED' }, { a: 'wechat', t: '微信', pid: 5388, sz: '1680×1012', m: 'TILED' }] },
    { n: 'PLAY', w: [{ a: 'music', t: '网易云音乐', pid: 6012, sz: '1680×1012', m: 'TILED' }] },
  ],
  fw: [0, 0, 0, 0, 0],
  bat: 100, charging: false, vol: 62, mute: false, mic: 48, micMute: false, out: 0,
  wifi: true, wnet: 0, vpn: false, bt: true, cast: false,
  profile: 1, bright: 70, dnd: false, night: false, dark: true,
  playing: true, pos: 74, len: 263, tr: 0,
  now: new Date(2026, 9, 30, 16, 29, 0),
  rail: 'ALERTS', sel: null, sort: 1,
};
const RAIL = ['ALERTS', 'SOUND', 'WIFI', 'BLUETOOTH', 'BATTERY', 'SYSTEM', 'TRAY', 'CLIPBOARD'];
const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

const NT = [
  { a: 'feishu', ap: 'FEISHU', ti: '16:27', sm: '周五发版评审 改到 17:30', bd: '林雨桐：会议室换成 3F 的极光，记得带上测试报告' },
  { a: 'wechat', ap: 'WECHAT', ti: '16:21', sm: '妈妈', bd: '周末回家吃饭吗？做了你爱吃的糖醋排骨' },
  { a: 'pacman', ap: 'PACMAN', ti: '16:02', sm: '14 updates available', bd: 'linux-zen 7.2.12 · mesa 26.2.1 · quickshell-git' },
  { a: 'feishu', ap: 'FEISHU', ti: '15:48', sm: 'kanban 组件 PR 已合并', bd: 'lyfmt/my-arch-kit #3 — fix daily task refresh' },
  { a: 'music', ap: '网易云音乐', ti: '15:30', sm: '每日推荐已更新', bd: '根据你的口味推荐了 30 首歌曲' },
  { a: 'firefox', ap: 'FIREFOX', ti: '14:56', sm: 'Download complete', bd: 'persona3-reload-ost-flac.zip  1.2 GB' },
  { a: 'wechat', ap: 'WECHAT', ti: '14:10', sm: '阿哲', bd: '[图片] 你看这个锁屏是不是跟你那个很像' },
  { a: 'clash', ap: 'CLASH VERGE', ti: '13:02', sm: 'Profile updated', bd: 'Subscription refreshed · 128 nodes' },
  { a: 'sunshine', ap: 'SUNSHINE', ti: '11:40', sm: 'Client paired', bd: 'Steam Deck connected from 192.168.1.42' },
];
let notes = NT.map((n, i) => ({ ...n, id: i, unread: i < 3 }));
const TOAST_POOL = [
  { a: 'wechat', ap: 'WECHAT', sm: '阿哲', bd: '晚上开黑吗，八点老地方' },
  { a: 'feishu', ap: 'FEISHU', sm: '构建通过 #482', bd: 'main · 3m 12s · all checks passed' },
  { a: 'music', ap: '网易云音乐', sm: 'Mass Destruction', bd: 'Lotus Juice · 目黒将司' },
  { a: 'pacman', ap: 'PACMAN', sm: 'quickshell-git updated', bd: 'r1987.4c1e2a0-1' },
];
let toastN = 0;

const NETS = [
  { n: 'lyfmt-5G', s: 4, lk: 1 }, { n: 'lyfmt-2.4G', s: 3, lk: 1 }, { n: 'ChinaNet-A3F2', s: 2, lk: 1 },
  { n: 'CMCC-WEB', s: 2, lk: 0 }, { n: 'TP-LINK_7C10', s: 1, lk: 1 },
];
const BTS = [
  { n: 'WH-1000XM5', b: 80, on: 1 }, { n: 'MX Master 3S', b: 55, on: 1 }, { n: 'Keychron K3', b: 0, on: 0 }, { n: 'Xbox Controller', b: 0, on: 0 },
];
const PROCS = [
  ['firefox', 18.4, 2140, 3102], ['code', 12.1, 1680, 4410], ['quickshell', 6.2, 412, 1880], ['niri', 3.8, 188, 1204],
  ['feishu', 3.1, 920, 5120], ['wechat', 2.4, 640, 5388], ['mpv', 1.9, 96, 6040], ['pipewire', 1.2, 42, 1302],
  ['kitty', 0.8, 120, 2214], ['clash-verge', 0.6, 210, 1720], ['fcitx5', 0.3, 64, 1410],
].map(([n, c, m, p]) => ({ n, c, m, p }));
const CLIPS = [
  { t: 'tx', v: 'qs ipc call music toggle', pin: 1 },
  { t: 'tx', v: 'https://wiki.archlinux.org/title/Niri' },
  { t: 'th', v: 'bg.png  2560×1440', b: 0 },
  { t: 'tx', v: 'include "p5lock.kdl"' },
  { t: 'tx', v: '周五发版评审 改到 17:30' },
  { t: 'th', v: 'screenshot 16-12-04.png', b: 1 },
  { t: 'tx', v: 'paru -S quickshell-git' },
  { t: 'tx', v: '#a3f0ff' },
];
const TRAY = [
  { a: 'feishu', l: 'FEISHU', m: [{ d: 'Open Feishu' }, { d: 'Do not disturb', ck: 0 }, { d: 'Status', sub: [{ d: 'Available', ck: 1, r: 1 }, { d: 'Busy', ck: 0, r: 1 }, { d: 'In a meeting', ck: 0, r: 1 }] }, { d: 'Quit' }] },
  { a: 'magpie', l: 'MAGPIE', m: [{ d: 'Scale window' }, { d: 'Auto scale', ck: 1 }, { d: 'Mode', sub: [{ d: 'Anime4K', ck: 1, r: 1 }, { d: 'FSR', ck: 0, r: 1 }, { d: 'Lanczos', ck: 0, r: 1 }] }, { d: 'Quit' }] },
  { a: 'rime', l: 'RIME', m: [{ d: '中州韵', ck: 0, r: 1 }, { d: '朙月拼音', ck: 1, r: 1 }, { d: '小鹤双拼', ck: 0, r: 1 }, { d: 'Deploy' }, { d: 'Sync user data' }, { d: 'Configure' }] },
  { a: 'sunshine', l: 'SUNSHINE', m: [{ d: 'Open web UI' }, { d: 'Paired clients', sub: [{ d: 'Steam Deck', ck: 1 }, { d: 'iPad Pro', ck: 1 }] }, { d: 'Restart' }, { d: 'Quit' }] },
  { a: 'clash', l: 'CLASH', m: [{ d: 'System proxy', ck: 1 }, { d: 'TUN mode', ck: 0 }, { d: 'Mode', sub: [{ d: 'Rule', ck: 1, r: 1 }, { d: 'Global', ck: 0, r: 1 }, { d: 'Direct', ck: 0, r: 1 }] }, { d: 'Dashboard' }, { d: 'Quit' }] },
];

/* ---------- left plate ---------- */
const ws = $('#ws'), wedge = $('#wedge'), wdig = $('#wdig'), appEl = $('#app');
S.wss.forEach(() => { const m = document.createElement('div'); m.className = 'mk'; m.innerHTML = '<i></i>'; ws.insertBefore(m, wedge); });
const focusWin = () => { const w = S.wss[S.ws]; return w.w[S.fw[S.ws]] || null; };
let leanT = 0;
function paintL(prev) {
  $$('.mk', ws).forEach((m, i) => { m.classList.toggle('occ', S.wss[i].w.length > 0); m.classList.toggle('on', i === S.ws); });
  const x = `${S.ws * 22}px 0`;
  $$('.w, .e', wedge).forEach(e => { e.style.translate = x; });
  wdig.style.translate = x;
  wdig.textContent = S.ws + 1;
  if (prev != null && prev !== S.ws && !STILL) {
    const r = S.ws > prev ? '4deg' : '-4deg';
    $$('.w, .e', wedge).forEach(e => { e.style.rotate = r; });
    clearTimeout(leanT);
    leanT = setTimeout(() => $$('.w, .e', wedge).forEach(e => { e.style.rotate = '0deg'; }), 160);
    retrig(wdig, 'roll');
  }
  const f = focusWin(), nm = f ? AP[f.a].n : '';
  if (appEl.textContent !== nm) {
    appEl.textContent = nm;
    appEl.className = 'app d' + zc(nm);
    if (prev != null && !STILL) retrig(appEl, 'swap');
  }
}
function goWs(i) {
  i = clamp(i, 0, S.wss.length - 1);
  if (i === S.ws) return;
  const p = S.ws; S.ws = i; paintL(p);
  if (isOpen(LPd) && lpView === 'list') renderLP(true);
}

/* ---------- right plate ---------- */
const urEl = $('#ur'), urn = $('#urn'), batEl = $('#bat'), batn = $('#batn'), glEl = $('#gl'), timeEl = $('#time'), dateEl = $('#date');
const unread = () => notes.filter(n => n.unread).length;
function paintR() {
  const u = unread();
  urEl.classList.toggle('zero', u === 0); urn.textContent = u;
  batn.textContent = S.bat;
  batEl.classList.toggle('low', S.bat <= 15 && !S.charging);
  const g = [];
  if (!S.wifi) g.push(G.wifiOff);
  if (S.mute) g.push(G.volOff);
  if (S.cast) g.push(G.cast);
  const gh = g.join('');
  if (glEl.innerHTML !== gh) glEl.innerHTML = gh;
  dateEl.textContent = `${pad(S.now.getMonth() + 1)}/${pad(S.now.getDate())}`;
}
function setDigits(el, str, anim) {
  const cur = $$('span', el);
  if (cur.length !== str.length) { el.innerHTML = [...str].map(c => `<span>${c}</span>`).join(''); return; }
  [...str].forEach((c, i) => { if (cur[i].textContent !== c) { cur[i].textContent = c; if (anim && !STILL) retrig(cur[i], 'roll'); } });
}
const hm = () => `${pad(S.now.getHours())}:${pad(S.now.getMinutes())}`;
function paintTime(anim) { setDigits(timeEl, hm(), anim); const b = $('.bigt', RP); if (b) setDigits(b, hm(), anim); }

/* ---------- drops ---------- */
const LPd = $('#LPd'), LP = $('#LP'), RPd = $('#RPd'), RP = $('#RP');
function openDrop(d) { d.classList.remove('fade'); d.classList.add('open'); }
function closeDrop(d) {
  if (!isOpen(d)) return;
  d.classList.remove('open');
  if (d === RPd) unflip();
}

/* ---------- left panel ---------- */
let lpView = 'list', lpWin = null;
function chip(w, f, i) {
  return `<div class="wc${f ? ' f' : ''}" data-w="${i}">${icon(AP[w.a].ic)}<span class="l${zc(AP[w.a].n)}">${esc(AP[w.a].n)}</span></div>`;
}
function renderLP(still) {
  LP.classList.toggle('still', !!still);
  if (lpView === 'list') {
    const old = $('.wl', LP), from = still ? hlTf(old) : '';
    LPd.style.minWidth = '';
    LP.innerHTML = '<div class="wl">' + S.wss.map((w, i) => {
      const on = i === S.ws, occ = w.w.length > 0;
      return `<div class="wr r${occ ? ' occ' : ''}${on ? ' on' : ''}" data-ws="${i}" style="--i:${i}">
        <div class="dg d">${i + 1}</div>
        <div class="nm d">${w.n}</div>
        <div class="chips">${w.w.map((x, j) => chip(x, on && j === S.fw[i], j)).join('')}</div></div>`;
    }).join('') + '</div>';
    const wl = $('.wl', LP);
    slide(wl, $('.wr.on .dg', wl), from);
  } else {
    const w = lpWin, a = AP[w.a];
    LP.innerHTML = `<div class="wv-h r fr" style="--i:0"><div class="gb" data-act="back">${G.back}</div>${icon(a.ic)}<div class="tt d${zc(w.t)}" data-copy="${esc(w.t)}">${esc(w.t)}</div></div>
      <div class="acts r fr" style="--i:1">
        <div class="bt l${w.m === 'FLOAT' ? ' on' : ''}" data-act="FLOAT">FLOAT</div>
        <div class="bt l${w.m === 'FULL' ? ' on' : ''}" data-act="FULL">FULL</div>
        <div class="bt l" data-act="OVERVIEW">OVERVIEW</div>
        <div class="bt l" data-act="RULE">RULE</div>
        <div class="bt l dz" data-act="CLOSE">CLOSE</div></div>`;
  }
}
function openLP() { closeDrop(RPd); lpView = 'list'; renderLP(); openDrop(LPd); }
function lpBack() { lpView = 'list'; renderLP(); }
function lpWinView(w) { LPd.style.minWidth = LPd.offsetWidth + 'px'; lpWin = w; lpView = 'win'; renderLP(); }
LP.addEventListener('click', e => {
  const t = e.target;
  if (lpView === 'list') {
    const dg = t.closest('.dg'), wc = t.closest('.wc'), row = t.closest('.wr');
    if (!row) return;
    const i = +row.dataset.ws;
    if (wc) {
      const j = +wc.dataset.w;
      if (i === S.ws && j === S.fw[i]) return lpWinView(S.wss[i].w[j]);
      S.fw[i] = j;
      if (i !== S.ws) { const p = S.ws; S.ws = i; paintL(p); } else paintL(S.ws);
      renderLP(true); return;
    }
    if (dg) { goWs(i); }
    return;
  }
  const cp = t.closest('[data-copy]');
  if (cp) { copy(cp.dataset.copy); retrig(cp, 'hit'); return; }
  const b = t.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, w = lpWin;
  if (act === 'back') return lpBack();
  if (act === 'FLOAT' || act === 'FULL') { w.m = w.m === act ? 'TILED' : act; renderLP(true); return; }
  if (act === 'OVERVIEW' || act === 'RULE') { closeDrop(LPd); return; }
  if (act === 'CLOSE') {
    const list = S.wss[S.ws].w, k = list.indexOf(w);
    if (k >= 0) list.splice(k, 1);
    S.fw[S.ws] = clamp(S.fw[S.ws], 0, Math.max(0, list.length - 1));
    paintL(S.ws); lpBack();
  }
});

/* ---------- right panel ---------- */
RP.innerHTML = `<div class="rh"><div class="bigt d ghost"></div><div class="hd"><span class="d wk"></span><span class="d md"></span></div></div>
  <div class="rb"><div class="rl">${RAIL.map((r, i) => `<div class="ri d" data-r="${r}" style="--i:${i}">${r}</div>`).join('')}</div><div class="pn"></div></div>`;
const bigt = $('.bigt', RP), hd = $('.hd', RP), pn = $('.pn', RP), rl = $('.rl', RP);
let calOn = false, stack = [];
function paintHd() {
  $('.wk', hd).textContent = WD[S.now.getDay()];
  $('.md', hd).textContent = `${MON[S.now.getMonth()].slice(0, 3)} ${S.now.getDate()}`;
  hd.classList.toggle('on', calOn);
}
function paintRail() {
  $$('.ri', rl).forEach(r => {
    r.classList.toggle('on', !calOn && r.dataset.r === S.rail);
    const sup = $('sup', r);
    if (r.dataset.r === 'ALERTS') {
      const u = unread();
      if (u && !sup) r.insertAdjacentHTML('beforeend', `<sup class="d">${u}</sup>`);
      else if (u) sup.textContent = u; else if (sup) sup.remove();
    }
  });
  if (isOpen(RPd) || RPd.classList.contains('opening')) slide(rl, calOn ? null : $('.ri.on', rl));
}
let flipEl = null, flipR = 0, flipT = 0;
const FLIP_MS = 380, flipEase = p => 1 - Math.pow(1 - p, 4);
/* ghost tracks the live slot every frame, so the sheet's dropin spring is followed exactly; hands over when it lands */
function flipIn() {
  unflipEl();
  setDigits(bigt, hm());
  timeEl.classList.add('hand'); dateEl.classList.add('hand');
  if (STILL) { bigt.classList.remove('ghost'); return; }
  bigt.classList.add('ghost');
  const a = timeEl.getBoundingClientRect();
  flipEl = document.createElement('div');
  flipEl.className = 'flipg d'; flipEl.innerHTML = bigt.innerHTML;
  flipEl.style.fontSize = getComputedStyle(bigt).fontSize;
  const t0 = performance.now(), el = flipEl;
  const step = now => {
    if (el !== flipEl) return;
    const b = bigt.getBoundingClientRect(), p = Math.min(1, (now - t0) / FLIP_MS), e = flipEase(p), k0 = a.height / b.height;
    const x = a.left + (b.left - a.left) * e, y = a.top + (b.top - a.top) * e, k = k0 + (1 - k0) * e;
    el.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    if (!el.isConnected) document.body.appendChild(el);
    if (p < 1) flipR = requestAnimationFrame(step);
    else land();
  };
  const land = () => { if (el === flipEl) { bigt.classList.remove('ghost'); unflipEl(); } };
  flipT = setTimeout(land, FLIP_MS + 120);
  step(t0);
}
function unflipEl() { cancelAnimationFrame(flipR); clearTimeout(flipT); if (flipEl) { flipEl.remove(); flipEl = null; } }
function unflip() { unflipEl(); bigt.classList.add('ghost'); timeEl.classList.remove('hand'); dateEl.classList.remove('hand'); }

function openRP(rail, cal) {
  closeDrop(LPd);
  calOn = !!cal; stack = [];
  if (rail) S.rail = rail;
  const was = isOpen(RPd);
  const hl = $(':scope > .hl', rl); if (hl && !was) hl.style.opacity = 0;
  openDrop(RPd);
  paintHd(); paintRail(); renderPane('swap');
  if (!was) flipIn();
}
const PMAX = 452;
function fitPane() {
  const cur = pn.offsetHeight; pn.style.transition = 'none'; pn.style.setProperty('--ph', 'auto');
  const full = pn.scrollHeight, min = rl.offsetHeight, h = clamp(full, min, PMAX);
  pn.style.setProperty('--ph', cur + 'px'); void pn.offsetHeight; pn.style.transition = '';
  pn.style.setProperty('--ph', h + 'px');
  pn.classList.toggle('ov', full > h + 1 && pn.scrollTop + h < full - 4);
}
pn.addEventListener('scroll', () => pn.classList.toggle('ov', pn.scrollTop + pn.clientHeight < pn.scrollHeight - 4));
function anim(c) { if (STILL) return; ['swap', 'push', 'pop'].forEach(x => pn.classList.remove(x)); void pn.offsetWidth; pn.classList.add(c); }
function renderPane(how) {
  let h;
  const top = stack[stack.length - 1];
  if (calOn) h = paneCal();
  else if (top) h = top.render();
  else h = PANES[S.rail]();
  pn.innerHTML = h;
  let i = 0; [...pn.children].forEach(c => { c.classList.add('q'); c.style.setProperty('--i', i++); });
  pn.scrollTop = 0;
  if (how) anim(how);
  afterPane();
}
function selRail(r) {
  if (!calOn && r === S.rail && !stack.length) return;
  calOn = false; stack = []; S.rail = r;
  paintHd(); paintRail(); renderPane('swap');
}
function push(v) { stack.push(v); renderPane('push'); }
function pop() { if (!stack.length) return false; stack.pop(); renderPane('pop'); return true; }
const subH = (title, ic) => `<div class="sub-h" data-act="pop"><div class="gb">${G.back}</div>${ic ? icon(ic) : ''}<span class="d${zc(title)}">${esc(title)}</span></div>`;

rl.addEventListener('click', e => { const r = e.target.closest('.ri'); if (r) selRail(r.dataset.r); });
hd.addEventListener('click', () => { calOn = !calOn; stack = []; paintHd(); paintRail(); renderPane('swap'); });

/* ---------- panes ---------- */
const slider = (k, lb, v, off) => `<div class="sl${off ? ' off' : ''}" data-k="${k}" style="--v:${v}%"><span class="lb l">${lb}</span><div class="tr"><i class="fi"></i><i class="th"></i></div><b class="vv d">${v}</b></div>`;
const seg = (k, opts, on) => `<div class="seg l" data-k="${k}">${opts.map((o, i) => `<span data-i="${i}"${i === on ? ' class="on"' : ''}>${o}</span>`).join('')}</div>`;
const tgl = (k, on) => `<div class="tgl${on ? ' on' : ''}" data-tg="${k}"></div>`;
const ntRow = n => `<div class="nt${n.unread ? ' new' : ''}" data-id="${n.id}">${icon(AP[n.a].ic)}<div><div class="top"><span class="ap l${zc(n.ap)}">${esc(n.ap)}</span><span class="ti l">${n.ti}</span></div>
  <div class="sm${zc(n.sm)}">${esc(n.sm)}</div><div class="bd${zc(n.bd)}">${esc(n.bd)}</div></div><div class="x">${G.x}</div></div>`;
const mmss = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

const PANES = {
  ALERTS: () => `<div class="ln"><div class="bt sm l${S.dnd ? ' on' : ''}" data-act="dnd">DND</div><div class="bt sm l" data-act="clear">CLEAR</div></div>`
    + (notes.length ? notes.map(ntRow).join('') : '<div class="empty"></div>'),
  SOUND: () => slider('vol', 'VOLUME', S.vol, S.mute) + slider('mic', 'MIC', S.mic, S.micMute)
    + `<div class="row">${seg('out', ['SPEAKERS', 'HEADPHONES', 'HDMI'], S.out)}<div class="bt l${S.mute ? ' on' : ''}" data-act="mute">MUTE</div></div>`
    + `<div class="med"><div class="cov"><img src="${WALL}" alt=""></div><div><div class="tt d">${esc(TRK[S.tr][0])}</div>
      <div class="mc"><span class="ar zh">${esc(TRK[S.tr][1])}</span><div class="ctl"><div class="gb" data-act="prev">${G.prev}</div><div class="gb" data-act="play">${S.playing ? G.pause : G.play}</div><div class="gb" data-act="next">${G.next}</div></div></div></div>
      <div class="pos"><span class="l" id="p0">${mmss(S.pos)}</span><div class="bar" data-act="seek"><i style="width:${S.pos / S.len * 100}%"></i></div><span class="l">${mmss(S.len)}</span></div></div>`,
  WIFI: () => `<div class="ln"><span class="l">WI-FI</span>${tgl('wifi', S.wifi)}</div>`
    + `<div class="list${S.wifi ? '' : ' off'}">${NETS.map((n, i) => `<div class="nw${S.wifi && i === S.wnet ? ' on' : ''}" data-net="${i}"><span class="sig">${[1, 2, 3, 4].map(k => `<i${k <= n.s ? ' class="f"' : ''}></i>`).join('')}</span><span class="d">${esc(n.n)}</span><span class="lk${n.lk ? '' : ' no'}">${G.lock}</span></div>`).join('')}</div>`
    + `<div class="sep"></div><div class="ln"><span class="l">VPN · WG-HOME</span>${tgl('vpn', S.vpn)}</div><div class="ln"><span class="l">CAST</span>${tgl('cast', S.cast)}</div>`,
  BLUETOOTH: () => `<div class="ln"><span class="l">BLUETOOTH</span>${tgl('bt', S.bt)}</div>`
    + `<div class="list${S.bt ? '' : ' off'}">${BTS.map((b, i) => `<div class="nw${b.on ? ' on' : ''}" data-bt="${i}"><span class="d">${esc(b.n)}</span>${b.on ? `<span class="bb"><b class="d">${b.b}%</b><span class="mb"><i style="width:${b.b}%"></i></span></span>` : ''}</div>`).join('')}</div>`,
  BATTERY: () => {
    const low = S.bat <= 15 && !S.charging;
    return `<div class="pt${low ? ' low' : ''}"><div class="bn d">${S.bat}<small>%</small></div></div><div class="lvb${low ? ' low' : ''}"><i style="width:${S.bat}%"></i></div>`
      + `<div class="row">${seg('profile', ['SAVER', 'BALANCED', 'PERFORM'], S.profile)}</div>`
      + slider('bright', 'BRIGHTNESS', S.bright)
      + `<div class="ln"><span class="l">NIGHT MODE</span>${tgl('night', S.night)}</div>`;
  },
  SYSTEM: () => `<div class="ln"><b class="d who">LYFMT</b><b class="d upt">3H 12M</b></div>`
    + `<div class="mts"><div class="mt" data-mt="1"><span class="l">CPU</span><b class="d">23%</b></div><div class="mt" data-mt="2"><span class="l">RAM</span><b class="d">9.4G</b></div><div class="mt" data-mt="1"><span class="l">TEMP</span><b class="d">54°</b></div></div>`
    + `<div class="ln"><span class="l">DARK MODE</span>${tgl('dark', S.dark)}</div>`
    + `<div class="pa"><div class="bt l" data-act="lock">${G.lock}LOCK</div><div class="bt l" data-act="pwr">${G.power}SESSION</div><div class="bt l" data-act="settings">SETTINGS</div></div>`,
  TRAY: () => `<div class="tg3">${TRAY.map((t, i) => `<div class="ti3" data-tray="${i}">${icon(AP[t.a].ic)}<span class="l">${t.l}</span></div>`).join('')}</div>`,
  CLIPBOARD: () => `<div class="ln"><div class="bt sm l${clipPinned ? ' on' : ''}" data-act="pinf">PINNED</div><div class="bt sm l" data-act="cclear">CLEAR</div></div>`
    + CLIPS.map((c, i) => [c, i]).filter(([c]) => !clipPinned || c.pin).map(([c, i]) => `<div class="cr${c.pin ? ' pin' : ''}" data-clip="${i}">${c.t === 'th' ? `<span class="th${c.b ? ' b' : ''}"><img src="${WALL}" alt=""></span><span class="tx${zc(c.v)}">${esc(c.v)}</span>` : `<span class="tx${zc(c.v)}">${esc(c.v)}</span>`}<span class="pn2" data-act="pin">${G.pin}</span></div>`).join(''),
};
let clipPinned = false;
const TRK = [['Color Your Night', 'Lotus Juice · 高橋あず美', 263], ['Full Moon Full Life', 'Lotus Juice · 高橋あず美', 248], ['It\'s Going Down Now', 'Lotus Juice · 高橋あず美', 236], ['Mass Destruction -Reload-', 'Lotus Juice · 高橋あず美', 225]];

const procView = () => ({
  render: () => {
    const keys = ['n', 'c', 'm', 'p'];
    const k = keys[S.sort];
    const list = PROCS.slice().sort((a, b) => k === 'n' ? a.n.localeCompare(b.n) : b[k] - a[k]);
    return subH('PROCESSES') + `<div class="pr-h">${['NAME', 'CPU', 'MEM', 'PID'].map((h, i) => `<span class="l${i === S.sort ? ' on' : ''}" data-sort="${i}">${h}</span>`).join('')}</div>`
      + `<div class="prl">${list.map(p => `<div class="pr${p.p === S.sel ? ' on' : ''}" data-pid="${p.p}"><span class="d">${p.n}</span><span class="l">${p.c.toFixed(1)}</span><span class="l">${p.m >= 1000 ? (p.m / 1024).toFixed(1) + 'G' : p.m + 'M'}</span><span class="l">${p.p}</span></div>`).join('')}</div>`
      + `<div class="acts"><div class="bt l" data-act="end">END</div><div class="bt l dz" data-act="kill">KILL</div></div>`;
  },
});
const pwrView = () => ({
  render: () => subH('SESSION') + `<div class="pwl">${['SUSPEND', 'REBOOT', 'SHUTDOWN', 'LOGOUT'].map(p => `<div class="pw l${p === 'SHUTDOWN' ? ' dz' : ''}${armed === p ? ' arm' : ''}" data-pw="${p}">${p}</div>`).join('')}</div>`,
});
let armed = null, armT = 0;
const menuView = (title, ic, items) => ({
  render: () => subH(title, ic) + items.map((m, i) => `<div class="mi" data-mi="${i}">${'ck' in m ? `<span class="ck${m.ck ? ' on' : ''}"></span>` : '<span class="nock"></span>'}<span class="l${zc(m.d)}">${esc(m.d)}</span>${m.sub ? G.chev : ''}</div>`).join(''),
  items, title, ic,
});

let cal = { y: 2026, m: 9, sel: 30 };
const EV = { '2026-9-30': '17:30  发版评审 · 3F 极光', '2026-9-31': '20:00  Halloween 开黑', '2026-10-1': '10:00  kanban 周会', '2026-9-24': '1024 程序员节', '2026-9-12': '14:00  牙医复诊' };
function paneCal() {
  const first = new Date(cal.y, cal.m, 1), off = (first.getDay() + 6) % 7, n = new Date(cal.y, cal.m + 1, 0).getDate();
  const prevN = new Date(cal.y, cal.m, 0).getDate();
  const cells = [];
  const rows = Math.ceil((off + n) / 7) * 7;
  for (let i = 0; i < rows; i++) {
    const d = i - off + 1, col = i % 7;
    if (d < 1 || d > n) { cells.push(`<span class="dy d out">${d < 1 ? prevN + d : d - n}</span>`); continue; }
    const td = cal.y === 2026 && cal.m === 9 && d === 30;
    const c = ['dy', 'd'];
    if (col >= 5) c.push('we'); if (td) c.push('td'); if (d === cal.sel && !td) c.push('sel'); if (EV[`${cal.y}-${cal.m}-${d}`]) c.push('ev');
    cells.push(`<span class="${c.join(' ')}" data-day="${d}">${d}</span>`);
  }
  const ev = EV[`${cal.y}-${cal.m}-${cal.sel}`] || '';
  const [t, ...rest] = ev.split('  ');
  return `<div class="cal-h"><span class="m d">${MON[cal.m]}</span><span class="y d">${cal.y}</span><div class="gb" data-act="cprev">${G.back}</div><div class="gb" data-act="cnext">${G.chev}</div></div>`
    + `<div class="cg">${['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(w => `<span class="wk l">${w}</span>`).join('')}${cells.join('')}</div>`
    + `<div class="evr">${ev ? (rest.length ? `<b class="d">${t}</b><span class="zh">${esc(rest.join(' '))}</span>` : `<span class="zh">${esc(t)}</span>`) : ''}</div>`;
}

/* ---------- pane interactions ---------- */
function afterPane() { paintRail(); fitPane(); }
function setSl(k, v, keep) {
  v = Math.round(clamp(v, 0, 100));
  if (k === 'vol') { S.vol = v; if (S.mute && !keep) S.mute = false; paintR(); }
  else if (k === 'mic') S.mic = v;
  else if (k === 'bright') S.bright = v;
  const el = $(`.sl[data-k="${k}"]`, pn);
  if (el) { el.style.setProperty('--v', v + '%'); $('.vv', el).textContent = v; el.classList.toggle('off', k === 'vol' ? S.mute : k === 'mic' ? S.micMute : false); }
}
pn.addEventListener('pointerdown', e => {
  const tr = e.target.closest('.tr'); if (!tr) return;
  const k = tr.parentElement.dataset.k;
  const mv = ev => { const r = tr.getBoundingClientRect(); setSl(k, (ev.clientX - r.left) / r.width * 100); if (k === 'vol') osd(); };
  tr.setPointerCapture(e.pointerId); mv(e);
  tr.onpointermove = mv;
  tr.onpointerup = tr.onpointercancel = () => { tr.onpointermove = null; };
});
function dismiss(row) {
  const id = +row.dataset.id;
  row.classList.add('gone');
  setTimeout(() => {
    row.style.height = row.offsetHeight + 'px'; void row.offsetWidth;
    row.style.height = '0px'; row.style.paddingTop = row.style.paddingBottom = '0px';
    setTimeout(() => {
      notes = notes.filter(n => n.id !== id); row.remove(); paintR(); paintRail();
      if (!notes.length && S.rail === 'ALERTS' && !calOn && !stack.length) renderPane(); else fitPane();
    }, STILL ? 0 : 240);
  }, STILL ? 0 : 180);
}
function blackout() {
  closeAll();
  const b = document.createElement('div'); b.className = 'blk'; body.appendChild(b);
  void b.offsetWidth; b.classList.add('on');
  setTimeout(() => { b.classList.remove('on'); setTimeout(() => b.remove(), 420); }, 1200);
}
pn.addEventListener('click', e => {
  const t = e.target, A = t.closest('[data-act]'), act = A && A.dataset.act;
  if (act === 'pop') return pop();
  if (calOn) {
    if (act === 'cprev' || act === 'cnext') { cal.m += act === 'cprev' ? -1 : 1; if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } cal.sel = 1; renderPane('swap'); return; }
    const d = t.closest('.dy[data-day]'); if (d) { cal.sel = +d.dataset.day; renderPane(); pn.classList.remove('swap', 'push', 'pop'); }
    return;
  }
  const top = stack[stack.length - 1];
  if (top && top.items) {
    const mi = t.closest('.mi'); if (!mi) return;
    const m = top.items[+mi.dataset.mi];
    if (m.sub) return push(menuView(m.d, top.ic, m.sub));
    if ('ck' in m) {
      if (m.r) { top.items.forEach(x => { if (x.r) x.ck = 0; }); m.ck = 1; renderPane(); return; }
      m.ck = m.ck ? 0 : 1; renderPane(); return;
    }
    closeAll(); return;
  }
  // alerts
  const nt = t.closest('.nt');
  if (nt) { if (t.closest('.x')) return dismiss(nt); const n = notes.find(x => x.id === +nt.dataset.id); if (n && n.unread) { n.unread = false; nt.classList.remove('new'); paintR(); paintRail(); } return; }
  if (act === 'dnd') { S.dnd = !S.dnd; A.classList.toggle('on', S.dnd); return; }
  if (act === 'clear') { $$('.nt', pn).forEach((r, i) => setTimeout(() => dismiss(r), STILL ? 0 : i * 40)); return; }
  // sound
  const sg = t.closest('.seg > span');
  if (sg) { const k = sg.parentElement.dataset.k, i = +sg.dataset.i; $$('span', sg.parentElement).forEach(x => x.classList.toggle('on', x === sg)); if (k === 'out') S.out = i; else S.profile = i; return; }
  if (act === 'mute') { toggleMute(); A.classList.toggle('on', S.mute); return; }
  if (act === 'play') { S.playing = !S.playing; A.innerHTML = S.playing ? G.pause : G.play; return; }
  if (act === 'prev' || act === 'next') { S.tr = (S.tr + (act === 'next' ? 1 : TRK.length - 1)) % TRK.length; S.len = TRK[S.tr][2]; S.pos = 0; renderPane(); return; }
  if (act === 'seek') { const r = A.getBoundingClientRect(); S.pos = clamp((e.clientX - r.left) / r.width, 0, 1) * S.len; $('i', A).style.width = S.pos / S.len * 100 + '%'; $('#p0', pn).textContent = mmss(S.pos); return; }
  // wifi / bt
  const tg = t.closest('.tgl');
  if (tg) { const k = tg.dataset.tg; S[k] = !S[k]; paintR(); renderPane(); return; }
  const nw = t.closest('.nw[data-net]'); if (nw) { S.wnet = +nw.dataset.net; renderPane(); return; }
  const bd = t.closest('.nw[data-bt]'); if (bd) { const b = BTS[+bd.dataset.bt]; b.on = b.on ? 0 : 1; if (b.on && !b.b) b.b = 70; renderPane(); return; }
  // power
  const mt = t.closest('.mt'); if (mt) { S.sort = +mt.dataset.mt; S.sel = null; return push(procView()); }
  const sh = t.closest('[data-sort]'); if (sh) { S.sort = +sh.dataset.sort; renderPane(); return; }
  const pr = t.closest('.pr'); if (pr) { S.sel = +pr.dataset.pid; $$('.pr', pn).forEach(x => x.classList.toggle('on', x === pr)); return; }
  if (act === 'end' || act === 'kill') {
    const row = $('.pr.on', pn); if (!row) return;
    const pid = +row.dataset.pid; row.classList.add('gone');
    setTimeout(() => { const k = PROCS.findIndex(p => p.p === pid); if (k >= 0) PROCS.splice(k, 1); S.sel = null; const st = $('.prl', pn).scrollTop; renderPane(); $('.prl', pn).scrollTop = st; }, STILL ? 0 : 200);
    return;
  }
  if (act === 'lock') return blackout();
  if (act === 'settings') return closeAll();
  if (act === 'pwr') { armed = null; return push(pwrView()); }
  const pw = t.closest('.pw');
  if (pw) {
    const p = pw.dataset.pw;
    if (armed === p) { armed = null; blackout(); return; }
    armed = p; clearTimeout(armT);
    $$('.pw', pn).forEach(x => x.classList.toggle('arm', x === pw));
    armT = setTimeout(() => { armed = null; $$('.pw', pn).forEach(x => x.classList.remove('arm')); }, 3000);
    return;
  }
  // tray
  const ti = t.closest('.ti3'); if (ti) { const tr = TRAY[+ti.dataset.tray]; return push(menuView(tr.l, AP[tr.a].ic, tr.m)); }
  // clip
  if (act === 'pinf') { clipPinned = !clipPinned; renderPane(); return; }
  if (act === 'cclear') { for (let i = CLIPS.length - 1; i >= 0; i--) if (!CLIPS[i].pin) CLIPS.splice(i, 1); clipPinned = false; renderPane('swap'); return; }
  const cr = t.closest('.cr');
  if (cr) {
    const c = CLIPS[+cr.dataset.clip];
    if (act === 'pin') { c.pin = c.pin ? 0 : 1; cr.classList.toggle('pin', !!c.pin); return; }
    copy(c.v); retrig(cr, 'hit2'); $$('.cr', pn).forEach(x => x !== cr && x.classList.remove('hit2'));
  }
});
pn.addEventListener('contextmenu', e => { const ti = e.target.closest('.ti3'); if (ti) { e.preventDefault(); const tr = TRAY[+ti.dataset.tray]; push(menuView(tr.l, AP[tr.a].ic, tr.m)); } });

/* ---------- osd ---------- */
const osdEl = $('#osd'), og = $('#og'), obv = $('#obv'), ov = $('#ov');
let osdT = 0;
function osd() {
  if (isOpen(RPd)) return;
  osdEl.classList.toggle('mute', S.mute);
  og.innerHTML = S.mute ? G.volOff : G.vol;
  obv.style.width = (S.mute ? 0 : S.vol) + '%';
  ov.textContent = S.mute ? 0 : S.vol;
  osdEl.classList.add('open'); body.classList.add('osdon');
  clearTimeout(osdT); osdT = setTimeout(() => { osdEl.classList.remove('open'); body.classList.remove('osdon'); }, 1200);
}
function toggleMute() { S.mute = !S.mute; paintR(); setSl('vol', S.vol, true); osd(); }

/* ---------- toasts ---------- */
const toastsEl = $('#toasts');
function toast() {
  const src = TOAST_POOL[toastN++ % TOAST_POOL.length];
  const n = { ...src, id: 100 + toastN, ti: hm(), unread: true };
  notes.unshift(n); paintR();
  if (isOpen(RPd) && S.rail === 'ALERTS' && !calOn && !stack.length) { renderPane(); paintRail(); }
  if (S.dnd || isOpen(RPd)) return;
  const el = document.createElement('div'); el.className = 'ts';
  el.innerHTML = `<div class="sheet">${ntRow(n)}</div>`;
  $('.nt', el).classList.remove('new');
  toastsEl.prepend(el);
  while (toastsEl.children.length > 3) toastsEl.lastElementChild.remove();
  const out = () => { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 200); };
  const t = setTimeout(out, 5000);
  el.addEventListener('click', e => {
    clearTimeout(t);
    if (e.target.closest('.x')) return out();
    el.remove(); openRP('ALERTS');
  });
}

/* ---------- global ---------- */
function closeAll() { closeDrop(LPd); closeDrop(RPd); }
$('#L').addEventListener('click', () => isOpen(LPd) ? closeDrop(LPd) : openLP());
$('#R').addEventListener('click', e => {
  if (e.target.closest('#ur')) { if (isOpen(RPd) && S.rail === 'ALERTS' && !calOn) return closeDrop(RPd); return openRP('ALERTS'); }
  if (e.target.closest('#bat')) { if (isOpen(RPd) && S.rail === 'BATTERY' && !calOn) return closeDrop(RPd); return openRP('BATTERY'); }
  if (e.target.closest('#time, #date')) { if (isOpen(RPd) && calOn) return closeDrop(RPd); return openRP(null, true); }
  if (isOpen(RPd)) closeDrop(RPd); else openRP();
});
$('#L').addEventListener('wheel', e => { e.preventDefault(); goWs(S.ws + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
$('#R').addEventListener('wheel', e => { e.preventDefault(); setSl('vol', S.vol + (e.deltaY > 0 ? -5 : 5)); osd(); }, { passive: false });
$('#R').addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); toggleMute(); } });
$('#R').addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
document.addEventListener('pointerdown', e => {
  if (e.target.closest('#L, #R, .drop, .toasts')) return;
  closeAll();
});
document.addEventListener('contextmenu', e => {
  if (!e.target.closest('.plate, .drop')) return;
  e.preventDefault();
  if (e.target.closest('#L')) { closeAll(); retrig($('#L .pin'), 'hit'); }
});
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === 'Escape') {
    if (isOpen(RPd)) { if (calOn) { calOn = false; paintHd(); paintRail(); renderPane('swap'); return; } if (pop()) return; return closeDrop(RPd); }
    if (isOpen(LPd)) { if (lpView !== 'list') return lpBack(); return closeDrop(LPd); }
    return;
  }
  if (k === 't' || k === 'T') { if (html.dataset.theme === 'lavender') delete html.dataset.theme; else html.dataset.theme = 'lavender'; return; }
  if (k === 'n' || k === 'N') return toast();
  if (/^[1-5]$/.test(k)) return goWs(+k - 1);
  if (isOpen(RPd) && (k === 'ArrowDown' || k === 'ArrowUp')) {
    e.preventDefault();
    const i = RAIL.indexOf(S.rail) + (k === 'ArrowDown' ? 1 : -1);
    selRail(RAIL[(i + RAIL.length) % RAIL.length]);
  }
});

/* ---------- clock ---------- */
setInterval(() => {
  const m = S.now.getMinutes();
  S.now = new Date(S.now.getTime() + 1000);
  if (S.playing) { S.pos += 1; if (S.pos >= S.len) { S.tr = (S.tr + 1) % TRK.length; S.len = TRK[S.tr][2]; S.pos = 0; } const b = $('.pos .bar i', pn); if (b) { b.style.width = S.pos / S.len * 100 + '%'; $('#p0', pn).textContent = mmss(S.pos); } }
  if (S.now.getMinutes() !== m) { paintTime(true); paintR(); }
}, 1000);

/* ---------- init ---------- */
paintL(); paintR(); paintTime(false); paintHd();
if (!STILL) setTimeout(() => body.classList.remove('enter'), 600);
})();
