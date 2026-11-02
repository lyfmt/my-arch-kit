(() => {
'use strict';
const q = new URLSearchParams(location.search);
const root = document.documentElement;
const STATIC = q.has('static');
if (STATIC) root.classList.add('static');
root.dataset.theme = q.get('theme') === 'lavender' ? 'lavender' : 'p3';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const later = (fn, ms) => setTimeout(fn, STATIC ? 0 : ms);
const col = i => `style="color:var(--c${(i % 5) + 1})"`;
const reflow = el => void el.offsetWidth;

const P = {
  chev: '<path d="M9 5l7 7-7 7"/>', back: '<path d="M15 5l-7 7 7 7"/>', x: '<path d="M5 5l14 14M19 5L5 19"/>',
  lock: '<path d="M5 11h14v10H5z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  sleep: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  logout: '<path d="M10 4H4v16h6M9 12h11M16 8l4 4-4 4"/>',
  reboot: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  off: '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  vol: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  sun: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
};
const F = {
  prev: '<path d="M5 5h3v14H5zM20 5v14L9 12z"/>', next: '<path d="M16 5h3v14h-3zM4 5v14l11-7z"/>',
  play: '<path d="M7 4v16l13-8z"/>', pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
};
const gi = g => g ? `<i class="gi ${g}"></i>` : '';
const CJK = /[\u3000-\u9fff\uff00-\uffef]/;
const dn = t => CJK.test(t) ? 'cj' : 'd';
const ic = k => `<svg class="ic" viewBox="0 0 24 24">${P[k]}</svg>`;
const fic = k => `<svg class="ic" viewBox="0 0 24 24">${F[k]}</svg>`;

/* ---------------- state ---------------- */
const S = {
  order: [1, 2, 3, 4, 5], active: 1,
  win: {
    1: { app: 'kitty', name: 'KITTY', g: 'kitty', title: 'nvim ~/.config/niri/config.kdl', pid: 41822, mode: 'TILED', size: '1674 × 902' },
    2: { app: 'firefox', name: 'FIREFOX', g: 'firefox', title: 'niri — Configuration: Window Rules — Mozilla Firefox', pid: 3120, mode: 'TILED', size: '1674 × 902' },
    3: { app: 'Bytedance-feishu', name: '飞书', g: 'feishu', title: '飞书 — 设计评审群', pid: 5521, mode: 'TILED', size: '1180 × 902' },
    5: { app: 'spotify', name: 'SPOTIFY', g: '', title: 'Lotus Juice, Azumi Takahashi — Full Moon Full Life', pid: 6012, mode: 'FLOATING', size: '1100 × 720' },
  },
  h: 16, m: 29, sec: 48,
  cpu: 4, ram: 29, load: 0.42,
  bat: 100, low: false, limit: false, pmode: 'BALANCED',
  vol: 62, bri: 80, mic: 45, player: 100, muted: false, micMuted: false, sink: 0,
  wifi: true, bt: true, dnd: false, vpn: false,
  ssid: 'lyfmt-5G', pwFor: null, joining: null, scanning: false,
  track: 0, playing: true, pos: 112,
  cal: { y: 2026, m: 9, pick: '2026-10-30' }, adding: false,
  ptype: 'ALL', psort: 'c', pfilter: '', pex: null,
};
const TRACKS = [
  { t: 'Full Moon Full Life', a: 'Lotus Juice, Azumi Takahashi', len: 266 },
  { t: 'Mass Destruction -Reload-', a: 'Lotus Juice, Azumi Takahashi', len: 203 },
  { t: 'Color Your Night', a: 'Lotus Juice, Azumi Takahashi', len: 248 },
];
const NOTES = [
  { g: 'feishu', s: '陈一鸣', b: '周五例会改到 17:00', t: '16:27' },
  { g: 'qq', s: 'Arch Linux CN', b: 'linux-zen 7.2.11 已进 core', t: '16:23' },
  { g: 'clash', s: 'Clash Verge', b: '订阅 clash.yaml 已更新', t: '16:15' },
  { g: 'firefox', s: 'GitHub', b: '[my-arch-kit] CI passed on main', t: '16:08' },
  { g: 'steam', s: 'Steam', b: 'Persona 3 Reload 下载完成', t: '15:51' },
  { g: 'shot', s: 'Screenshot saved', b: '~/Pictures/Screenshots/2026-10-30 15-47-12.png', t: '15:47' },
  { g: 'feishu', s: '日程', b: '18:30 健身', t: '15:30' },
  { g: 'arch', s: 'pacman', b: '12 个更新可用', t: '15:12' },
  { g: 'sunshine', s: 'Sunshine', b: 'Moonlight 已连接 · Steam Deck', t: '14:40' },
];
const POOL = [
  { g: 'feishu', s: '王磊', b: '晚上一起吃饭吗' },
  { g: 'qq', s: '阿杰', b: '周末 P3R 联机吗' },
  { g: 'firefox', s: 'GitHub', b: 'niri-wm/niri: v26.10 released' },
  { g: 'magpie', s: 'magpie', b: '重启以更新到 0.1.2168' },
  { g: 'feishu', s: '日程', b: '17:00 例会 · 3 楼会议室' },
];
let nid = 0;
S.notes = NOTES.map(n => ({ ...n, id: ++nid }));
const PROCS = [
  ['firefox', 3120, 1.6, 1840, 1], ['feishu', 5521, 0.5, 964, 1], ['spotify', 6012, 0.3, 402, 1], ['qs', 1388, 0.6, 356, 1],
  ['niri', 1043, 0.9, 268, 1], ['kitty', 41822, 0.4, 212, 1], ['clash-verge', 2190, 0.1, 188, 1], ['sunshine', 2240, 0.1, 142, 1],
  ['Xwayland', 1102, 0.2, 118, 1], ['magpie', 2210, 0.2, 96, 1], ['fcitx5', 1460, 0.1, 84, 1], ['systemd-journald', 402, 0.1, 48, 0],
  ['pipewire', 1201, 0.1, 38, 1], ['NetworkManager', 688, 0.0, 22, 0], ['systemd', 1, 0.0, 14, 0], ['bluetoothd', 712, 0.0, 9, 0],
].map(([n, pid, c, m, u]) => ({ n, pid, c, m, u }));
const NETS = [
  { s: 'lyfmt-5G', g: 78, sec: 1 }, { s: 'lyfmt', g: 71, sec: 1 }, { s: 'ChinaNet-7F2A', g: 52, sec: 1 }, { s: 'CMCC-Home', g: 44, sec: 1 },
  { s: 'TP-LINK_3C9E', g: 30, sec: 1 }, { s: 'iQOO Neo9', g: 26, sec: 1 }, { s: 'Xiaomi_Guest', g: 18, sec: 0 },
];
const BTS = [
  { n: 'WH-1000XM5', b: 80, on: true }, { n: 'MX Master 3S', b: 65, on: true },
  { n: '8BitDo Ultimate', b: 40, on: false }, { n: 'Steam Deck', b: 0, on: false },
];
const SINKS = [['WH-1000XM5', 'BLUETOOTH'], ['Built-in Speakers', 'ANALOG'], ['LG ULTRAGEAR', 'HDMI']];
const CLIPS = ['paru -Syu', 'https://github.com/niri-wm/niri/wiki/Configuration:-Window-Rules', '~/.config/niri/dms/binds.kdl',
  'git commit -m "kanban: fix daily reset"', '#a3f0ff', '周五例会改到 17:00'];
const TASKS = {
  '2026-10-30': [{ t: '17:00 例会', d: true }, { t: '升级 linux-zen 7.2.11', d: false }, { t: '18:30 健身', d: false }],
  '2026-10-31': [{ t: '买南瓜', d: false }],
  '2026-11-02': [{ t: 'Sunshine 串流测试', d: false }],
};

/* ---------------- workspaces ---------------- */
const ws = $('#ws'), wsw = $('#wsw'), wse = $('#wse');
const spr = (k, c) => ({ x: 0, v: 0, t: 0, w: 44, wv: 0, wt: 44, k, c });
const W = spr(520, 32), E = spr(380, 30);
let skew = 0, raf = 0, lastT = 0;
function cells() { return $$('.wc', ws); }
function renderWs() {
  cells().forEach(c => c.remove());
  const frag = document.createDocumentFragment();
  S.order.forEach(n => {
    const b = document.createElement('button');
    b.className = 'wc d' + (S.win[n] ? ' occ' : '') + (n === S.active ? ' on' : '');
    b.dataset.n = n; b.textContent = n;
    frag.appendChild(b);
  });
  ws.appendChild(frag);
}
function slotOf(n) {
  let x = 0;
  for (const m of S.order) { if (m === n) return x; x += (m === S.active ? 44 : 28) + 4; }
  return 0;
}
function aimWedge(jump) {
  const x = slotOf(S.active);
  W.t = x;
  if (jump || STATIC) { W.x = E.x = E.t = x; W.v = E.v = 0; skew = 0; paintWedge(); return; }
  setTimeout(() => { E.t = W.t; kick(); }, 40);
  kick();
}
function paintWedge() {
  wsw.style.transform = `translateX(${W.x}px) skewX(${skew}deg)`;
  wse.style.transform = `translateX(${E.x}px)`;
}
function kick() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(step); } }
function step(now) {
  const dt = Math.min(0.032, (now - lastT) / 1000); lastT = now;
  for (const s of [W, E]) { const a = -s.k * (s.x - s.t) - s.c * s.v; s.v += a * dt; s.x += s.v * dt; }
  skew *= Math.pow(0.0005, dt);
  paintWedge();
  const rest = [W, E].every(s => Math.abs(s.x - s.t) < 0.05 && Math.abs(s.v) < 0.05) && Math.abs(skew) < 0.05;
  if (rest) { W.x = W.t; E.x = E.t; skew = 0; paintWedge(); raf = 0; return; }
  raf = requestAnimationFrame(step);
}
function setWs(n, dir = 0) {
  if (!S.order.includes(n) || n === S.active) return;
  S.active = n;
  cells().forEach(c => { const m = +c.dataset.n; c.classList.toggle('on', m === n); });
  if (dir) skew = 4 * dir;
  aimWedge();
  if (sheetOpen && stack.length === 1) refresh();
}
let wheelAt = 0;
ws.addEventListener('wheel', e => {
  e.preventDefault();
  const now = performance.now(); if (now - wheelAt < 100) return; wheelAt = now;
  const d = e.deltaY > 0 ? 1 : -1, i = S.order.indexOf(S.active);
  const j = clamp(i + d, 0, S.order.length - 1);
  if (j !== i) setWs(S.order[j], d);
}, { passive: false });
let drag = null;
ws.addEventListener('pointerdown', e => {
  const c = e.target.closest('.wc'); if (!c) return;
  drag = { c, n: +c.dataset.n, x0: e.clientX, moved: false, off: 0 };
  ws.setPointerCapture(e.pointerId);
});
ws.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x0;
  if (!drag.moved && Math.abs(dx) < 6) return;
  drag.moved = true; drag.c.classList.add('drag');
  const i = S.order.indexOf(drag.n), wOf = m => (m === S.active ? 44 : 28) + 4;
  let off = dx - drag.off;
  if (off > 0 && i < S.order.length - 1 && off > wOf(S.order[i + 1]) / 2) {
    const nb = S.order[i + 1]; S.order.splice(i, 2, nb, drag.n); drag.off += wOf(nb);
    drag.c.parentNode.insertBefore(drag.c, $(`.wc[data-n="${nb}"]`, ws).nextSibling);
  } else if (off < 0 && i > 0 && -off > wOf(S.order[i - 1]) / 2) {
    const nb = S.order[i - 1]; S.order.splice(i - 1, 2, drag.n, nb); drag.off -= wOf(nb);
    drag.c.parentNode.insertBefore(drag.c, $(`.wc[data-n="${nb}"]`, ws));
  }
  off = dx - drag.off;
  drag.c.style.translate = `${off}px 0`;
  if (drag.n === S.active) { W.t = slotOf(S.active) + off; E.t = W.t; W.x = W.t; E.x = E.t; paintWedge(); }
  else aimWedge();
});
const endDrag = () => {
  if (!drag) return;
  const { c, n, moved } = drag; drag = null;
  c.classList.remove('drag'); c.style.translate = '';
  if (!moved) setWs(n, Math.sign(S.order.indexOf(n) - S.order.indexOf(S.active)));
  else aimWedge();
};
ws.addEventListener('pointerup', endDrag);
ws.addEventListener('contextmenu', e => { e.preventDefault(); ws.classList.remove('ov'); reflow(ws); ws.classList.add('ov'); });
ws.addEventListener('pointercancel', endDrag);

/* ---------------- clock ---------------- */
const clock = $('#clock');
const p2 = n => String(n).padStart(2, '0');
function renderClock(roll) {
  const s = p2(S.h) + ':' + p2(S.m);
  clock.setAttribute('aria-label', s);
  const prev = clock.dataset.v || s;
  if (!roll || !clock.children.length) {
    clock.innerHTML = [...s].map(ch => ch === ':' ? '<span class="cn">:</span>' : `<span class="dg"><b>${ch}</b></span>`).join('');
  } else {
    [...s].forEach((ch, i) => {
      if (ch === ':' || ch === prev[i]) return;
      const dg = clock.children[i], old = dg.querySelector('b');
      old.className = 'old';
      const nb = document.createElement('b'); nb.className = 'new'; nb.textContent = ch; dg.appendChild(nb);
      setTimeout(() => old.remove(), 450);
    });
  }
  clock.dataset.v = s;
}
renderClock();
if (!STATIC) setInterval(() => {
  if (++S.sec < 60) return;
  S.sec = 0; if (++S.m === 60) { S.m = 0; S.h = (S.h + 1) % 24; }
  renderClock(true);
  if (sheetOpen) $$('.uptime').forEach(e => e.textContent = uptime());
}, 1000);
const UP0 = 3 * 60 + 41;
const uptime = () => { const t = UP0 + (S.h * 60 + S.m) - (16 * 60 + 29); return `${Math.floor(t / 60)}:${p2(t % 60)}`; };

/* ---------------- marks ---------------- */
const mark = $('#mark'), markn = $('#markn');
function renderMark(pop) {
  const n = S.notes.length;
  mark.classList.toggle('on', n > 0);
  markn.textContent = n;
  if (pop && !STATIC) { mark.classList.remove('pop'); reflow(mark); mark.classList.add('pop'); }
}
function renderStates() {
  document.body.classList.toggle('dnd', S.dnd);
  document.body.classList.toggle('muted', S.muted);
  $('#lowbat').classList.toggle('on', S.low);
  $('#lowbat').textContent = S.bat + '%';
  $('#muted').classList.toggle('on', S.muted);
  $('#muted').style.marginRight = S.low ? ($('#lowbat').offsetWidth + 18) + 'px' : '8px';
  const lb = $('#lowbat'), lw = S.low ? lb.offsetWidth + 10 : 0;
  $('#cplate').style.left = -(4 + lw + (S.muted ? 28 : 0) + (S.low || S.muted ? 6 : 0)) + 'px';
}

/* ---------------- toast / osd ---------------- */
const toast = $('#toast'), tin = $('.tin', toast);
let toastT = 0, toastKind = '';
function showToast(html, kind) {
  if (sheetOpen) return;
  const was = toast.classList.contains('on') && toastKind === kind;
  tin.innerHTML = html; toastKind = kind;
  if (!was) { toast.classList.remove('on'); reflow(toast); toast.classList.add('on'); }
  clearTimeout(toastT);
  toastT = setTimeout(hideToast, kind === 'osd' ? 1600 : 4000);
}
function hideToast() { toast.classList.remove('on'); clearTimeout(toastT); }
function osd(kind) {
  const v = kind === 'vol' ? (S.muted ? 0 : S.vol) : S.bri;
  showToast(`${ic(kind === 'vol' ? 'vol' : 'sun')}<span class="l ov">${kind === 'vol' ? 'VOLUME' : 'BRIGHTNESS'}</span><span class="bar"><i style="width:${v}%"></i></span><span class="d">${v}</span>`, 'osd');
}
function arrive(n) {
  n = { ...n, id: ++nid, t: p2(S.h) + ':' + p2(S.m) };
  S.notes.unshift(n);
  renderMark(true);
  if (sheetOpen) { if (['main', 'notes'].includes(stack[stack.length - 1].id)) refresh(); return; }
  if (S.dnd) return;
  showToast(`<span class="ap">${gi(n.g)}</span><span class="tx"><span class="${dn(n.s)} s">${esc(n.s)}</span><span class="zh b">${esc(n.b)}</span></span>`, 'note');
}
tin.addEventListener('click', () => { hideToast(); if (toastKind === 'note') openSheet(); });
$('#center').addEventListener('wheel', e => {
  e.preventDefault();
  const d = e.deltaY > 0 ? -5 : 5;
  if (e.shiftKey) { S.bri = clamp(S.bri + d, 1, 100); osd('bri'); }
  else { S.vol = clamp(S.vol + d, 0, 100); if (S.muted && d > 0) S.muted = false; renderStates(); osd('vol'); }
  if (sheetOpen) paintSliders();
}, { passive: false });

/* ---------------- sheet ---------------- */
let sheetOpen = false, stack = [], kbd = false, closeT = 0;
const sheet = $('#sheet'), pages = $('.pages', sheet), fade = $('#fade');
const topPg = () => $$('.pg', pages).filter(p => !p.classList.contains('out-l') && !p.classList.contains('out-r')).pop();
const K = (a, v = '', cls = '') => `class="k ${cls}" data-a="${a}" data-v="${esc(v)}"`;
const sc = (i, html, cls = '') => `<div class="sc ${cls}" style="--i:${i}">${html}</div>`;
const ph = (t, rt = '', f = 'd') => `<div class="ph"><button ${K('back', '', 'bk')}>${ic('back')}</button><span class="h ${f}">${t}</span><div class="rt">${rt}</div></div>`;
const chev = (a, v) => `<button ${K(a, v, 'cv')}>${ic('chev')}</button>`;
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const TODAY = '2026-10-30';
const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const fmtM = mb => mb >= 1024 ? (mb / 1024).toFixed(1) + 'G' : mb + 'M';
const lockI = `<svg class="ic lk" viewBox="0 0 24 24">${P.lock}</svg>`;
const sg = g => `<span class="sg">${[1, 2, 3, 4].map(i => `<i${g > (i - 1) * 25 ? ' class="on"' : ''}></i>`).join('')}</span>`;

/* tray menus */
const it = (t, o) => ({ t, ...o });
const ck = (t, on) => ({ t, bt: 1, on: !!on });
const rd = (t, on) => ({ t, bt: 2, on: !!on });
const sub = (t, kids, o) => ({ t, kids, ...o });
const fl = (t, flip) => ({ t, flip });
const SEP = { sep: 1 };
const DANGER = /^(quit|exit|退出)/i;
const TRAY = {
  feishu: { g: 'feishu', name: '飞书', menu: [it('打开飞书', { go: 3 }), it('退出飞书')] },
  magpie: { g: 'magpie', name: 'MAGPIE', menu: [it('打开 magpie'), SEP, it('版本 0.1.2121', { dis: 1 }), it('重启以更新到 0.1.2168'), it('退出 magpie')] },
  fcitx: { g: 'rime', name: 'FCITX 5', menu: [rd('Keyboard - English (US)'), rd('Rime', true), SEP,
    sub('万象拼音', [it('Latin Mode'), it('万象拼音'), it('雾凇拼音'), SEP, it('Deploy', { nf: 1 }), it('Synchronize', { nf: 1 })], { follow: 1 }),
    fl('英标', '中标'), fl('半角', '全角'), fl('表情关', '表情开'), fl('翻译关', '翻译开'), fl('上下文关', '上下文开'),
    sub('原编码', [it('原编码'), it('有声调'), it('无声调')], { follow: 1 }),
    sub('简体', [it('简体'), it('通繁'), it('港繁'), it('臺繁')], { follow: 1 }),
    fl('简码开', '简码关'), fl('注释关', '注释开'), fl('提示关', '提示开'), fl('大字集', '常用字'), fl('词组先', '单字先'), fl('英文开', '英文关'), SEP,
    it('Restart'), it('Input Method Settings'), it('Exit')] },
  sunshine: { g: 'sunshine', name: 'SUNSHINE', menu: [it('Open Sunshine'), SEP, sub('Donate', [it('GitHub Sponsors'), it('Patreon'), it('PayPal')]), SEP, it('Restart'), it('Quit')] },
  clash: { g: 'clash', name: 'CLASH VERGE', menu: [it('仪表板'), SEP,
    sub('出站模式 (规则)', [ck('规则模式', true), ck('全局模式'), ck('直连模式')], { x: 1, follow: t => `出站模式 (${t.replace('模式', '')})` }), SEP,
    sub('订阅', [ck('clash.yaml'), ck('clash.yaml'), ck('clash.yaml'), ck('clash.yaml', true)], { x: 1 }),
    sub('代理', [
      sub('🚀 节点选择', [it('测试延迟', { stay: 1 }), SEP, ck('🇭🇰 香港 | 103ms'), ck('🇹🇼 台湾 | 128ms'), ck('🇯🇵 日本 | 103ms'), ck('🇺🇸 美国 | 159ms'),
        ck('🇩🇪 德国备用 | T/O'), ck('♻️ 自动选择 | 103ms', true), ck('DIRECT | -ms')], { x: 1 }),
      sub('🇭🇰 香港', [ck('ZOUTER-HK-TMP-v6 | 103ms', true), ck('LEC-ZOUTER-HK-v6 | 107ms'), ck('ZOUTER-HK-TMP | T/O')], { x: 1 }),
      sub('🇹🇼 台湾', null), sub('🇯🇵 日本', null), sub('🇺🇸 美国', null), sub('🇩🇪 德国备用', null), sub('♻️ 自动选择', null), sub('AI', null), sub('国内', null)]),
    SEP, ck('系统代理'), ck('TUN 模式', true), SEP, ck('轻量模式'), SEP,
    sub('打开目录', [it('配置目录'), it('内核目录'), it('日志目录'), it('应用日志'), it('内核日志')]),
    sub('更多', [it('复制环境变量'), it('关闭所有连接'), it('重启 Clash 内核'), it('重启应用'), it('Verge 版本 2.5.8')]),
    SEP, it('退出')] },
};
S.tray = ['feishu', 'magpie', 'fcitx', 'sunshine', 'clash'];
S.copied = -1; S.kvc = null; S.rule = { float: false, full: false, opacity: false, saved: false };
function trayLevel(app, path) {
  let lvl = TRAY[app].menu, parent = null, title = TRAY[app].name;
  for (const i of path) { parent = lvl[i]; title = parent.t; lvl = parent.kids; }
  return { lvl, parent, title };
}

/* ---------------- pages ---------------- */
const SL = { vol: 'VOLUME', bri: 'BRIGHTNESS', mic: 'MICROPHONE', player: 'SPOTIFY' };
const slOff = k => (k === 'vol' && S.muted) || (k === 'mic' && S.micMuted);
function slRow(key, tail) {
  const v = S[key];
  return `<div ${K('sl', key, 'r sl' + (slOff(key) ? ' off' : ''))}><span class="l">${SL[key]}</span><span class="tr" data-k="${key}"><i style="--v:${v}%"></i></span><span class="d">${v}</span>${tail || '<span class="gap"></span>'}</div>`;
}
function paintSliders() {
  $$('.sl', pages).forEach(r => {
    const k = r.dataset.v;
    $('.tr i', r).style.setProperty('--v', S[k] + '%');
    $('.d', r).textContent = S[k];
    r.classList.toggle('off', slOff(k));
  });
}
function noteRow(n) {
  return `<div ${K('note', n.id, 'r nt')}><span class="ap">${gi(n.g)}</span><span class="n zh"><span class="nsn ${dn(n.s)}">${esc(n.s)}</span>${esc(n.b)}</span><span class="t">${n.t}</span><button ${K('dis', n.id, 'x')}>${ic('x')}</button></div>`;
}
const chip = (key, label, page) => `<div class="cg"><button ${K('tog', key, 'cp l' + (S[key] ? ' on' : ''))}>${label}</button>${page ? chev('go', page) : ''}</div>`;

function pMain() {
  const w = S.win[S.active], tr = TRACKS[S.track], n = S.notes.length;
  let h = sc(0, `<div class="hd"><button ${K('go', 'month', 'dt d')}>30</button><span class="dw l">FRI<br>OCTOBER</span><div class="ros">
    <button ${K('go', 'procs', 'ro')}><span class="l">CPU</span><span class="d cpu">${S.cpu}%</span></button>
    <button ${K('go', 'procs:m', 'ro')}><span class="l">RAM</span><span class="d">${S.ram}%</span></button>
    <button ${K('go', 'battery', 'ro')}><span class="l">BAT</span><span class="d"${S.low ? ' style="color:var(--red)"' : ''}>${S.bat}%</span></button></div></div>`);
  let i = 1;
  if (w) h += sc(i++, `<div ${K('go', 'window', 'r')}><span class="ap">${gi(w.g)}</span><span class="n ${dn(w.name)}">${w.name}</span><span class="t grow">${esc(w.title)}</span><span class="cv">${ic('chev')}</span></div>`);
  h += sc(i++, `<div class="r md"><div class="tx grow"><span class="n d">${tr.t}</span><span class="t">${tr.a}</span></div>
    <button ${K('prev', '', 'mb')}>${fic('prev')}</button><button ${K('play', '', 'mb')}>${fic(S.playing ? 'pause' : 'play')}</button><button ${K('next', '', 'mb')}>${fic('next')}</button>
    <div class="pr"><i style="width:${(S.pos / tr.len * 100).toFixed(2)}%"></i></div></div>`);
  h += sc(i++, slRow('vol', chev('go', 'output')) + slRow('bri'));
  h += sc(i++, `<div class="r chips">${chip('wifi', 'WI-FI', 'net')}${chip('bt', 'BLUETOOTH', 'bt')}${chip('dnd', 'DND')}</div>`);
  h += sc(i++, `<div class="r dh"><span class="n d">${n}</span><span class="l lab dim">NOTIFICATIONS</span>${n ? `<button ${K('clear', '', 'lb l')}>CLEAR</button>` : ''}</div>`
    + S.notes.slice(0, 3).map(noteRow).join('')
    + (n > 3 ? `<div ${K('go', 'notes', 'r more')}><span class="d">+${n - 3}</span><span class="grow"></span><span class="cv">${ic('chev')}</span></div>` : ''));
  h += sc(i++, `<div class="r ft">${S.tray.map(a => `<button ${K('tray', a, 'ap')} aria-label="${TRAY[a].name}">${gi(TRAY[a].g)}</button>`).join('')}<span class="sp"></span>
    <button ${K('go', 'clip', 'lb l')}>CLIPBOARD</button><a ${K('link', '', 'lb l')} href="../../menu.html">MENU</a><button ${K('go', 'power', 'lb l')}>POWER</button></div>`);
  return h;
}
function pNotes() {
  return ph('NOTIFICATIONS', S.notes.length ? `<button ${K('clear', '', 'lb l')}>CLEAR</button>` : '')
    + sc(0, S.notes.length ? S.notes.map(noteRow).join('') : '<div class="empty"></div>');
}
function pMonth() {
  const { y, m, pick } = S.cal;
  const off = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  let g = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => `<span class="wd l">${d}</span>`).join('');
  const cells = Math.ceil((off + dim) / 7) * 7;
  for (let i = 0; i < cells; i++) {
    const dt = new Date(y, m, 1 - off + i), key = iso(dt), dow = i % 7;
    const cls = 'dy d' + (dt.getMonth() !== m ? ' o' : '') + (dow >= 5 ? ' we' : '') + (key === TODAY ? ' td' : '') + (key === pick ? ' pk' : '') + (TASKS[key] && TASKS[key].length ? ' has' : '');
    g += `<button ${K('day', key, cls)}>${dt.getDate()}</button>`;
  }
  const [py, pm, pd] = pick.split('-').map(Number), pdow = new Date(py, pm - 1, pd).getDay();
  const ts = TASKS[pick] || [];
  const tasks = ts.map((t, i) => `<div ${K('task', i, 'r tk' + (t.d ? ' done' : ''))}><span class="cb${t.d ? ' on' : ''}"></span><span class="n zh">${esc(t.t)}</span></div>`).join('')
    + (S.adding ? `<div class="r tk"><span class="cb"></span><input id="tin" maxlength="40" autocomplete="off"></div>` : `<div ${K('add', '', 'r')}><span class="l lab">+ ADD</span></div>`);
  const tri = d => `<svg viewBox="0 0 14 16"><polygon points="${d < 0 ? '13,1 13,15 1,8' : '1,1 1,15 13,8'}"/></svg>`;
  return `<div class="ph"><button ${K('back', '', 'bk')}>${ic('back')}</button><div class="mh"><button ${K('mon', -1, 'ma')} aria-label="-1">${tri(-1)}</button><span class="h d">${MONTHS[m]}</span><button ${K('mon', 1, 'ma')} aria-label="+1">${tri(1)}</button></div><div class="rt"><span class="v d">${y}</span></div></div>`
    + sc(0, `<div class="cal">${g}</div>`)
    + sc(1, `<div class="r dh"><span class="n d">${DAYS[pdow]} ${pd}</span><span class="t">${MONTHS[pm - 1].slice(0, 3)}</span></div>${tasks}`);
}
let procs = PROCS.slice();
function pProcs() {
  const f = S.pfilter;
  const list = procs.filter(p => S.ptype === 'ALL' || (S.ptype === 'USER') === !!p.u).filter(p => p.n.toLowerCase().includes(f))
    .sort((a, b) => S.psort === 'n' ? a.n.localeCompare(b.n) : b[S.psort] - a[S.psort]);
  const hs = (k, t) => `<button ${K('psort', k, k + ' l' + (S.psort === k ? ' on' : ''))}>${t}</button>`;
  return ph('PROCESSES', (f ? `<span class="flt l">${esc(f)}</span>` : '') + `<span class="v d">${list.length}</span>`)
    + sc(0, `<div class="big"><div class="ro"><span class="l">CPU</span><span class="d">${S.cpu}%</span></div><div class="ro"><span class="l">RAM</span><span class="d">4.6G</span></div><div class="ro"><span class="l">LOAD</span><span class="d">${S.load.toFixed(2)}</span></div><div class="ro"><span class="l">UPTIME</span><span class="d uptime">${uptime()}</span></div></div>`)
    + sc(1, `<div class="cps">${['ALL', 'USER', 'SYSTEM'].map(t => `<button ${K('ptype', t, 'cp l' + (S.ptype === t ? ' on' : ''))}>${t}</button>`).join('')}</div>`)
    + sc(2, `<div class="r ps hdr">${hs('n', 'NAME')}<span class="pid l">PID</span>${hs('c', 'CPU')}${hs('m', 'MEM')}</div>`
      + list.map(p => `<div ${K('pex', p.pid, 'r ps' + (S.pex === p.pid ? ' ex' : ''))}><span class="n">${p.n}</span><span class="pid l">${p.pid}</span><span class="c d">${p.c.toFixed(1)}</span><span class="m d">${fmtM(p.m)}</span><span class="acts"><button ${K('term', p.pid, 'ab l')}>TERM</button><button ${K('kill', p.pid, 'ab l red')}>KILL</button></span></div>`).join(''));
}
function pBattery() {
  return ph('BATTERY')
    + sc(0, `<div class="big"><span class="huge d"${S.low ? ' style="color:var(--red)"' : ''}>${S.bat}%</span><div class="ro"><span class="l">TIME</span><span class="d">${S.low ? '0:52' : '—'}</span></div><div class="ro"><span class="l">HEALTH</span><span class="d">94%</span></div></div>`)
    + sc(1, `<div class="cps">${['POWER SAVER', 'BALANCED', 'PERFORMANCE'].map(t => `<button ${K('pmode', t, 'cp l' + (S.pmode === t ? ' on' : ''))}>${t}</button>`).join('')}</div>`)
    + sc(2, `<div ${K('limit', '', 'r')}><span class="l lab">CHARGE LIMIT 80%</span><span class="tg${S.limit ? ' on' : ''}"></span></div>
      <div class="r kv"><span class="l">CYCLES</span><span class="vv d">212</span></div>
      <div class="r kv"><span class="l">CAPACITY</span><span class="vv d">53.6 / 57.0 WH</span></div>`);
}
function pNet() {
  const rt = `<button ${K('scan', '', 'lb l')}>${S.scanning ? '<span class="spin">SCAN</span>' : 'SCAN'}</button><button ${K('tog', 'wifi', 'tgk')}><span class="tg${S.wifi ? ' on' : ''}"></span></button>`;
  if (!S.wifi) return ph('WI-FI', rt);
  const cur = NETS.find(n => n.s === S.ssid);
  const rows = NETS.filter(n => n.s !== S.ssid).sort((a, b) => b.g - a.g).map(n =>
    `<div ${K('net', n.s, 'r nw')}>${sg(n.g)}<span class="n d">${esc(n.s)}</span>${n.sec ? lockI : ''}<span class="v l">${S.joining === n.s ? '<span class="spin">· · ·</span>' : ''}</span></div>`
    + (S.pwFor === n.s ? `<div class="r pw">${lockI}<input id="pwin" type="password" autocomplete="off"><button ${K('join', n.s, 'lb l')}>JOIN</button></div>` : '')).join('');
  return ph('WI-FI', rt)
    + sc(0, `<div class="cur">${sg(cur ? cur.g : 60)}<span class="n d">${esc(S.ssid)}</span><span class="v l">192.168.31.24</span></div>`)
    + sc(1, rows);
}
function pBt() {
  const rt = `<button ${K('tog', 'bt', 'tgk')}><span class="tg${S.bt ? ' on' : ''}"></span></button>`;
  if (!S.bt) return ph('BLUETOOTH', rt);
  return ph('BLUETOOTH', rt) + sc(0, BTS.map((d, i) => `<div ${K('btc', i, 'r nw bt' + (d.on ? ' on' : ''))}><span class="n d">${d.n}</span><span class="t">${d.busy ? '<span class="spin">· · ·</span>' : ''}</span><span class="v d">${d.on && d.b ? d.b + '%' : ''}</span></div>`).join(''));
}
function pOutput() {
  return ph('OUTPUT')
    + sc(0, SINKS.map(([n, t], i) => `<div ${K('sink', i, 'r mi')}><span class="mk">${i === S.sink ? '<i></i>' : ''}</span><span class="mt">${n}</span><span class="v l">${t}</span></div>`).join(''))
    + sc(1, slRow('vol') + slRow('mic') + slRow('player'));
}
function pWindow() {
  const w = S.win[S.active];
  if (!w) return ph('WORKSPACE ' + S.active);
  const kv = (l, v, ok) => `<div ${K('kv', l, 'r kv' + (ok ? ' ok' : '') + (S.kvc === l ? ' cpd' : ''))}><span class="l">${l}</span><span class="vv">${S.kvc === l ? 'COPIED' : esc(v)}</span></div>`;
  return ph(w.name, `<span class="v l">WORKSPACE ${S.active}</span>`, dn(w.name))
    + sc(0, kv('TITLE', w.title) + kv('APP ID', w.app) + kv('PID', w.pid) + kv('MODE', w.mode, w.mode === 'FLOATING') + kv('SIZE', w.size))
    + sc(1, `<div class="wact"><button ${K('wmode', '', 'hb l')}>${w.mode === 'TILED' ? 'FLOAT' : 'TILE'}</button><button ${K('wfull', '', 'hb l')}>FULLSCREEN</button><button ${K('wrule', '', 'hb l')}>RULE</button><button ${K('wclose', '', 'hb l red')} data-hold>CLOSE</button></div>`);
}
function pTray({ app, path }) {
  const { lvl, title } = trayLevel(app, path);
  return ph(esc(title), "", dn(title)) + sc(0, lvl.map((o, i) => {
    if (o.sep) return '<div class="hr"></div>';
    const mk = o.bt === 1 ? `<span class="cb${o.on ? ' on' : ''}"></span>` : o.bt === 2 && o.on ? '<i></i>' : '';
    const dis = o.dis || o.kids === null;
    const attrs = dis ? 'class="r mi dis"' : K('mi', i, 'r mi' + (DANGER.test(o.t) ? ' red' : ''));
    return `<div ${attrs}><span class="mk">${mk}</span><span class="mt">${esc(o.t)}</span>${o.kids ? `<span class="cv">${ic('chev')}</span>` : ''}</div>`;
  }).join(''));
}
function pPower() {
  const b = (v, i, t, cls = '', hold) => `<button ${K('pw', v, 'hb l' + cls)}${hold ? ' data-hold' : ''}>${ic(i)}<span>${t}</span></button>`;
  return ph('POWER', `<span class="v d uptime">${uptime()}</span>`)
    + sc(0, `<div class="pg3">${b('lock', 'lock', 'LOCK')}${b('sleep', 'sleep', 'SLEEP')}${b('logout', 'logout', 'LOG OUT')}${b('reboot', 'reboot', 'REBOOT', '', 1)}${b('off', 'off', 'SHUT DOWN', ' fillred wide', 1)}</div>`);
}
function pClip() {
  return ph('CLIPBOARD', CLIPS.length ? `<button ${K('clipclr', '', 'lb l')}>CLEAR</button>` : '')
    + sc(0, CLIPS.length ? CLIPS.map((c, i) => `<div ${K('copy', i, 'r cl' + (i === S.copied ? ' ok' : ''))}><span class="n">${esc(c)}</span><span class="v l">${i === S.copied ? 'COPIED' : ''}</span></div>`).join('') : '<div class="empty"></div>');
}
function pRule() {
  const w = S.win[S.active], r = S.rule;
  const row = (k, t) => `<div ${K('rulef', k, 'r')}><span class="l lab">${t}</span><span class="tg${r[k] ? ' on' : ''}"></span></div>`;
  return ph('RULE', `<span class="v l">${esc(w ? w.app : '')}</span>`)
    + sc(0, row('float', 'OPEN FLOATING') + row('full', 'OPEN FULLSCREEN') + row('opacity', 'OPACITY 0.9'))
    + sc(1, `<div class="wact"><button ${K('rulesave', '', 'hb l')}>${r.saved ? 'SAVED' : 'SAVE'}</button></div>`);
}
const BUILD = { rule: pRule, main: pMain, notes: pNotes, month: pMonth, procs: pProcs, battery: pBattery, net: pNet, bt: pBt, output: pOutput, window: pWindow, tray: pTray, power: pPower, clip: pClip };

/* ---------------- navigation ---------------- */
let selKey = null;
const keyOf = el => el.dataset.a + '|' + el.dataset.v;
function build(entry) {
  const pg = document.createElement('div');
  pg.className = 'pg';
  pg.dataset.id = entry.id;
  pg.innerHTML = '<i class="hl"></i>' + BUILD[entry.id](entry.arg || {});
  return pg;
}
function fit(pg) {
  pages.style.height = Math.min(pg.scrollHeight, 780, innerHeight - 70) + 'px';
}
function mount(entry, dir) {
  const old = topPg(), pg = build(entry);
  if (dir) pg.classList.add('anim', dir > 0 ? 'in-r' : 'in-l');
  else if (!old) pg.classList.add('anim');
  pages.appendChild(pg);
  fit(pg);
  if (old) {
    if (dir) {
      old.classList.add(dir > 0 ? 'out-l' : 'out-r');
      later(() => old.remove(), 320);
    } else old.remove();
  }
  if (dir) { reflow(pg); pg.classList.remove('in-r', 'in-l'); }
  selKey = null;
  if (kbd) selectIdx(0, true);
  const inp = $('input', pg); if (inp) inp.focus();
  return pg;
}
function refresh() {
  const old = topPg(); if (!old) return;
  const top = stack[stack.length - 1], st = old.scrollTop;
  const pg = build(top);
  old.replaceWith(pg);
  pg.scrollTop = st;
  fit(pg);
  const el = selKey && $$('[data-a]', pg).find(e => keyOf(e) === selKey);
  if (el) select(el, true); else if (kbd) selectIdx(0, true);
  const inp = $('input', pg); if (inp) inp.focus();
}
function push(id, arg) { stack.push({ id, arg }); mount(stack[stack.length - 1], 1); }
function pop() {
  if (stack.length < 2) return closeSheet();
  stack.pop(); mount(stack[stack.length - 1], -1);
}
function openSheet(page = 'main', arg) {
  hideToast();
  clearTimeout(closeT);
  sheet.classList.remove('closing');
  $$('.pg', pages).forEach(p => p.remove());
  stack = [{ id: 'main' }];
  if (page !== 'main') stack.push({ id: page, arg });
  sheetOpen = true;
  document.body.classList.add('open');
  sheet.classList.add('open');
  mount(stack[stack.length - 1], 0);
}
function closeSheet() {
  if (!sheetOpen) return;
  sheetOpen = false; kbd = false; S.adding = false; S.pwFor = null; S.pex = null; S.pfilter = '';
  document.body.classList.remove('open');
  sheet.classList.remove('open');
  sheet.classList.add('closing');
  closeT = later(() => { sheet.classList.remove('closing'); $$('.pg', pages).forEach(p => p.remove()); }, 360);
}

/* highlight */
function place(el, jump) {
  const pg = el.closest('.pg'), hl = $('.hl', pg);
  const a = el.getBoundingClientRect(), b = pg.getBoundingClientRect();
  const x = a.left - b.left, y = a.top - b.top + pg.scrollTop;
  hl.classList.toggle('jump', !!jump || !hl.classList.contains('on'));
  hl.style.transform = `translate(${x}px, ${y}px)`;
  hl.style.width = a.width + 'px'; hl.style.height = a.height + 'px';
  reflow(hl);
  hl.classList.add('on');
  hl.classList.remove('jump');
}
function select(el, jump) {
  const pg = topPg(); if (!pg || !el) return;
  $$('.k.sel', pg).forEach(e => e !== el && e.classList.remove('sel'));
  el.classList.add('sel');
  selKey = keyOf(el);
  place(el, jump);
}
function unselect() {
  const pg = topPg(); if (!pg) return;
  $$('.k.sel', pg).forEach(e => e.classList.remove('sel'));
  $('.hl', pg).classList.remove('on');
  selKey = null;
}
const items = () => { const pg = topPg(); return pg ? $$('[data-a]', pg).filter(e => e.offsetParent && !e.matches('.ps:not(.ex) .ab, .ps.hdr *')) : []; };
function selectIdx(i, jump) {
  const list = items(); if (!list.length) return;
  const el = list[clamp(i, 0, list.length - 1)];
  select(el, jump);
  const pg = topPg(), a = el.getBoundingClientRect(), b = pg.getBoundingClientRect();
  if (a.top < b.top) pg.scrollTop -= b.top - a.top + 8;
  else if (a.bottom > b.bottom) pg.scrollTop += a.bottom - b.bottom + 8;
  place(el, true);
}
function moveSel(d) {
  const list = items(), cur = $('.k.sel', topPg());
  const i = cur ? list.indexOf(cur) : -1;
  selectIdx(i < 0 ? 0 : (i + d + list.length) % list.length);
}
pages.addEventListener('pointerover', e => {
  const el = e.target.closest('[data-a]');
  if (el && el.closest('.pg') === topPg()) { kbd = false; select(el); }
});
pages.addEventListener('pointerleave', () => { if (!kbd) unselect(); });
pages.addEventListener('scroll', () => { const el = $('.k.sel', topPg() || pages); if (el) place(el, true); }, true);

/* ---------------- actions ---------------- */
const curArg = () => stack[stack.length - 1].arg || {};
function dismiss(id) {
  const row = $$('.nt', topPg()).find(r => r.dataset.v == id);
  S.notes = S.notes.filter(n => n.id != id);
  renderMark();
  if (row && !STATIC) { row.classList.add('gone'); unselect(); setTimeout(refresh, 220); } else refresh();
}
function trayPick(i) {
  const { app, path } = curArg(), { lvl, parent } = trayLevel(app, path), o = lvl[i];
  if (!o || o.sep || o.dis) return;
  if (o.kids) return push('tray', { app, path: [...path, i] });
  if (o.kids === null) return;
  if (o.flip) { [o.t, o.flip] = [o.flip, o.t]; return refresh(); }
  if (o.bt) {
    if (o.bt === 2 || (parent && parent.x)) lvl.forEach(x => { if (x.bt) x.on = x === o; });
    else o.on = !o.on;
    if (parent && parent.follow) parent.t = typeof parent.follow === 'function' ? parent.follow(o.t) : o.t;
    return refresh();
  }
  if (parent && parent.follow) { parent.t = typeof parent.follow === 'function' ? parent.follow(o.t) : o.t; return pop(); }
  if (o.stay) {
    lvl.forEach(x => { if (x.bt && / \| /.test(x.t) && !/T\/O|-ms/.test(x.t)) x.t = x.t.replace(/\d+ms/, () => (80 + Math.floor(Math.random() * 90)) + 'ms'); });
    return refresh();
  }
  if (o.go) setWs(o.go);
  closeSheet();
}
function lockScreen() { closeSheet(); later(() => fade.classList.add('on'), 200); }
fade.addEventListener('click', () => fade.classList.remove('on'));
function setSl(k, v) {
  S[k] = clamp(Math.round(v), k === 'bri' ? 1 : 0, 100);
  if (k === 'vol' && S.muted && S.vol > 0) S.muted = false;
  if (k === 'vol' && S.vol === 0) S.muted = true;
  renderStates(); paintSliders();
}
function act(el) {
  const a = el.dataset.a, v = el.dataset.v, top = stack[stack.length - 1];
  switch (a) {
    case 'back': return pop();
    case 'go': {
      const [id, sub] = v.split(':');
      if (id === 'procs') { S.psort = sub || 'c'; S.pfilter = ''; S.pex = null; }
      if (id === 'month') S.cal = { y: 2026, m: 9, pick: TODAY };
      return push(id);
    }
    case 'link': closeSheet(); return location.href = el.getAttribute('href');
    case 'sl': if (v === 'vol') { S.muted = !S.muted; renderStates(); paintSliders(); } if (v === 'mic') { S.micMuted = !S.micMuted; paintSliders(); } return;
    case 'prev': case 'next': S.track = (S.track + (a === 'next' ? 1 : TRACKS.length - 1)) % TRACKS.length; S.pos = 0; S.playing = true; return refresh();
    case 'play': S.playing = !S.playing; return refresh();
    case 'tog': S[v] = !S[v]; renderStates(); return refresh();
    case 'note': case 'dis': return dismiss(v);
    case 'clear': S.notes = []; renderMark(); return refresh();
    case 'tray': return push('tray', { app: v, path: [] });
    case 'mi': return trayPick(+v);
    case 'day': {
      const [y, m] = v.split('-').map(Number);
      S.cal.pick = v; S.adding = false;
      if (m - 1 !== S.cal.m) { S.cal.y = y; S.cal.m = m - 1; }
      return refresh();
    }
    case 'mon': {
      const d = new Date(S.cal.y, S.cal.m + +v, 1);
      S.cal.y = d.getFullYear(); S.cal.m = d.getMonth();
      S.cal.pick = iso(d.getMonth() === 9 && d.getFullYear() === 2026 ? new Date(2026, 9, 30) : d);
      S.adding = false; return refresh();
    }
    case 'task': { const t = TASKS[S.cal.pick][+v]; t.d = !t.d; return refresh(); }
    case 'add': S.adding = true; return refresh();
    case 'psort': S.psort = v; return refresh();
    case 'ptype': S.ptype = v; return refresh();
    case 'pex': S.pex = S.pex == v ? null : +v; return refresh();
    case 'term': case 'kill': procs = procs.filter(p => p.pid != v); S.pex = null; return refresh();
    case 'pmode': S.pmode = v; return refresh();
    case 'limit': S.limit = !S.limit; return refresh();
    case 'scan':
      if (S.scanning) return;
      S.scanning = true; refresh();
      return later(() => { S.scanning = false; NETS.forEach(n => n.g = clamp(n.g + Math.round(Math.random() * 12 - 6), 8, 96)); if (sheetOpen && top.id === 'net') refresh(); }, 1400);
    case 'net': {
      const n = NETS.find(x => x.s === v);
      if (n.sec) { S.pwFor = S.pwFor === v ? null : v; return refresh(); }
      return join(v);
    }
    case 'join': return join(v);
    case 'btc': {
      const d = BTS[+v]; if (d.busy) return;
      d.busy = true; refresh();
      return later(() => { d.busy = false; d.on = !d.on; if (!d.b) d.b = 72; if (sheetOpen && stack[stack.length - 1].id === 'bt') refresh(); }, 900);
    }
    case 'sink': S.sink = +v; return refresh();
    case 'wmode': { const w = S.win[S.active]; w.mode = w.mode === 'TILED' ? 'FLOATING' : 'TILED'; return refresh(); }
    case 'wfull': { const w = S.win[S.active]; w.size = w.size === '1706 × 960' ? '1674 × 902' : '1706 × 960'; return refresh(); }
    case 'wrule': return push('rule');
    case 'kv': S.kvc = v; refresh(); return later(() => { S.kvc = null; if (sheetOpen && stack[stack.length - 1].id === 'window') refresh(); }, 900);
    case 'rulef': { const r = S.rule; r[v] = !r[v]; r.saved = false; return refresh(); }
    case 'rulesave': S.rule.saved = true; refresh(); return later(pop, 450);
    case 'wclose': delete S.win[S.active]; renderWs(); aimWedge(true); stack = [{ id: 'main' }]; return mount(stack[0], -1);
    case 'pw':
      if (v === 'reboot' || v === 'off' || v === 'lock' || v === 'sleep' || v === 'logout') return lockScreen();
      return;
    case 'clipclr': CLIPS.length = 0; S.copied = -1; return refresh();
    case 'copy': S.copied = +v; refresh(); return later(closeSheet, 450);
  }
}
function join(s) {
  const inp = $('#pwin');
  if (inp && !inp.value) { inp.focus(); return; }
  S.pwFor = null; S.joining = s; refresh();
  later(() => { S.joining = null; S.ssid = s; S.wifi = true; if (sheetOpen && stack[stack.length - 1].id === 'net') refresh(); }, 1300);
}
function addTask(txt) {
  txt = txt.trim();
  S.adding = false;
  if (txt) (TASKS[S.cal.pick] = TASKS[S.cal.pick] || []).push({ t: txt, d: false });
  refresh();
}

/* hold-to-confirm */
let holdT = 0, holdEl = null, swallow = false;
pages.addEventListener('pointerdown', e => {
  const tr = e.target.closest('.tr');
  if (tr) {
    const k = tr.dataset.k, r = tr.getBoundingClientRect();
    const setX = x => setSl(k, (x - r.left) / r.width * 100);
    tr.classList.add('drag'); setX(e.clientX);
    const mv = ev => setX(ev.clientX);
    const up = () => { tr.classList.remove('drag'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
    swallow = true; e.preventDefault(); return;
  }
  const h = e.target.closest('[data-hold]');
  if (!h) return;
  holdEl = h; h.classList.add('hold');
  holdT = setTimeout(() => { h.classList.remove('hold'); holdEl = null; swallow = true; act(h); }, STATIC ? 0 : 500);
});
const cancelHold = () => { if (holdEl) { clearTimeout(holdT); holdEl.classList.remove('hold'); holdEl = null; swallow = true; } };
addEventListener('pointerup', cancelHold);
pages.addEventListener('click', e => {
  if (swallow) { swallow = false; return; }
  const el = e.target.closest('[data-a]');
  if (!el || el.closest('.pg') !== topPg()) return;
  if (el.hasAttribute('data-hold')) return;
  e.preventDefault(); e.stopPropagation();
  act(el);
});
pages.addEventListener('keydown', e => {
  if (e.target.id === 'tin') {
    if (e.key === 'Enter') { e.preventDefault(); addTask(e.target.value); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); S.adding = false; refresh(); }
    e.stopPropagation();
  } else if (e.target.id === 'pwin') {
    if (e.key === 'Enter') { e.preventDefault(); join(S.pwFor); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); S.pwFor = null; refresh(); }
    e.stopPropagation();
  }
});

/* triggers */
clock.addEventListener('click', () => sheetOpen ? closeSheet() : openSheet());
mark.addEventListener('click', () => sheetOpen && stack[stack.length - 1].id === 'notes' ? closeSheet() : openSheet('notes'));
$('#lowbat').addEventListener('click', () => openSheet('battery'));
$('#muted').addEventListener('click', () => openSheet('output'));
document.addEventListener('pointerdown', e => {
  if (!sheetOpen) return;
  if (e.target.closest('#sheet, #center, #ws')) return;
  closeSheet();
});

/* keys */
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (fade.classList.contains('on')) { fade.classList.remove('on'); return; }
  const k = e.key;
  if (!sheetOpen) {
    if (/^[1-5]$/.test(k)) return setWs(+k, Math.sign(S.order.indexOf(+k) - S.order.indexOf(S.active)));
    if (k === 't' || k === 'T') return toggleTheme();
    if (k === 'Enter' || k === ' ') { e.preventDefault(); return openSheet(); }
    if (k === 'Escape') return hideToast();
    return;
  }
  const top = stack[stack.length - 1];
  if (k === 'Escape') { e.preventDefault(); return closeSheet(); }
  if (k === 'Backspace') {
    e.preventDefault();
    if (top.id === 'procs' && S.pfilter) { S.pfilter = S.pfilter.slice(0, -1); return refresh(); }
    return pop();
  }
  if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Tab') { e.preventDefault(); kbd = true; return moveSel(k === 'ArrowUp' || (k === 'Tab' && e.shiftKey) ? -1 : 1); }
  const cur = $('.k.sel', topPg());
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    e.preventDefault(); kbd = true;
    const d = k === 'ArrowRight' ? 1 : -1;
    if (cur && cur.dataset.a === 'sl') return setSl(cur.dataset.v, S[cur.dataset.v] + d * 5);
    if (!cur && d < 0) return pop();
    return moveSel(d);
  }
  if (k === 'Enter' || k === ' ') { e.preventDefault(); if (cur) { kbd = true; act(cur); } return; }
  if (top.id === 'procs' && /^[a-z0-9-]$/i.test(k)) { S.pfilter += k.toLowerCase(); S.pex = null; return refresh(); }
  if (k === 't' || k === 'T') toggleTheme();
});
function toggleTheme() { root.dataset.theme = root.dataset.theme === 'lavender' ? 'p3' : 'lavender'; }

/* timers */
if (!STATIC) {
  let pi = 0;
  const next = () => setTimeout(() => { arrive(POOL[pi++ % POOL.length]); next(); }, pi ? 38000 : 9000);
  next();
  setInterval(() => {
    if (!S.playing) return;
    const tr = TRACKS[S.track];
    if (++S.pos >= tr.len) { S.track = (S.track + 1) % TRACKS.length; S.pos = 0; if (sheetOpen && stack[stack.length - 1].id === 'main') refresh(); return; }
    const bar = $('.pg .pr i', pages); if (bar) bar.style.width = (S.pos / tr.len * 100).toFixed(2) + '%';
  }, 1000);
  setInterval(() => {
    S.cpu = clamp(S.cpu + Math.round(Math.random() * 4 - 2), 2, 14);
    $$('.cpu', pages).forEach(e => e.textContent = S.cpu + '%');
  }, 2000);
}

/* init */
if (q.has('low')) { S.low = true; S.bat = 18; }
if (q.has('muted')) S.muted = true;
renderWs(); aimWedge(true); renderMark(); renderStates();
if (q.get('ws')) setWs(+q.get('ws'));
if (q.get('open')) {
  const [id, a] = q.get('open').split(':');
  if (id === 'tray') openSheet('tray', { app: a || 'clash', path: [] });
  else if (BUILD[id]) openSheet(id);
  if (q.has('kbd')) { kbd = true; selectIdx(+q.get('kbd') || 0, true); }
}
})();
