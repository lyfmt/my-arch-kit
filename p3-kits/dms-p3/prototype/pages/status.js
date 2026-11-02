// STATUS — numeric readouts. Data: shared/backend.js (QML mapping in its proc + stats / battery sections):
//   P3Sys.stats.state (DgopService readouts; watch() on enter = DgopService.addRef, release on leave = removeRef),
//   P3Sys.proc.state.list / sort(k) / kill(pid, force), P3Sys.battery.state / setProfile(id), P3Sys.net.state (rates).
//   Subscribes to 'stats' 'proc' 'battery' 'net' and patches the DOM in place (rows keep focus by pid).
// Layout: CPU / MEMORY / DISK water tanks + CPU history (left), battery tank + power profile (right),
// one readout strip + PROCESSES entry (bottom). PROCESSES (the only entry; P is its shortcut) swaps the left
// column for an inline top-process list; hold Enter on a row to end that process.
// URL: ?charging=1 (battery charging to its limit), ?procs=1|cpu|mem (open the list on enter).
// Motion: liquid rises / numbers count up on enter, surfaces drift slowly, history scrolls one
// sample per backend tick. ?static=1 renders final values, no loops (the mock stops ticking too).
(() => {
  'use strict';
  const G = (n, s = 22) => P3Menu.glyph(n, s);

  // ---------------------------------------------------------------- styles (page-local)
  const CSS = `
@property --lv { syntax: '<number>'; inherits: true; initial-value: 0; }
.st { position: absolute; inset: 0; }
.st-col { position: absolute; top: 0; display: flex; flex-direction: column; }
.st .p-sec { margin-bottom: 14px; letter-spacing: .1em; }
.st .p-meta { font-size: 15px; letter-spacing: .06em; }
.st-side { transition: opacity .25s var(--ease); }
.st.procs-open .st-side { opacity: .4; }

/* tank */
.st-tanks { display: flex; gap: 20px; }
.st-tank { flex: none; --lv: 0; transition: --lv 1.2s var(--soft); }
.st-glass { position: relative; height: 250px; overflow: hidden; background: var(--panel); }
.st-tnum { position: absolute; left: 18px; top: 16px; font-size: 64px; color: var(--p-fg); white-space: nowrap; z-index: 1; }
.st-tnum small { font: 700 20px/1 "BarlowC", sans-serif; letter-spacing: .08em; font-style: normal; margin-left: 3px; color: var(--p-dim); }
.st-inkl { position: absolute; inset: 0; z-index: 3; pointer-events: none; clip-path: inset(calc((100 - var(--lv)) * 1% + 2px) 0 0 0); }
.st-tnum.ink, .st-tnum.ink small { color: var(--ink); }
.st-water { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--lv) * 1%); background: var(--fill); z-index: 2; }
.st-surf { position: absolute; left: 0; right: 0; top: -9px; height: 10px; animation: stBob 4.6s ease-in-out infinite; }
.st-wave { position: absolute; left: 0; top: 0; height: 10px; display: block; animation: stFlow 7s linear infinite; }
.st-wave path { fill: var(--fill); }
.st-wave.back { top: -3px; opacity: .4; animation-duration: 11s; animation-direction: reverse; }
@keyframes stFlow { to { transform: translateX(-50%); } }
@keyframes stBob { 50% { transform: translateY(1.5px); } }
.st-tlab { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 14px 2px 0; }
.st-limit { position: absolute; right: 0; bottom: var(--lim); width: 22px; height: 2px; background: var(--tx); z-index: 4; }
.st-limit span { position: absolute; right: 28px; top: -7px; font: 700 13px/1 "BarlowC", sans-serif; letter-spacing: .06em; color: var(--dim); }
.st-bat .st-tnum { top: auto; bottom: 18px; font-size: 84px; }

/* history */
.st-hist { margin-top: 22px; padding: 18px 22px 18px; background: var(--panel); flex: 1; display: flex; flex-direction: column; }
.st-hist-h { display: flex; align-items: baseline; gap: 22px; }
.st-hist-h .p-label { color: var(--tx); margin-right: auto; }
.st-hist-h b { color: var(--tx); font-weight: 700; }
.st-spark { display: block; overflow: hidden; margin-top: auto; }
.st-spark .line { fill: none; stroke: var(--fill); stroke-width: 2; stroke-linejoin: round;
  stroke-dasharray: 1; stroke-dashoffset: var(--draw, 0); transition: stroke-dashoffset 1.1s var(--ease); }
.st-spark .area { fill: var(--fill); opacity: .1; transition: opacity .8s var(--ease) .3s; }
.st-spark .base { stroke: var(--line); stroke-width: 1; }
.st-spark .dot { fill: var(--fill); }
.st-spark .mv { transition: transform 1.3s linear; }
.st-spark .mv.jump { transition: none; }
/* bottom strip + processes entry */
.st-bot { position: absolute; left: 0; right: 0; bottom: 0; height: 86px; border-top: 1px solid var(--line); padding-top: 12px;
  display: grid; grid-template-columns: 880px 482px; gap: 48px; }
.st-strip { display: grid; grid-template-columns: repeat(5, 1fr); align-items: center; }
.st-cell { padding: 0 0 2px 18px; border-left: 1px solid var(--line); display: flex; flex-direction: column; gap: 12px; }
.st-cell:first-child { padding-left: 0; border-left: 0; }
.st-cell small, .st-bl small { font: 700 15px/1 "BarlowC", sans-serif; letter-spacing: .08em; font-style: normal; color: var(--p-dim); margin-left: 5px; }
.st-link { border-bottom: 0; height: 72px; }
.st-link .p-num { font-size: 34px; margin-left: auto; }
.st-link .p-chev { color: var(--p-fg); transition: rotate .3s var(--spring); }
.st.procs-open .st-link .p-chev { rotate: 90deg; }

/* battery */
.st-batrow { display: flex; gap: 26px; }
.st-batlist { display: flex; flex-direction: column; justify-content: space-between; padding: 6px 0 50px; }
.st-bl { display: flex; flex-direction: column; gap: 10px; }
.st-bl .p-num { font-size: 56px; color: var(--tx); }

/* power profile: one-of-three toggle group */
.st-prof { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; height: 104px; }
.st-seg { display: flex; flex-direction: column; justify-content: space-between; padding: 16px 16px 18px;
  background: var(--panel); color: var(--p-fg); transition: background .22s var(--ease), color .22s; }
.st-seg .p-ico { color: inherit; }
.st-seg .nm { display: flex; align-items: baseline; gap: 10px; }
.st-seg .nm .p-label { color: inherit; font-size: 16px; }
.st-seg.cur { background: var(--fill); --p-fg: var(--ink); color: var(--ink); }
.st-seg.cur.is-focus { --p-fg: var(--ink); color: var(--ink); }
.st-seg.pick { animation: stPick .45s var(--spring); }
@keyframes stPick { 35% { transform: translateY(-5px); } }

/* process list (replaces the PERFORMANCE column while open) */
.st-perf { display: contents; }
.st.procs-open .st-perf { display: none; }
.st-procs { display: none; flex-direction: column; }
.st.procs-open .st-procs { display: flex; }
.st-ph { display: flex; align-items: center; height: 44px; border-bottom: 1px solid var(--line); padding: 0 18px; gap: 18px; }
.st-ph .c { width: 120px; text-align: right; cursor: pointer; transition: color .2s var(--ease); }
.st-ph .c.c1 { margin-left: auto; }
.st-ph .c span { display: inline-block; padding: 7px 0 6px; box-shadow: inset 0 -2px 0 transparent; transition: box-shadow .25s var(--ease); }
.st-ph .c.on { color: var(--fill); }
.st-ph .c.on span { box-shadow: inset 0 -2px 0 var(--fill); }
.st-pr { display: flex; align-items: center; gap: 18px; height: 56px; padding: 0 18px; border-bottom: 1px solid var(--line);
  color: var(--p-fg); overflow: hidden; animation: stRowIn .36s var(--ease) backwards; animation-delay: calc(var(--i) * 30ms); }
@keyframes stRowIn { from { opacity: 0; transform: translateX(-24px); } }
.st-pr .nm { font: 700 21px/1 "BarlowC", sans-serif; letter-spacing: .04em; white-space: nowrap; }
.st-pr .pid { font: 700 14px/1 "BarlowC", sans-serif; letter-spacing: .08em; color: var(--p-dim); }
.st-pr .v { width: 120px; text-align: right; font: italic 900 30px/.86 "P3", sans-serif; white-space: nowrap; }
.st-pr .v.c1 { margin-left: auto; }
.st-pr .v.dim { color: var(--p-dim); }
.st-pr .v small { font: 700 13px/1 "BarlowC", sans-serif; letter-spacing: .08em; font-style: normal; color: var(--p-dim); margin-left: 3px; }
.st-pr.holding .v small, .st-pr.holding .pid, .st-pr.holding .v.dim { color: #fff; }
.st-pr.gone { animation: stRowOut .3s var(--ease) forwards; }
@keyframes stRowOut { to { opacity: 0; transform: translateX(60px); height: 0; } }
.st-empty { padding: 22px 18px; color: var(--dim); }
`;
  function injectCSS() {
    if (document.getElementById('st-css')) return;
    const s = document.createElement('style'); s.id = 'st-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- state
  // S mirrors the backend snapshots in display form (pull()); page-only bits: open, fromEl.
  // The power profile is SHARED with SYSTEM through P3Sys.battery (never cached in S).
  const num = s => parseFloat(String(s)) || 0;
  const Q = new URLSearchParams(location.search);
  const CHG = Q.has('charging') ? Q.get('charging') !== '0' : null;   // debug override of battery.charging
  let S = null, timers = [], raf = 0, stCtx = null, countEnd = 0, unsub = [], reconT = 0;
  const getProfile = () => P3Sys.battery.state.profile || 'balanced';
  const plist = () => P3Sys.proc.state.list;
  const PROC_ROWS = 8;

  // copy backend snapshots into S; returns true when a new CPU sample arrived (history scrolls)
  function pull() {
    const st = P3Sys.stats.state, b = P3Sys.battery.state, n = P3Sys.net.state || {};
    const up = String(st.uptime || '0h 0m').match(/(\d+)h\s*(\d+)m/) || [0, 0, 0];
    const load = String(st.load || '0 0 0').split(/\s+/).map(num);
    const chg = CHG == null ? !!b.charging : CHG;
    const hist = st.cpuHist && st.cpuHist.length ? st.cpuHist : [0, 0];
    const fresh = S.histRef !== undefined && hist !== S.histRef;
    Object.assign(S, {
      cpu: st.cpu, cpuTemp: st.cpuTemp, cores: st.cores,
      ram: st.ram, ramUsed: st.ramUsed, ramTotal: st.ramTotal,
      gpuTemp: st.gpuTemp, disk: st.disk, diskUsed: st.diskUsed, diskTotal: st.diskTotal,
      upH: +up[1], upM: +up[2], load1: load[0], procs: st.procs,
      down: num(n.down), up: num(n.up),
      bat: b.pct, charging: chg, remain: b.remain, watts: chg && !b.charging ? 24.0 : b.watts, health: b.health, limit: b.limit ?? 85,
      hist: hist.slice(), histRef: hist, sort: P3Sys.proc.state.sort || 'cpu',
    });
    return fresh;
  }
  function freshState() {
    const pq = Q.get('procs');
    S = { open: !!pq && pq !== '0' };
    if (pq === 'mem' || pq === 'cpu') P3Sys.proc.sort(pq);
    pull();
    return S;
  }
  const DEC = { ramUsed: 1, down: 1, watts: 1, load1: 2 };
  const fmt = (k, v) => { const d = DEC[k] || 0; return d ? (+v).toFixed(d) : String(Math.round(v)); };
  const k = (key, cls = '') => `<b class="st-k ${cls}" data-key="${key}">${fmt(key, S[key])}</b>`;
  const atLimit = () => S.charging && S.bat >= S.limit;
  const toLimit = () => { const m = Math.max(0, Math.round((S.limit - S.bat) * 1.4)); return `0:${String(m).padStart(2, '0')}`; };
  // text fragments that depend on charging; re-evaluated on every redraw
  const TXT = {
    batState: () => atLimit() ? 'HELD' : S.charging ? 'CHARGING' : 'ON BATTERY',
    wLab: () => S.charging ? 'CHARGE' : 'DRAW',
    remain: () => S.charging ? (atLimit() ? '—' : toLimit()) : S.remain,
    remainLab: () => S.charging ? 'TO LIMIT' : 'REMAIN',
  };
  const t = key => `<span data-txt="${key}">${TXT[key]()}</span>`;

  const PROFILES = [
    { id: 'power-saver', t: 'SAVER', g: 'bat' },
    { id: 'balanced', t: 'BALANCED', g: 'gauge' },
    { id: 'performance', t: 'PERFORM', g: 'bolt' },
  ];


  // ---------------------------------------------------------------- pieces
  function wave(w, amp, per, cls = '') {
    // two tile-widths so translateX(-50%) loops seamlessly; filled down to y=10
    let d = 'M0 5';
    for (let x = 0; x <= w * 2; x += 4) d += `L${x} ${(5 + Math.sin(x / per * Math.PI * 2) * amp).toFixed(2)}`;
    return `<svg class="st-wave ${cls}" width="${w * 2}" height="10" viewBox="0 0 ${w * 2} 10"><path d="${d}L${w * 2} 10L0 10Z"/></svg>`;
  }
  function tank(o) {
    const w = o.w, numHtml = `${k(o.key, 'st-n')}<small>%</small>`;
    return `<div class="st-tank ${o.cls || ''}" data-tank="${o.key}" data-lvkey="${o.key}" style="--lv:${o.lv0};width:${w}px" data-in>
      <div class="st-glass" ${o.gh ? `style="height:${o.gh}px"` : ''}>
        <div class="st-tnum d">${numHtml}</div>
        <div class="st-water"><div class="st-surf">${wave(w, 2.2, w / 1.5, 'back')}${wave(w, 2.6, w / 2.2)}</div></div>
        <div class="st-inkl" aria-hidden="true"><div class="st-tnum d ink">${numHtml}</div></div>
        ${o.extra || ''}
      </div>
      <div class="st-tlab"><span class="p-label">${o.lab}</span><span class="p-meta">${o.meta}</span></div>
    </div>`;
  }
  function sparkPaths(h, W, H) {
    const n = h.length, step = W / (n - 2);   // last point sits one step off the right edge (scroll buffer)
    const pts = h.map((v, i) => [i * step, H - 3 - Math.min(100, v) / 50 * (H - 8)]);  // scale: 0..50 %
    const line = 'M' + pts.map(p => `${p[0].toFixed(1)} ${Math.max(2, p[1]).toFixed(1)}`).join('L');
    return { line, area: `${line}L${pts[n - 1][0].toFixed(1)} ${H}L0 ${H}Z`, step, last: pts[n - 2] };
  }
  function spark(W, H) {
    const p = sparkPaths(S.hist, W, H);
    return `<svg class="st-spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-w="${W}" data-h="${H}">
      <line class="base" x1="0" y1="${H - .5}" x2="${W}" y2="${H - .5}"/>
      <g class="mv"><path class="area" d="${p.area}"/><path class="line" pathLength="1" d="${p.line}"/></g>
      <circle class="dot" r="4" cx="${p.last[0].toFixed(1)}" cy="${Math.max(2, p.last[1]).toFixed(1)}"/>
    </svg>`;
  }
  const histPeak = () => Math.max(...S.hist);
  const histAvg = () => S.hist.reduce((a, b) => a + b, 0) / S.hist.length;

  function profileSegs() {
    const cur = getProfile();
    return `<div class="st-prof" role="radiogroup" data-in>${PROFILES.map(p => `
      <div class="st-seg st-side-f ${p.id === cur ? 'cur' : ''}" role="radio" aria-checked="${p.id === cur}" data-focus data-prof="${p.id}">
        <span class="p-ico">${G(p.g, 22)}</span>
        <span class="nm"><span class="p-label">${p.t}</span></span></div>`).join('')}
    </div>`;
  }

  // ---------------------------------------------------------------- process list
  const fmtMem = mb => mb >= 1000 ? `${(mb / 1024).toFixed(1)}<small>GB</small>` : `${Math.round(mb)}<small>MB</small>`;
  function sorted() {
    const key = S.sort;
    return plist().slice().sort((a, b) => b[key] - a[key]).slice(0, PROC_ROWS);
  }
  function procRow(p, i) {
    const cpuDim = S.sort !== 'cpu' ? ' dim' : '', memDim = S.sort !== 'mem' ? ' dim' : '';
    return `<div class="st-pr p-hold" data-focus data-hold="900" data-pid="${p.pid}" style="--i:${i}">
      <span class="nm">${p.name}</span><span class="pid">${p.pid}</span>
      <span class="v c1${cpuDim}" data-pv="cpu">${p.cpu.toFixed(1)}<small>%</small></span>
      <span class="v${memDim}" data-pv="mem">${fmtMem(p.mem)}</span></div>`;
  }
  function procBody() {
    const rows = sorted();
    return rows.length ? rows.map(procRow).join('') : `<div class="st-empty p-label">NO PROCESSES</div>`;
  }
  function procsHtml() {
    return `<div class="st-procs">
      <div class="p-sec">TOP PROCESSES</div>
      <div class="st-ph"><span class="p-meta">NAME · PID</span>
        ${['cpu', 'mem'].map((s, i) => `<span class="p-meta c${i ? '' : ' c1'}${S.sort === s ? ' on' : ''}" data-sort="${s}"><span>${s === 'cpu' ? 'CPU' : 'MEM'}</span></span>`).join('')}
      </div>
      <div class="st-plist">${procBody()}</div>
    </div>`;
  }
  function refreshProcs(root, focusFirst) {
    const list = root.querySelector('.st-plist');
    list.innerHTML = procBody();
    root.querySelectorAll('.st-ph [data-sort]').forEach(s => s.classList.toggle('on', s.dataset.sort === S.sort));
    if (focusFirst) { const r = list.querySelector('.st-pr'); if (r) stCtx.focus(r); }
    stCtx.refocus();
  }
  // rebuild the list after rows vanished; focus stays on the same pid, else the row that took its place
  function refreshKeep(root) {
    const f = stCtx.focused(), inList = !!(f && f.classList.contains('st-pr'));
    const rows = [...root.querySelectorAll('.st-pr')], i = inList ? rows.indexOf(f) : -1, pid = inList ? f.dataset.pid : null;
    refreshProcs(root, false);
    if (!inList) return;
    const nr = [...root.querySelectorAll('.st-pr')];
    const nx = nr.find(r => r.dataset.pid === pid) || nr[Math.min(Math.max(0, i), nr.length - 1)];
    stCtx.focus(nx || root.querySelector('.st-link'));
  }
  // 'proc' changed: values in place; rows whose pid left the list slide out, then the list closes the gap
  function reconcile(root) {
    const alive = new Map(plist().map(p => [p.pid, p]));
    const rows = [...root.querySelectorAll('.st-pr')], missing = rows.filter(r => !alive.has(+r.dataset.pid));
    rows.forEach(r => {
      const p = alive.get(+r.dataset.pid); if (!p) return;
      r.querySelector('[data-pv="cpu"]').innerHTML = `${p.cpu.toFixed(1)}<small>%</small>`;
      r.querySelector('[data-pv="mem"]').innerHTML = fmtMem(p.mem);
    });
    if (!missing.length) return;
    if (stCtx.static) return refreshKeep(root);
    // focus moves off a vanishing row right away (to its neighbour), then the gap closes
    const f = stCtx.focused();
    if (f && missing.includes(f)) {
      const i = rows.indexOf(f), keep = rows.filter(r => !missing.includes(r));
      const nx = keep.find(r => rows.indexOf(r) > i) || keep[keep.length - 1];
      if (nx) stCtx.focus(nx);
    }
    missing.forEach(r => { r.classList.add('gone'); r.removeAttribute('data-focus'); });
    clearTimeout(reconT);
    reconT = setTimeout(() => { if (root.querySelector('.st')) refreshKeep(root); }, 300);
    timers.push(reconT);
  }
  function setSort(k, root, focusFirst) { P3Sys.proc.sort(k); S.sort = P3Sys.proc.state.sort; refreshProcs(root, focusFirst); }
  function setOpen(on, sort) {
    const root = stCtx.root, st = root.querySelector('.st');
    if (sort) setSort(sort, root, false);
    if (on && !S.open) S.fromEl = stCtx.focused();
    S.open = on;
    st.classList.toggle('procs-open', on);
    root.querySelectorAll('.st-side-f').forEach(el => el.toggleAttribute('data-disabled', on));
    if (on) refreshProcs(root, true);
    else {
      const back = S.fromEl && root.contains(S.fromEl) && !S.fromEl.closest('.st-procs') ? S.fromEl : null;
      S.fromEl = null;
      stCtx.focus(back || root.querySelector('.st-link'));
    }
    stCtx.refocus();
  }
  // hold-confirmed: SIGTERM via the backend. Success → 'proc' event removes the row (reconcile);
  // rejection ('denied' system process, 'gone' already exited) → the row stays.
  function kill(row) {
    const pid = +row.dataset.pid;
    if (!plist().some(x => x.pid === pid)) return;
    P3Sys.ui(stCtx, P3Sys.proc.kill(pid, false));
  }

  // ---------------------------------------------------------------- layout
  function render(lv) {
    const L = v => lv ? v : 0, TW = 280;
    const tanks = [
      tank({ key: 'cpu', w: TW, lv0: L(S.cpu), lab: 'CPU', meta: `${k('cpuTemp')}°C · ${S.cores} 核` }),
      tank({ key: 'ram', w: TW, lv0: L(S.ram), lab: 'MEMORY', meta: `${k('ramUsed')} / ${S.ramTotal} GB` }),
      tank({ key: 'disk', w: TW, lv0: L(S.disk), lab: 'DISK /', meta: `${S.diskUsed} / ${S.diskTotal}` }),
    ].join('');
    const bat = tank({ key: 'bat', cls: 'st-bat', w: 236, gh: 350, lv0: L(S.bat), lab: t('batState'), meta: '',
      extra: `<div class="st-limit" style="--lim:${S.limit}%"><span>${S.limit}</span></div>` });
    return `<div class="st ${S.open ? 'procs-open' : ''}">
      <div class="st-col" style="left:0;width:880px;height:572px">
        <div class="st-perf">
          <div class="p-sec" data-in>PERFORMANCE</div>
          <div class="st-tanks">${tanks}</div>
          <div class="st-hist" data-in>
            <div class="st-hist-h"><span class="p-label">CPU · 60 S</span>
              <span class="p-meta">PEAK <b data-key="peak">${Math.round(histPeak())}</b>%</span><span class="p-meta">AVG <b data-key="avg">${Math.round(histAvg())}</b>%</span></div>
            ${spark(836, 150)}
          </div>
        </div>
        ${procsHtml()}
      </div>
      <div class="st-col st-side" style="left:928px;width:482px;height:572px">
        <div class="p-sec" data-in>BATTERY</div>
        <div class="st-batrow">
          ${bat}
          <div class="st-batlist" data-in>
            <div class="st-bl"><span class="p-meta">${t('wLab')}</span><span class="p-num">${k('watts', 'st-n')}<small>W</small></span></div>
            <div class="st-bl"><span class="p-meta">${t('remainLab')}</span><span class="p-num" data-txt="remain">${TXT.remain()}</span></div>
            <div class="st-bl"><span class="p-meta">HEALTH</span><span class="p-num">${k('health', 'st-n')}<small>%</small></span></div>
          </div>
        </div>
        <div class="p-sec" style="margin-top:auto" data-in>POWER PROFILE</div>
        ${profileSegs()}
      </div>
      <div class="st-bot">
        <div class="st-strip" data-in>
          <div class="st-cell"><span class="p-meta">↓ DOWN</span><span class="p-num sm">${k('down', 'st-n')}<small>MB/S</small></span></div>
          <div class="st-cell"><span class="p-meta">↑ UP</span><span class="p-num sm">${k('up', 'st-n')}<small>KB/S</small></span></div>
          <div class="st-cell"><span class="p-meta">GPU</span><span class="p-num sm">${k('gpuTemp', 'st-n')}<small>°C</small></span></div>
          <div class="st-cell"><span class="p-meta">LOAD</span><span class="p-num sm">${k('load1', 'st-n')}</span></div>
          <div class="st-cell"><span class="p-meta">UPTIME</span><span class="p-num sm">${k('upH', 'st-n')}<small>H</small> ${k('upM', 'st-n')}<small>M</small></span></div>
        </div>
        <div class="p-row tall st-link" data-focus data-in>
          <span class="p-ico">${G('list')}</span>
          <span class="p-two"><span class="p-label">PROCESSES</span></span>
          <span class="p-num">${k('procs')}</span><span class="p-chev">${G('chev', 20)}</span></div>
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------- motion
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const target = key => key === 'peak' ? histPeak() : key === 'avg' ? histAvg() : S[key];
  function delayOf(el) { const b = el.closest('[data-k]'); return 330 + (b ? +b.dataset.k : 0) * 45; }
  function countUp(els, delayFn, D = 950) {
    const jobs = els.map(el => ({ el, key: el.dataset.key, t0: delayFn(el) }));
    const start = performance.now();
    jobs.forEach(j => { j.el.textContent = fmt(j.key, 0); });
    if (raf) cancelAnimationFrame(raf);
    // finish on a timer too, so values land even when frames are throttled (hidden tab / headless)
    const end = Math.max(0, ...jobs.map(j => j.t0)) + D + 40;
    countEnd = start + end;
    timers.push(setTimeout(() => { if (raf) cancelAnimationFrame(raf); raf = 0; jobs.forEach(j => { j.el.textContent = fmt(j.key, target(j.key)); }); }, end));
    const step = now => {
      let live = false;
      for (const j of jobs) {
        const x = Math.min(1, Math.max(0, (now - start - j.t0) / D));
        if (x < 1) live = true;
        j.el.textContent = fmt(j.key, target(j.key) * easeOut(x));
      }
      raf = live ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
  }
  function fillIn(root) {
    root.querySelectorAll('[data-lvkey]').forEach(el => {
      timers.push(setTimeout(() => el.style.setProperty('--lv', S[el.dataset.lvkey]), delayOf(el) + 40));
    });
    root.querySelectorAll('.st-spark').forEach(sv => {
      sv.style.setProperty('--draw', 1);
      const a = sv.querySelector('.area'); a.style.opacity = 0;
      timers.push(setTimeout(() => { sv.style.setProperty('--draw', 0); a.style.opacity = ''; }, delayOf(sv) + 80));
    });
  }
  function redrawNums(root) {
    root.querySelectorAll('.st-k').forEach(el => { el.textContent = fmt(el.dataset.key, target(el.dataset.key)); });
    root.querySelectorAll('[data-txt]').forEach(el => { el.textContent = TXT[el.dataset.txt](); });
  }
  function redraw(root, scroll) {
    redrawNums(root);
    root.querySelectorAll('[data-lvkey]').forEach(el => el.style.setProperty('--lv', S[el.dataset.lvkey]));
    root.querySelectorAll('.st-limit').forEach(el => { el.style.setProperty('--lim', S.limit + '%'); el.firstElementChild.textContent = S.limit; });
    if (scroll) root.querySelectorAll('.st-spark').forEach(sv => {
      if (!sv.offsetParent) return;
      const p = sparkPaths(S.hist, +sv.dataset.w, +sv.dataset.h), g = sv.querySelector('.mv');
      sv.querySelector('.line').setAttribute('d', p.line);
      sv.querySelector('.area').setAttribute('d', p.area);
      const dot = sv.querySelector('.dot');
      dot.setAttribute('cx', p.last[0].toFixed(1)); dot.setAttribute('cy', Math.max(2, p.last[1]).toFixed(1));
      // new path drawn one step to the right, then glides left: continuous scroll
      g.classList.add('jump'); g.style.transform = `translateX(${p.step}px)`; void g.getBoundingClientRect();
      g.classList.remove('jump'); g.style.transform = 'translateX(0)';
    });
  }
  function stop() {
    timers.forEach(x => clearTimeout(x)); timers = []; if (raf) cancelAnimationFrame(raf); raf = 0;
    unsub.forEach(f => f()); unsub = [];
  }
  function syncProfile(root) {
    const id = getProfile();
    root.querySelectorAll('.st-seg').forEach(s => { const c = s.dataset.prof === id; s.classList.toggle('cur', c); s.setAttribute('aria-checked', c); });
  }
  function pickProfile(seg) {
    const id = seg.dataset.prof;
    if (id === getProfile()) return;
    const root = stCtx.root;
    // optimistic: highlight now; the 'battery' event confirms, an error reverts to the real profile
    root.querySelectorAll('.st-seg').forEach(s => { const c = s === seg; s.classList.toggle('cur', c); s.setAttribute('aria-checked', c); });
    if (!stCtx.static) { seg.classList.remove('pick'); void seg.offsetWidth; seg.classList.add('pick'); }
    P3Sys.ui(stCtx, P3Sys.battery.setProfile(id), { revert: () => { if (root.querySelector('.st')) syncProfile(root); } });
  }

  // ---------------------------------------------------------------- page
  P3Menu.register('status', {
    title: 'STATUS',
    render(root, ctx) {
      injectCSS();
      stop();
      S = freshState(); stCtx = ctx;
      root.insertAdjacentHTML('beforeend', render(ctx.static));
      if (S.open) root.querySelectorAll('.st-side-f').forEach(el => el.setAttribute('data-disabled', ''));
      if (!ctx.static) root.querySelectorAll('.st-k').forEach(el => { el.textContent = fmt(el.dataset.key, 0); });

      // root (.pg-root) outlives this render, so bind once; handlers only match status DOM
      if (root._stBound) return;
      root._stBound = true;
      root.addEventListener('p3confirm', e => {
        const row = e.target.closest('.st-pr');
        if (row && root.querySelector('.st')) kill(row);
      });
      root.addEventListener('click', e => {
        if (!root.querySelector('.st')) return;
        const seg = e.target.closest('.st-seg');
        if (seg) return pickProfile(seg);
        const so = e.target.closest('[data-sort]');
        if (so) { setSort(so.dataset.sort, root, false); return; }
        if (e.target.closest('.st-link')) { setOpen(!S.open); return; }
      });
    },
    onEnter(ctx) {
      syncProfile(ctx.root);
      if (S.open) { const r = ctx.root.querySelector('.st-pr'); if (r) ctx.focus(r); }
      const root = ctx.root;
      const live = () => stCtx === ctx && !!root.querySelector('.st');
      // during the entry count-up only S changes (countUp reads S live); afterwards patch the DOM
      const onStats = () => { if (!live()) return; const sc = pull(); if (performance.now() >= countEnd) redraw(root, sc); };
      unsub.push(P3Sys.stats.watch(),     // DgopService.addRef; released in stop() (onLeave / re-render)
        P3Sys.on('stats', onStats), P3Sys.on('net', onStats),
        P3Sys.on('battery', () => { if (!live()) return; pull(); if (performance.now() >= countEnd) redraw(root, false); syncProfile(root); }),
        P3Sys.on('proc', () => { if (live() && S.open) reconcile(root); }));
      if (ctx.static) return;
      fillIn(root);
      countUp([...root.querySelectorAll('.st-k')], el => delayOf(el) + 60);
    },
    onKey(e, ctx) {
      const k = e.key;
      if (S.open) {
        if (k === 'Escape' || k === 'Backspace' || (k === 'ArrowLeft')) { setOpen(false); return true; }
        if (k === 'Tab') { setSort(S.sort === 'cpu' ? 'mem' : 'cpu', ctx.root, true); return true; }
      }
      if (k === 'Tab') return true;
      if ((k === 'p' || k === 'P') && !e.repeat) { setOpen(!S.open); return true; }
      return false;
    },
    onLeave() { stop(); },
  });
})();
