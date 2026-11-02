/* ==========================================================================
   P3 SHELL MENU — framework (menu-x.html). Static prototype, no build, file://.

   PAGE API
   --------------------------------------------------------------------------
   Each page is pages/<id>.js, loaded by a plain <script> after this file. Pages must not
   depend on each other; share only what this file exposes.
   Main list: APPS · STATUS · CALENDAR · SYSTEM · POWER (ITEMS below).

     P3Menu.register(id, {
       title:    'SYSTEM',              // P3 display noun shown in the page header
       render(root, ctx) {},            // build DOM into root (1410×680 stage px, overflow hidden).
                                        //   Called once on enter; root is emptied first.
                                        //   Mark focusables with [data-focus].
       onKey(e, ctx) { return false },  // gets EVERY keydown first (arrows/Enter/Esc/Backspace…);
                                        //   return true to swallow it (e.g. close an inner level
                                        //   on Escape).
       onEnter(ctx) {},                 // after render, when the page becomes active
       onLeave(ctx) {},                 // before the page is torn down (back / switch)
       onFocus(el, ctx) {},             // optional; after focus moved to el (key, mouse, ctx.focus)
     });

     ctx = {
       data,          // window.P3DATA (shared/data.js), read-only by convention
       static,        // true with ?static=1: no infinite animation, render final states
       back(),        // leave the page (same as Esc at top level)
       root,          // the page root element
       focus(el),     // move focus to el (plays the entry wobble)
       focused(),     // currently focused [data-focus] element or null
       refocus(),     // re-measure the indicator after you changed layout / swapped DOM
     }
     A ctx is only live while its page is open: after back / switch every call is a no-op
     (focused() returns null), so late timers in a page cannot leak focus.

   FOCUS MODEL (central; pages only mark elements)
     [data-focus]            focusable; ↑↓←→ move spatially to the nearest one in that direction,
                             mouse hover focuses, Enter / click = el.click().
     [data-autofocus]        initial focus (else first [data-focus]; ?sel=N picks the Nth).
     [data-cursor]           tide (default, also any unknown value) | wedge | none.
       tide   no box, no fill. Steady: element gets .is-focus → text/--p-fg turn --fill
              (#a3f0ff); a pulsing sky glow dot sits on its top-left corner and glides along.
       wedge  white wedge behind + red echo, .is-focus inverts --p-* to ink (rail-like lists).
       none   framework only toggles .is-focus / .p-wob; the page styles both.
     .is-focus               steady state, stays while focused. Never animated in a loop.
     .p-wob                  added for ~380ms on FRESH entry only (keyboard move, ctx.focus, or
                             mouseenter from outside the element); the default CSS plays a 320ms
                             --spring jelly and pops the glow dot. Re-hovering the same element
                             without leaving it does not re-trigger. Pages with data-cursor="none"
                             can hang their own keyframes on .p-wob. ?static=1 never adds it.
     Inside focusables use var(--p-fg) / var(--p-dim) / var(--p-track) / var(--p-on) for color
     so both modes can retint them; all primitives in menu.css already do.
     [data-disabled]         skipped by navigation.
     .p-toggle               click/Enter flips .on, fires 'p3change' {detail:{value:boolean}}.
     .p-slider               ←→ step, drag, wheel; fires 'p3change' {detail:{value:number}}.
     .p-hold                 hold Enter / pointer for data-hold ms; fires 'p3confirm'.
     Events bubble, so a page can root.addEventListener('p3change', …) once.
     Back: Esc / Backspace / right-click anywhere / ArrowLeft when nothing is to the left
     (and the focused element is not a slider). A page with inner levels (sub-pages) handles
     these in onKey (return true) until it is back at its top level.

   HELPERS   P3Menu.glyph(name, size=24, stroke=2) → inline SVG string (24-grid line icons, list:
             Object.keys(P3Menu.GLYPHS)); P3Menu.ui.setSlider(el, v); P3Menu.ui.rng(seed) → seeded random.

   URL / KEYS
     ?page=apps|status|calendar|system|power   ?static=1   ?sel=N (main list index, or focus
     index inside ?page)   ?bg=water|none.   Hidden dev keys: G backdrop,
     O replay open. Esc on the main list closes (prototype re-opens after 1s).
   ========================================================================== */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const q = new URLSearchParams(location.search);
  const STATIC = q.has('static') && q.get('static') !== '0';

  // ------------------------------------------------------------ main list
  // along the hair diagonal: top right → bottom left, P3R-style mixed angles
  const ITEMS = [
    { id: 'apps',     t: 'APPS',     x: 1190, y: 238, r: -12, c: '--c1' },
    { id: 'status',   t: 'STATUS',   x: 1138, y: 376, r: -6,  c: '--c4' },
    { id: 'calendar', t: 'CALENDAR', x: 1088, y: 512, r: -8,  c: '--c2' },
    { id: 'system',   t: 'SYSTEM',   x: 1068, y: 648, r: -3,  c: '--c1' },
    { id: 'power',    t: 'POWER',    x: 1030, y: 784, r: 4,   c: '--c4' },
  ];
  const RAIL = { x: 150, y: 270, dy: 62 };

  // ------------------------------------------------------------ glyphs
  const GLYPHS = {
    apps:    '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    music:   '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    chat:    '<path d="M4 4h16v11H9l-5 4z"/>',
    wifi:    '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle class="f" cx="12" cy="19.5" r="1.6"/>',
    bt:      '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
    vpn:     '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    kanban:  '<path d="M3 4h5v16H3zM10 4h5v11h-5zM17 4h4v7h-4z"/>',
    term:    '<path d="M2.5 4h19v16h-19z"/><path d="M6.5 9l3 3-3 3M12 15h5"/>',
    folder:  '<path d="M3 6h7l2 2h9v11H3z"/>',
    globe:   '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    ext:     '<path d="M8 16 17 7M9 7h8v8"/>',
    chev:    '<path d="M9 5l7 7-7 7"/>',
    back:    '<path d="M15 5l-7 7 7 7"/>',
    down:    '<path d="M5 9l7 7 7-7"/>',
    check:   '<path d="M4 12l5 5L20 6"/>',
    x:       '<path d="M6 6l12 12M18 6 6 18"/>',
    plus:    '<path d="M12 5v14M5 12h14"/>',
    moon:    '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    bell:    '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    bulb:    '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
    vol:     '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    mute:    '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 9l5 6M21 9l-5 6"/>',
    sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    out:     '<path d="M6 2.5h12v19H6z"/><circle cx="12" cy="14" r="3.5"/><circle class="f" cx="12" cy="6.5" r="1.2"/>',
    mic:     '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    head:    '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><path d="M3 14h4v7H3zM17 14h4v7h-4z"/>',
    mouse:   '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v3"/>',
    kbd:     '<path d="M2 6h20v12H2z"/><path d="M6 10h1M10 10h1M14 10h1M18 10h1M7 14h10"/>',
    display: '<path d="M3 4h18v12H3z"/><path d="M8 20h8M12 16v4"/>',
    cpu:     '<path d="M7 7h10v10H7z"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    ram:     '<path d="M3 7h18v9H3z"/><path d="M7 16v3M11 16v3M15 16v3M7 10v3M11 10v3M15 10v3"/>',
    disk:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
    temp:    '<path d="M10 4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0z"/><path d="M12 10v7"/>',
    bat:     '<path d="M3 7h16v10H3z"/><path d="M21 10.5v3"/>',
    bolt:    '<path class="f" d="M13 2 5 14h6l-1 8 8-12h-6z"/>',
    gauge:   '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
    lock:    '<path d="M5 11h14v10H5z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    sleep:   '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    exit:    '<path d="M10 4H4v16h6M9 12h11M16 8l4 4-4 4"/>',
    reboot:  '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    power:   '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
    play:    '<path class="f" d="M7 4l13 8-13 8z"/>',
    pause:   '<path class="f" d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
    prev:    '<path class="f" d="M18 5v14l-9-7zM6 5h2.5v14H6z"/>',
    next:    '<path class="f" d="M6 5v14l9-7zM15.5 5H18v14h-2.5z"/>',
    cal:     '<path d="M3 5h18v16H3z"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    gear:    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    list:    '<path d="M8 6h13M8 12h13M8 18h13"/><circle class="f" cx="4" cy="6" r="1.3"/><circle class="f" cx="4" cy="12" r="1.3"/><circle class="f" cx="4" cy="18" r="1.3"/>',
    search:  '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  };
  function glyph(name, size = 24, sw = 2) {
    const g = GLYPHS[name] || GLYPHS.x;
    return `<svg class="gsvg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="square" stroke-linejoin="miter">${g.replace(/class="f"/g, 'class="f" fill="currentColor" stroke="none"')}</g></svg>`;
  }
  function rng(seed) {
    let s = 2166136261;
    for (const c of String(seed)) s = Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  // ------------------------------------------------------------ registry
  const PAGES = {};
  function register(id, def) {
    if (!def || typeof def.render !== 'function') { console.warn(`P3Menu.register(${id}): render() missing`); return; }
    PAGES[id] = Object.assign({ title: id.toUpperCase() }, def);
  }

  // ------------------------------------------------------------ state
  let stage, menu, pg, root, cursor, tide;
  let cur = -1;            // selected main item
  let page = null;         // open page id
  let ctx = null;
  let focusEl = null;
  let busy = false;        // during open/close choreography
    const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  const scale = () => (stage ? stage.getBoundingClientRect().width / 1920 : 1);

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));


  // ------------------------------------------------------------ main list
  function buildMenu() {
    ITEMS.forEach((it, i) => {
      const el = document.createElement('div');
      el.className = 'it d';
      el.style.cssText = `--x:${it.x}px;--y:${it.y}px;--r:${it.r}deg;--c:var(${it.c});--i:${i};--n:${ITEMS.length};` +
        `--rx:${RAIL.x}px;--ry:${RAIL.y + i * RAIL.dy}px`;
      el.innerHTML = `<span class="mv"><span class="rt"><span class="sh sr"></span><span class="sh sw"></span>` +
        `<span class="echo">${it.t}</span><span class="tx">${it.t}</span></span></span>`;
      el.addEventListener('mouseenter', () => { if (!page && !busy) select(i); });
      el.addEventListener('click', e => { e.stopPropagation(); if (busy) return; select(i, true); confirmItem(); });
      menu.appendChild(el);
      it.el = el;
    });
  }
  function select(i, force) {
    i = (i + ITEMS.length) % ITEMS.length;
    if (i === cur && !force) return;
    if (cur >= 0) ITEMS[cur].el.classList.remove('on');
    cur = i;
    ITEMS[i].el.classList.add('on');
  }
  function confirmItem() {
    const it = ITEMS[cur], el = it.el;
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    if (page === it.id) return;
    if (!PAGES[it.id]) { console.warn(`pages/${it.id}.js not registered`); return; }
    openPage(it.id);
  }

  // ------------------------------------------------------------ pages
  function makeCtx(id) {
    // a ctx goes inert once its page has left (late timers / microtasks must not touch the menu)
    const live = () => page === id && ctx === c;
    const c = {
      data: window.P3DATA || {},
      static: STATIC,
      root,
      back: () => { if (live()) closePage(); },
      focus: el => { if (live()) setFocus(el); },
      focused: () => (live() ? focusEl : null),
      refocus: () => { if (live()) placeCursor(true); },
    };
    return c;
  }
  function headFor(id) {
    $('.pg-title', pg).textContent = PAGES[id].title;
  }
  function renderPage(id) {
    const P = PAGES[id];
    root.innerHTML = '';
    root.appendChild(cursor); root.appendChild(tide);
    cursor.classList.remove('on'); tide.classList.remove('on');
    focusEl = null;
    ctx = makeCtx(id);
    try { P.render(root, ctx); }
    catch (err) { console.error(err); root.insertAdjacentHTML('beforeend', `<div class="p-sec">RENDER ERROR · ${esc(err.message)}</div>`); }
    if (root.firstChild !== cursor) { root.prepend(tide); root.prepend(cursor); }
    initControls();
    let ins = $$('[data-in]', root);
    if (!ins.length) ins = [...root.children].filter(n => n !== cursor && n !== tide);
    ins.forEach((n, k) => { n.dataset.k = k; n.style.setProperty('--k', k); });
    headFor(id);
    const all = focusables();
    const selN = q.has('sel') && q.get('page') === id && !renderPage.usedSel ? +q.get('sel') : NaN;
    if (!Number.isNaN(selN)) renderPage.usedSel = true;
    const first = (!Number.isNaN(selN) && all[selN]) || $('[data-autofocus]', root) || all[0];
    if (first) setFocus(first, true);
    try { P.onEnter && P.onEnter(ctx); } catch (err) { console.error(err); }
  }
  function playEnter() {
    pg.classList.remove('enter', 'leave', 'swap'); void pg.offsetWidth; pg.classList.add('enter');
    cursor.style.visibility = tide.style.visibility = STATIC ? '' : 'hidden';
    if (!STATIC) later(() => { cursor.style.visibility = tide.style.visibility = ''; placeCursor(true); }, 520);
    later(() => pg.classList.remove('enter'), 1600);
  }
  function openPage(id) {
    if (!PAGES[id]) return;
    const i = ITEMS.findIndex(it => it.id === id);
    if (i >= 0) select(i, true);
    const swap = !!page;
    if (page) leaveHook();
    page = id;
    stage.classList.add('paged');
    pg.classList.add('show');
    menu.style.transform = '';
    if (swap && !STATIC) {
      pg.classList.remove('enter'); pg.classList.add('swap');
      later(() => { pg.classList.remove('swap'); renderPage(id); playEnter(); }, 150);
    } else { renderPage(id); playEnter(); }
  }
  function leaveHook() {
    const P = PAGES[page];
    if (holdEl) holdCancel();
    try { P && P.onLeave && P.onLeave(ctx); } catch (err) { console.error(err); }
  }
  function closePage() {
    if (!page) return;
    leaveHook();
    page = null; focusEl = null;
    stage.classList.remove('paged');
    pg.classList.remove('enter', 'swap'); pg.classList.add('leave');
    later(() => { if (!page) { pg.classList.remove('leave', 'show'); root.innerHTML = ''; } }, STATIC ? 0 : 260);
  }

  // ------------------------------------------------------------ in-page focus
  const focusables = () => $$('[data-focus]', root).filter(n => !n.hasAttribute('data-disabled') && n.offsetParent !== null);
  function boxOf(el) {
    // layout box relative to root, ignoring transforms (entrance animations)
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    if (n !== root) { // offsetParent chain escaped root; fall back to rects
      const r = el.getBoundingClientRect(), rr = root.getBoundingClientRect(), s = scale();
      return { x: (r.left - rr.left) / s, y: (r.top - rr.top) / s, w: r.width / s, h: r.height / s };
    }
    // subtract scroll offsets of scrolling ancestors inside root
    for (let p = el.parentElement; p && p !== root; p = p.parentElement) { x -= p.scrollLeft; y -= p.scrollTop; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  // data-cursor: wedge | none, anything else = tide
  const modeOf = el => { const m = el.dataset.cursor; return m === 'wedge' || m === 'none' ? m : 'tide'; };
  function placeCursor(instant) {
    if (!focusEl || !page) { cursor.classList.remove('on'); tide.classList.remove('on'); return; }
    const b = boxOf(focusEl);
    const mode = modeOf(focusEl);
    const use = mode === 'tide' ? tide : mode === 'wedge' ? cursor : null;
    [cursor, tide].forEach(c => { if (c !== use) c.classList.remove('on'); });
    if (!use) return;
    if (instant) use.style.transition = 'none';
    Object.assign(use.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    use.classList.add('on');
    if (instant) { void use.offsetWidth; use.style.transition = ''; }
  }
  // fresh-entry micro-animation: .p-wob on the element (jelly) + .wob on the tide dot (pop).
  // Fires on focus change and on a pointer re-entering the focused element, never while it rests.
  let wobT = 0, wobEl = null;
  function wob(el) {
    if (STATIC || !el) return;
    clearTimeout(wobT);
    if (wobEl && wobEl !== el) wobEl.classList.remove('p-wob');
    wobEl = el;
    el.classList.remove('p-wob'); tide.classList.remove('wob'); void el.offsetWidth;
    el.classList.add('p-wob');
    if (modeOf(el) === 'tide') tide.classList.add('wob');
    wobT = setTimeout(() => { el.classList.remove('p-wob'); tide.classList.remove('wob'); wobEl = null; }, 380);
  }
  function setFocus(el, instant) {
    if (!el || el === focusEl) { if (el) placeCursor(instant); return; }
    if (focusEl) focusEl.classList.remove('is-focus');
    focusEl = el;
    el.classList.add('is-focus');
    if (!instant && !STATIC) {
      cursor.classList.remove('moving'); void cursor.offsetWidth; cursor.classList.add('moving');
      requestAnimationFrame(() => cursor.classList.remove('moving'));
      wob(el);
    }
    placeCursor(instant || STATIC);
    const P = page && PAGES[page];
    if (P && P.onFocus && ctx) { try { P.onFocus(el, ctx); } catch (err) { console.error(err); } }
  }
  function move(dir) {
    const all = focusables();
    if (!all.length) return false;
    if (!focusEl || !all.includes(focusEl)) { setFocus(all[0]); return true; }
    const a = boxOf(focusEl);
    const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
    let best = null, bestS = Infinity;
    for (const el of all) {
      if (el === focusEl) continue;
      const b = boxOf(el);
      const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
      let prim, orth;
      if (dir === 'down' || dir === 'up') {
        prim = dir === 'down' ? b.y - (a.y + a.h) : a.y - (b.y + b.h);
        const c = dir === 'down' ? bcy - acy : acy - bcy;
        if (c <= 2) continue;
        prim = Math.max(prim, 0);
        orth = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)); // horizontal gap, 0 if overlapping
        orth += Math.abs(bcx - acx) * .1;
      } else {
        prim = dir === 'right' ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
        const c = dir === 'right' ? bcx - acx : acx - bcx;
        if (c <= 2) continue;
        prim = Math.max(prim, 0);
        orth = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
        orth += Math.abs(bcy - acy) * .1;
      }
      const s = prim + orth * 3;
      if (s < bestS) { bestS = s; best = el; }
    }
    if (best) { setFocus(best); return true; }
    return false;
  }

  // ------------------------------------------------------------ controls
  function setSlider(el, v, emit) {
    const min = +(el.dataset.min ?? 0), max = +(el.dataset.max ?? 100), step = +(el.dataset.step || 1);
    v = Math.max(min, Math.min(max, Math.round(v / step) * step));
    const changed = +el.dataset.value !== v;
    el.dataset.value = v;
    el.style.setProperty('--v', ((v - min) / (max - min || 1)) * 100);
    const sv = $('.p-sval', el); if (sv && sv.textContent !== String(v)) sv.textContent = v;
    if (emit && changed) el.dispatchEvent(new CustomEvent('p3change', { bubbles: true, detail: { value: v } }));
  }
  function initControls() {
    $$('.p-slider', root).forEach(el => setSlider(el, +(el.dataset.value ?? 0)));
    $$('.p-hold', root).forEach(el => {
      if (!$('.p-hold-fill', el)) el.insertAdjacentHTML('afterbegin', '<span class="p-hold-fill"></span>');
      el.style.setProperty('--hold', `${+(el.dataset.hold || 1000)}ms`);
    });
  }
  let holdEl = null, holdT = 0;
  function holdStart(el) {
    if (holdEl) return;
    holdEl = el;
    el.classList.remove('p-done'); void el.offsetWidth;
    el.classList.add('holding');
    holdT = setTimeout(() => {
      el.classList.remove('holding'); el.classList.add('p-done'); holdEl = null;
      el.dispatchEvent(new CustomEvent('p3confirm', { bubbles: true }));
      setTimeout(() => el.classList.remove('p-done'), 900);
    }, +(el.dataset.hold || 1000));
  }
  function holdCancel() {
    if (!holdEl) return;
    clearTimeout(holdT); holdEl.classList.remove('holding'); holdEl = null;
  }
  function activate(el) {
    if (!el) return;
    el.classList.remove('p-press'); void el.offsetWidth; el.classList.add('p-press');
    cursor.classList.remove('pop'); tide.classList.remove('pop'); void cursor.offsetWidth;
    if (modeOf(el) !== 'none') (modeOf(el) === 'tide' ? tide : cursor).classList.add('pop');
    if (el.classList.contains('p-toggle')) {
      const on = el.classList.toggle('on');
      el.dispatchEvent(new CustomEvent('p3change', { bubbles: true, detail: { value: on } }));
    }
  }
  function bindRoot() {
    root.addEventListener('click', e => {
      const el = e.target.closest('[data-focus]');
      if (!el || !root.contains(el) || el.hasAttribute('data-disabled')) return;
      setFocus(el);
      if (el.classList.contains('p-hold') || el.classList.contains('p-slider')) return;
      activate(el);
    });
    root.addEventListener('mouseover', e => {
      const el = e.target.closest('[data-focus]');
      if (!el || !root.contains(el) || el.hasAttribute('data-disabled') || holdEl) return;
      if (el !== focusEl) return setFocus(el);
      if (!el.contains(e.relatedTarget)) wob(el);   // pointer came back from outside
    });
    root.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const h = e.target.closest('.p-hold');
      if (h && root.contains(h)) { setFocus(h); holdStart(h); return; }
      const tr = e.target.closest('.p-track');
      const sl = tr && tr.closest('.p-slider');
      if (sl) {
        setFocus(sl);
        const min = +(sl.dataset.min ?? 0), max = +(sl.dataset.max ?? 100);
        const set = ev => { const r = tr.getBoundingClientRect(); setSlider(sl, min + (ev.clientX - r.left) / r.width * (max - min), true); };
        set(e); sl.classList.add('dragging'); tr.setPointerCapture(e.pointerId);
        tr.onpointermove = set;
        tr.onpointerup = tr.onpointercancel = () => { tr.onpointermove = null; sl.classList.remove('dragging'); };
      }
    });
    addEventListener('pointerup', holdCancel);
    root.addEventListener('pointerleave', holdCancel);
    root.addEventListener('wheel', e => {
      const sl = e.target.closest('.p-slider');
      if (!sl) return;
      e.preventDefault(); e.stopPropagation();
      setFocus(sl);
      setSlider(sl, +sl.dataset.value - Math.sign(e.deltaY) * +(sl.dataset.step || 1), true);
    }, { passive: false });
    new MutationObserver(() => initControls()).observe(root, { childList: true, subtree: true });
  }

  // ------------------------------------------------------------ open / close
  function open() {
    timers.forEach(clearTimeout); timers.clear();
    busy = !STATIC;
    stage.classList.remove('closing', 'closed', 'opening');
    if (STATIC) return;
    void stage.offsetWidth;
    stage.classList.add('opening');
    later(() => { stage.classList.remove('opening'); busy = false; }, 1300);
  }
  function close() {
    if (busy) return;
    busy = true;
    stage.classList.remove('opening');
    stage.classList.add('closing');
    later(() => { stage.classList.replace('closing', 'closed'); }, STATIC ? 0 : 720);
    later(() => open(), STATIC ? 0 : 1720);   // prototype: come back after 1s
  }

  // ------------------------------------------------------------ backdrop
  function setBg(mode) {
    stage.classList.toggle('bg-water', mode !== 'none');
    stage.classList.toggle('bg-none', mode === 'none');
  }
  function buildBubbles() {
    const r = rng('bubbles'), box = $('#bubbles');
    for (let k = 0; k < 16; k++) {
      const b = document.createElement('i'), s = 6 + r() * 16;
      b.style.cssText = `left:${760 + r() * 1140}px;top:${1100 + r() * 40}px;width:${s}px;height:${s}px;` +
        `animation-duration:${9 + r() * 10}s;animation-delay:${-r() * 18}s`;
      if (STATIC) b.style.transform = `translate(${r() * 14}px, ${-120 - r() * 820}px)`;
      box.appendChild(b);
    }
  }
  function tick() {
    const D = window.P3DATA && P3DATA.clock;
    const now = new Date();
    const mo = STATIC && D ? D.month : now.getMonth() + 1, da = STATIC && D ? D.day : now.getDate();
    const h = STATIC && D ? D.h : now.getHours(), mi = STATIC && D ? D.m : now.getMinutes();
    const dow = STATIC && D ? D.dow : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
    $('#md').textContent = `${mo}/${da}`;
    $('#dow').textContent = dow;
    $('#tod').textContent = h < 5 ? 'DARK HOUR' : h < 9 ? 'EARLY MORNING' : h < 12 ? 'MORNING' : h < 13 ? 'LUNCHTIME' :
      h < 17 ? 'AFTERNOON' : h < 19 ? 'AFTER SCHOOL' : 'EVENING';
    $('#hm').textContent = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  }
  function fit() {
    const s = Math.max(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `scale(${s})`;
  }

  // ------------------------------------------------------------ input
  function onKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const P = page && PAGES[page];
    if (P && P.onKey) {
      let r = false;
      try { r = P.onKey(e, ctx); } catch (err) { console.error(err); }
      if (r) { e.preventDefault(); return; }
    }
    const k = e.key;
    if (k === 'g' || k === 'G') { setBg(stage.classList.contains('bg-none') ? 'water' : 'none'); return; }
    if (k === 'o' || k === 'O') { if (!page) open(); return; }
    if (busy && !page) return;

    if (page) {
      const f = focusEl;
      switch (k) {
        case 'Escape': case 'Backspace': e.preventDefault(); return closePage();
        case 'ArrowUp': case 'w': e.preventDefault(); return void move('up');
        case 'ArrowDown': case 's': e.preventDefault(); return void move('down');
        case 'ArrowLeft': case 'ArrowRight': case 'a': case 'd': {
          e.preventDefault();
          const d = (k === 'ArrowLeft' || k === 'a') ? -1 : 1;
          if (f && f.classList.contains('p-slider')) return setSlider(f, +f.dataset.value + d * +(f.dataset.step || 1), true);
          if (!move(d < 0 ? 'left' : 'right') && d < 0) closePage();
          return;
        }
        case 'Enter': case ' ':
          e.preventDefault();
          if (!f || e.repeat) return;
          if (f.classList.contains('p-hold')) return holdStart(f);
          return f.click();
      }
      return;
    }
    switch (k) {
      case 'ArrowDown': case 's': case 'Tab': e.preventDefault(); return select(cur + 1);
      case 'ArrowUp': case 'w': e.preventDefault(); return select(cur - 1);
      case 'Enter': case ' ': case 'ArrowRight': e.preventDefault(); return confirmItem();
      case 'Escape': e.preventDefault(); return close();
    }
  }

  // ------------------------------------------------------------ init
  function init() {
    stage = $('#stage'); menu = $('#menu'); pg = $('#pg'); root = $('.pg-root', pg);
    cursor = document.createElement('div'); cursor.className = 'p-cursor';
    tide = document.createElement('div'); tide.className = 'p-tide';
    tide.innerHTML = '<svg class="p-tide-wave" viewBox="0 0 160 16" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M0 8 Q10 0 20 8 T40 8 T60 8 T80 8 T100 8 T120 8 T140 8 T160 8"/></svg>';

    setBg(q.get('bg') === 'none' ? 'none' : 'water');
    if (STATIC) stage.classList.add('static');
    fit(); addEventListener('resize', () => { fit(); placeCursor(true); });
    buildMenu(); buildBubbles(); tick(); if (!STATIC) setInterval(tick, 10000);
    bindRoot();

    addEventListener('keydown', onKey);
    addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') holdCancel(); });
    addEventListener('contextmenu', e => {
      e.preventDefault();
      if (busy && !page) return;
      if (page) {
        const P = PAGES[page];
        if (P.onKey) { let r = false; try { r = P.onKey(new KeyboardEvent('keydown', { key: 'Escape' }), ctx); } catch (err) { console.error(err); } if (r) return; }
        closePage();
      } else close();
    });
    let wheelLock = 0;
    addEventListener('wheel', e => {
      if (page || busy) return;
      const now = performance.now(); if (now < wheelLock) return;
      wheelLock = now + 90; select(cur + Math.sign(e.deltaY));
    }, { passive: true });

    // parallax (main list only; pages stay still so focus never drifts)
    const sea = $('.water .sea'), date = $('.date');
    if (!STATIC) addEventListener('mousemove', e => {
      const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
      sea.style.transform = `translate(${nx * -18}px, ${ny * -12}px)`;
      date.style.translate = `${nx * -6}px ${ny * -4}px`;
      menu.style.transform = page ? '' : `translate(${nx * 10}px, ${ny * 6}px)`;
    });

    const start = q.get('page');
    const sel = +(q.get('sel') ?? 0);
    select(start ? Math.max(0, ITEMS.findIndex(it => it.id === start)) : (Number.isFinite(sel) ? sel : 0), true);
    open();
    if (start && PAGES[start]) {
      if (STATIC) openPage(start);
      else later(() => { busy = false; stage.classList.remove('opening'); openPage(start); }, 650);
    }
  }

  window.P3Menu = { register, glyph, GLYPHS, ui: { setSlider: (el, v) => setSlider(el, v, false), rng }, items: ITEMS,
    open: id => openPage(id), back: () => closePage() };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else queueMicrotask(init);
})();
