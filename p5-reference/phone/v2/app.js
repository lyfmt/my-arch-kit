// P-Phone v2 静态原型：主页 = APPS；左 STATUS（性能），右 CONTROL / CALENDAR
// 应用两种状态：data-open → 机内二级界面；data-launch → 打开态（水位盖满屏幕后手机收起）
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const q = new URLSearchParams(location.search);
const STATIC = q.has('static');

// ---------- 舞台缩放 ----------
const stage = $('#stage');
function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px,${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fit); fit();
if (STATIC) stage.classList.add('static');
if (q.get('theme')) document.documentElement.dataset.theme = q.get('theme');

// ---------- 种子随机 ----------
function rng(seed) {
  let s = 2166136261;
  for (const c of String(seed)) s = Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- 图标（24×24 线框，.f 实心） ----------
const GLYPHS = {
  music:  '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  chat:   '<path d="M4 4h16v11H9l-5 4z"/>',
  wifi:   '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle class="f" cx="12" cy="19.5" r="1.6"/>',
  bt:     '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
  kanban: '<path d="M3 4h5v16H3zM10 4h5v11h-5zM17 4h4v7h-4z"/>',
  term:   '<path d="M2.5 4h19v16h-19z"/><path d="M6.5 9l3 3-3 3M12 15h5"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  globe:  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  shot:   '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  ext:    '<path d="M8 16 17 7M9 7h8v8"/>',
  chev:   '<path d="M9 5l7 7-7 7"/>',
  back:   '<path d="M15 5l-7 7 7 7"/>',
  cloud:  '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.3 1.5A3.3 3.3 0 0 0 7 18z"/>',
  dnd:    '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  bulb:   '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  vol:    '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  sun:    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  out:    '<path d="M6 2.5h12v19H6z"/><circle cx="12" cy="14" r="3.5"/><circle class="f" cx="12" cy="6.5" r="1.2"/>',
  mic:    '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  lock:   '<path d="M5 11h14v10H5z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  exit:   '<path d="M10 4H4v16h6M9 12h11M16 8l4 4-4 4"/>',
  reboot: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  power:  '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  play:   '<path class="f" d="M7 4l13 8-13 8z"/>',
  pause:  '<path class="f" d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  prev:   '<path class="f" d="M18 5v14l-9-7zM6 5h2.5v14H6z"/>',
  next:   '<path class="f" d="M6 5v14l9-7zM15.5 5H18v14h-2.5z"/>',
  head:   '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><path d="M3 14h4v7H3zM17 14h4v7h-4z"/>',
  kbd:    '<path d="M2 6h20v12H2z"/><path d="M6 10h1M10 10h1M14 10h1M18 10h1M7 14h10"/>',
  mouse:  '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v3"/>',
  phone:  '<path d="M7 2.5h10v19H7z"/><path d="M11 18.5h2"/>',
  plus:   '<path d="M12 5v14M5 12h14"/>',
};
const SIZE = { pl: 22, tile: 22, cbtn: 26, big: 30, back: 18, pbtn: 20, kind: 14, sbar: 14, hd: 14 };
function glyph(name, size, sw = 2) {
  return `<svg class="gsvg" width="${size}" height="${size}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name]}</g></svg>`;
}
$$('[data-g]').forEach(el => {
  const size = el.classList.contains('big') ? SIZE.big
    : el.classList.contains('cbtn') ? SIZE.cbtn
    : el.classList.contains('pl-k') ? SIZE.kind
    : el.classList.contains('back') ? SIZE.back
    : el.closest('.sbar, .hd, .sl-top, .row') ? (el.closest('.row') ? 18 : SIZE.sbar)
    : el.closest('.pbtn') ? SIZE.pbtn
    : el.closest('.pl-m') ? 14
    : SIZE.pl;
  el.innerHTML = glyph(el.dataset.g, size, size <= 14 ? 2.4 : 2);
});

// ---------- 信号格 ----------
$$('.bars').forEach(el => {
  const n = +el.dataset.n;
  el.innerHTML = [5, 8, 11, 14].map((h, i) => `<i class="${i < n ? '' : 'off'}" style="height:${h}px"></i>`).join('');
});

// ---------- 主页列表的水流缩进：沿一条正弦排开 ----------
$$('.plist:not(.sm) .pl').forEach((el, i) => el.style.setProperty('--x', `${Math.round(10 + 14 * Math.sin(i * .7 + .3))}px`));

// ---------- 波浪路径（宽 2W，平移 W 可无缝循环） ----------
function wavePath(W, A, L, H) {
  let d = `M0 ${H}`;
  for (let x = 0; x <= W * 2; x += 2) d += `L${x} ${(A + A * Math.sin(2 * Math.PI * x / L)).toFixed(2)}`;
  return d + `L${W * 2} ${H}Z`;
}
$('.lw-wave path').setAttribute('d', wavePath(380, 8, 190, 24));

// ---------- 气泡 ----------
{
  const r = rng('bubbles'), box = $('.bg-bubbles');
  for (let i = 0; i < 12; i++) {
    const b = document.createElement('i'), s = 3 + r() * 7;
    Object.assign(b.style, {
      left: `${10 + r() * 360}px`, width: `${s}px`, height: `${s}px`,
      animationDuration: `${9 + r() * 10}s`, animationDelay: `${-r() * 18}s`,
    });
    if (STATIC) b.style.transform = `translateY(${-80 - r() * 700}px)`;
    box.appendChild(b);
  }
}

// ---------- 月相（P3 的标志：日期旁的月亮） ----------
const NOW = new Date(2026, 9, 18, 20, 46);
const SYN = 29.530588853, REF_NEW = Date.UTC(2000, 0, 6, 18, 14);
const phaseAt = d => (((d - REF_NEW) / 864e5 / SYN) % 1 + 1) % 1;
function moonSVG(svg, p) {
  const r = 10, k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r;
  const waxing = p < .5;
  const sweep2 = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
  const lit = `M0 ${-r}A${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r}A${rx.toFixed(2)} ${r} 0 0 ${sweep2} 0 ${-r}Z`;
  svg.innerHTML = `<circle class="moon-dark" r="${r}"/><path class="moon-lit" d="${lit}"/>`;
}
function phaseName(p) {
  const N = [[.03, 'NEW MOON'], [.22, 'WAXING CRESCENT'], [.28, 'FIRST QUARTER'], [.47, 'WAXING GIBBOUS'],
             [.53, 'FULL MOON'], [.72, 'WANING GIBBOUS'], [.78, 'LAST QUARTER'], [.97, 'WANING CRESCENT'], [1, 'NEW MOON']];
  return N.find(([t]) => p < t)[1];
}
const P = phaseAt(NOW);
moonSVG($('#moon'), P);
moonSVG($('#moonFull'), .5);
$('#moonName').textContent = phaseName(P);
const fullDate = new Date(+NOW + ((.5 - P + 1) % 1) * SYN * 864e5);
$('#moonNext').textContent = `FULL MOON ${fullDate.getMonth() + 1}/${fullDate.getDate()}`;

// ---------- 日历 ----------
{
  const y = NOW.getFullYear(), m = NOW.getMonth();
  const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const HAS = [14, 18, 20, 23, 27, 31];
  let h = '<span></span>'.repeat(first);
  for (let d = 1; d <= days; d++) {
    const c = [d < NOW.getDate() && 'past', d === NOW.getDate() && 'today', HAS.includes(d) && 'has',
               fullDate.getMonth() === m && d === fullDate.getDate() && 'full'].filter(Boolean).join(' ');
    h += `<span class="${c}">${d}</span>`;
  }
  $('#calGrid').innerHTML = h;
}

// ---------- 性能：水箱 + 折线（每秒小幅波动，?static 冻结） ----------
const perf = { cpu: 34, mem: 61, gpu: 12, cpuT: 52, gpuT: 47, hist: [] };
{
  const r = rng('hist'); let v = 30;
  for (let i = 0; i < 60; i++) { v = Math.max(6, Math.min(92, v + (r() - .5) * 18 + (i > 44 && i < 50 ? 9 : 0))); perf.hist.push(v); }
  perf.hist[59] = perf.cpu;
}
const TANKS = [
  { k: 'cpu', label: 'CPU', sub: () => `${perf.cpuT}°C` },
  { k: 'mem', label: 'MEMORY', sub: () => `${(perf.mem * .32).toFixed(1)} / 32G` },
  { k: 'gpu', label: 'GPU', sub: () => `${perf.gpuT}°C` },
];
const TH = 196;
$('#tanks').innerHTML = TANKS.map(t => `
  <div class="tank-wrap" data-k="${t.k}">
    <div class="tank">
      <div class="tk-num d"><span></span><small>%</small></div>
      <svg class="tk-wave back" viewBox="0 0 208 10" preserveAspectRatio="none"><path d="${wavePath(104, 2.5, 52, 10)}"/></svg>
      <svg class="tk-wave" viewBox="0 0 208 10" preserveAspectRatio="none"><path d="${wavePath(104, 3, 104 / 3, 10)}"/></svg>
      <div class="tk-water"><div class="tk-num d"><span></span><small>%</small></div></div>
    </div>
    <div class="tk-lab l"><b>${t.label}</b><span></span></div>
  </div>`).join('');
function renderPerf() {
  TANKS.forEach(t => {
    const w = $(`.tank-wrap[data-k="${t.k}"]`), v = perf[t.k], h = Math.round(v / 100 * TH);
    $$('.tk-num span', w).forEach(s => s.textContent = v);
    $('.tk-water', w).style.height = `${h}px`;
    // 水中那份数字反色：与上方数字对齐，被水面裁切
    $('.tk-water .tk-num', w).style.top = `${12 - (TH - h)}px`;
    $$('.tk-wave', w).forEach(s => s.style.bottom = `${h - 1}px`);
    $('.tk-lab span', w).textContent = t.sub();
  });
  const W = 340, H = 56, n = perf.hist.length;
  const pts = perf.hist.map((v, i) => `${(i / (n - 1) * W).toFixed(1)} ${(H - 2 - v / 100 * (H - 4)).toFixed(1)}`);
  $('.sp-line').setAttribute('d', 'M' + pts.join('L'));
  $('.sp-area').setAttribute('d', `M0 ${H}L${pts.join('L')}L${W} ${H}Z`);
  $('#load').textContent = `LOAD ${(perf.cpu / 26).toFixed(2)} 0.98 0.87`;
  $('#net').innerHTML = `↓ ${(1.6 + perf.cpu / 40).toFixed(1)} <small>MB/S</small>&nbsp; ↑ 120 <small>KB/S</small>`;
  $('#fans').innerHTML = `${1000 + perf.cpu * 6} <small>RPM</small>`;
}
renderPerf();
if (!STATIC) setInterval(() => {
  const step = (v, a, lo, hi) => Math.round(Math.max(lo, Math.min(hi, v + (Math.random() - .5) * a)));
  perf.cpu = step(perf.cpu, 14, 8, 88); perf.gpu = step(perf.gpu, 8, 3, 70); perf.mem = step(perf.mem, 2, 55, 70);
  perf.cpuT = 44 + Math.round(perf.cpu / 5); perf.gpuT = 40 + Math.round(perf.gpu / 4);
  perf.hist.push(perf.cpu); perf.hist.shift();
  renderPerf();
}, 1200);

// ---------- 滑条 ----------
function setSlider(el, v) {
  v = Math.max(0, Math.min(100, Math.round(v)));
  el.dataset.v = v;
  $('i', el).style.width = `${v}%`;
  $('.sl-val', el).textContent = v;
}
$$('.slider').forEach(el => {
  setSlider(el, +el.dataset.v);
  $('.sl-track', el).addEventListener('pointerdown', e => {
    const tr = e.currentTarget, rect = tr.getBoundingClientRect();
    const set = ev => setSlider(el, (ev.clientX - rect.left) / rect.width * 100);
    set(e); tr.setPointerCapture(e.pointerId);
    tr.onpointermove = set; tr.onpointerup = () => { tr.onpointermove = null; };
  });
});

// ---------- 页面 / 页签 ----------
const screen = $('#screen');
const pages = $$('.page');
const HOME = 1;
let cur = HOME, sub = null;
const tabs = $('.tabs');
tabs.innerHTML = pages.map((p, i) => `<span class="tab l" data-i="${i}">${p.dataset.name}<svg width="28" height="6" viewBox="0 0 28 6"><path d="${'M0 3' + [...Array(15)].map((_, j) => `L${j * 2} ${(3 + 2 * Math.sin(j * 2 * Math.PI / 7)).toFixed(2)}`).join('')}"/></svg></span>`).join('');
tabs.addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) { closeSub(); goPage(+t.dataset.i); } });

function goPage(i) {
  cur = Math.max(0, Math.min(pages.length - 1, i));
  $('.track').style.transform = `translateX(${-cur * 380}px)`;
  pages.forEach((p, j) => p.classList.toggle('cur', j === cur));
  $$('.tab').forEach((t, j) => t.classList.toggle('cur', j === cur));
  // 背景视差：比内容慢，营造水体纵深
  const off = (HOME - cur) * 26;
  $('.bg-base').style.transform = `translateX(${off * .5}px)`;
  $('.bg-caustic').style.transform = `translateX(${off}px)`;
  $('.bg-rays').style.transform = `translateX(${off * 1.4}px)`;
  const scope = pages[cur];
  if (!$('.nav.sel', scope)) select($('.nav', scope));
  renderHints();
}

// ---------- 选中 ----------
const scopeEl = () => sub || pages[cur];
function select(el) {
  if (!el) return;
  $$('.nav.sel', scopeEl()).forEach(s => s.classList.remove('sel'));
  el.classList.add('sel');
  renderHints();
}
function move(d) {
  const items = $$('.nav', scopeEl());
  if (!items.length) return;
  const i = items.indexOf($('.nav.sel', scopeEl()));
  select(items[Math.max(0, Math.min(items.length - 1, i + d))]);
}
function renderHints() {
  const s = $('.nav.sel', scopeEl());
  const what = !s ? '' : s.dataset.open ? 'OPEN' : s.dataset.launch ? 'LAUNCH' : s.matches('.slider') ? '' : s.matches('[data-toggle]') ? 'TOGGLE' : 'SELECT';
  const lr = s && s.matches('.slider') ? '<kbd>← →</kbd>ADJUST' : sub ? '' : '<kbd>← →</kbd>PAGE';
  $('.hints').innerHTML = `${lr}<kbd>↑ ↓</kbd>MOVE${what ? `<kbd>↵</kbd>${what}` : ''}<kbd>ESC</kbd>${sub ? 'BACK' : 'CLOSE'}`;
}

// ---------- 二级界面：落水波纹 + 内容上浮 ----------
function ripple(from) {
  const sr = screen.getBoundingClientRect(), s = sr.width / screen.offsetWidth;
  const r = from ? from.getBoundingClientRect() : { left: sr.left + sr.width / 2, top: sr.top + sr.height / 2, width: 0, height: 0 };
  const x = (r.left + Math.min(r.width, 120) / 2 - sr.left) / s, y = (r.top + r.height / 2 - sr.top) / s;
  for (const c of ['r1', 'r2']) {
    const el = document.createElement('i');
    el.className = `ripple ${c}`; el.style.left = `${x}px`; el.style.top = `${y}px`;
    screen.appendChild(el); setTimeout(() => el.remove(), 900);
  }
}
function openSub(name, from) {
  const el = $(`#sub-${name}`);
  if (!el) return;
  closeSub(true);
  if (!STATIC) ripple(from && $('.pl-w', from) || from);
  sub = el; el.classList.add('open'); screen.classList.add('sub-open');
  if (!$('.nav.sel', el)) select($('.nav', el)); else renderHints();
}
function closeSub(silent) {
  if (!sub) return;
  sub.classList.remove('open'); sub = null; screen.classList.remove('sub-open');
  if (!silent) renderHints();
}

// ---------- 打开态 ----------
const LAUNCH = {
  kanban: ['KANBAN', 'OVERLAY · QS -C KANBAN', 'kanban'], terminal: ['TERMINAL', 'FOOT · NEW WINDOW', 'term'],
  files: ['FILES', 'NAUTILUS · ~/', 'folder'], browser: ['BROWSER', 'FIREFOX · FOCUS EXISTING', 'globe'],
  screenshot: ['SCREENSHOT', 'DRAG TO SELECT A REGION', 'shot'],
  lock: ['LOCK', 'P5LOCK · SESSION LOCKED', 'lock'], sleep: ['SLEEP', 'SUSPEND TO RAM', 'dnd'], logout: ['LOG OUT', 'NIRI · QUIT SESSION', 'exit'],
  reboot: ['REBOOT', 'SYSTEMCTL REBOOT', 'reboot'], off: ['POWER OFF', 'SYSTEMCTL POWEROFF', 'power'],
};
const lw = $('#launch');
let lwTimer = [];
function launch(name) {
  const [title, hint] = LAUNCH[name];
  $('.lw-name', lw).textContent = title;
  $('.lw-k', lw).textContent = ['lock', 'sleep', 'logout', 'reboot', 'off'].includes(name) ? 'SESSION' : 'OPENING';
  $('.lw-hint', lw).textContent = hint;
  $('.lw-g', lw).innerHTML = glyph(LAUNCH[name][2], 40, 2.2);
  lw.classList.remove('on'); void lw.offsetWidth; lw.classList.add('on');
  if (STATIC) return;
  lwTimer.forEach(clearTimeout);
  // 原型里收起后再弹回来，方便反复看
  lwTimer = [
    setTimeout(() => $('#phone').classList.add('dismiss'), 1300),
    setTimeout(() => { lw.classList.remove('on'); closeSub(); closeSheet(); goPage(HOME); }, 1700),
    setTimeout(() => $('#phone').classList.remove('dismiss'), 2300),
  ];
}

// ---------- 危险操作：长按确认 ----------
const sheet = $('#sheet'), hold = $('.sh-hold');
let sheetAction = null, holdTimer = 0;
function openSheet(action) {
  sheetAction = action;
  $('.sh-title').textContent = action === 'off' ? 'POWER OFF?' : 'REBOOT?';
  sheet.classList.add('open');
}
function closeSheet() { sheet.classList.remove('open'); sheetAction = null; holdEnd(); }
function holdStart() {
  if (hold.classList.contains('hold')) return;
  hold.classList.add('hold');
  holdTimer = setTimeout(() => { const a = sheetAction; closeSheet(); launch(a); }, 1000);
}
function holdEnd() { hold.classList.remove('hold'); clearTimeout(holdTimer); }
hold.addEventListener('pointerdown', holdStart);
addEventListener('pointerup', holdEnd);
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });

// ---------- 激活 ----------
function activate(el) {
  if (!el) return;
  if (el.dataset.open) return openSub(el.dataset.open, el);
  if (el.dataset.launch) return launch(el.dataset.launch);
  if (el.dataset.power) return ['off', 'reboot'].includes(el.dataset.power) ? openSheet(el.dataset.power) : launch(el.dataset.power);
  if (el.hasAttribute('data-toggle')) {
    el.classList.toggle('on');
    $('small', el).textContent = el.classList.contains('on') ? el.dataset.on : 'OFF';
  }
  if (el.matches('.cbtn.big')) {
    const playing = el.dataset.g === 'pause';
    el.dataset.g = playing ? 'play' : 'pause';
    el.innerHTML = glyph(el.dataset.g, SIZE.big);
  }
}
$$('.nav').forEach(el => {
  el.addEventListener('mouseenter', () => { if (scopeEl().contains(el)) select(el); });
  el.addEventListener('click', e => { if (!e.target.closest('.sl-track')) activate(el); });
});
$$('.back').forEach(b => b.addEventListener('click', () => closeSub()));
$$('.sw').forEach(s => s.addEventListener('click', () => s.classList.toggle('on')));

addEventListener('keydown', e => {
  if (lw.classList.contains('on')) return;
  if (sheet.classList.contains('open')) {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Enter') holdStart();
    return;
  }
  const s = $('.nav.sel', scopeEl());
  switch (e.key) {
    case 'Escape': return closeSub();
    case 'ArrowUp': e.preventDefault(); return move(-1);
    case 'ArrowDown': e.preventDefault(); return move(1);
    case 'ArrowLeft': case 'ArrowRight': {
      const d = e.key === 'ArrowLeft' ? -1 : 1;
      if (s && s.matches('.slider')) return setSlider(s, +s.dataset.v + d * 5);
      if (!sub) goPage(cur + d);
      return;
    }
    case 'Enter': return activate(s);
    case 't': case 'T': {
      const r = document.documentElement;
      r.dataset.theme = r.dataset.theme === 'lavender' ? 'p3' : 'lavender';
    }
  }
});
addEventListener('keyup', e => { if (e.key === 'Enter') holdEnd(); });

// ---------- 初始状态（?page= / ?app= / ?sheet= / ?sel= 方便截图） ----------
goPage(q.has('page') ? +q.get('page') : HOME);
if (q.has('sel')) select($$('.nav', pages[cur])[+q.get('sel')]);
const app = q.get('app');
if (app) LAUNCH[app] ? launch(app) : openSub(app, $(`[data-open="${app}"]`));
if (q.get('sheet')) openSheet(q.get('sheet'));
