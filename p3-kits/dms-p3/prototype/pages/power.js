// POWER — sub-page of the P3 shell menu. API: header of shared/menu.js.
//   Slanted list in the main-menu language (page-drawn wedge + red echo, data-cursor="none").
//   LOCK / SLEEP run on Enter. LOG OUT / REBOOT / SHUT DOWN need Enter (or pointer) held for 1s:
//   JS-driven progress --p, damped-spring return on early release, then a full-stage confirm curtain.
//   The right panel shows the focused action's glyph and the hold countdown.
//   RESTART SHELL is a small secondary row (instant, page reloads in place).
//   Actions go through shared/backend.js: P3Sys.power.run(lock|suspend|logout|reboot|poweroff|restartShell),
//   errors handled via P3Sys.ui. Actions missing from P3Sys.power.state.supported are dimmed and skipped.
//   Real calls (QML port): SessionService.lock / suspend / logout / reboot / poweroff
//   (lock = `dms ipc call lock lock`); restart shell = `dms restart`.
//   Extra URL params for static screenshots (with ?page=power):
//     ?sel=N      focus the Nth focusable (framework)   order: LOCK SLEEP LOGOUT REBOOT OFF SHELL
//     ?hold=0..1  freeze the hold progress on the focused item
//     ?confirm=1  show the confirm curtain for the focused item
(() => {
  'use strict';
  const HOLD_MS = 1000;
  const q = new URLSearchParams(location.search);
  const G = (n, s, w) => P3Menu.glyph(n, s, w);

  const SYS = window.P3Sys;
  // run = P3Sys.power.run action (also the key into power.state.supported)
  const ACTS = [
    { id: 'lock',   t: 'LOCK',      g: 'lock',   c: '--c1', run: 'lock',     cur: 'LOCKED' },
    { id: 'sleep',  t: 'SLEEP',     g: 'sleep',  c: '--c4', run: 'suspend',  cur: 'SLEEP' },
    { id: 'logout', t: 'LOG OUT',   g: 'exit',   c: '--c2', run: 'logout',   cur: 'LOG OUT',   hold: 1 },
    { id: 'reboot', t: 'REBOOT',    g: 'reboot', c: '--c1', run: 'reboot',   cur: 'REBOOT',    hold: 1 },
    { id: 'off',    t: 'SHUT DOWN', g: 'power',  c: '--c4', run: 'poweroff', cur: 'SHUT DOWN', hold: 1 },
  ];
  const SHELL = { id: 'shell', t: 'RESTART SHELL', g: 'reboot', run: 'restartShell' };
  const supported = a => a.run === 'restartShell' || !!SYS.power.state.supported[a.run];
  const BYID = {}; [...ACTS, SHELL].forEach(a => { BYID[a.id] = a; });

  // ---------------------------------------------------------------- styles
  const CSS = `
.pw { position: absolute; inset: 0; }
.pw-swap { animation: pwSwap .32s var(--ease); }
@keyframes pwSwap { from { opacity: 0; transform: translateX(18px); } }
.pw-reload { animation: pwReload .55s var(--ease); }
@keyframes pwReload { 25% { opacity: .25; filter: blur(3px); } }

/* ---- A: slanted list ---- */
.pw-it { position: absolute; left: var(--x); top: var(--y); font-size: 84px; color: var(--c); white-space: nowrap; transform-origin: 0 60%; }
.pw-it .mv { display: block; transition: translate .45s var(--soft), opacity .3s; }
.pw-it .rt { display: block; position: relative; transform: rotate(var(--r)); transform-origin: 0 60%; transition: transform .26s var(--soft); }
.pw-it .tx { position: relative; display: block; text-shadow: var(--ink-shadow); transition: color .12s, text-shadow .12s; }
.pw-it .echo, .pw-it .ghost { position: absolute; left: 0; top: 0; pointer-events: none; }
.pw-it .echo { color: var(--accent); opacity: 0; transition: opacity .1s, translate .2s var(--ease); }
.pw-it .ghost { color: var(--fill); opacity: 0; }
.pw-it .sh, .pw-it .fl { position: absolute; pointer-events: none; opacity: 0; }
.pw-it .sw, .pw-it .fl { left: -46px; right: -54px; top: -14px; bottom: -22px; clip-path: polygon(0 66%, 100% 0, 97% 100%, 12% 92%); }
.pw-it .sw { background: var(--shard); transform: scaleX(.2); transform-origin: 100% 50%; transition: transform .22s var(--ease), opacity .1s; }
.pw-it .sr { left: -96px; right: -22px; top: -40px; bottom: 6px; background: var(--accent); clip-path: polygon(0 88%, 100% 0, 88% 34%);
  transform: scaleX(.2); transform-origin: 100% 0; transition: transform .26s var(--ease) .03s, opacity .1s; }
.pw-it.pw-na { opacity: .28; }   /* not supported on this machine (P3Sys.power.state.supported) */
.pw-it.is-focus { z-index: 2; }
.pw-it.is-focus .rt { transform: rotate(var(--r)) translate(-18px, 0) scale(1.2); }
.pw-it.is-focus .tx { color: var(--ink); text-shadow: none; }
.pw-it.is-focus .echo { opacity: 1; translate: 5px 4px; }
.pw-it.is-focus .sh { opacity: 1; transform: none; }
/* hold: accent floods the wedge left → right with a slanted blade; label turns white behind it */
.pw-it.pw-h .rt { transform: rotate(var(--r)) translate(-18px, 0) scale(calc(1.2 + var(--pr, 0) * .12)); transition: none; }
.pw-it.pw-h .echo { translate: calc(5px + var(--pr, 0) * 14px) calc(4px + var(--pr, 0) * 7px); transition: opacity .1s; }
.pw-it.pw-h .fl { opacity: 1; }
.pw-it .fl::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--p, 0) * 100%); background: var(--accent); }
.pw-it .fl::after { content: ""; position: absolute; top: -20px; bottom: -20px; left: calc(var(--p, 0) * 100% - 6px); width: 14px;
  background: var(--accent); transform: skewX(-14deg); }
.pw-it .tw { position: absolute; left: 0; top: 0; color: #fff; opacity: 0; pointer-events: none;
  clip-path: inset(-20px calc(100% - var(--p, 0) * (100% + 100px) + 46px) -20px -20px); }
.pw-it.pw-h .tw { opacity: 1; }
.pw-holding .pw-it:not(.pw-h) .mv { opacity: calc(1 - var(--p, 0) * .8); translate: calc(var(--p, 0) * -56px) 0; transition: none; }
.pw-hot .pw-h .mv { animation: pwShake .06s linear infinite alternate; }
@keyframes pwShake { from { transform: translate(-2px, 1px); } to { transform: translate(2px, -1px); } }
.pw-it.pw-boom .sw { animation: pwHit .38s var(--ease); }
.pw-it.pw-boom .ghost { animation: pwGhost .6s var(--ease); }
@keyframes pwHit { 40% { transform: scale(1.12, 1.25); } }
@keyframes pwGhost { 0% { opacity: .9; transform: none; } 100% { opacity: 0; transform: translateX(140px) scale(1.5); } }
.pg.enter .pw-it .mv { animation: pwItIn .7s var(--spring) backwards; animation-delay: calc(var(--i) * 50ms + .26s); }
@keyframes pwItIn { from { opacity: 0; transform: translateX(150px) rotate(7deg); } }

/* ---- secondary row ---- */
.pw-shell { position: absolute; left: 60px; top: 618px; width: 330px; border-bottom: 0; color: var(--p-dim); }
.pw-shell .p-label { color: inherit; }
.pw-shell.is-focus { color: var(--fill); }

/* ---- right panel: focused action glyph + hold countdown ---- */
.pw-side { position: absolute; left: 820px; top: 196px; width: 560px; }
.pw-sel { display: flex; align-items: center; gap: 26px; }
.pw-sg { color: var(--fill); display: grid; }
.pw-meter { display: flex; align-items: center; gap: 26px; margin-top: 102px; transition: opacity .2s; }
.pw:not(.pw-hold) .pw-meter { opacity: 0; }
.pw-meter.nudge { animation: pwNudge .36s var(--ease); }
@keyframes pwNudge { 20%, 60% { transform: translateX(-7px); } 40%, 80% { transform: translateX(7px); } }
.pw-ticks { flex: 1; display: flex; gap: 5px; height: 22px; }
.pw-ticks i { flex: 1; background: var(--line); clip-path: polygon(30% 0, 100% 0, 70% 100%, 0 100%); }
.pw-ticks i.on { background: var(--accent); }
.pw-cd { font-size: 72px; min-width: 150px; text-align: right; color: var(--dim); transition: color .1s; }
.pw-holding .pw-cd { color: var(--tx); }
.pw-hot .pw-cd { color: var(--accent); }

/* ---- confirm curtain (lives in #stage under the description bar) ---- */
.pw-curtain { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
.pw-cv { position: absolute; inset: 0; background: rgb(var(--deepv)); animation: pwDrop .5s cubic-bezier(.6,.05,.3,1) both; }
@keyframes pwDrop { from { clip-path: polygon(0 0, 100% 0, 100% -14%, 0 -2%); } to { clip-path: polygon(0 0, 100% 0, 100% 112%, 0 124%); } }
.pw-cd2 { position: absolute; inset: 0; background: #000; animation: pwDim 1.3s var(--ease) .35s both; }
@keyframes pwDim { from { opacity: 0; } to { opacity: .5; } }
.pw-cs { position: absolute; left: 0; top: -120px; width: 90px; height: 1320px; background: var(--accent);
  animation: pwSlash .6s cubic-bezier(.6,.05,.3,1) .1s both; }
@keyframes pwSlash { from { transform: translateX(-300px) skewX(-14deg); } to { transform: translateX(2200px) skewX(-14deg); } }
.pw-cc { position: absolute; left: 0; right: 0; top: 300px; display: flex; flex-direction: column; align-items: center; }
.pw-cg { color: var(--fill); animation: pwCg .6s var(--spring) .3s both; }
.pw-cg svg { display: block; }
@keyframes pwCg { from { opacity: 0; transform: scale(.4) rotate(-50deg); } }
.pw-c-reboot .pw-cg svg { animation: pwSpin 1.1s linear .7s infinite; }
@keyframes pwSpin { to { transform: rotate(360deg); } }
.pw-c-off .pw-cg svg { animation: pwOff 1s var(--ease) .8s both; }
@keyframes pwOff { to { opacity: .2; transform: scale(.82); } }
.pw-cn { margin-top: 26px; font-size: 168px; color: var(--tx); white-space: nowrap; padding-right: .06em;
  animation: pwCn .62s var(--spring) .36s both; }
@keyframes pwCn { from { opacity: 0; transform: translateX(-90px); } }
.pw-curtain.out .pw-cv { animation: pwLift .45s cubic-bezier(.6,0,.8,.4) .1s both; }
@keyframes pwLift { from { clip-path: polygon(0 0, 100% 0, 100% 112%, 0 124%); } to { clip-path: polygon(0 0, 100% 0, 100% -14%, 0 -2%); } }
.pw-curtain.out .pw-cd2 { animation: pwUndim .3s var(--ease) both; }
@keyframes pwUndim { from { opacity: .5; } to { opacity: 0; } }
.pw-curtain.out .pw-cc { animation: pwCcOut .28s var(--ease) both; }
@keyframes pwCcOut { from { opacity: 1; } to { opacity: 0; transform: translateY(-34px); } }
.pw-curtain.out .pw-cs { display: none; }
`;
  function injectCSS() {
    if (document.getElementById('pw-style')) return;
    const s = document.createElement('style');
    s.id = 'pw-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- markup
  const shellRow = () => `<div class="p-row pw-shell" data-focus data-in data-act="shell">
      <span class="p-ico">${G('reboot', 20)}</span><span class="p-label">${SHELL.t}</span></div>`;

  // same geometry language as the main list (top right → bottom left, mixed angles)
  const POS = [[254, 84, -8], [208, 184, -4], [164, 284, -7], [124, 384, -2], [80, 484, 3]];
  function render() {
    const items = ACTS.map((a, i) => {
      const [x, y, r] = POS[i], ok = supported(a);
      return `<div class="pw-it d ${ok ? '' : 'pw-na'}" data-focus ${ok ? '' : 'data-disabled'} data-cursor="none" data-act="${a.id}"
        style="--x:${x}px;--y:${y}px;--r:${r}deg;--c:var(${a.c});--i:${i}"><span class="mv"><span class="rt">
        <span class="sh sr"></span><span class="sh sw"></span><span class="echo">${a.t}</span><span class="ghost">${a.t}</span>
        <span class="fl"></span><span class="tx">${a.t}</span><span class="tw">${a.t}</span></span></span></div>`;
    }).join('');
    return `<div class="pw">${items}${shellRow()}
      <div class="pw-side" data-in>
        <div class="pw-sel"><span class="pw-sg"></span></div>
        <div class="pw-meter"><div class="pw-ticks">${'<i></i>'.repeat(20)}</div>
          <div class="p-num pw-cd">1.0<small class="p-unit">S</small></div></div>
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------- state
  let C = null, box = null, raf = 0, last = 0;
  let hEl = null, holding = false, p = 0, v = 0, busy = false, lastF = null;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  const actOf = el => el && BYID[el.dataset.act];

  function paint() {
    if (!box) return;
    const pc = Math.max(0, Math.min(1, p));
    const tgt = hEl || box;
    tgt.style.setProperty('--p', pc.toFixed(4));
    tgt.style.setProperty('--pr', p.toFixed(4));
    box.style.setProperty('--p', pc.toFixed(4));
    box.classList.toggle('pw-holding', !!hEl && pc > 0.001);
    box.classList.toggle('pw-hot', holding && pc > .72);
    const n = Math.round(pc * 20);
    box.querySelectorAll('.pw-ticks i').forEach((t, k) => t.classList.toggle('on', k < n));
    const cd = box.querySelector('.pw-cd');
    if (cd) cd.firstChild.nodeValue = ((1 - pc) * HOLD_MS / 1000).toFixed(1);
  }
  function loop(t) {
    raf = 0;
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    if (holding) {
      if (C.focused() !== hEl) { release(); }
      else {
        p = Math.min(1, p + dt * 1000 / HOLD_MS);
        if (p >= 1) { paint(); holding = false; return confirm(actOf(hEl), hEl); }
      }
    }
    if (!holding) { // damped spring back to 0 (ζ≈0.5: one visible undershoot)
      for (let s = 0; s < 4; s++) { const h = dt / 4; v += (-220 * p - 15 * v) * h; p += v * h; }
      if (Math.abs(p) < .002 && Math.abs(v) < .02) { p = 0; v = 0; paint(); return endHold(); }
    }
    paint();
    raf = requestAnimationFrame(loop);
  }
  function startHold(el) {
    if (busy || holding) return;
    if (hEl && hEl !== el) endHold();
    hEl = el; holding = true; v = 0;
    el.classList.add('pw-h');
    if (C.static) return;
    last = 0; if (!raf) raf = requestAnimationFrame(loop);
  }
  function release() {
    if (!holding) return;
    holding = false; v = -1.5;
    if (p < .04) { p = 0; paint(); return endHold(); }
    const m = box && box.querySelector('.pw-meter');
    if (m && !C.static) { m.classList.remove('nudge'); void m.offsetWidth; m.classList.add('nudge'); }
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  }
  function endHold() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (hEl) { hEl.classList.remove('pw-h'); hEl.style.removeProperty('--p'); hEl.style.removeProperty('--pr'); }
    hEl = null; holding = false; p = 0; v = 0;
    if (box) { box.classList.remove('pw-holding', 'pw-hot'); paint(); }
  }

  // ---------------------------------------------------------------- confirm curtain
  function confirm(a, el) {
    if (!a) return;
    busy = true;
    if (el && !C.static) { el.classList.remove('pw-boom'); void el.offsetWidth; el.classList.add('pw-boom'); }
    const ctx = C;
    SYS.ui(ctx, SYS.power.run(a.run), { revert: () => { if (C === ctx && box) lift(cur, el, 0); } });
    const stage = document.getElementById('stage');
    const cur = document.createElement('div');
    cur.className = `pw-curtain pw-c-${a.id}`;
    cur.innerHTML = `<div class="pw-cv"></div><div class="pw-cd2"></div><div class="pw-cs"></div>
      <div class="pw-cc"><div class="pw-cg">${G(a.g, 84, 1.8)}</div><div class="d pw-cn">${a.cur}</div></div>`;
    stage.appendChild(cur);
    if (C.static) return;
    lift(cur, el, 1900);
  }
  // curtain lifts after the demo beat, or at once when the backend refuses the action
  function lift(cur, el, ms) {
    if (cur.classList.contains('out')) return;
    later(() => { if (cur.classList.contains('out')) return; cur.classList.add('out'); endHold();
      later(() => { cur.remove(); busy = false; if (el) el.classList.remove('pw-boom'); }, 520); }, ms);
  }

  // ---------------------------------------------------------------- focus sync
  function sync() {
    const f = C.focused();
    if (f === lastF) return;
    lastF = f;
    const a = actOf(f);
    if (!a || !box) return;
    box.querySelector('.pw-sg').innerHTML = G(a.g, 60, 2);
    box.classList.toggle('pw-hold', !!a.hold);
    const sel = box.querySelector('.pw-sel');
    if (!C.static) { sel.classList.remove('pw-swap'); void sel.offsetWidth; sel.classList.add('pw-swap'); }
  }

  // ---------------------------------------------------------------- input
  const onKeyUp = e => { if (e.key === 'Enter' || e.key === ' ') release(); };
  const onUp = () => release();

  P3Menu.register('power', {
    title: 'POWER',
    render(root, ctx) {
      injectCSS();
      endHold(); busy = false; lastF = null; C = ctx;
      root.insertAdjacentHTML('beforeend', render());
      box = root.querySelector('.pw');
      box.addEventListener('pointerdown', e => {
        if (e.button !== 0 || busy) return;
        const el = e.target.closest('[data-act]'), a = actOf(el);
        if (a && a.hold && supported(a)) { ctx.focus(el); startHold(el); }
      });
      box.addEventListener('click', e => {
        const el = e.target.closest('[data-act]'), a = actOf(el);
        if (!a || busy) return;
        if (a.id === 'shell') {
          if (!ctx.static) { box.classList.remove('pw-reload'); void box.offsetWidth; box.classList.add('pw-reload'); }
          SYS.ui(ctx, SYS.power.run(a.run));
          return;
        }
        if (!supported(a)) return;
        if (!a.hold) confirm(a, el);
      });
    },
    onEnter(ctx) {
      C = ctx;
      addEventListener('keyup', onKeyUp);
      addEventListener('pointerup', onUp);
      addEventListener('blur', onUp);
      sync();
      // static screenshot states
      if (q.get('page') === 'power') {
        const f = ctx.focused(), a = actOf(f);
        const hv = parseFloat(q.get('hold'));
        if (a && a.hold && hv > 0) { hEl = f; f.classList.add('pw-h'); p = Math.min(1, hv); holding = true; paint(); holding = ctx.static ? false : holding; if (!ctx.static) { holding = false; v = 0; raf = requestAnimationFrame(loop); } }
        if (a && q.get('confirm') === '1' && !confirm.shown) { confirm.shown = true; confirm(a, f); }
      }
    },
    onKey(e, ctx) {
      if (busy) return true;   // curtain up: swallow everything until it lifts
      const k = e.key;
      if (k === 'Enter' || k === ' ') {
        const f = ctx.focused(), a = actOf(f);
        if (a && a.hold) { if (!e.repeat) startHold(f); return true; }
        return false;
      }
      if (holding && /^Arrow|^[wasd]$/.test(k)) return true;   // keep focus put while holding
      if (holding && (k === 'Escape' || k === 'Backspace')) { release(); return true; }
      return false;
    },
    onFocus() { if (box) sync(); },
    onLeave() {
      removeEventListener('keyup', onKeyUp);
      removeEventListener('pointerup', onUp);
      removeEventListener('blur', onUp);
      timers.forEach(clearTimeout); timers.clear();
      document.querySelectorAll('.pw-curtain').forEach(n => n.remove());
      endHold(); busy = false; box = null; lastF = null;
    },
  });
})();
