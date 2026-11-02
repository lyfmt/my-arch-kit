// P-Phone 静态原型：贴纸图标 / 拼贴字 / 星芒全部由种子随机生成，刷新不变
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';

// ---------- 舞台缩放 ----------
const stage = $('#stage');
function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px,${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fit); fit();

// ---------- 种子随机 ----------
function rng(seed) {
  let s = 2166136261;
  for (const c of String(seed)) s = Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- 图标字形（24×24，描边用 currentColor，.f 为实心） ----------
const GLYPHS = {
  wifi:   '<path d="M1.5 9Q12-.5 22.5 9M5.2 12.8Q12 6.8 18.8 12.8M8.8 16.4Q12 13.6 15.2 16.4"/><circle class="f" cx="12" cy="20" r="2.2"/>',
  bt:     '<path d="M6.5 7.5 17 16.5 12 21V3l5 4.5L6.5 16.5"/>',
  chat:   '<path class="f" d="M2 3.5 22 2.5 21 15.5H11.5L5.5 21V15.5H3Z"/><path class="h" d="M6.5 8h11M6.5 11.5h7"/>',
  kanban: '<path d="M5 5h14v16H5z"/><path class="f" d="M8.5 2.5h7v4h-7z"/><path d="M8 11h8M8 14.5h8M8 18h5"/>',
  tray:   '<path class="f" d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3z"/><path d="M14 17h6M17 14v6"/>',
  shot:   '<path class="f" d="M2.5 7.5h4l2-3.5h7l2 3.5h4v13h-19z"/><circle class="h f2" cx="12" cy="13.8" r="3.8"/>',
  power:  '<path d="M12 2.5v9.5"/><path d="M6.6 5.8a8 8 0 1 0 10.8 0"/>',
  lock:   '<path class="f" d="M4.5 11h15v10.5h-15z"/><path d="M7.8 11V7.8a4.2 4.2 0 0 1 8.4 0V11"/>',
  moon:   '<path class="f" d="M20.5 14.8A8.6 8.6 0 1 1 9.2 3.5a6.8 6.8 0 0 0 11.3 11.3z"/>',
  exit:   '<path d="M10.5 3.5h-7v17h7"/><path d="M9 12h12M16.5 7.5 21 12l-4.5 4.5"/>',
  reboot: '<path d="M19.5 12.5a7.5 7.5 0 1 1-3-6.1"/><path class="f" d="M13 2.5 20 4.5 15.8 10z"/>',
  vol:    '<path class="f" d="M2.5 8.5H7L12.5 4v16L7 15.5H2.5z"/><path d="M15.5 8.8q2.5 3.2 0 6.4M18.3 6q4.6 6 0 12"/>',
  sun:    '<circle class="f" cx="12" cy="12" r="4.4"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
};
function glyphSVG(name, size, strokeW = 2.6) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" class="gsvg">
    <g fill="none" stroke="currentColor" stroke-width="${strokeW}" stroke-linecap="square" stroke-linejoin="miter">${GLYPHS[name]}</g></svg>`;
}
// .f 实心；.h 是"挖空"线条，用底色描出
const gstyle = document.createElement('style');
gstyle.textContent = `.gsvg .f{fill:currentColor;stroke:none}.gsvg .h{stroke:var(--hole,#000)}.gsvg .f2{fill:var(--hole,#000);stroke:none}
.stk.sel{--hole:var(--lav)} .stk.danger.sel{--hole:var(--red)} .tile.on{--hole:var(--lav)} .tile{--hole:#000}`;
document.head.appendChild(gstyle);
$$('[data-g]').forEach(el => { el.innerHTML = glyphSVG(el.dataset.g, el.closest('.slider') ? 18 : el.closest('.route') ? 20 : 34); });

// ---------- 勒索信拼贴字 ----------
const STYLES = [
  { f: '"Anton"',     bg: '#fff',      fg: '#000' },
  { f: '"Luckiest"',  bg: '#000',      fg: '#fff' },
  { f: '"BarlowC"',   bg: 'var(--lav)', fg: 'var(--on-lav)', w: '800', it: true },
  { f: '"NotoK"',     bg: 'transparent', fg: '#fff', stroke: true },
  { f: '"Luckiest"',  bg: '#fff',      fg: '#000' },
  { f: '"Anton"',     bg: '#000',      fg: 'var(--lav)' },
];
const KEYSTYLE = { f: '"Luckiest"', bg: 'var(--lav)', fg: 'var(--on-lav)' };
function ransom(el, text, size, key) {
  const r = rng(text + size);
  el.innerHTML = '';
  let prev = -1, keyUsed = !key;
  for (const word of text.split(' ')) {
    const w = document.createElement('span'); w.className = 'w';
    for (const ch of word) {
      let st, isKey = false;
      if (!keyUsed && ch.toUpperCase() === key) { st = KEYSTYLE; isKey = keyUsed = true; }
      else { let i; do i = Math.floor(r() * STYLES.length); while (i === prev); prev = i; st = STYLES[i]; }
      const c = document.createElement('span');
      c.className = 'c' + (isKey ? ' key' : '');
      c.textContent = r() < .35 ? ch.toLowerCase() : ch;
      if (st.f === '"Anton"' || st.f === '"NotoK"') c.textContent = ch;
      const sc = isKey ? 1.22 : .86 + r() * .3;
      Object.assign(c.style, {
        fontFamily: st.f, fontWeight: st.w || 'normal', fontStyle: st.it ? 'italic' : 'normal',
        fontSize: `${size * sc}px`, background: st.bg, color: st.fg,
        transform: `rotate(${(r() - .5) * (isKey ? 10 : 18)}deg) translateY(${(r() - .5) * size * .14}px)`,
      });
      if (st.stroke) c.style.webkitTextStroke = '1.5px #000', c.style.textShadow = '2px 2px 0 #000';
      w.appendChild(c);
    }
    el.appendChild(w);
  }
}
$$('.ransom[data-text]').forEach(el => ransom(el, el.dataset.text, +el.dataset.size || 22, el.dataset.key));

// ---------- 锯齿多边形 ----------
function jagged(x0, y0, w, h, seed, amp = 5) {
  const r = rng(seed), j = () => (r() - .5) * 2 * amp, pts = [];
  const side = (ax, ay, bx, by, n, nx, ny) => {
    for (let i = 0; i < n; i++) {
      const t = i / n, d = i === 0 ? 0 : j();
      pts.push([ax + (bx - ax) * t + nx * d + (i === 0 ? j() * .8 : 0), ay + (by - ay) * t + ny * d + (i === 0 ? j() * .8 : 0)]);
    }
  };
  side(x0, y0, x0 + w, y0, 3, 0, 1);
  side(x0 + w, y0, x0 + w, y0 + h, 2, 1, 0);
  side(x0 + w, y0 + h, x0, y0 + h, 3, 0, 1);
  side(x0, y0 + h, x0, y0, 2, 1, 0);
  return pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
}

// ---------- 贴纸 ----------
function buildSticker(el) {
  const mini = el.classList.contains('mini');
  const W = mini ? 60 : 110, H = mini ? 50 : 82, G = mini ? 30 : 46;
  const seed = el.dataset.label;
  const r = rng(seed + 'chip');
  const cx = r() < .5 ? W - 4 : 4;
  const chip = `${cx},${H * .62} ${cx + (cx > W / 2 ? -18 : 18)},${H + 6} ${cx + (cx > W / 2 ? 4 : -4)},${H + 4}`;
  el.innerHTML = `
    <svg class="icon" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <polygon class="shape" points="${jagged(0, 0, W, H, seed, mini ? 3.5 : 5)}"/>
      <polygon class="chip" points="${chip}"/>
      <g class="gl" transform="translate(${(W - G) / 2},${(H - G) / 2})">${glyphSVG(el.dataset.glyph, G, mini ? 2.8 : 2.6).replace('<svg', '<svg x="0" y="0"')}</g>
    </svg>
    <div class="label ransom"></div>`;
  ransom($('.label', el), el.dataset.label, mini ? 15 : 24, el.dataset.key);
  if (el.dataset.badge) el.insertAdjacentHTML('beforeend', `<span class="badge">${el.dataset.badge}</span>`);
}
$$('.stk').forEach(buildSticker);

// ---------- 选中光标：粉紫 + 粉色双层多边形抖动（menu-3d 的做法） ----------
const cursor = document.createElementNS(NS, 'svg');
cursor.setAttribute('class', 'cursor');
cursor.setAttribute('viewBox', '0 0 100 66');
cursor.setAttribute('preserveAspectRatio', 'none');
cursor.innerHTML = '<polygon class="ca"/><polygon class="cb"/>';
function jitter() {
  const q = (x0, x1, y0, y1) => `${(x0 + Math.random() * (x1 - x0)).toFixed(1)},${(y0 + Math.random() * (y1 - y0)).toFixed(1)}`;
  cursor.children[0].setAttribute('points', [q(0, 14, 24, 32), q(86, 100, 20, 28), q(88, 100, 38, 46), q(4, 16, 42, 50)].join(' '));
  cursor.children[1].setAttribute('points', [q(14, 34, 0, 10), q(80, 100, 8, 26), q(90, 100, 50, 66), q(6, 28, 52, 66)].join(' '));
}
setInterval(jitter, 120); jitter();
function select(stk) {
  if (!stk) return;
  $$('.stk.sel', stk.parentElement).forEach(s => s.classList.remove('sel'));
  stk.classList.add('sel');
  stk.prepend(cursor);
  const k = stk.dataset.key;
  $('.dock-keys').innerHTML = `<kbd>‹ ›</kbd>PAGE <kbd>${k}</kbd>${stk.dataset.label} <kbd>ESC</kbd>CLOSE`;
}

// ---------- 滑条 / 信号星 ----------
$$('.sl-bar').forEach(el => {
  const n = 12, v = Math.round(+el.dataset.v * n);
  el.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < v ? 'f' : ''}${i === v - 1 ? ' tip' : ''}"></i>`).join('');
});
const STAR = 'M12 1.5l2.9 6.6 7.1.6-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 8.7l7.1-.6z';
$$('.stars').forEach(el => {
  const n = +el.dataset.n;
  el.innerHTML = Array.from({ length: 4 }, (_, i) => `<svg width="17" height="17" viewBox="0 0 24 24" class="${i < n ? '' : 'off'}"><path d="${STAR}"/></svg>`).join('');
});

// ---------- 背景星芒 / 底板 ----------
function burst(el, spikes, rIn, rOut, seed, rot) {
  const r = rng(seed), pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i / (spikes * 2)) * Math.PI * 2 + (r() - .5) * .08;
    const rad = i % 2 ? rIn * (.85 + r() * .3) : rOut * (.7 + r() * .5);
    pts.push(`${(Math.cos(a) * rad).toFixed(1)},${(Math.sin(a) * rad).toFixed(1)}`);
  }
  el.setAttribute('points', pts.join(' '));
}
burst($('#burstA'), 15, 300, 600, 'A', .1);
burst($('#burstB'), 11, 380, 740, 'B', .35);
$('#plateP').setAttribute('points', '60,40 250,8 300,26 520,0 540,320 512,360 552,700 500,968 300,940 250,972 30,950 52,620 0,560 28,240');

// ---------- 分页 ----------
const pages = $$('.page');
let cur = 0;
const dockStars = $('.dock-stars');
function renderDock() {
  dockStars.innerHTML = pages.map((_, i) =>
    `<svg width="${i === cur ? 34 : 24}" height="${i === cur ? 34 : 24}" viewBox="0 0 24 24" data-i="${i}"><path class="${i === cur ? 'on' : 'off'}" d="${STAR}"/></svg>`).join('');
  const name = pages[cur].dataset.name;
  ransom($('.dock-name'), name, 22);
}
function goPage(i, anim = true) {
  i = (i + pages.length) % pages.length;
  if (i === cur && anim) return;
  const prev = pages[cur];
  pages.forEach(p => p.classList.remove('cur', 'enter', 'leave'));
  if (anim) { prev.classList.add('leave'); pages[i].classList.add('enter'); }
  pages[i].classList.add('cur');
  cur = i;
  renderDock();
  select($('.stk.sel', pages[i]) || $('.stk', pages[i]));
}
dockStars.addEventListener('click', e => { const s = e.target.closest('svg'); if (s) goPage(+s.dataset.i); });

// ---------- 应用 ----------
const screen = $('.ph-screen');
function openApp(name) {
  closeApp();
  if (name === 'wifi') { screen.classList.add('ui-hidden'); $('#app-wifi').classList.add('open'); }
  if (name === 'power') $('#app-power').classList.add('open');
}
function closeApp() {
  screen.classList.remove('ui-hidden');
  $$('.app.open, .callcard.open').forEach(a => a.classList.remove('open'));
}
const OPENS = { WIFI: 'wifi', POWER: 'power', OFF: 'power' };
$$('.stk').forEach(s => {
  s.addEventListener('mouseenter', () => select(s));
  s.addEventListener('click', () => OPENS[s.dataset.label] && openApp(OPENS[s.dataset.label]));
});
$('.app-head .back').addEventListener('click', closeApp);
$('#app-power').addEventListener('click', e => { if (e.target.id === 'app-power') closeApp(); });

addEventListener('keydown', e => {
  if (e.key === 'Escape') return closeApp();
  if (e.key === 'ArrowRight') { closeApp(); return goPage(cur + 1); }
  if (e.key === 'ArrowLeft') { closeApp(); return goPage(cur - 1); }
  const sel = $('.stk.sel', pages[cur]);
  if (e.key === 'Enter' && sel && OPENS[sel.dataset.label]) return openApp(OPENS[sel.dataset.label]);
  const hit = $$('.stk', pages[cur]).find(s => s.dataset.key === e.key.toUpperCase());
  if (hit) { select(hit); if (OPENS[hit.dataset.label]) openApp(OPENS[hit.dataset.label]); }
});

// ---------- 初始状态（?page=1 / ?app=wifi / ?app=power 方便截图） ----------
const q = new URLSearchParams(location.search);
cur = +(q.get('page') || 0);
goPage(cur, false);
if (q.has('static')) stage.classList.add('static');
if (q.get('app')) openApp(q.get('app'));
