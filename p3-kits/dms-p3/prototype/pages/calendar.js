// CALENDAR 日历 — sub-page of the P3 shell menu. API: header of shared/menu.js.
//   Left: month grid (Mon-first). The selected day follows the keyboard and the pointer; the right
//   column shows that day big, its lunar date / 节气 / holiday, and its agenda.
//   Today = P3Sys.clock.now() (mock: 2026-10-30 FRI 16:29) — white wedge + red echo on its numeral.
//   Data: shared/backend.js (QML mapping in its calendar / clock sections).
//     P3Sys.calendar.day(d)          sync: lunar (Intl zh-CN-u-ca-chinese), 节气, festival, 休/班 (holiday table = @gap,
//                                    holiday-cn json cached per year)
//     P3Sys.calendar.events(a, b)    async, CalendarService.loadEvents(start, end); loaded for the 6-week sheet on every
//                                    month change, cached per month; agenda shows 正在加载日程… until it resolves and
//                                    the error text if it rejects (?fail=calendar.events). Dots appear when it lands.
//   Keys: ←→ day, ↑↓ week (crossing a month edge slides the month), PageUp/PageDown or [ ] month,
//   T / Home today. Wheel over the grid = month. Click an adjacent-month day to flip to it.
//   URL (with ?page=calendar): ?day=YYYY-MM-DD preselects a day (static screenshots).
(() => {
  'use strict';
  const q = new URLSearchParams(location.search);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const same = (a, b) => key(a) === key(b);
  const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // ---------------------------------------------------------------- data (shared/backend.js → P3Sys.calendar / clock)
  // day info is sync (lunar via Intl zh-CN-u-ca-chinese + holiday table); events are async per visible range.
  const dayCache = new Map();
  const info = d => { const k = key(d); let v = dayCache.get(k); if (!v) dayCache.set(k, v = P3Sys.calendar.day(d)); return v; };
  // lunar line: month + day (九月廿一, 九月初一, 闰六月初一); 十一月 is called 冬月
  const lmon = m => m.replace(/十一月$/, '冬月');
  const lunarText = l => l ? lmon(l.month) + l.dayZh : null;
  // events cache, one entry per shown month: { a, b (YYYY-MM-DD range of the 6-week sheet), st: 'loading'|'ok'|'err', map, msg }
  let evCache = new Map(), gen = 0;

  // ---------------------------------------------------------------- styles
  const CSS = `
.cl { position: absolute; inset: 0; }
.cl-l { position: absolute; left: 0; top: 0; width: 860px; height: 680px; }
.cl-r { position: absolute; left: 950px; top: 0; width: 460px; height: 680px; }
/* month sheet: title + cells slide together */
.cl-clip { position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: hidden; }
.cl-sheet { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.cl-mon { position: absolute; left: 0; top: 0; height: 76px; display: flex; align-items: flex-end; gap: 18px; }
.cl-mon .d { font-size: 76px; color: var(--tx); text-shadow: var(--ink-shadow); padding-right: .06em; }
.cl-mon .yr { font-size: 40px; color: var(--dim); padding-bottom: 2px; }
.cl-wk { position: absolute; left: 0; top: 104px; width: 100%; display: grid; grid-template-columns: repeat(7, 1fr); }
.cl-wk span { padding-left: 16px; font-size: 17px; color: var(--dim); }
.cl-wk span.we { color: var(--sky); }
.cl-grid { position: absolute; left: 0; top: 140px; width: 100%; display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: 88px;
  border-top: 1px solid var(--line); }
.cl-c { border-bottom: 1px solid var(--line); display: flex; align-items: flex-end; gap: 10px; padding: 0 0 12px 16px; color: var(--p-fg); }
.cl-c .n { position: relative; font-size: 44px; color: var(--p-fg); transform-origin: 0 100%; transition: color .12s, scale .22s var(--soft); }
.cl-c.is-focus .n { scale: 1.16; }
.cl-c.we:not(.wk) .n { color: color-mix(in srgb, var(--p-fg) 80%, var(--sky)); }
.cl-c.out { --p-fg: rgba(163,240,255,.3); }
.cl-c.out.is-focus { --p-fg: var(--dim); }
.cl-c .dot { width: 8px; height: 8px; margin-bottom: 6px; background: var(--sky); transform: rotate(45deg); flex: none; }
.cl-c.is-focus .dot { background: var(--fill); }
.cl-c.today .dot { margin-left: 8px; }
.cl-c .tag { position: absolute; right: 14px; top: 12px; font-size: 16px; color: var(--sky); }
.cl-c .tag.wk { color: var(--dim); }
/* today: white wedge + red echo behind the numeral */
.cl-c.today .n { color: var(--ink); z-index: 0; }
.cl-c.today .n::before, .cl-c.today .n::after { content: ""; position: absolute; inset: -6px -14px -8px -14px; z-index: -1;
  clip-path: polygon(12px 4px, 100% 0, calc(100% - 6px) 100%, 0 92%); }
.cl-c.today .n::after { background: var(--shard); }
.cl-c.today .n::before { background: var(--accent); translate: 6px 5px; }
.cl-c.today.is-focus .n::before { translate: 9px 7px; transition: translate .2s var(--soft); }

/* right column */
.cl-day { position: relative; height: 238px; display: flex; align-items: flex-start; gap: 22px; }
.cl-big { width: 236px; margin-left: -6px; text-align: right; font-size: 228px; color: var(--tx); text-shadow: var(--ink-shadow); padding-right: .06em; flex: none; }
.cl-side { padding-top: 30px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
.cl-side .dw { font-size: 56px; color: var(--fill); }
.cl-side .lu { font-size: 18px; color: var(--dim); }
.cl-rel { margin-top: 2px; }
.cl-ag { position: absolute; left: 0; top: 262px; width: 100%; }
.cl-ev { display: flex; align-items: center; gap: 18px; height: 64px; border-bottom: 1px solid var(--line); }
.cl-ev .t { font-size: 34px; color: var(--tx); width: 104px; flex: none; }
.cl-ev .e { font-size: 20px; color: var(--dim); width: 64px; flex: none; margin-left: -12px; }
.cl-ev .ti { font-size: 19px; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.cl-ev .p-chip { margin-left: auto; flex: none; }
.cl-ev.past .t, .cl-ev.past .ti { color: var(--dim); }
.cl-ev.past .ti { text-decoration: line-through; text-decoration-color: rgba(163,240,255,.4); }
.cl-ev.next .t { color: var(--fill); }
.cl-none { padding-top: 22px; font-size: 22px; color: var(--dim); }
.cl-swap { animation: clSwap .22s var(--ease); }
@keyframes clSwap { from { opacity: 0; transform: translateX(14px); } }
.cl-big.cl-swap { animation: clBig .3s var(--spring); }
@keyframes clBig { from { opacity: 0; transform: translateY(18px) scale(.94); } }
`;
  function injectCSS() {
    if (document.getElementById('cl-css')) return;
    const s = document.createElement('style'); s.id = 'cl-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- state
  let CTX = null, now, today, sel, view, els, agT = 0, wheelLock = 0;

  function sheetHTML(y, m) {
    const first = new Date(y, m, 1);
    const off = (first.getDay() + 6) % 7;
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(y, m, 1 - off + i), k = key(d), dw = d.getDay();
      const cls = ['cl-c'];
      if (d.getMonth() !== m) cls.push('out');
      if (dw === 0 || dw === 6) cls.push('we');
      const di = info(d);
      if (di.work) cls.push('wk');
      if (same(d, today)) cls.push('today');
      const tag = di.off ? '<span class="tag zh">休</span>' : di.work ? '<span class="tag wk zh">班</span>' : '';
      cells += `<div class="${cls.join(' ')}" data-focus data-day="${k}">${tag}<span class="n d">${d.getDate()}</span>${(eventsOf(k) || []).length ? '<i class="dot"></i>' : ''}</div>`;
    }
    return `<div class="cl-mon"><span class="d">${MONTHS[m]}</span><span class="d yr">${y}</span></div>
      <div class="cl-grid">${cells}</div>`;
  }
  const cellOf = d => els.sheet.querySelector(`[data-day="${key(d)}"]`);
  const parse = k => new Date(k + 'T00:00');

  // ---------------------------------------------------------------- events (async, cached per shown month)
  const monKey = (y, m) => `${y}-${pad(m + 1)}`;
  function sheetRange(y, m) {
    const off = (new Date(y, m, 1).getDay() + 6) % 7;
    return [new Date(y, m, 1 - off), new Date(y, m, 1 - off + 41)];
  }
  // events of day k from any loaded month that covers it; undefined while nothing covering it has loaded
  function eventsOf(k) {
    for (const e of evCache.values()) if (e.st === 'ok' && k >= e.a && k <= e.b) return e.map[k] || [];
    return undefined;
  }
  // status of the month that covers k (the shown one first)
  function statusOf(k) {
    const cur = view && evCache.get(monKey(view.y, view.m));
    if (cur && k >= cur.a && k <= cur.b) return cur;
    for (const e of evCache.values()) if (k >= e.a && k <= e.b) return e;
    return null;
  }
  function loadMonth(y, m) {
    const mk = monKey(y, m), had = evCache.get(mk);
    if (had && had.st !== 'err') return;           // ok or in flight; errors retry on revisit
    const [from, to] = sheetRange(y, m), g = gen;
    const e = { a: key(from), b: key(to), st: 'loading', map: null, msg: '' };
    evCache.set(mk, e);
    P3Sys.calendar.events(from, to).then(map => { e.st = 'ok'; e.map = map || {}; }, err => { e.st = 'err'; e.msg = (err && err.message) || String(err); })
      .then(() => {
        if (g !== gen || !CTX) return;              // page left or re-rendered meanwhile
        if (view && monKey(view.y, view.m) === mk) markDots();
        const k = key(sel);
        if (k >= e.a && k <= e.b) renderAgenda();
      });
  }
  // add event dots to the shown sheet once its events arrived (in place, focus untouched)
  function markDots() {
    els.sheet.querySelectorAll('[data-day]').forEach(c => {
      const has = (eventsOf(c.dataset.day) || []).length > 0, dot = c.querySelector('.dot');
      if (has && !dot) c.insertAdjacentHTML('beforeend', '<i class="dot"></i>');
      else if (!has && dot) dot.remove();
    });
  }

  function relLabel(d) {
    const n = Math.round((d - today) / 864e5);
    if (n === 0) return '<span class="p-chip hot">TODAY</span>';
    if (n === 1) return '<span class="p-chip">明天</span>';
    if (n === -1) return '<span class="p-chip ghost">昨天</span>';
    return n > 0 ? `<span class="p-chip">${n} 天后</span>` : `<span class="p-chip ghost">${-n} 天前</span>`;
  }
  function renderDay(animate) {
    const d = sel, k = key(d);
    const di = info(d), lu = lunarText(di.lunar), extra = di.fest || di.term;
    els.day.innerHTML = `<div class="cl-big d">${d.getDate()}</div>
      <div class="cl-side"><span class="d dw">${DOW[d.getDay()]}</span>
        ${lu || extra ? `<span class="zh lu">${[lu, extra].filter(Boolean).join(' · ')}</span>` : ''}
        <span class="cl-rel">${relLabel(d)}</span></div>`;
    renderAgenda();
    if (animate && !(CTX && CTX.static)) {
      [els.day.querySelector('.cl-big'), els.day.querySelector('.cl-side'), els.ag].forEach(n => {
        n.classList.remove('cl-swap'); void n.offsetWidth; n.classList.add('cl-swap');
      });
    }
  }
  function renderAgenda() {
    const d = sel, k = key(d), ev = eventsOf(k);
    if (!ev) {
      const s = statusOf(k);
      els.ag.innerHTML = s && s.st === 'err'
        ? `<div class="p-sec">AGENDA · —</div><div class="zh cl-none">${esc(s.msg || '日程加载失败')}</div>`
        : `<div class="p-sec">AGENDA · …</div><div class="zh cl-none">正在加载日程…</div>`;
      return;
    }
    const nowM = now.getHours() * 60 + now.getMinutes(), isToday = same(d, today), isPast = d < today;
    const mins = s => +s.slice(0, 2) * 60 + +s.slice(3);
    let nextDone = false;
    els.ag.innerHTML = `<div class="p-sec">AGENDA · ${ev.length}</div>` + (ev.length ? ev.map(({ start: t, end: e, title: ti }) => {
      let cls = 'cl-ev', chip = '';
      if (isPast || (isToday && mins(e) <= nowM)) cls += ' past';
      else if (isToday && mins(t) <= nowM) { cls += ' next'; chip = '<span class="p-chip hot">进行中</span>'; nextDone = true; }
      else if (isToday && !nextDone) { cls += ' next'; nextDone = true; chip = `<span class="p-chip hot">${mins(t) - nowM} 分钟后</span>`; }
      return `<div class="${cls}"><span class="d t">${t}</span><span class="d e">–${e}</span><span class="zh ti">${esc(ti)}</span>${chip}</div>`;
    }).join('') : '<div class="zh cl-none">无日程</div>');
  }

  function showMonth(y, m, dir, ctx) {
    view = { y, m };
    loadMonth(y, m);
    const old = els.sheet;
    const nu = document.createElement('div');
    nu.className = 'cl-sheet';
    nu.innerHTML = sheetHTML(y, m);
    els.clip.appendChild(nu);
    els.sheet = nu;
    if (old) {
      old.querySelectorAll('[data-focus]').forEach(n => n.removeAttribute('data-focus'));
      if (ctx.static || !dir) old.remove();
      else {
        const opt = { duration: 300, easing: 'cubic-bezier(.22,.9,.24,1)' };
        old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${-dir * 60}px)`, opacity: 0 }], opt).onfinish = () => old.remove();
        nu.animate([{ transform: `translateY(${dir * 90}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { ...opt, duration: 380 });
      }
    }
  }
  // select a date; flips the month when it falls outside the shown one
  function select(d, ctx, opts = {}) {
    const flip = d.getFullYear() !== view.y || d.getMonth() !== view.m;
    const changed = !same(d, sel);
    sel = d;
    if (flip && !opts.noFlip) showMonth(d.getFullYear(), d.getMonth(), Math.sign(d - new Date(view.y, view.m, 1)), ctx);
    const c = cellOf(d);
    if (c && ctx.focused() !== c) ctx.focus(c);
    else if (flip) ctx.refocus();
    if (!changed) return;
    clearTimeout(agT);
    if (opts.lazy) agT = setTimeout(() => renderDay(true), 90);
    else renderDay(true);
  }
  function shiftMonth(n, ctx) {
    const y = view.y, m = view.m + n;
    const last = new Date(y, m + 1, 0).getDate();
    select(new Date(y, m, Math.min(sel.getDate(), last)), ctx);
  }

  P3Menu.register('calendar', {
    title: 'CALENDAR',
    render(root, ctx) {
      injectCSS();
      CTX = ctx;
      gen++; evCache = new Map(); dayCache.clear();
      now = P3Sys.clock.now();
      today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const qd = q.get('day');
      sel = qd && /^\d{4}-\d\d-\d\d$/.test(qd) ? parse(qd) : today;
      root.insertAdjacentHTML('beforeend', `<div class="cl">
        <div class="cl-l" data-in>
          <div class="cl-wk">${'一二三四五六日'.split('').map((c, i) => `<span class="zh${i > 4 ? ' we' : ''}">${c}</span>`).join('')}</div>
          <div class="cl-clip"></div>
        </div>
        <div class="cl-r" data-in><div class="cl-day"></div><div class="cl-ag"></div></div>
      </div>`);
      els = { clip: root.querySelector('.cl-clip'), day: root.querySelector('.cl-day'), ag: root.querySelector('.cl-ag'), sheet: null };
      showMonth(sel.getFullYear(), sel.getMonth(), 0, ctx);
      cellOf(sel).setAttribute('data-autofocus', '');
      renderDay(false);

      const grid = root.querySelector('.cl-l');
      // pointer: hover selects (agenda follows, debounced); click on an adjacent-month day flips to it
      grid.addEventListener('mouseover', e => {
        const c = e.target.closest('[data-day][data-focus]');
        if (c && c.dataset.day !== key(sel)) select(parse(c.dataset.day), ctx, { lazy: true, noFlip: true });
      });
      grid.addEventListener('click', e => {
        const c = e.target.closest('[data-day][data-focus]');
        if (c && c.classList.contains('out')) select(parse(c.dataset.day), ctx);
      });
      grid.addEventListener('wheel', e => {
        e.preventDefault();
        const now = performance.now(); if (now < wheelLock || !e.deltaY) return;
        wheelLock = now + 280; shiftMonth(Math.sign(e.deltaY), ctx);
      }, { passive: false });
    },
    onKey(e, ctx) {
      const step = { ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1, ArrowUp: -7, w: -7, ArrowDown: 7, s: 7 }[e.key];
      if (step) { const d = new Date(sel); d.setDate(d.getDate() + step); select(d, ctx); return true; }
      if (e.key === 'PageUp' || e.key === '[') { shiftMonth(-1, ctx); return true; }
      if (e.key === 'PageDown' || e.key === ']') { shiftMonth(1, ctx); return true; }
      if (e.key === 't' || e.key === 'T' || e.key === 'Home') { select(new Date(today), ctx); return true; }
      if (e.key === 'Enter' || e.key === ' ') {   // Enter on an adjacent-month day flips to it
        const c = ctx.focused();
        if (c && c.dataset.day) select(parse(c.dataset.day), ctx);
        return true;
      }
      return false;
    },
    onLeave() { clearTimeout(agT); CTX = null; gen++; },
  });
})();
