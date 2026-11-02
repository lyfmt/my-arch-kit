/* ==========================================================================
   SYSTEM — in-menu system settings. Static prototype; page API: shared/menu.js header.

   LAYOUT   two levels, both "category rail (330px) + detail pane (1024px)".
     TOP    NETWORK · BLUETOOTH · SOUND · DISPLAY · MODE   daily quick controls
            MORE (pinned to the rail bottom, hairline above)  → preview tiles of the MORE categories
     MORE   INPUT · KEYBINDS · LOOK · POWER · NOTICES · GENERAL   finer DMS settings as P3R-style
            rows: label left, control right (toggle / slider / ◀ cycle ▶ / key field / action).

   KEYS
     rail     ↑↓ category (detail swaps live) · → / Enter into the detail (Enter on MORE opens
              the MORE level) · Esc / ← : TOP leaves the page, MORE goes back to TOP
     detail   ↑↓←→ move · Enter activate · Esc / Backspace, or ← at the left edge → rail
              slider ←→ ±step · cycle ←→ prev / next (Enter = next) · key field Enter = capture
     capture  press a combo that has a modifier; Esc cancels; a combo already bound is refused
     search   (KEYBINDS) type to filter · ⌫ delete · ↓ / Enter → results
     Right-click = Esc (framework).

   URL      ?cat=network|bluetooth|sound|display|mode|more   ?more=input|keys|look|power|notify|general
            ?focus=N  Nth focusable in the detail      ?pw=SSID  password row open
            ?q=TEXT   keybind search                   ?cap=1    capture state on the focused key field

   DATA + ACTIONS   all service data is read from shared/backend.js (P3Sys.<ns>.state) and every
     control calls a P3Sys action (Promise, revert on reject). S below holds UI state only.
     Subscriptions (P3Sys.on) re-render the open detail. The DMS / CLI mapping of each action is
     the @dms tag next to it in shared/backend.js; the QML port keeps this page's shape.
   ========================================================================== */
(() => {
  const G = (n, s = 24, w = 2) => P3Menu.glyph(n, s, w);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const q = new URLSearchParams(location.search);

  // ------------------------------------------------------------ categories
  const CATS = [
    { id: 'network',   t: 'NETWORK' },
    { id: 'bluetooth', t: 'BLUETOOTH' },
    { id: 'sound',     t: 'SOUND' },
    { id: 'display',   t: 'DISPLAY' },
    { id: 'mode',      t: 'MODE' },
  ];
  const MCATS = [
    { id: 'input',   t: 'INPUT' },
    { id: 'keys',    t: 'KEYBINDS' },
    { id: 'look',    t: 'LOOK' },
    { id: 'power',   t: 'POWER' },
    { id: 'notify',  t: 'NOTICES' },
    { id: 'general', t: 'GENERAL' },
  ];
  const CAT = id => CATS.find(c => c.id === id);
  const MCAT = id => MCATS.find(c => c.id === id);
  const PROFILES = [
    { id: 'power-saver', t: 'SAVER', g: 'bat' },
    { id: 'balanced',    t: 'BALANCED', g: 'gauge' },
    { id: 'performance', t: 'PERFORMANCE', g: 'bolt' },
  ];

  const MIN = ['1 分钟', '3 分钟', '5 分钟', '10 分钟', '15 分钟', '30 分钟', '从不'];
  const APPR = ['弹窗 + 声音', '仅弹窗', '静默', '关闭'];

  // ------------------------------------------------------------ state
  // S = UI state (lvl cat mcat last pw cap bq) + a flat cache of P3Sys state, refreshed by sync().
  const Y = () => window.P3Sys;
  let S = null;
  function initState() {
    const mq = q.get('more'), cq = q.get('cat');
    S = {
      lvl: MCAT(mq) ? 'more' : 'top',
      cat: CAT(cq) ? cq : cq === 'more' || MCAT(mq) ? 'more' : 'network',
      mcat: MCAT(mq) ? mq : 'input',
      bq: q.get('q') || '', cap: null, pw: null,
      last: {},              // remembered detail focus per category (data-key)
    };
    sync();
  }
  // copy backend state into the S cache the renderers read
  function sync() {
    const P = Y(), n = P.net.state, b = P.bt.state, a = P.audio.state, d = P.display.state, m = P.mode.state,
      bat = P.battery.state, sv = P.settings.state, df = P.defaults.state, u = P.update.state;
    Object.assign(S, {
      wifi: n.wifi, ssid: n.ssid, ip: n.ip, down: n.down, up: n.up, list: n.list, vpn: n.vpn, netBusy: n.connecting,
      vpnNode: P.clash.state.node,
      bt: b.on, devs: b.devices, scanning: b.scanning, btBusy: b.busy,
      vol: a.vol, muted: a.muted, mic: a.mic, micMuted: a.micMuted, sink: a.sink, src: a.source,
      sinks: a.sinks.map(x => ({ name: x.name, g: x.kind })), srcs: a.sources.map(x => ({ name: x.name, g: x.kind })),
      streams: a.streams,
      bright: d.bright, night: d.night, temp: d.temp, nsched: d.sched, monitors: d.monitors,
      profile: bat.profile || 'balanced', limit: bat.limit, bat,
      dnd: m.dnd, caffeine: m.caffeine, count: P.notify.state.items.length,
      ime: P.ime.state.im === 'keyboard-us' ? 'us' : 'rime', imeKey: P.ime.state.trigger,
      delay: sv.repeatDelay, rate: sv.repeatRate, tap: sv.tapToClick, natural: sv.naturalScroll, tspeed: sv.touchSpeed,
      theme: sv.theme, font: sv.font, fscale: sv.fontScale, motion: sv.motion, alpha: sv.popupAlpha,
      acOff: sv.acOff, acLock: sv.acLock, acSus: sv.acSus, btOff: sv.btOff, btLock: sv.btLock, btSus: sv.btSus,
      lid: sv.lid, lockSus: sv.lockBeforeSuspend, dndSched: sv.dndSchedule, dndFrom: sv.dndFrom, dndTo: sv.dndTo,
      popT: sv.popTimeout, popPos: sv.popPos,
      appr: P.rules.state,
      browser: df.browser, files: df.files, term: df.term, music: df.music,
      binds: P.keybinds.state.list.map(x => ({ k: x.key, k0: x.key0, a: x.label, cmd: x.cmd })),
      autoList: P.autostart.state.list,
      updates: u.count, updRunning: u.running,
    });
  }
  const ssidSig = () => (S.list.find(w => w.ssid === S.ssid) || { sig: 0 }).sig;
  const btConn = () => S.devs.filter(x => x.connected);
  const vpnShort = () => String(S.vpnNode).split('·').pop().trim();
  const curCat = () => S.lvl === 'more' ? S.mcat : S.cat;
  const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
  // cycle option lists, keyed by data-key of the .sy-cyc row
  const OPTS = {
    nsched: ['手动', '日落到日出', '22:00 – 07:00'],
    theme: ['P3 BLUE', 'DYNAMIC'], font: ['Barlow Condensed', 'Inter', 'Noto Sans CJK'],
    motion: ['减弱', '标准', '夸张'],
    acOff: MIN, acLock: MIN, acSus: MIN, btOff: MIN, btLock: MIN, btSus: MIN,
    lid: ['挂起', '锁屏', '关闭屏幕', '无操作'],
    dndFrom: HOURS, dndTo: HOURS, popT: ['3 秒', '5 秒', '8 秒', '常驻'], popPos: ['右上', '顶部居中', '右下'],
    browser: ['Chromium', 'Firefox'], files: ['Thunar', 'Nautilus'], term: ['kitty', 'foot'], music: ['网易云音乐', 'mpv'],
  };
  // ------------------------------------------------------------ page CSS (scoped to .sy)
  const STYLE = `
  .sy { position: absolute; inset: 0; padding: 10px 8px 0 18px; }
  .sy [data-need].sy-na { opacity: .32; }
  .sy .p-sec { margin-bottom: 10px; }
  .sy .p-sec.fr { margin-bottom: 24px; }
  .sy .p-sec b { color: var(--tx); font-weight: 700; margin-left: -6px; }
  .sy-big { font: italic 900 60px/.86 "P3", sans-serif; letter-spacing: -.01em; color: var(--p-fg); white-space: nowrap; padding-right: .06em; }
  .sy-n { font: italic 900 40px/.86 "P3", sans-serif; letter-spacing: -.01em; white-space: nowrap; padding-right: .06em; }
  .sy-gap { height: 22px; flex: none; }

  /* swap-in of a detail / view: blocks slide in from the right, staggered */
  .sy-in [data-s] { animation: syIn .46s var(--ease) backwards; animation-delay: calc(var(--s, 0) * 34ms); }
  @keyframes syIn { from { opacity: 0; transform: translateX(46px); } }
  .sy-in .p-sec[data-s]::after { animation: syRule .6s var(--ease) backwards; animation-delay: calc(var(--s, 0) * 34ms + 80ms); transform-origin: 0 50%; }
  @keyframes syRule { from { transform: scaleX(0); } }
  .sy-leaving { animation: syOut .16s cubic-bezier(.5,0,.9,.5) forwards; }
  @keyframes syOut { to { opacity: 0; transform: translateX(-50px); } }

  /* liquid switch: the fill sweeps in with a round leading edge, the knob stretches */
  .sy .p-switch { width: 60px; height: 28px; overflow: hidden; background: none !important; outline: 2px solid var(--p-track); outline-offset: -2px; }
  .sy .p-switch::before { content: ""; position: absolute; top: 0; bottom: 0; left: -14px; width: calc(100% + 28px);
    background: var(--p-on); border-radius: 0 14px 14px 0; transform: translateX(-100%);
    transition: transform .5s cubic-bezier(.3,1.35,.5,1); }
  .sy .p-switch::after { left: 5px; top: 5px; width: 18px; height: 18px; transform-origin: 50% 50%;
    transition: transform .42s cubic-bezier(.3,1.5,.5,1), background .15s, width .2s; z-index: 1; }
  .sy .p-toggle.on .p-switch { outline-color: var(--p-on); }
  .sy .p-toggle.on .p-switch::before { transform: translateX(-14px); }
  .sy .p-toggle.on .p-switch::after { transform: translateX(32px); background: var(--p-onfg); }
  .sy .sy-flip .p-switch::after { animation: syKnob .42s var(--ease); }
  @keyframes syKnob { 35% { width: 30px; } }
  .sy .sy-flip.on .p-switch::after { animation-name: syKnobR; }
  @keyframes syKnobR { 35% { width: 30px; margin-left: -12px; } }

  /* ---------- rail + detail */
  .sy-a { display: grid; grid-template-columns: 330px minmax(0, 1fr); column-gap: 56px; height: 100%; }
  .sy-rail { position: relative; display: flex; flex-direction: column; }
  .sy-rail::after { content: ""; position: absolute; right: -28px; top: 4px; bottom: 30px; width: 1px; background: var(--line); }
  .sy-cat { display: flex; align-items: center; gap: 14px; height: 64px; padding: 0 16px 0 18px; flex: none; color: var(--p-dim); }
  .sy-cat .sy-n { color: var(--p-dim); transition: color .2s, transform .35s var(--spring); }
  .sy-cat .p-meta { margin-left: auto; max-width: 128px; overflow: hidden; text-overflow: ellipsis; transition: color .2s; }
  .sy-cat.cur .sy-n { color: var(--p-on); }
  .sy-cat.cur .p-meta { color: var(--p-fg); }
  .sy-cat.is-focus .sy-n { color: var(--p-fg); transform: translateX(6px); }
  .sy-mark { position: absolute; left: 0; width: 6px; height: 34px; background: var(--fill); pointer-events: none;
    transition: top .5s var(--spring), opacity .2s, transform .3s var(--ease); transform-origin: 0 50%; }
  .sy-mode-rail .sy-mark { opacity: 0; transform: scaleX(0); }
  .sy-detail { position: relative; min-width: 0; height: 100%; }
  .sy-mode-rail .sy-detail { opacity: .78; transition: opacity .25s; }
  .sy-mode-detail .sy-detail { opacity: 1; transition: opacity .25s; }

  /* hero line at the top of a detail */
  .sy-hero { display: flex; align-items: flex-end; gap: 28px; height: 116px; padding: 0 18px 18px; flex: none; }
  .sy-hero .l1 { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .sy-hero .r { margin-left: auto; display: flex; align-items: flex-end; gap: 18px; }
  .sy-hero .r .p-meta { text-align: right; line-height: 1.5; }
  .sy-cols { display: grid; grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr)); column-gap: 28px; }
  .sy-col { display: flex; flex-direction: column; min-width: 0; }

  /* signal bars */
  .sy-sig { display: inline-flex; align-items: flex-end; gap: 3px; height: 20px; flex: none; }
  .sy-sig i { width: 5px; background: var(--p-track); }
  .sy-sig i:nth-child(1) { height: 25%; } .sy-sig i:nth-child(2) { height: 50%; } .sy-sig i:nth-child(3) { height: 75%; } .sy-sig i:nth-child(4) { height: 100%; }
  .sy-sig i.lit { background: var(--p-fg); }
  .sy-sig.big { height: 44px; gap: 6px; } .sy-sig.big i { width: 10px; }

  /* wifi list */
  .sy-net { height: 62px; }
  .sy-net .p-value { margin-left: 0; text-transform: none; }
  .sy-net .p-meta.r, .sy-row-r { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .sy-busy { position: relative; width: 70px; height: 3px; background: var(--p-track); overflow: hidden; }
  .sy-busy::after { content: ""; position: absolute; top: 0; bottom: 0; width: 30%; background: var(--p-fg); animation: syBusy .9s var(--ease) infinite; }
  @keyframes syBusy { from { left: -30%; } to { left: 100%; } }
  .sy-pw { display: flex; align-items: center; gap: 16px; height: 0; padding: 0 18px; margin: 0; background: var(--panel); overflow: hidden;
    animation: syPw .42s var(--spring) forwards; }
  @keyframes syPw { from { height: 0; margin: 0; } to { height: 60px; margin: 8px 0 10px; } }
  .static .sy-pw { height: 60px; margin: 8px 0 10px; }
  .sy-field { flex: 1; display: flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; outline: 1px solid var(--line); outline-offset: -1px; }
  .sy-field .dot { width: 10px; height: 10px; background: var(--tx); transform: rotate(45deg) scale(.86); animation: syDot .22s var(--spring); }
  @keyframes syDot { from { transform: rotate(45deg) scale(0); } }
  .sy-field .ph { font: 700 15px/1 "BarlowC", sans-serif; letter-spacing: .14em; color: var(--dim); }
  .sy-field .caret { width: 2px; height: 20px; background: var(--fill); animation: syCaret 1s steps(1) infinite; }
  @keyframes syCaret { 50% { opacity: 0; } }
  .static .sy-field .caret { animation: none; }
  .sy-shake { animation: syShake .4s var(--ease) !important; height: 60px; margin: 8px 0 10px; }
  @keyframes syShake { 20% { transform: translateX(-12px); } 45% { transform: translateX(9px); } 70% { transform: translateX(-5px); } }

  /* bluetooth cards */
  .sy-dev { height: 168px; display: flex; flex-direction: column; gap: 12px; }
  .sy-dev .top { display: flex; align-items: center; justify-content: space-between; color: var(--tx); }
  .sy-dev .sy-n { color: var(--tx); font-size: 40px; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; }
  .sy-dev .bot { margin-top: auto; display: flex; align-items: flex-end; gap: 14px; }
  .sy-dev .bot .p-bar { flex: 1; margin-bottom: 8px; }
  .sy-dev .act { margin-left: auto; }
  .sy-dev.fresh { animation: syNew .6s var(--spring) backwards; }
  @keyframes syNew { from { opacity: 0; transform: translateY(30px) scale(.94); } }
  .sy-pulse { animation: syBlink 1s steps(1) infinite; }
  @keyframes syBlink { 50% { opacity: .35; } }
  .sy-scan .sy-rings { position: relative; width: 24px; height: 24px; flex: none; }
  .sy-rings i { position: absolute; inset: 0; border: 2px solid var(--p-fg); border-radius: 50%; opacity: 0; }
  .sy-scanning .sy-rings i { animation: syRing 1.5s var(--ease) infinite; }
  .sy-scanning .sy-rings i:nth-child(2) { animation-delay: .5s; }
  .sy-scanning .sy-rings i:nth-child(3) { animation-delay: 1s; }
  @keyframes syRing { from { transform: scale(.2); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
  .sy-rings b { position: absolute; left: 9px; top: 9px; width: 6px; height: 6px; background: var(--p-fg); }
  .sy-rings i:nth-child(2) { transform: scale(.55); opacity: .9; } .sy-rings i:nth-child(1) { opacity: .45; }
  .sy-scanning .sy-rings i { opacity: 0; }

  /* sound */
  .sy .p-slider.big .p-sval { font-size: 64px; }
  .sy .p-slider .p-label { display: flex; align-items: center; gap: 12px; }
  .sy .sy-dimmed .p-track i, .sy .sy-dimmed .p-sval { opacity: .35; }
  .sy-radio .chk { margin-left: auto; color: var(--p-fg); opacity: 0; transform: scale(.4); transition: opacity .15s, transform .35s var(--spring); }
  .sy-radio.sel .chk { opacity: 1; transform: none; }
  .sy-radio .p-value { margin-left: 0; text-transform: none; }
  .sy-meter { display: flex; align-items: flex-end; gap: 5px; height: 84px; padding: 0 18px; }
  .sy-meter i { flex: 1; height: calc(var(--h, 0) * 1%); min-height: 3px; background: var(--fill); transition: height .09s linear; }
  .sy-meter i.pk { background: var(--accent); }
  .sy-meter.off i { background: var(--line); height: 3px !important; }

  /* display */
  .sy-tempw .p-label::after { content: ""; width: 14px; height: 14px; background: var(--sw, #fff); outline: 2px solid var(--p-track); outline-offset: 2px; transition: background .2s; }
  .sy-mrow { display: flex; align-items: center; gap: 16px; height: 50px; padding: 0 18px; border-bottom: 1px solid var(--line); }
  .sy-mrow .p-value { font-size: 19px; }
  .sy-mrow .p-meta.r { margin-left: auto; }

  /* profile segmented */
  .sy-seg { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); height: 84px; background: var(--panel); }
  .sy-seg .puck { position: absolute; top: 0; bottom: 0; width: calc(100% / 3); left: calc(var(--pi, 1) * 100% / 3); background: var(--fill);
    transition: left .5s cubic-bezier(.3,1.3,.5,1); }
  .sy-seg .puck.go { animation: syPuck .5s var(--ease); }
  @keyframes syPuck { 30% { transform: scaleX(1.12) scaleY(.92); } }
  .sy-seg .cell { position: relative; display: flex; align-items: center; gap: 14px; padding: 0 22px; color: var(--tx); transition: color .25s .08s; }
  .sy-seg .cell .p-ico { color: inherit; width: 26px; height: 26px; flex: none; }
  .sy-seg .cell .sy-n { color: inherit; font-size: 30px; }
  .sy-seg .cell.sel { color: var(--ink); }
  .sy-batt { display: grid; grid-template-columns: auto 1fr; column-gap: 34px; align-items: end; padding: 6px 18px 0; }
  .sy-lim { position: relative; height: 10px; background: var(--line); margin-bottom: 10px; }
  .sy-lim i { position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--v) * 1%); background: var(--fill); }
  .sy-lim u { position: absolute; top: -8px; bottom: -8px; left: calc(var(--lim) * 1%); width: 2px; background: var(--accent); text-decoration: none; }
  .sy-lim u::after { content: "LIMIT " attr(data-l); position: absolute; left: 8px; top: -14px; font: 700 12px/1 "BarlowC", sans-serif; letter-spacing: .14em; color: var(--accent); white-space: nowrap; }

  /* MORE entry pinned at the rail bottom, hairline above */
  .sy-gomore { margin-top: auto; margin-bottom: 30px; }
  .sy-gomore::before { content: ""; position: absolute; left: 18px; right: 16px; top: -14px; height: 1px; background: var(--line); }
  .sy-gomore .p-chev { margin-left: auto; }

  /* MORE preview tiles (TOP level, MORE selected) */
  .sy-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .sy-mt { height: 168px; display: flex; flex-direction: column; gap: 10px; padding: 22px; background: var(--panel); color: var(--p-fg); }
  .sy-mt .p-ico { color: var(--p-dim); }
  .sy-mt .sy-n { margin-top: auto; color: var(--p-fg); font-size: 36px; }
  .sy-mt.is-focus { background: color-mix(in srgb, var(--fill) 12%, var(--panel)); }

  /* cycle select: ◀ value ▶ on the right of a row */
  .sy-cyc > * { white-space: nowrap; }
  .sy-cyc .sy-cv { margin-left: auto; display: flex; align-items: center; gap: 12px; color: var(--p-fg); }
  .sy-cyc .sy-cv .p-value { min-width: 160px; text-align: center; text-transform: none; white-space: nowrap; }
  .sy-cyc .sy-cv .ar { color: var(--p-dim); opacity: 0; transition: opacity .15s, transform .25s var(--spring); }
  .sy-cyc .sy-cv .ar.l svg { transform: scaleX(-1); }
  .sy-cyc.is-focus .sy-cv .ar { opacity: 1; }
  .sy-cyc.bumpL .ar.l { transform: translateX(-5px); } .sy-cyc.bumpR .ar.r { transform: translateX(5px); }
  .sy-cyc .p-value.go { animation: syVal .3s var(--spring); }
  @keyframes syVal { from { opacity: 0; transform: translateY(8px); } }
  .sy .p-row .zh.l { font-size: 18px; letter-spacing: .04em; color: var(--p-fg); }
  .sy .p-row img.ai { width: 28px; height: 28px; flex: none; }
  .sy .p-row .p-value.n { margin-left: 0; text-transform: none; }

  /* key chips + capture */
  .sy-kc { display: inline-flex; gap: 6px; flex: none; }
  .sy-kc b { font: 700 15px/1 "BarlowC", sans-serif; letter-spacing: .08em; text-transform: uppercase; padding: 6px 8px 5px;
    outline: 1px solid var(--p-track); outline-offset: -1px; color: var(--p-fg); }
  .sy-kc.chg b { outline-color: var(--p-fg); }
  .sy-capt { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .sy-capt .lbl { font: 700 15px/1 "BarlowC", sans-serif; letter-spacing: .14em; color: var(--accent); }
  .sy-capt i { width: 10px; height: 10px; background: var(--accent); animation: syBlink 1s steps(1) infinite; }
  .static .sy-capt i { animation: none; }
  .sy-capting { outline: 2px solid var(--accent); outline-offset: -2px; }

  /* keybind search + list */
  .sy-search { display: flex; align-items: center; gap: 14px; height: 56px; padding: 0 18px; outline: 1px solid var(--line); outline-offset: -1px; color: var(--p-fg); }
  .sy-search .p-ico { color: var(--p-dim); }
  .sy-search .tx { font: 700 20px/1 "BarlowC", sans-serif; letter-spacing: .06em; color: var(--p-fg); white-space: pre; }
  .sy-search .ph { font: 700 15px/1 "BarlowC", sans-serif; letter-spacing: .14em; color: var(--dim); }
  .sy-search .caret { width: 2px; height: 22px; background: var(--fill); opacity: 0; }
  .sy-search.is-focus .caret { opacity: 1; animation: syCaret 1s steps(1) infinite; }
  .static .sy-search .caret { animation: none; }
  .sy-search .n { margin-left: auto; }
  .sy-blist { height: 504px; overflow-y: auto; scrollbar-width: none; margin-top: 10px; }
  .sy-blist::-webkit-scrollbar { display: none; }
  .sy-bind { display: grid; grid-template-columns: 230px 150px minmax(0, 1fr); align-items: center; height: 56px; }
  .sy-bind .cmd { font: 500 14px/1 ui-monospace, monospace; color: var(--p-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sy-bind.cap .cmd { display: none; }
  .sy-bind.cap .sy-capt { grid-column: 3; justify-self: end; }
  .sy-none { padding: 30px 18px; }
  .sy-hold { height: 56px; }
  .sy-hold .p-label { flex: none; }
  .sy-hold.p-btn { justify-content: flex-start; }
  .sy-hold .p-meta { margin-left: auto; position: relative; }
`;


  // ------------------------------------------------------------ small builders
  const sig = (v, big) => `<span class="sy-sig${big ? ' big' : ''}">${[1, 30, 55, 75].map(t => `<i class="${v >= t ? 'lit' : ''}"></i>`).join('')}</span>`;
  const chev = () => `<span class="p-chev">${G('chev', 18)}</span>`;
  const lab = label => `<span class="p-label">${label}</span>`;
  const tog = (key, label, on, opt = {}) => `
    <div class="p-row ${opt.tall ? 'tall' : ''} p-toggle ${on ? 'on' : ''}" data-focus data-key="${key}" ${opt.need ? `data-need="${opt.need}"` : ''}>
      ${opt.img ? `<img class="ai" src="${esc(opt.img)}" alt="">` : opt.g ? `<span class="p-ico">${G(opt.g)}</span>` : ''}
      ${opt.meta ? `<span class="p-two"><span class="p-label">${label}</span><span class="p-meta" data-bind="${opt.meta}"></span></span>` : `<span class="${opt.n ? 'p-value n' : 'p-label'}">${label}</span>`}
      <span class="p-switch"></span></div>`;
  const slider = (key, label, g, v, o = {}) => `
    <div class="p-slider ${o.big ? 'big' : ''}" data-focus data-key="${key}" data-value="${v}" data-min="${o.min ?? 0}" data-max="${o.max ?? 100}"
      data-step="${o.step ?? 5}" ${o.need ? `data-need="${o.need}"` : ''}>
      <span class="p-label">${o.img ? `<img class="ai" src="${esc(o.img)}" alt="" style="width:22px;height:22px">` : g ? G(g, 20) : ''}${label}</span><b class="p-num sm p-sval"></b><div class="p-track"><i></i></div></div>`;
  // ◀ value ▶ cycle select; S[key] (or o.get/o.set) holds the index into OPTS[key] (or o.opts)
  const cyc = (key, label, o = {}) => {
    const opts = o.opts || OPTS[key], i = o.i ?? S[key];
    return `<div class="p-row sy-cyc" data-focus data-key="${key}" ${o.need ? `data-need="${o.need}"` : ''}>
      ${o.img ? `<img class="ai" src="${esc(o.img)}" alt="">` : o.g ? `<span class="p-ico">${G(o.g)}</span>` : ''}${o.n ? `<span class="p-value n">${label}</span>` : lab(label)}
      <span class="sy-cv"><span class="ar l">${G('chev', 18)}</span><span class="p-value">${esc(opts[i])}</span><span class="ar r">${G('chev', 18)}</span></span></div>`;
  };
  const act = (key, g, label, value) => `
    <div class="p-row" data-focus data-key="${key}">
      <span class="p-ico">${G(g)}</span>${lab(label)}<span class="p-value" style="margin-left:auto">${esc(value)}</span>${chev()}</div>`;
  const info = (label, value) => `<div class="p-row"><span class="p-label" style="color:var(--dim)">${label}</span><span class="p-value">${esc(value)}</span></div>`;
  const keyChips = (k, chg) => `<span class="sy-kc ${chg ? 'chg' : ''}">${k.split('+').map(p => `<b>${esc(p)}</b>`).join('')}</span>`;
  const capUI = () => `<span class="sy-capt"><i></i><span class="lbl">PRESS KEYS</span></span>`;
  const devGlyph = k => ({ headphones: 'head', mouse: 'mouse', kbd: 'kbd' }[k] || 'bt');
  const kelvinColor = k => { // flat swatch, warm → neutral (approximate blackbody)
    const t = (k - 2500) / 4000;
    const r = 255, g = Math.round(160 + 85 * t), b = Math.round(70 + 170 * t);
    return `rgb(${r},${g},${b})`;
  };

  // ------------------------------------------------------------ live text bindings
  const BIND = {
    ssid:    () => S.wifi ? S.ssid : 'OFFLINE',
    netline: () => S.wifi ? `CONNECTED · WPA2 · ${/2\.4/.test(S.ssid) ? '2.4' : '5'} GHZ` : 'WI-FI RADIO OFF',
    vpnmeta: () => S.vpn ? `TUN ON · ${vpnShort()}` : 'DIRECT · NO PROXY',
    wifimeta:() => S.wifi ? S.ssid : 'OFF',
    btmeta:  () => !S.bt ? 'OFF' : btConn().length ? btConn().map(x => x.name).join(', ') : 'NO DEVICE',
    btname:  () => !S.bt ? 'BT OFF' : (btConn()[0] || { name: 'NO DEVICE' }).name,
    btline:  () => S.bt ? `ADAPTER ON · ${S.devs.length} PAIRED · ${btConn().length} CONNECTED` : 'ADAPTER OFF',
    scanmeta:() => S.scanning ? 'SCANNING NEARBY…' : '',
    nightmeta: () => S.night ? `ON · ${S.temp}K` : 'OFF',
    dndmeta: () => S.dnd ? 'SILENT · POPUPS HIDDEN' : `${S.count} UNREAD`,
    cafmeta: () => S.caffeine ? 'IDLE INHIBITED' : 'IDLE TIMERS ACTIVE',
    bcount:  () => { const n = filteredBinds().length; return S.bq ? `${n} / ${S.binds.length}` : `${S.binds.length} BINDS`; },
    'cat:network':   () => S.wifi ? S.ssid : 'OFF',
    'cat:bluetooth': () => !S.bt ? 'OFF' : `${btConn().length} ON`,
    'cat:sound':     () => S.muted ? 'MUTED' : `${S.vol}%`,
    'cat:display':   () => `${S.bright}%${S.night ? ' · NIGHT' : ''}`,
    'cat:mode':      () => PROFILES.find(p => p.id === S.profile).t + (S.dnd ? ' · DND' : ''),
  };
  const NEED = { wifi: () => S.wifi, bt: () => S.bt, ap: () => S.wifi && !S.netBusy, dev: () => S.bt && !S.btBusy, night: () => S.night, dsch: () => S.dndSched };

  // ------------------------------------------------------------ TOP details
  const DETAIL = {
    network() {
      const rows = S.list.map(w => {
        const cur = w.ssid === S.ssid, busy = S.netBusy === w.ssid;
        const right = busy ? `<span class="sy-row-r"><span class="p-meta">CONNECTING</span><span class="sy-busy"></span></span>`
          : cur ? `<span class="sy-row-r"><span class="p-chip">CONNECTED</span></span>`
          : `<span class="sy-row-r">${w.sec ? `<span class="p-ico">${G('lock', 18)}</span>` : ''}${chev()}</span>`;
        const row = `<div class="p-row sy-net" data-focus data-key="ap:${esc(w.ssid)}" data-need="${busy ? 'wifi' : 'ap'}" data-ssid="${esc(w.ssid)}">
            ${sig(w.sig)}<span class="p-value">${esc(w.ssid)}</span>${right}</div>`;
        const pw = S.pw && S.pw.ssid === w.ssid ? `
          <div class="sy-pw" data-s>
            <span class="p-ico">${G('lock', 20)}</span>
            <div class="sy-field" data-focus data-key="pw">${pwInner()}</div></div>` : '';
        return row + pw;
      }).join('');
      return `
        <div class="sy-hero" data-s>
          <div class="l1"><span class="p-meta" data-bind="netline"></span><span class="sy-big" data-bind="ssid"></span></div>
          <div class="r">${sig(S.wifi ? ssidSig() : 0, true)}</div>
        </div>
        <div class="sy-cols" data-s>
          ${tog('wifi', 'WI-FI', S.wifi, { tall: true, g: 'wifi', meta: 'wifimeta' })}
          ${tog('vpn', 'CLASH TUN', S.vpn, { tall: true, g: 'vpn', meta: 'vpnmeta' })}
        </div>
        <div class="sy-gap"></div>
        <div class="p-sec" data-s>AVAILABLE · ${S.list.length}</div>
        <div data-s>${rows}</div>`;
    },
    bluetooth() {
      const cards = S.devs.map(x => {
        const busy = S.btBusy === x.name;
        return `<div class="p-card sy-dev ${x.fresh ? 'fresh' : ''}" data-focus data-key="dev:${esc(x.name)}" data-need="${busy ? 'bt' : 'dev'}">
          <div class="top"><span class="p-ico">${G(devGlyph(x.kind), 28)}</span>
            ${busy ? `<span class="p-chip ghost sy-pulse">${x.connected ? 'DISCONNECTING' : 'CONNECTING'}</span>`
              : x.connected ? '<span class="p-chip">CONNECTED</span>' : x.nearby ? '<span class="p-chip hot">NEW</span>' : '<span class="p-chip ghost">PAIRED</span>'}</div>
          <div class="sy-n">${esc(x.name)}</div>
          <div class="bot">${x.connected && x.battery != null
              ? `<div class="p-bar" style="--v:${x.battery}"><i></i></div><span class="p-num sm">${x.battery}<small class="p-unit">%</small></span>`
              : ''}</div>
        </div>`;
      }).join('');
      return `
        <div class="sy-hero" data-s>
          <div class="l1"><span class="p-meta" data-bind="btline"></span><span class="sy-big" data-bind="btname"></span></div>
        </div>
        <div class="sy-cols" data-s>
          ${tog('bt', 'BLUETOOTH', S.bt, { tall: true, g: 'bt', meta: 'btmeta' })}
          <div class="p-row tall p-toggle sy-scan ${S.scanning ? 'on sy-scanning' : ''}" data-focus data-key="scan" data-need="bt">
            <span class="sy-rings"><i></i><i></i><i></i><b></b></span>
            <span class="p-two"><span class="p-label">DISCOVER</span><span class="p-meta" data-bind="scanmeta"></span></span><span class="p-switch"></span></div>
        </div>
        <div class="sy-gap"></div>
        <div class="p-sec fr" data-s>DEVICES · ${S.devs.length}</div>
        <div class="p-grid" style="--cols:3" data-s>${cards}</div>`;
    },
    sound() {
      const radios = (arr, cur, pre) => arr.map((s, i) => `
        <div class="p-row sy-radio ${i === cur ? 'sel' : ''}" data-focus data-key="${pre}:${i}">
          <span class="p-ico">${G(s.g)}</span><span class="p-value">${esc(s.name)}</span><span class="chk">${G('check', 22, 2.4)}</span></div>`).join('');
      const apps = S.streams.map(a => `<div data-s>${slider(`app:${a.id}`, esc(a.name), '', a.vol, { img: a.icon, step: 5 })}</div>`).join('');
      return `
        <div class="sy-cols" style="padding-top:8px">
          <div class="sy-col">
            <div class="p-sec" data-s>OUTPUT</div>
            <div data-s class="${S.muted ? 'sy-dimmed' : ''}" id="sy-volwrap">${slider('vol', 'VOLUME', 'vol', S.vol, { big: true, step: 2 })}</div>
            <div data-s>${tog('mute', 'MUTE', S.muted, { g: 'mute' })}</div>
            <div data-s>${radios(S.sinks, S.sink, 'sink')}</div>
            <div class="sy-gap"></div>
            <div class="p-sec" data-s>INPUT</div>
            <div data-s>${radios(S.srcs, S.src, 'src')}</div>
          </div>
          <div class="sy-col">
            <div class="p-sec" data-s>APPS</div>
            ${apps}
            <div class="sy-gap" style="height:12px"></div>
            <div class="p-sec" data-s>MICROPHONE</div>
            <div data-s class="${S.micMuted ? 'sy-dimmed' : ''}" id="sy-micwrap">${slider('mic', 'GAIN', 'mic', S.mic)}</div>
            <div data-s>${tog('micmute', 'MIC MUTE', S.micMuted, { g: 'mute' })}</div>
            <div class="sy-meter ${S.micMuted ? 'off' : ''}" data-s style="height:52px;margin-top:12px">${Array.from({ length: 28 }, (_, i) => `<i style="--h:${meterSeed(i)}"></i>`).join('')}</div>
          </div>
        </div>`;
    },
    display() {
      const M = S.monitors || [];
      const rows = M.map(m => `<div class="sy-mrow"><span class="p-ico">${G('display', 20)}</span><span class="p-value">${m.name}</span>
          ${m.primary ? '<span class="p-chip">PRIMARY</span>' : ''}<span class="p-meta r">${m.w}×${m.h} · ×${m.scale}</span></div>`).join('');
      return `
        <div class="sy-cols" style="padding-top:8px">
          <div class="sy-col">
            <div class="p-sec" data-s>BRIGHTNESS</div>
            <div data-s>${slider('bright', 'BACKLIGHT', 'sun', S.bright, { big: true })}</div>
            <div class="sy-gap"></div>
            <div class="p-sec" data-s>MONITORS</div>
            <div data-s>${rows}</div>
          </div>
          <div class="sy-col">
            <div class="p-sec" data-s>NIGHT LIGHT</div>
            <div data-s>${tog('night', 'NIGHT LIGHT', S.night, { tall: true, g: 'moon', meta: 'nightmeta' })}</div>
            <div data-s class="sy-tempw" style="--sw:${kelvinColor(S.temp)}">${slider('temp', 'TEMPERATURE', '', S.temp, { min: 2500, max: 6500, step: 250, need: 'night' })}</div>
            <div data-s>${cyc('nsched', 'SCHEDULE', { g: 'cal', need: 'night' })}</div>
          </div>
        </div>`;
    },
    mode() {
      const b = S.bat;
      return `
        <div class="p-sec fr" data-s style="margin-top:8px">POWER PROFILE</div>
        <div data-s>${segHTML()}</div>
        <div class="sy-gap" style="height:30px"></div>
        <div class="sy-cols" data-s>
          ${tog('dnd', 'DO NOT DISTURB', S.dnd, { tall: true, g: 'bell', meta: 'dndmeta' })}
          ${tog('caffeine', 'CAFFEINE', S.caffeine, { tall: true, g: 'sun', meta: 'cafmeta' })}
        </div>
        <div class="sy-gap" style="height:34px"></div>
        <div class="p-sec" data-s>BATTERY</div>
        <div class="sy-batt" data-s>
          <div><span class="p-num" style="font-size:80px">${b.pct}<small class="p-unit">%</small></span></div>
          <div class="p-stack" style="gap:14px">
            <span class="p-meta">${b.charging ? 'CHARGING' : 'ON BATTERY'} · ${b.remain} LEFT · ${b.watts} W</span>
            <div class="sy-lim" style="--v:${b.pct};--lim:${S.limit}" data-l="${S.limit}"><i></i><u data-l="${S.limit}"></u></div>
          </div>
        </div>`;
    },
    more() {
      const g = { input: 'kbd', keys: 'list', look: 'display', power: 'sleep', notify: 'bell', general: 'gear' };
      return `
        <div class="p-sec fr" data-s style="margin-top:8px">MORE</div>
        <div class="sy-tiles" data-s>${MCATS.map(c => `
          <div class="sy-mt" data-focus data-key="mt:${c.id}">
            <span class="p-ico">${G(g[c.id], 26)}</span><span class="sy-n">${c.t}</span></div>`).join('')}</div>`;
    },
  };

  // ------------------------------------------------------------ MORE details
  function filteredBinds() {
    const t = S.bq.trim().toLowerCase();
    return t ? S.binds.filter(b => (b.k + ' ' + b.a + ' ' + b.cmd).toLowerCase().includes(t)) : S.binds;
  }
  function bindRows() {
    const L = filteredBinds();
    if (!L.length) return `<div class="sy-none p-meta">NO MATCH</div>`;
    return L.map(b => {
      const i = S.binds.indexOf(b), cap = S.cap === `bind:${i}`;
      return `<div class="p-row sy-bind ${cap ? 'cap sy-capting' : ''}" data-focus data-key="bind:${i}">
        ${keyChips(b.k, b.k !== b.k0)}<span class="zh l">${esc(b.a)}</span><span class="cmd">${esc(b.cmd)}</span>${cap ? capUI() : ''}</div>`;
    }).join('');
  }
  const searchInner = () => `<span class="p-ico">${G('search', 20)}</span>${S.bq ? `<span class="tx">${esc(S.bq)}</span>` : ''}<i class="caret"></i>
    ${S.bq ? '' : '<span class="ph">TYPE TO SEARCH</span>'}<span class="p-meta n" data-bind="bcount"></span>`;

  const MDETAIL = {
    input() {
      const ime = [['rime', '中 · RIME', 'fcitx5-rime 拼音'], ['us', 'EN · KEYBOARD-US', 'keyboard-us']];
      const cap = S.cap === 'imeKey';
      return `
        <div class="sy-cols" style="padding-top:8px">
          <div class="sy-col">
            <div class="p-sec" data-s>INPUT METHOD</div>
            <div data-s>${ime.map(([id, n, m]) => `
              <div class="p-row sy-radio ${S.ime === id ? 'sel' : ''}" data-focus data-key="ime:${id}">
                <span class="p-value" style="margin-left:0">${n}</span><span class="p-meta">${m}</span><span class="chk">${G('check', 22, 2.4)}</span></div>`).join('')}</div>
            <div data-s><div class="p-row ${cap ? 'sy-capting' : ''}" data-focus data-key="imeKey">
              <span class="p-ico">${G('kbd')}</span>${lab('SWITCH KEY')}${cap ? capUI() : `<span style="margin-left:auto">${keyChips(S.imeKey)}</span>`}</div></div>
            <div class="sy-gap"></div>
            <div class="p-sec" data-s>KEYBOARD</div>
            <div data-s>${slider('delay', 'REPEAT DELAY · MS', '', S.delay, { min: 150, max: 800, step: 25 })}</div>
            <div data-s>${slider('rate', 'REPEAT RATE · /S', '', S.rate, { min: 10, max: 80, step: 5 })}</div>
          </div>
          <div class="sy-col">
            <div class="p-sec" data-s>TOUCHPAD</div>
            <div data-s>${tog('tap', 'TAP TO CLICK', S.tap, {})}</div>
            <div data-s>${tog('natural', 'NATURAL SCROLL', S.natural, {})}</div>
            <div data-s>${slider('tspeed', 'POINTER SPEED', 'mouse', S.tspeed)}</div>
          </div>
        </div>`;
    },
    keys() {
      return `
        <div data-s style="padding-top:8px"><div class="sy-search" data-focus data-key="search">${searchInner()}</div></div>
        <div class="sy-blist" data-s id="sy-blist">${bindRows()}</div>
        <div data-s style="display:flex;align-items:center;gap:16px;margin-top:14px">
          <div class="p-row" style="flex:1;border:0" data-focus data-key="bindReset">
            <span class="p-ico">${G('reboot', 20)}</span>${lab('RESET ALL')}</div>
        </div>`;
    },
    look() {
      return `
        <div class="sy-cols" style="padding-top:8px">
          <div class="sy-col">
            <div class="p-sec" data-s>THEME</div>
            <div data-s>${cyc('theme', 'COLOR', { g: 'bulb' })}</div>
            <div data-s>${act('wall', 'display', 'WALLPAPER', 'MOD+Y')}</div>
            <div data-s>${slider('alpha', 'PANEL OPACITY', '', S.alpha, { min: 40, max: 100 })}</div>
          </div>
          <div class="sy-col">
            <div class="p-sec" data-s>TEXT</div>
            <div data-s>${cyc('font', 'FONT')}</div>
            <div data-s>${slider('fscale', 'FONT SCALE · %', '', S.fscale, { min: 80, max: 140, step: 5 })}</div>
            <div class="sy-gap"></div>
            <div class="p-sec" data-s>MOTION</div>
            <div data-s>${cyc('motion', 'ANIMATION', { g: 'play' })}</div>
          </div>
        </div>`;
    },
    power() {
      return `
        <div class="sy-cols" style="padding-top:8px">
          <div class="sy-col">
            <div class="p-sec" data-s>PLUGGED IN</div>
            <div data-s>${cyc('acOff', 'SCREEN OFF')}${cyc('acLock', 'LOCK')}${cyc('acSus', 'SUSPEND')}</div>
            <div class="sy-gap"></div>
            <div class="p-sec" data-s>LID & LOCK</div>
            <div data-s>${cyc('lid', 'LID CLOSE', { g: 'sleep' })}</div>
            <div data-s>${tog('lockSus', 'LOCK BEFORE SLEEP', S.lockSus)}</div>
            <div data-s>${act('lockNow', 'lock', 'LOCK NOW', 'MOD+ALT+L')}</div>
          </div>
          <div class="sy-col">
            <div class="p-sec" data-s>ON BATTERY</div>
            <div data-s>${cyc('btOff', 'SCREEN OFF')}${cyc('btLock', 'LOCK')}${cyc('btSus', 'SUSPEND')}</div>
            <div class="sy-gap"></div>
            <div class="p-sec" data-s>CHARGING</div>
            <div data-s>${slider('limit', 'CHARGE LIMIT · %', 'bat', S.limit, { min: 60, max: 100, step: 5 })}</div>
          </div>
        </div>`;
    },
    notify() {
      const apps = [['飞书', 'shared/icons/feishu.png'], ['QQ', 'shared/icons/qq.png'], ['Clash Verge', 'shared/icons/clash-verge.png'], ['网易云音乐', 'shared/icons/netease.svg']];
      return `
        <div class="sy-cols" style="padding-top:8px">
          <div class="sy-col">
            <div class="p-sec" data-s>DND SCHEDULE</div>
            <div data-s>${tog('dndSched', 'SCHEDULE', S.dndSched, { g: 'moon' })}</div>
            <div data-s>${cyc('dndFrom', 'FROM', { need: 'dsch' })}${cyc('dndTo', 'UNTIL', { need: 'dsch' })}</div>
            <div class="sy-gap"></div>
            <div class="p-sec" data-s>POPUPS</div>
            <div data-s>${cyc('popT', 'TIMEOUT')}${cyc('popPos', 'POSITION')}</div>
          </div>
          <div class="sy-col">
            <div class="p-sec" data-s>PER APP</div>
            <div data-s>${apps.map(([n, ic]) => cyc(`appr:${n}`, esc(n), { opts: APPR, i: S.appr[n], img: ic, n: true })).join('')}</div>
          </div>
        </div>`;
    },
    general() {
      return `
        <div class="sy-cols" style="padding-top:8px">
          <div class="sy-col">
            <div class="p-sec" data-s>DEFAULT APPS</div>
            <div data-s>${cyc('browser', 'BROWSER', { g: 'globe' })}${cyc('files', 'FILES', { g: 'folder' })}${cyc('term', 'TERMINAL', { g: 'term' })}${cyc('music', 'MUSIC', { g: 'music' })}</div>
            <div class="sy-gap"></div>
            <div class="p-sec" data-s>UPDATES</div>
            <div data-s><div class="p-btn p-hold sy-hold" data-focus data-key="upd" data-hold="900" ${S.updates && !S.updRunning ? '' : 'data-disabled style="opacity:.35"'}>
              <span class="p-ico">${G('reboot', 20)}</span><span class="p-label">${S.updRunning ? '更新中' : S.updates ? `UPDATE ${S.updates}` : 'UP TO DATE'}</span></div></div>
          </div>
          <div class="sy-col">
            <div class="p-sec" data-s>AUTOSTART</div>
            <div data-s>${S.autoList.map(a => tog(`auto:${a.id}`, esc(a.name), a.on, { img: a.icon, n: true })).join('')}</div>
            <div class="sy-gap" style="height:16px"></div>
            <div class="p-sec" data-s>ABOUT</div>
            <div data-s>${info('HOST', 'lyfmt-arch')}${info('KERNEL', '7.2.11-zen1-1-zen')}</div>
          </div>
        </div>`;
    },
  };

  function segHTML() {
    const pi = PROFILES.findIndex(p => p.id === S.profile);
    return `<div class="sy-seg" style="--pi:${pi}"><span class="puck"></span>
      ${PROFILES.map((p, i) => `<div class="cell ${i === pi ? 'sel' : ''}" data-focus data-key="prof:${p.id}">
        <span class="p-ico">${G(p.g, 26)}</span><span class="sy-n">${p.t}</span></div>`).join('')}</div>`;
  }
  const pwInner = () => S.pw.val.length
    ? Array.from(S.pw.val).map(() => '<i class="dot"></i>').join('') + '<i class="caret"></i>'
    : '<i class="caret"></i><span class="ph">PASSWORD</span>';
  const meterSeed = (() => { const r = P3Menu.ui.rng('mic'); const a = Array.from({ length: 28 }, () => r()); return i => Math.round(12 + a[i] * 70 * Math.sin(Math.PI * (i + 2) / 31)); })();

  // ------------------------------------------------------------ runtime
  let C = null, R = null;         // live ctx / root
  const T = new Set();            // timers to clear on leave
  const later = (fn, ms) => { const t = setTimeout(() => { T.delete(t); fn(); }, ms); T.add(t); return t; };
  let meterT = 0, urlUsed = false, capH = null, capBusy = false, unsub = [];
  const $ = (s, n = R) => n && n.querySelector(s);
  const $$ = (s, n = R) => n ? [...n.querySelectorAll(s)] : [];
  const detailEl = () => $('.sy-detail');

  function ensureCSS() {
    if (document.getElementById('sy-css')) return;
    const st = document.createElement('style'); st.id = 'sy-css'; st.textContent = STYLE; document.head.appendChild(st);
  }
  function refresh() {
    $$('[data-bind]').forEach(n => { const f = BIND[n.dataset.bind]; if (f) { const v = String(f()); if (n.textContent !== v) n.textContent = v; } });
    $$('[data-need]').forEach(n => { const ok = NEED[n.dataset.need](); n.classList.toggle('sy-na', !ok); n.toggleAttribute('data-disabled', !ok); });
    const hs = $('.sy-hero .sy-sig.big'); if (hs) hs.outerHTML = sig(S.wifi ? ssidSig() : 0, true);
    const vw = $('#sy-volwrap'); if (vw) vw.classList.toggle('sy-dimmed', S.muted);
    const mw = $('#sy-micwrap'); if (mw) mw.classList.toggle('sy-dimmed', S.micMuted);
    const me = $('.sy-meter'); if (me) me.classList.toggle('off', S.micMuted);
    const sw = $('.sy-tempw'); if (sw) sw.style.setProperty('--sw', kelvinColor(S.temp));
    const sc = $('.sy-scan'); if (sc) sc.classList.toggle('sy-scanning', S.scanning);
  }
  function stamp(box, animate) {
    $$('[data-s]', box).forEach((n, i) => n.style.setProperty('--s', i));
    box.classList.remove('sy-in');
    if (animate && !C.static) { void box.offsetWidth; box.classList.add('sy-in'); later(() => box.classList.remove('sy-in'), 1100); }
  }
  const detailHTML = () => S.lvl === 'more' ? MDETAIL[S.mcat]() : DETAIL[S.cat]();

  // ---------- detail swap — keeps focus on the same data-key when possible
  function renderDetail(animate, keepKey) {
    const box = detailEl(); if (!box) return;
    const f = C.focused(), key = keepKey !== undefined ? keepKey : (f && box.contains(f) ? f.dataset.key : null);
    box.innerHTML = detailHTML();
    stamp(box, animate);
    refresh();
    if (key) {
      const n = $(`[data-key="${CSS.escape(key)}"]`, box);
      if (n && !n.hasAttribute('data-disabled')) C.focus(n);
      else if (n) {   // kept row just became disabled (e.g. 更新中): nearest enabled row before it, else first
        const all = $$('[data-focus]', box), i = all.indexOf(n);
        const p = all.slice(0, i).reverse().find(x => !x.hasAttribute('data-disabled')) || all.find(x => !x.hasAttribute('data-disabled'));
        if (p) C.focus(p);
      }
    }
    C.refocus();
    startMeter();
  }
  function showCat(id) {
    if (curCat() === id) return;
    if (S.lvl === 'more') S.mcat = id; else S.cat = id;
    S.pw = null; S.cap = null;
    $$('.sy-cat[data-cat]').forEach(n => n.classList.toggle('cur', n.dataset.cat === id));
    moveMark();
    renderDetail(true, null);
  }
  function moveMark() {
    const m = $('.sy-mark'), c = $(`.sy-cat[data-cat="${curCat()}"]`);
    if (m && c) m.style.top = `${c.offsetTop + (c.offsetHeight - 34) / 2}px`;
  }
  const inRail = el => !!(el && el.closest('.sy-rail'));
  function syncMode() {
    const f = C.focused();
    const wrap = $('.sy-a'); if (!wrap) return;
    const rail = inRail(f);
    wrap.classList.toggle('sy-mode-rail', rail); wrap.classList.toggle('sy-mode-detail', !rail);
  }

  // ---------- views: TOP and MORE share the rail + detail frame
  function view() {
    const more = S.lvl === 'more', list = more ? MCATS : CATS, cur = curCat();
    const cats = list.map(c => `
      <div class="sy-cat ${c.id === cur ? 'cur' : ''}" data-focus data-in data-cat="${c.id}" data-key="cat:${c.id}">
        <span class="sy-n">${c.t}</span>${more ? '' : `<span class="p-meta" data-bind="cat:${c.id}"></span>`}</div>`).join('');
    const tail = more ? '' : `
        <div class="sy-cat sy-gomore ${cur === 'more' ? 'cur' : ''}" data-focus data-in data-cat="more" data-key="cat:more">
          <span class="sy-n">MORE</span>${chev()}</div>`;
    return `<div class="sy sy-a sy-mode-rail sy-lv-${S.lvl}">
      <div class="sy-rail"><span class="sy-mark"></span>${cats}${tail}</div>
      <div class="sy-detail" data-in></div></div>`;
  }
  function draw(animate, focusKey) {
    const host = $('.sy-host');
    host.innerHTML = view();
    const d = detailEl(); d.innerHTML = detailHTML();
    stamp(d, false);
    if (animate && !C.static) {
      $$('.sy-cat', host).forEach((n, i) => { n.dataset.s = ''; n.style.setProperty('--s', i); });
      stamp(host, true);
    }
    refresh();
    const n = focusKey && $(`[data-key="${CSS.escape(focusKey)}"]`, host);
    C.focus(n || $(`.sy-cat[data-cat="${curCat()}"]`, host));
    requestAnimationFrame(() => { moveMark(); C.refocus(); });
    moveMark(); startMeter(); syncMode();
  }
  function goLevel(lvl, mcat) {
    endCapture(false);
    const from = S.lvl; S.lvl = lvl; S.pw = null;
    if (mcat) S.mcat = mcat;
    if (lvl === 'top') S.cat = 'more';
    const focusKey = lvl === 'more' ? (mcat ? null : `cat:${S.mcat}`) : 'cat:more';
    const host = $('.sy-host');
    const fin = () => { host.classList.remove('sy-leaving'); draw(true, focusKey); if (lvl === 'more' && mcat) enterDetail(); };
    if (C.static || from === lvl) return fin();
    host.classList.add('sy-leaving'); later(fin, 150);
  }

  // ---------- mic level meter (secondary motion)
  function startMeter() {
    clearInterval(meterT);
    const me = $('.sy-meter'); if (!me || C.static) return;
    const bars = [...me.children], r = P3Menu.ui.rng('lvl' + Date.now());
    meterT = setInterval(() => {
      if (!me.isConnected) return clearInterval(meterT);
      if (S.micMuted) return;
      const g = S.mic / 100, env = .35 + .65 * Math.abs(Math.sin(Date.now() / 420));
      bars.forEach((b, i) => {
        const h = Math.max(4, Math.min(100, (12 + r() * 80 * Math.sin(Math.PI * (i + 2) / 31)) * g * env * 1.3));
        b.style.setProperty('--h', h); b.classList.toggle('pk', h > 88);
      });
    }, 110);
  }

  // ------------------------------------------------------------ actions
  const flip = n => { n.classList.remove('sy-flip'); void n.offsetWidth; n.classList.add('sy-flip'); };
  // every control → a P3Sys action. On reject: resync from the backend and redraw (revert).
  const revert = key => () => { if (!S) return; sync(); if (C && R && detailEl()) renderDetail(false, key); };
  const run = (p, key, o = {}) => Y().ui(C, p, { revert: o.revert || revert(key), done: o.done });
  // mine(): the DOM already shows this change (optimistic), so its emit only refreshes, it does not rebuild the detail
  const pending = {};
  const mine = (p, ...ns) => { ns.forEach(n => pending[n] = (pending[n] || 0) + 1); const f = () => ns.forEach(n => pending[n]--); p.then(f, f); return p; };
  const quiet = (p, key) => p.catch(() => revert(key)());   // sliders: revert on error
  const SETK = { tap: 'tapToClick', natural: 'naturalScroll', lockSus: 'lockBeforeSuspend', dndSched: 'dndSchedule',
    delay: 'repeatDelay', rate: 'repeatRate', tspeed: 'touchSpeed', alpha: 'popupAlpha', fscale: 'fontScale',
    theme: 'theme', font: 'font', motion: 'motion', acOff: 'acOff', acLock: 'acLock', acSus: 'acSus',
    btOff: 'btOff', btLock: 'btLock', btSus: 'btSus', lid: 'lid', dndFrom: 'dndFrom', dndTo: 'dndTo', popT: 'popTimeout', popPos: 'popPos' };
  const TOG = {
    wifi:    v => { if (!v) S.pw = null; return Y().net.setWifi(v); },
    vpn:     v => Y().clash.setTun(v),
    bt:      v => Y().bt.setPower(v),
    scan:    v => Y().bt.setScan(v),
    dnd:     v => Y().mode.setDnd(v),
    caffeine:v => Y().mode.setCaffeine(v),
    night:   v => Y().display.setNight(v),
    mute:    v => Y().audio.setMuted(v),
    micmute: v => Y().audio.setMicMuted(v),
  };
  const SLD = {
    vol:    v => Y().audio.setVolume(v),
    mic:    v => Y().audio.setMic(v),
    bright: v => Y().display.setBrightness(v),
    temp:   v => Y().display.setTemp(v),
    limit:  v => Y().battery.setLimit(v),
  };
  // namespaces whose emit after this page's own change needs no rebuild (wifi / bt / scan rebuild: rows change)
  const TOG_NS = { vpn: ['net', 'clash'], dnd: ['mode'], caffeine: ['mode'], night: ['display'], mute: ['audio'], micmute: ['audio'] };
  const SLD_NS = { vol: 'audio', mic: 'audio', bright: 'display', temp: 'display', limit: 'battery' };
  // cycle select: read the index from the cache, write through the backend
  function cycGet(k) { return k.startsWith('appr:') ? S.appr[k.slice(5)] : S[k]; }
  function cycCall(k, i) {
    if (k.startsWith('appr:')) return Y().rules.set(k.slice(5), i);
    if (k === 'nsched') return Y().display.setSchedule(i);
    if (k in Y().defaults.state) return Y().defaults.set(k, i);
    return Y().settings.set(SETK[k], i);
  }
  function stepCyc(n, d) {
    const k = n.dataset.key, opts = k.startsWith('appr:') ? APPR : OPTS[k];
    const i = (cycGet(k) + d + opts.length) % opts.length;
    if (k.startsWith('appr:')) S.appr = { ...S.appr, [k.slice(5)]: i }; else S[k] = i;   // optimistic; sync() restores
    const v = $('.sy-cv .p-value', n); v.textContent = opts[i]; v.classList.remove('go'); void v.offsetWidth; v.classList.add('go');
    n.classList.remove('bumpL', 'bumpR'); void n.offsetWidth; n.classList.add(d < 0 ? 'bumpL' : 'bumpR');
    later(() => n.classList.remove('bumpL', 'bumpR'), 220);
    run(mine(cycCall(k, i), k.startsWith('appr:') ? 'rules' : k === 'nsched' ? 'display' : k in Y().defaults.state ? 'defaults' : 'settings'), k);
  }
  function onChange(e) {
    const n = e.target.closest('[data-key]'); if (!n) return;
    const k = n.dataset.key, v = e.detail.value;
    if (k.startsWith('auto:')) { flip(n); run(mine(Y().autostart.set(k.slice(5), v), 'autostart'), k); return; }
    if (k.startsWith('app:')) { quiet(mine(Y().audio.setStream(k.slice(4), v), 'audio'), k); return; }
    if (TOG[k]) { flip(n); S[{ mute: 'muted', micmute: 'micMuted', scan: 'scanning' }[k] || k] = v; run(TOG_NS[k] ? mine(TOG[k](v), ...TOG_NS[k]) : TOG[k](v), k); }
    else if (SETK[k] && n.classList.contains('p-toggle')) { flip(n); S[k] = v; run(mine(Y().settings.set(SETK[k], v), 'settings'), k); }
    else if (SLD[k]) { S[k] = v; quiet(mine(SLD[k](v), SLD_NS[k]), k); }
    else if (SETK[k]) { S[k] = v; quiet(mine(Y().settings.set(SETK[k], v), 'settings'), k); }
    else return;
    if (k === 'limit') { const u = $('.sy-lim u'); if (u) u.dataset.l = S.limit; }
    refresh();
  }
  function setProfileUI(id) {
    S.profile = id;
    const pi = PROFILES.findIndex(p => p.id === id);
    $$('.sy-seg').forEach(sg => {
      sg.style.setProperty('--pi', pi);
      const pk = $('.puck', sg); pk.classList.remove('go'); void pk.offsetWidth; pk.classList.add('go');
      $$('.cell', sg).forEach((c, i) => c.classList.toggle('sel', i === pi));
    });
    refresh();
  }
  function setProfile(id) {
    const old = S.profile; if (old === id) return;
    setProfileUI(id);
    run(mine(Y().battery.setProfile(id), 'battery'), `prof:${id}`, { revert: () => { if (S && R) setProfileUI(old); } });
  }
  const shakePw = () => { const f = $('.sy-pw'); if (!f) return; f.classList.remove('sy-shake'); void f.offsetWidth; f.classList.add('sy-shake'); };
  // backend sets net.connecting (emit → the row shows CONNECTING, others disabled); 'auth' reopens the field
  function connectAp(ssid, pw = '') {
    S.pw = null;
    renderDetail(false, `ap:${ssid}`);
    run(Y().net.connect(ssid, pw), `ap:${ssid}`, { revert: e => {
      if (!S) return; sync();
      if (!(C && R && detailEl())) return;
      if (e && e.code === 'auth') { S.pw = { ssid, val: '' }; renderDetail(false, 'pw'); shakePw(); }
      else renderDetail(false, `ap:${ssid}`);
    } });
  }
  function onClick(e) {
    const n = e.target.closest('[data-focus]'); if (!n || n.hasAttribute('data-disabled') || S.cap) return;
    const k = n.dataset.key || '';
    if (n.classList.contains('sy-cat')) {
      if (n.dataset.cat === 'more') { if (S.cat === 'more') goLevel('more'); else showCat('more'); return; }
      showCat(n.dataset.cat); return;
    }
    if (k.startsWith('mt:')) return goLevel('more', k.slice(3));
    if (n.classList.contains('sy-cyc')) {
      return stepCyc(n, e.target.closest('.ar.l') ? -1 : 1);   // click ◀ steps back; Enter / click elsewhere steps on
    }
    if (k.startsWith('bind:') || k === 'imeKey') return startCapture(k);
    if (k === 'search') { const f = $('[data-key^="bind:"]'); if (f) C.focus(f); return; }
    if (k === 'bindReset') { S.bq = ''; run(Y().keybinds.resetAll(), 'bindReset', { done: () => { if (C && R && detailEl()) renderDetail(false, 'bindReset'); } }); return; }
    if (k === 'lockNow') { run(Y().power.run('lock'), k); return; }
    if (k.startsWith('ap:')) {
      const w = S.list.find(x => x.ssid === n.dataset.ssid);
      if (!w || S.netBusy) return;
      if (w.ssid === S.ssid) return;
      if (!w.sec || w.saved) return connectAp(w.ssid);
      S.pw = { ssid: w.ssid, val: '' };
      renderDetail(false, 'pw');
      return;
    }
    if (k.startsWith('dev:')) {
      const x = S.devs.find(d => `dev:${d.name}` === k); if (!x || S.btBusy) return;
      run(Y().bt.toggle(x.name), k);
      return;
    }
    if (k.startsWith('sink:') || k.startsWith('src:')) {
      const out = k.startsWith('sink:'), i = +k.split(':')[1], pre = out ? 'sink' : 'src';
      const mark = key => $$(`.sy-radio[data-key^="${pre}:"]`).forEach(r => r.classList.toggle('sel', r.dataset.key === key));
      mark(k);
      run(out ? Y().audio.setSink(i) : Y().audio.setSource(i), k, { revert: () => { if (!S) return; sync(); mark(`${pre}:${S[pre]}`); } });
      return;
    }
    if (k.startsWith('ime:')) {
      const mark = id => $$('.sy-radio[data-key^="ime:"]').forEach(r => r.classList.toggle('sel', r.dataset.key === `ime:${id}`));
      mark(k.slice(4));
      run(Y().ime.set(k.slice(4) === 'us' ? 'keyboard-us' : 'rime'), k, { revert: () => { if (!S) return; sync(); mark(S.ime); } });
      return;
    }
    if (k.startsWith('prof:')) return setProfile(k.slice(5));
  }
  function onConfirm(e) {
    if (e.target.dataset.key !== 'upd') return;
    run(Y().update.run(), 'upd');   // emit 'update' → 更新中, then UP TO DATE
  }

  // ---------- backend subscriptions: sync the cache, refresh live text, rebuild the detail that shows ns
  const NS = ['net', 'bt', 'audio', 'display', 'mode', 'battery', 'clash', 'ime', 'settings', 'rules', 'keybinds', 'autostart', 'update', 'defaults', 'notify'];
  const DEP = { network: ['net', 'clash'], bluetooth: ['bt'], sound: ['audio', 'bt'], display: ['display'], mode: ['battery', 'mode'],
    input: ['ime', 'settings'], keys: ['keybinds'], look: ['settings'], power: ['settings', 'battery'], notify: ['settings', 'rules'],
    general: ['defaults', 'autostart', 'update'] };
  function onSys(ns) {
    if (!S || !C || !R || !R.isConnected || !detailEl()) return;   // page left / ctx dead
    sync();
    if (!pending[ns] && (DEP[curCat()] || []).includes(ns)) renderDetail(false);
    else refresh();
  }
  function subscribe() { unsubscribe(); unsub = NS.map(ns => Y().on(ns, () => onSys(ns))); }
  function unsubscribe() { unsub.forEach(f => f()); unsub = []; }

  // ---------- key capture (rebind). Window capture phase: the framework drops modifier keys.
  const MODK = { Control: 1, Shift: 1, Alt: 1, Meta: 1, Super: 1, OS: 1 };
  function comboOf(e) {
    let key = e.key.length === 1 ? e.key.toUpperCase() : { ' ': 'Space', Escape: 'Esc' }[e.key] || e.key;
    if (/^Arrow/.test(key)) key = key.slice(5);
    const p = [];
    if (e.metaKey) p.push('Mod'); if (e.ctrlKey) p.push('Ctrl'); if (e.altKey) p.push('Alt'); if (e.shiftKey) p.push('Shift');
    return { mods: p.length, k: [...p, key].join('+') };
  }
  function startCapture(key) {
    if (S.cap) return;
    S.cap = key; renderDetail(false, key);
    if (C.static) return;
    capH = e => {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat || MODK[e.key]) return;
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey) return endCapture(false);
      const c = comboOf(e);
      if (!c.mods) return;
      if (capBusy) return;
      const ime = S.cap === 'imeKey', b = !ime && S.binds[+S.cap.slice(5)];
      capBusy = true;
      (ime ? Y().ime.setTrigger(c.k) : Y().keybinds.rebind(b.k, c.k)).then(r => {
        capBusy = false; if (!S || !S.cap) return;
        sync(); endCapture(true);
      }, e => {
        capBusy = false; if (!S || !S.cap) return;
        if (!(e && e.code === 'conflict')) endCapture(false);   // conflict: stay in capture, try another combo
      });
    };
    addEventListener('keydown', capH, true);
  }
  function endCapture(ok) {
    if (capH) { removeEventListener('keydown', capH, true); capH = null; }
    if (!S || !S.cap) return;
    const k = S.cap; S.cap = null;
    if (R && detailEl()) { renderDetail(false, k); if (ok) { const n = $(`[data-key="${CSS.escape(k)}"] .sy-kc`); if (n) { n.classList.add('p-press'); } } }
    
  }

  // ---------- keybind search typing
  function searchKey(e) {
    const k = e.key;
    if (k === 'ArrowDown' || k === 'Enter') { const f = $('[data-key^="bind:"]'); if (f) C.focus(f); return true; }
    if (k === 'Backspace') { if (!S.bq) return false; S.bq = S.bq.slice(0, -1); }
    else if (k.length === 1 && k !== ' ' || (k === ' ' && S.bq)) { if (S.bq.length >= 24) return true; S.bq += k; }
    else return false;
    $('.sy-search').innerHTML = searchInner();
    const L = $('#sy-blist'); L.innerHTML = bindRows(); L.scrollTop = 0;
    refresh(); C.refocus();
    return true;
  }

  // ---------- password field typing
  function pwKey(e) {
    const k = e.key;
    if (k === 'Escape') { const s = S.pw.ssid; S.pw = null; renderDetail(false, `ap:${s}`); return true; }
    if (k === 'Enter') {
      connectAp(S.pw.ssid, S.pw.val);   // backend validates (<8 → 'auth' → field reopens with a shake)
      return true;
    }
    if (k === 'Backspace') { S.pw.val = S.pw.val.slice(0, -1); $('.sy-field').innerHTML = pwInner(); return true; }
    if (k.length === 1 && S.pw.val.length < 32) { S.pw.val += k; $('.sy-field').innerHTML = pwInner(); return true; }
    return false;   // arrows etc. fall through
  }

  // ---------- keyboard routing
  function hasLeftIn(scope, f) {
    const a = f.getBoundingClientRect();
    return $$('[data-focus]', scope).some(n => n !== f && !n.hasAttribute('data-disabled') && n.offsetParent && n.getBoundingClientRect().right <= a.left + 2);
  }
  function lockRail(on) { $$('.sy-rail [data-focus]').forEach(n => n.toggleAttribute('data-disabled', on)); }
  function enterDetail() {
    const box = detailEl(); if (!box) return;
    const c = curCat(), last = S.last[c] && $(`[data-key="${CSS.escape(S.last[c])}"]`, box);
    const n = (last && !last.hasAttribute('data-disabled') && last) || $('[data-focus]:not([data-disabled])', box);
    if (n) C.focus(n);
  }
  function toRail() {
    const f = C.focused(); if (f && f.dataset.key) S.last[curCat()] = f.dataset.key;
    const c = $(`.sy-cat[data-cat="${curCat()}"]`); if (c) C.focus(c);
  }
  // keep the focused row visible inside a scrolling list (the framework does not scroll)
  function keepVisible() {
    const f = C.focused(), L = f && f.closest('.sy-blist'); if (!L) return;
    const a = f.getBoundingClientRect(), b = L.getBoundingClientRect();
    if (a.top < b.top || a.bottom > b.bottom) { L.scrollTop += a.top < b.top ? a.top - b.top : a.bottom - b.bottom; C.refocus(); }
  }
  function keyNav(e, f) {
    const k = e.key, up = k === 'ArrowUp' || k === 'w', dn = k === 'ArrowDown' || k === 's';
    const lt = k === 'ArrowLeft' || k === 'a', rt = k === 'ArrowRight' || k === 'd', go = rt || k === 'Enter' || k === ' ';
    if (inRail(f)) {
      if (up || dn) {
        const list = $$('.sy-rail [data-focus]'), i = list.indexOf(f);
        const n = list[Math.max(0, Math.min(list.length - 1, i + (up ? -1 : 1)))];
        if (n && n !== f) { C.focus(n); showCat(n.dataset.cat); }
        return true;
      }
      if (go) {
        if (e.repeat) return true;
        if (curCat() !== f.dataset.cat) showCat(f.dataset.cat);
        if (f.dataset.cat === 'more' && S.lvl === 'top' && k !== 'ArrowRight' && k !== 'd') { goLevel('more'); return true; }
        enterDetail(); return true;
      }
      if ((k === 'Escape' || k === 'Backspace' || lt) && S.lvl === 'more') { goLevel('top'); return true; }
      return false;   // ← / Esc on the TOP rail: framework leaves the page
    }
    if (k === 'Escape' || k === 'Backspace') { toRail(); return true; }
    if (f && f.classList.contains('sy-cyc') && (lt || rt)) { stepCyc(f, lt ? -1 : 1); return true; }
    if (lt && !(f && f.classList.contains('p-slider')) && f && !hasLeftIn(detailEl(), f)) { toRail(); return true; }
    if (up && f && f.dataset.key && f.dataset.key.startsWith('bind:') && f === $('[data-key^="bind:"]')) { C.focus($('.sy-search')); $('#sy-blist').scrollTop = 0; C.refocus(); return true; }
    if (up || dn || lt || rt) { lockRail(true); queueMicrotask(() => { lockRail(false); keepVisible(); }); }
    return false;
  }

  // ------------------------------------------------------------ register
  P3Menu.register('system', {
    title: 'SYSTEM',
    render(root, ctx) {
      ensureCSS();
      if (!S) initState(); else sync();
      C = ctx; R = root;
      if (!urlUsed) {
        const pw = q.get('pw'), w = pw && S.list.find(x => x.ssid === pw);
        if (w) { S.lvl = 'top'; S.cat = 'network'; S.pw = { ssid: w.ssid, val: 'p3shell' }; }
      }
      const host = document.createElement('div');
      host.className = 'sy-host'; host.style.cssText = 'position:absolute;inset:0';
      root.appendChild(host);
      host.addEventListener('p3change', onChange);
      host.addEventListener('p3confirm', onConfirm);
      host.addEventListener('click', onClick);
      host.addEventListener('mouseover', () => queueMicrotask(syncMode));
      host.innerHTML = view();
      const d = detailEl(); d.innerHTML = detailHTML(); stamp(d, false);
      refresh();
      const fx = S.pw ? $('.sy-field', host) : $(`.sy-cat[data-cat="${curCat()}"]`, host);
      if (fx) fx.setAttribute('data-autofocus', '');
    },
    onEnter(ctx) {
      C = ctx;
      subscribe();
      moveMark();
      if (!urlUsed) {
        urlUsed = true;
        const fN = q.get('focus');
        const list = $$('[data-focus]', detailEl()).filter(n => !n.hasAttribute('data-disabled'));
        if (fN != null && list[+fN]) ctx.focus(list[+fN]);
        else if (q.get('more') && (q.get('cap') || q.get('q') || fN == null) && list.length) {
          ctx.focus(q.get('more') === 'keys' && (q.get('cap') || q.get('q')) ? ($('[data-key^="bind:"]') || list[0]) : list[0]);
        }
        const f = ctx.focused();
        if (q.get('cap') === '1' && f && (f.dataset.key.startsWith('bind:') || f.dataset.key === 'imeKey')) startCapture(f.dataset.key);
      }
      startMeter(); syncMode();
    },
    onLeave() {
      unsubscribe(); endCapture(false);
      T.forEach(clearTimeout); T.clear(); clearInterval(meterT); if (S) S.pw = null;
    },
    onKey(e, ctx) {
      C = ctx;
      if (S.cap) { if (e.key === 'Escape') endCapture(false); return true; }   // right-click → synthetic Esc
      const f = ctx.focused(), k = f ? f.dataset.key : '';
      let r = false;
      if (k === 'pw' && S.pw) r = pwKey(e);
      if (!r && k === 'search') r = searchKey(e);
      if (!r) r = keyNav(e, f);
      queueMicrotask(syncMode);
      return r;
    },
  });
})();
