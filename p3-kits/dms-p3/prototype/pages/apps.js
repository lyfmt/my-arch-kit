/* APPS — left field: TRAY · PINNED (+ ALL APPS) · FREQUENT, one 150px column grid
   so ↑↓ move straight between rows. Right column = detail of the focused app; for a tray app it lists
   that app's tray menu (dimmed preview). M / right-click turns the preview live (inline sub-list).
   Data + actions go through shared/backend.js (P3Sys); this page holds no fake data and builds no commands.
     apps   P3Sys.apps.state.all / .pinned / .usage, ranked(), byId(), launch(id)
     tray   P3Sys.tray.state.items, activate(id), menu(id) (generic entries, async), trigger(id, 'quit')
     rows   item-specific menu rows: P3Sys.clash (setMode/setNode/setSysProxy/setTun), P3Sys.ime.set, P3Sys.qq.set
   Every action goes through P3Sys.ui; failed toggles / radios revert.
   Behaviour
     tray app    ENTER = activate its window (unread cleared).  M / right-click = tray menu.
                 menu 退出 (hold ENTER) quits the app: the item turns dead and leaves TRAY (a real SNI item
                 vanishes); a frequent app then shows up in FREQUENT again. It comes back when the backend
                 re-registers the item.
     pinned      ENTER = launch (P3Sys.apps.state.pinned: TERMINAL / BROWSER / FILES → app id).
     frequent    ENTER = launch. FREQUENT = P3Sys.apps.ranked() with usage > 0, minus live tray apps and pinned, top 5.
     ALL APPS    ENTER = search view with every installed app (A–Z).
     A–Z / 0–9   on the field: start searching (every letter incl. W A S D belongs to the search; arrows move).
     tray menu   ↑↓ / W S select, ENTER runs, ESC / BKSP / ← / A / M closes.
     search      type to filter, BACKSPACE edits (empty = leave), ESC leaves, ENTER launches the focused hit.
   URL extras (with ?page=apps): ?sel=N (framework), ?menu=clash|fcitx|feishu|qq|magpie|sunshine,
     ?q=text (open search with text; ?q= for the full list). */
(() => {
  'use strict';
  const G = (n, s) => P3Menu.glyph(n, s);
  const CJK = /[　-鿿]/;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const Q = new URLSearchParams(location.search);
  const SYS = window.P3Sys;

  // ------------------------------------------------------------ backend reads (P3Sys snapshots)
  const apps = () => SYS.apps.state.all;
  const trayItems = () => SYS.tray.state.items;
  const trayItem = id => trayItems().find(t => t.id === id) || null;
  const liveTray = () => trayItems().filter(t => !t.dead);
  const APP2TRAY = { 'fcitx5-configtool': 'fcitx' };   // desktop entries whose tray item has another name
  const SHORT = { fcitx: 'FCITX5' };
  const trayOfApp = a => a && trayItems().find(t => t.id === APP2TRAY[a.id] || t.name === a.name) || null;
  const pinnedList = () => Object.entries(SYS.apps.state.pinned).map(([role, id]) => ({ role, id, app: SYS.apps.byId(id) }));
  const bindKey = id => { const b = SYS.keybinds && SYS.keybinds.state.list.find(x => x.cmd === `spawn "${id}"`); return b ? b.key : '—'; };
  function freqList() {
    const usage = SYS.apps.state.usage;
    const shown = new Set([...liveTray().map(t => t.name), ...pinnedList().map(p => p.id)]);
    return SYS.apps.ranked().filter(a => usage[a.id] > 0 && !shown.has(a.id) && !(trayOfApp(a) && !trayOfApp(a).dead)).slice(0, 5);
  }

  // item-specific state labels (backend keeps ids; the UI shows short Chinese words)
  const MODE = { rule: '规则模式', global: '全局模式', direct: '直连模式' };
  const IME = { rime: ['中文', '中文 · Rime'], 'keyboard-us': ['英文', '英文 · US'] };
  const imeShort = id => (IME[id] || [])[0] || ((SYS.ime.state.list.find(x => x.id === id) || {}).name || id);
  const imeLabel = x => (IME[x.id] || [])[1] || x.name;
  const qqLabel = p => (SYS.qq.state.list.find(x => x[0] === p) || [p, p])[1];
  // mock seeds clash.node from the tray status line ("规则模式 · HK 02"); show only the node part
  const clashNode = () => String(SYS.clash.state.node).replace(/^.*模式 · /, '');
  // one live line per tray app, only where it says something (unread lives in the badge)
  function trayStatus(id) {
    if (id === 'clash') return `${MODE[SYS.clash.state.mode] || SYS.clash.state.mode} · ${clashNode()}`;
    if (id === 'fcitx') return imeShort(SYS.ime.state.im);
    if (id === 'qq') return qqLabel(SYS.qq.state.presence);
    if (id === 'sunshine') return (trayItem(id) || {}).status || '';
    return '';
  }

  // tray menus = item-specific rows (wired to clash / ime / qq) + the item's generic entries (P3Sys.tray.menu)
  // rows: h = section label, radio / toggle (k = state key), node (cycle clash node), act (run), quit (hold)
  const MENU = {};            // id → generic entries once P3Sys.tray.menu(id) resolved
  function specificRows(id) {
    switch (id) {
      case 'clash': return [
        { t: 'h', label: '代理模式' },
        ...Object.keys(MODE).map(v => ({ t: 'radio', k: 'clash.mode', v, label: MODE[v] })),
        { t: 'node', label: '节点' },
        { t: 'h', label: '网络' },
        { t: 'toggle', k: 'clash.sysproxy', label: '系统代理' },
        { t: 'toggle', k: 'clash.tun', label: 'TUN 模式' }];
      case 'fcitx': return [
        { t: 'h', label: '输入法' },
        ...SYS.ime.state.list.map(x => ({ t: 'radio', k: 'ime', v: x.id, label: imeLabel(x) })),
        { t: 'act', label: '配置', run: 'launch:fcitx5-configtool' }];
      case 'qq': return [
        { t: 'h', label: '我的状态' },
        ...SYS.qq.state.list.map(([v, label]) => ({ t: 'radio', k: 'qq', v, label }))];
      default: return [];
    }
  }
  function trayMenu(id) {
    const gen = !MENU[id] ? [{ t: 'h', label: '读取菜单…' }]          // still loading
      : MENU[id].filter(e => !e.sep).map(e => e.id === 'quit' ? { t: 'quit', label: e.text }
        : { t: 'act', label: e.text, run: e.id === 'show' ? 'show' : `entry:${e.id}` });
    return [...specificRows(id), ...gen];
  }
  const getK = k => ({ 'clash.mode': SYS.clash.state.mode, 'clash.sysproxy': SYS.clash.state.sysproxy, 'clash.tun': SYS.clash.state.tun,
    ime: SYS.ime.state.im, qq: SYS.qq.state.presence })[k];
  const setRadio = (k, v) => k === 'clash.mode' ? SYS.clash.setMode(v) : k === 'ime' ? SYS.ime.set(v) : SYS.qq.set(v);
  const setToggle = (k, on) => k === 'clash.tun' ? SYS.clash.setTun(on) : SYS.clash.setSysProxy(on);
  function nextNode() {
    const ns = SYS.clash.state.nodes, i = ns.indexOf(SYS.clash.state.node);
    return ns[(i + 1) % ns.length];
  }

  // search: every installed app; empty query = all, A–Z (pinyin order for Chinese).
  // QML port: AppSearchService.searchApplications(q) does the matching; this local ranking stands in for it.
  const coll = new Intl.Collator('en', { sensitivity: 'base' });
  const sk = a => /^[\x00-\x7f]/.test(a.name) ? a.name : (a.keys || a.name).split(' ')[0];   // Chinese names sort by their pinyin key
  function search(q) {
    const s = q.trim().toLowerCase();
    const list = apps().map(a => {
      if (!s) return [a, 0];
      const n = a.name.toLowerCase(), hay = `${a.id} ${a.keys}`.toLowerCase();
      const r = n.startsWith(s) ? 1 : n.split(/[\s·]+/).some(w => w.startsWith(s)) ? 2 : n.includes(s) ? 3
        : hay.split(/[\s.\-]+/).some(w => w.startsWith(s)) ? 4 : 0;
      return [a, r];
    }).filter(([, r]) => !s || r);
    return list.sort((x, y) => x[1] - y[1] || coll.compare(sk(x[0]), sk(y[0]))).map(([a]) => a);
  }

  // ------------------------------------------------------------ CSS (scoped to .ap)
  const STYLE = `
  .ap { position: absolute; inset: 0; }
  .ap .zh { text-transform: none; }
  .ap-field, .ap-srch { position: absolute; left: 0; top: 0; width: 930px; height: 680px; transition: opacity .25s var(--ease); }
  .ap-grp { margin-bottom: 30px; }
  .ap-grp .p-sec { margin-bottom: 14px; }
  .ap-flow { display: grid; grid-template-columns: repeat(6, 132px); column-gap: 18px; row-gap: 6px; }

  /* app tile: icon over name, left aligned (framework tide line sits under it) */
  .ap-it { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; padding: 8px 0 12px; color: var(--p-fg); }
  .ap-ico { position: relative; width: var(--s); height: var(--s); flex: none; transition: transform .34s var(--spring); transform-origin: 30% 70%; }
  .ap-ico img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .ap-it.is-focus .ap-ico { transform: translateY(-5px) scale(1.12); }
  .ap-nm { font: 700 16px/1.15 "BarlowC", sans-serif; letter-spacing: .12em; text-transform: uppercase; color: var(--p-dim);
    max-width: 132px; transition: color .12s; }
  .ap-nm.zh { font: 700 16px/1.15 "Noto Sans CJK SC", sans-serif; letter-spacing: .08em; }
  .ap-it.is-focus .ap-nm { color: var(--fill); }
  .ap-badge { position: absolute; right: -9px; top: -7px; min-width: 24px; height: 22px; padding: 2px 6px 0; display: grid; place-items: center;
    background: var(--accent); color: #fff; font: 700 14px/1 "BarlowC", sans-serif; letter-spacing: .04em; }
  .ap-rk { font: italic 900 24px/.8 "P3", sans-serif; color: var(--p-fg); margin-right: 8px; padding-right: .06em; vertical-align: -2px; }
  .ap-tile { position: absolute; inset: 0; display: grid; place-items: center; background: var(--panel); color: var(--p-fg);
    font: italic 900 calc(var(--s) * .5)/1 "P3", sans-serif; padding-right: .06em; }
  .ap-all .ap-tile { background: none; outline: 2px solid var(--p-track); outline-offset: -2px; }
  .pg.enter .ap-field .ap-ico { animation: apRise .62s var(--spring) backwards; animation-delay: calc(var(--q) * 30ms + .3s); }
  @keyframes apRise { from { opacity: 0; transform: translateY(40px) scale(.6); } }
  .ap-ghost { position: absolute; z-index: 6; pointer-events: none; animation: apGhost .6s var(--ease) forwards; }
  .ap-ghost img { width: 100%; height: 100%; object-fit: contain; display: block; }
  @keyframes apGhost { to { opacity: 0; transform: translate(90px, -30px) scale(1.6); } }

  /* tray menu open: field steps back, source tile stays lit */
  .ap.menu-on .ap-field .ap-it:not(.ap-src), .ap.menu-on .ap-field .p-sec { opacity: .22; }
  .ap.menu-on .ap-src .ap-nm { color: var(--fill); }
  .ap-field .ap-it { transition: opacity .25s var(--ease); }

  /* detail column */
  .ap-det { position: absolute; left: 970px; top: 0; width: 440px; height: 680px; padding-left: 40px; border-left: 1px solid var(--line); }
  .ap-dx { animation: apDx .4s var(--ease) backwards; animation-delay: calc(var(--j) * 35ms); }
  @keyframes apDx { from { opacity: 0; translate: -22px 0; } }
  .ap-dh { display: flex; align-items: center; gap: 22px; margin: 10px 0 26px; }
  .ap-dh .ap-ico { --s: 76px; }
  .ap-dn { font: italic 900 var(--fs, 48px)/.9 "P3", sans-serif; letter-spacing: -.01em; color: var(--tx); white-space: nowrap; padding-right: .08em; }
  .ap-dn.zh { font: 900 calc(var(--fs, 48px) * .82)/1.05 "Noto Sans CJK SC", sans-serif; letter-spacing: .04em; }
  .ap-ds { margin-top: 12px; display: flex; align-items: center; gap: 12px; font-size: 19px; color: var(--dim); }
  .ap-ds .p-chip { font-size: 14px; }
  .ap-fact { display: flex; align-items: baseline; justify-content: space-between; height: 54px; border-bottom: 1px solid var(--line); padding-top: 18px; }
  .ap-fact .zh { font-size: 17px; color: var(--dim); }
  .ap-big { display: flex; align-items: baseline; gap: 10px; margin-top: 4px; }
  .ap-big + .p-bar { margin-top: 16px; }

  /* tray menu rows (preview = dim, not focusable; live after M) */
  .ap-mlist { position: relative; margin-top: 4px; }
  .ap-mh { padding: 14px 0 6px 36px; font: 500 14px/1 "Noto Sans CJK SC", sans-serif; letter-spacing: .14em; color: var(--dim); }
  .ap-mi { display: flex; align-items: center; gap: 14px; height: 46px; padding: 0 6px 0 0; color: var(--p-fg); transition: opacity .25s var(--ease); }
  .ap-mi .zh { font-size: 18px; font-weight: 700; color: var(--p-fg); }
  .ap-ck { width: 22px; flex: none; display: grid; place-items: center; color: var(--p-fg); }
  .ap-ck svg { transform: scale(0); transition: transform .3s var(--spring); }
  .ap-mi.on .ap-ck svg, .ap-mi.ap-act .ap-ck svg, .ap-quit .ap-ck svg { transform: none; }
  .ap-mi.ap-act .ap-ck { color: var(--p-dim); }
  .ap-mi .p-switch { margin-left: auto; transform: scale(.82); transform-origin: 100% 50%; }
  .ap-mi .p-value { margin-left: auto; }
  .ap-quit { --p-fg: #ff7076; margin-top: 10px; padding-left: 0; }
  .ap-quit.is-focus { --p-fg: #ff9aa0; }
  .ap-quit.holding, .ap-quit.p-done { --p-fg: #fff; }
  .ap-mlist.prev .ap-mi, .ap-mlist.prev .ap-mh { opacity: .38; }
  .ap-mlist.live .ap-mi { animation: apRowIn .34s var(--ease) backwards; animation-delay: calc(var(--j) * 26ms); }
  @keyframes apRowIn { from { opacity: .38; translate: -14px 0; } }

  /* search view */
  .ap-qline { display: flex; align-items: flex-end; gap: 22px; height: 96px; margin-bottom: 18px; border-bottom: 1px solid var(--line); padding-bottom: 14px; }
  .ap-q { font: italic 900 72px/.86 "P3", sans-serif; color: var(--tx); white-space: pre; padding-right: .06em; max-width: 640px; overflow: hidden; }
  .ap-q.empty { color: var(--dim); font: 700 22px/1 "Noto Sans CJK SC", sans-serif; letter-spacing: .1em; padding-bottom: 6px; }
  .ap-caret { width: 5px; height: 62px; background: var(--fill); flex: none; margin-left: -14px; }
  .ap-q.empty + .ap-caret { height: 30px; margin-left: -10px; }
  .ap-qn { margin-left: auto; padding-bottom: 2px; }
  .ap-srch .ap-flow { grid-template-columns: repeat(7, 116px); grid-auto-rows: 104px; column-gap: 16px; row-gap: 0; }
  .ap-srch .ap-it { gap: 10px; padding: 6px 0 10px; }
  .ap-srch .ap-nm { font-size: 14px; max-width: 116px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ap-srch .ap-nm.zh { font-size: 15px; }
  .ap-srch .ap-it { animation: apHit .3s var(--ease) backwards; animation-delay: calc(var(--q) * 12ms); }
  @keyframes apHit { from { opacity: 0; translate: 0 14px; } }
  .ap-none { margin-top: 40px; font-size: 22px; color: var(--dim); }
  `;

  // ------------------------------------------------------------ builders
  let q = 0;
  const icon = (src, name, s, extra = '') => `<span class="ap-ico" style="--s:${s}px;--q:${q++}">${src
    ? `<img src="${esc(src)}" alt="">` : `<span class="ap-tile">${esc([...name][0].toUpperCase())}</span>`}${extra}</span>`;
  const nmEl = (s, pre) => `<span class="ap-nm ${CJK.test(s) ? 'zh' : ''}">${pre ? `<span class="ap-rk">${pre}</span>` : ''}${esc(s)}</span>`;
  const tile = o => `<div class="ap-it ${o.cls || ''}" data-focus data-in data-ref="${esc(o.ref)}"
    >${icon(o.icon, o.name, o.s, o.extra)}${nmEl(o.label || o.name, o.rank)}</div>`;

  function fieldHTML() {
    q = 0;
    const tray = liveTray().map(t => tile({ ref: `tray:${t.id}`, icon: t.icon, name: t.name, label: SHORT[t.id] || t.name, s: 68,
      extra: t.badge ? `<span class="ap-badge">${t.badge}</span>` : '' })).join('');
    const pin = pinnedList().map(p => tile({ ref: `pin:${p.role}`, icon: p.app && p.app.icon, name: p.role, s: 88 })).join('')
      + tile({ ref: 'all', cls: 'ap-all', icon: null, name: 'ALL APPS', s: 88 }).replace('<span class="ap-tile">A</span>', `<span class="ap-tile">${G('apps', 34)}</span>`);
    const fq = freqList().map((a, i) => tile({ ref: `fq:${a.id}`, icon: a.icon, name: a.name, s: 60, rank: i + 1 })).join('');
    return `
      ${tray ? `<div class="ap-grp"><div class="p-sec" data-in>TRAY</div><div class="ap-flow">${tray}</div></div>` : ''}
      <div class="ap-grp"><div class="p-sec" data-in>PINNED</div><div class="ap-flow">${pin}</div></div>
      ${fq ? `<div class="ap-grp"><div class="p-sec" data-in>FREQUENT</div><div class="ap-flow">${fq}</div></div>` : ''}`;
  }

  function menuRows(id, live) {
    const rows = trayMenu(id);
    let j = 0;
    const f = live ? 'data-focus' : '';
    return rows.map(m => {
      const jj = `style="--j:${j++}"`;
      if (m.t === 'h') return `<div class="ap-mh" ${jj}>${esc(m.label)}</div>`;
      if (m.t === 'radio') return `<div class="ap-mi ap-radio ${getK(m.k) === m.v ? 'on' : ''}" ${f} ${jj} data-k="${m.k}" data-v="${esc(m.v)}">
        <span class="ap-ck">${G('check', 18)}</span><span class="zh">${esc(m.label)}</span></div>`;
      if (m.t === 'toggle') return `<div class="ap-mi p-toggle ${getK(m.k) ? 'on' : ''}" ${f} ${jj} data-k="${m.k}">
        <span class="ap-ck"></span><span class="zh">${esc(m.label)}</span><span class="p-switch"></span></div>`;
      if (m.t === 'node') return `<div class="ap-mi ap-node" ${f} ${jj}>
        <span class="ap-ck"></span><span class="zh">${esc(m.label)}</span><span class="p-value">${esc(clashNode())}</span></div>`;
      if (m.t === 'quit') return `<div class="ap-mi p-hold ap-quit" ${f} ${jj} data-hold="700"
        ><span class="ap-ck">${G('x', 16)}</span><span class="zh">${esc(m.label)}</span></div>`;
      return `<div class="ap-mi ap-act" ${f} ${jj} data-run="${esc(m.run)}">
        <span class="ap-ck">${G('ext', 16)}</span><span class="zh">${esc(m.label)}</span></div>`;
    }).join('');
  }

  // detail column for a ref: tray:<id> | pin:<role> | fq:<appId> | all | hit:<appId>
  function detailHTML(ref, live) {
    let j = 0;
    const dx = () => `ap-dx" style="--j:${j++}`;
    const head = (src, name, sub) => {
      const fs = CJK.test(name) ? 48 : name.length <= 7 ? 54 : name.length <= 11 ? 44 : name.length <= 15 ? 34 : 28;
      return `<div class="ap-dh ${dx()}">${icon(src, name, 76)}<div>
        <div class="ap-dn ${CJK.test(name) ? 'zh' : ''}" style="--fs:${fs}px">${esc(name)}</div>${sub ? `<div class="ap-ds zh">${sub}</div>` : ''}</div></div>`;
    };
    const fact = (a, b) => `<div class="ap-fact ${dx()}"><span class="zh">${esc(a)}</span><span class="p-value">${esc(b)}</span></div>`;
    const [kind, arg] = [ref.slice(0, ref.indexOf(':') >>> 0), ref.slice(ref.indexOf(':') + 1)];
    if (kind === 'tray') {
      const t = trayItem(arg);
      if (!t) return '';
      const sub = [trayStatus(arg) && esc(trayStatus(arg)), t.badge ? `<span class="p-chip hot">${t.badge} 未读</span>` : ''].filter(Boolean).join('');
      return head(t.icon, t.name, sub) + `<div class="ap-mlist ${live ? 'live' : 'prev'} ${dx()}">${menuRows(arg, live)}</div>`;
    }
    if (kind === 'pin') {
      const id = SYS.apps.state.pinned[arg], a = SYS.apps.byId(id);
      return head(a && a.icon, arg, '') + fact('程序', id) + fact('快捷键', bindKey(id).toUpperCase());
    }
    if (kind === 'fq') {
      const a = SYS.apps.byId(arg), usage = SYS.apps.state.usage, n = usage[arg] || 0;
      const max = Math.max(1, ...Object.values(usage));
      return head(a.icon, a.name, '') + `<div class="${dx()}"><div class="ap-big"><span class="p-num">${n}</span>
        <span class="p-unit zh">次启动 · 近 30 天</span></div><div class="p-bar" style="--v:${Math.round(n / max * 100)}"><i></i></div></div>`;
    }
    if (kind === 'hit') {
      const a = SYS.apps.byId(arg), t = trayOfApp(a), on = t && !t.dead;
      return head(a.icon, a.name, on ? '托盘中运行' : '') + fact('桌面项', a.id);
    }
    return head(null, 'ALL APPS', '').replace(/<span class="ap-tile">A<\/span>/, `<span class="ap-tile">${G('apps', 34)}</span>`)
      + `<div class="${dx()}"><div class="ap-big"><span class="p-num">${apps().length}</span><span class="p-unit zh">个应用</span></div></div>`;
  }

  function searchHTML(text) {
    q = 0;
    const hits = search(text);
    const grid = hits.slice(0, 35).map(a => tile({ ref: `hit:${a.id}`, icon: a.icon, name: a.name, s: 52 })).join('');
    return `<div class="ap-qline">
        <span class="ap-q ${text ? '' : 'empty'}">${text ? esc(text) : '输入名称搜索'}</span><span class="ap-caret"></span>
        <span class="ap-qn"><span class="p-num sm">${hits.length}</span><span class="p-unit zh">${text ? '个匹配' : '个应用'}</span></span></div>
      ${hits.length ? `<div class="ap-flow">${grid}</div>` : `<div class="ap-none zh" data-focus data-cursor="none" data-ref="none">没有匹配「${esc(text)}」的应用</div>`}`;
  }

  // ------------------------------------------------------------ page state
  let box, field, srch, det, ctx_, lastF, timers = [], unsubs = [], alive = false;
  let menuOn = null;          // tray id while its menu is live
  let qText = null;           // search text while searching (null = field)
  let backRef = null;         // field ref to return to after search
  let pending = 0;            // in-flight menu actions: backend events wait until they settle (no DOM swap under the cursor)
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const byRef = ref => box.querySelector(`[data-ref="${CSS.escape(ref)}"]`);

  function renderField(ctx, keepRef) {
    field.innerHTML = fieldHTML();
    const el = keepRef && byRef(keepRef);
    if (el) ctx.focus(el); else if (keepRef !== undefined) ctx.focus(field.querySelector('[data-focus]'));
    ctx.refocus(); sync(ctx, true);
  }
  function showDetail(ref, ctx) { det.innerHTML = ref && ref !== 'none' ? detailHTML(ref, false) : ''; }

  // generic tray entries are async (QsMenuOpener / dms ipc call tray menu): fetch once, re-render when they land
  const asked = {};
  function loadMenu(id, ctx) {
    if (asked[id]) return;
    asked[id] = 1;
    SYS.tray.menu(id).then(es => { MENU[id] = es || []; if (alive) refreshDetail(ctx, id); },
      () => { MENU[id] = []; if (alive) refreshDetail(ctx, id); });
  }
  // detail column shows tray:<id> → redraw it (live menu keeps focus on the same row)
  function refreshDetail(ctx, id) {
    if (!alive) return;
    if (menuOn === id) { const f = ctx.focused(), i = [...det.querySelectorAll('.ap-mi')].indexOf(f); paintMenu(id, ctx, i); return; }
    const f = ctx.focused();
    if (!menuOn && f && f.dataset.ref === `tray:${id}`) showDetail(f.dataset.ref, ctx);
  }
  function paintMenu(id, ctx, idx) {
    det.innerHTML = detailHTML(`tray:${id}`, true);
    const rows = [...det.querySelectorAll('.ap-mi')];
    if (!rows.length) return;            // generic entries still loading: focus stays on the source tile
    ctx.focus(rows[idx] || rows.find(r => r.classList.contains('ap-radio') && r.classList.contains('on')) || rows[0]);
    ctx.refocus(); sync(ctx, true);
  }

  // ---- tray menu
  function openMenu(id, ctx) {
    const src = field.querySelector(`[data-ref="tray:${id}"]`);
    if (!src) return;
    menuOn = id;
    field.querySelectorAll('[data-focus]').forEach(n => n.setAttribute('data-disabled', ''));
    box.classList.add('menu-on'); src.classList.add('ap-src');
    loadMenu(id, ctx);
    paintMenu(id, ctx, -1);
    sync(ctx, true);
  }
  function closeMenu(ctx, ref) {
    if (!menuOn) return;
    const id = menuOn, t = trayItem(id);
    menuOn = null;
    box.classList.remove('menu-on');
    field.querySelectorAll('[data-disabled]').forEach(n => n.removeAttribute('data-disabled'));
    field.querySelectorAll('.ap-src').forEach(n => n.classList.remove('ap-src'));
    if (!t || t.dead) renderField(ctx, ref || null);     // quit: tile vanishes, focus first tile
    else { const src = byRef(`tray:${id}`); ctx.focus(src); showDetail(`tray:${id}`, ctx); }
    sync(ctx, true);
  }

  // ---- search
  function setSearch(text, ctx) {
    const was = qText !== null;
    if (!was) { const f = ctx.focused(); backRef = f && f.dataset.ref; }
    qText = text;
    field.style.display = 'none'; srch.style.display = '';
    srch.innerHTML = searchHTML(text);
    ctx.focus(srch.querySelector('[data-focus]'));
    ctx.refocus(); sync(ctx, true);
  }
  function endSearch(ctx) {
    qText = null;
    srch.innerHTML = ''; srch.style.display = 'none'; field.style.display = '';
    renderField(ctx, backRef || '');
  }

  function ghost(el) {
    const ic = el.querySelector('.ap-ico img');
    if (!ic || ctx_.static) return;
    const r = ic.getBoundingClientRect(), br = box.getBoundingClientRect(), s = br.width / box.offsetWidth;
    const g = document.createElement('div');
    g.className = 'ap-ghost';
    g.style.cssText = `left:${(r.left - br.left) / s}px;top:${(r.top - br.top) / s}px;width:${r.width / s}px;height:${r.height / s}px`;
    g.innerHTML = `<img src="${ic.getAttribute('src')}" alt="">`;
    box.appendChild(g);
    later(() => g.remove(), 640);
  }

  // ---- detail follows the focus
  function sync(ctx, force) {
    const f = ctx.focused();
    if (f === lastF && !force) return;
    lastF = f;
    const ref = f && f.dataset.ref;
    if (!menuOn && ref) { showDetail(ref, ctx); if (ref.startsWith('tray:')) loadMenu(ref.slice(5), ctx); }
  }

  // backend changed (tray / clash / ime / qq / apps): redraw what is on screen, keep the focus where it was
  function onBackend(ctx) {
    if (!alive || pending) return;
    if (menuOn) { const t = trayItem(menuOn); if (t && !t.dead) refreshDetail(ctx, menuOn); return; }
    if (qText !== null) return;          // search grid does not depend on live state; detail refreshes on focus
    const f = ctx.focused();
    renderField(ctx, (f && f.dataset.ref) || '');
  }

  // run a backend action from the page; `pending` holds backend re-renders until it settles
  function run(ctx, promise, o = {}) {
    pending++;
    const end = () => { pending--; onBackend(ctx); };
    const p = SYS.ui(ctx, promise, o);
    p.then(end, end);
    return p;
  }

  function launch(id, ctx, after) {
    run(ctx, SYS.apps.launch(id), { done: after });
  }

  function bind(ctx) {
    box.addEventListener('click', e => {
      if (menuOn && !e.target.closest('.ap-det')) { e.stopPropagation(); closeMenu(ctx); return; }
      const mi = e.target.closest('.ap-mi');
      if (mi && menuOn) {
        const id = menuOn;
        if (mi.classList.contains('ap-radio')) {
          const k = mi.dataset.k, was = getK(k), v = mi.dataset.v;
          if (was === v) return;
          const mark = val => det.querySelectorAll(`.ap-radio[data-k="${k}"]`).forEach(r => r.classList.toggle('on', r.dataset.v === val));
          mark(v);
          run(ctx, setRadio(k, v), { revert: () => mark(was) });
        } else if (mi.classList.contains('ap-node')) {
          run(ctx, SYS.clash.setNode(nextNode()));
        } else if (mi.classList.contains('ap-act')) {
          const r = mi.dataset.run;
          const p = r === 'show' ? SYS.tray.activate(id) : r.startsWith('launch:') ? SYS.apps.launch(r.slice(7)) : SYS.tray.trigger(id, r.slice(6));
          run(ctx, p, { done: () => { if (!ctx.static) later(() => closeMenu(ctx), 320); } });
        }
        return;
      }
      const el = e.target.closest('[data-ref]');
      if (!el || el.hasAttribute('data-disabled') || el.dataset.ref === 'none') return;
      const [kind, arg] = [el.dataset.ref.split(':')[0], el.dataset.ref.slice(el.dataset.ref.indexOf(':') + 1)];
      if (kind === 'all') { later(() => setSearch('', ctx), 0); return; }
      ghost(el);
      if (kind === 'tray') run(ctx, SYS.tray.activate(arg));
      else if (kind === 'pin') launch(SYS.apps.state.pinned[arg], ctx);
      else if (kind === 'fq' || kind === 'hit') launch(arg, ctx, () => { if (kind === 'hit') showDetail(el.dataset.ref, ctx); });
    });
    box.addEventListener('p3change', e => {
      const mi = e.target.closest('.ap-mi.p-toggle');
      if (!mi || !menuOn) return;
      const on = e.detail.value;
      run(ctx, setToggle(mi.dataset.k, on), { revert: () => mi.classList.toggle('on', !on) });
    });
    box.addEventListener('p3confirm', e => {
      if (!menuOn || !e.target.closest('.ap-quit')) return;
      const id = menuOn;
      run(ctx, SYS.tray.trigger(id, 'quit'), { done: () => later(() => closeMenu(ctx), ctx.static ? 0 : 380) });
    });
    box.addEventListener('contextmenu', e => {
      const el = e.target.closest('[data-ref^="tray:"]');
      if (!el || menuOn || qText !== null) return;   // otherwise the framework sends Escape → onKey
      e.preventDefault(); e.stopPropagation();
      openMenu(el.dataset.ref.slice(5), ctx);
    });
  }

  // is there a focusable left of el on (roughly) the same row?
  function hasLeft(el) {
    const r = el.getBoundingClientRect();
    return [...box.querySelectorAll('[data-focus]:not([data-disabled])')].some(n => {
      if (n === el || n.offsetParent === null) return false;
      const b = n.getBoundingClientRect();
      return b.right <= r.left + 2 && b.bottom > r.top && b.top < r.bottom;
    });
  }

  P3Menu.register('apps', {
    title: 'APPS',
    render(root, ctx) {
      if (!document.getElementById('ap-css')) {
        const st = document.createElement('style'); st.id = 'ap-css'; st.textContent = STYLE; document.head.appendChild(st);
      }
      ctx_ = ctx; menuOn = null; qText = null; lastF = null; backRef = null;
      box = document.createElement('div');
      box.className = 'ap';
      box.innerHTML = `<div class="ap-field"></div><div class="ap-srch" style="display:none"></div><div class="ap-det" data-in></div>`;
      root.appendChild(box);
      [field, srch, det] = ['.ap-field', '.ap-srch', '.ap-det'].map(s => box.querySelector(s));
      field.innerHTML = fieldHTML();
      bind(ctx);
    },
    onEnter(ctx) {
      alive = true; pending = 0;
      liveTray().forEach(t => loadMenu(t.id, ctx));     // prefetch generic tray entries (static: resolve on the next tick)
      unsubs = ['tray', 'clash', 'ime', 'qq', 'apps'].map(ns => SYS.on(ns, () => onBackend(ctx)));
      sync(ctx, true);
      if (!this._urlUsed) {
        this._urlUsed = true;
        const m = Q.get('menu');
        if (m && trayItem(m) && !trayItem(m).dead) openMenu(m, ctx);
        else if (Q.has('q')) setSearch(Q.get('q'), ctx);
      }
    },
    onFocus(el, ctx) { if (box) sync(ctx); },
    onLeave() {
      alive = false;
      unsubs.forEach(u => u && u()); unsubs = [];
      timers.forEach(clearTimeout); timers = [];
      menuOn = null; qText = null; lastF = null;
    },
    onKey(e, ctx) {
      const k = e.key;
      const printable = k.length === 1 && /[\p{L}\p{N}\-+. ]/u.test(k);
      if (menuOn) {
        if (['Escape', 'Backspace', 'ArrowLeft', 'a', 'A', 'm', 'M'].includes(k)) { closeMenu(ctx); return true; }
        if (k === 'ArrowRight' || k === 'd' || k === 'D') return true;
        if (k === 'w' || k === 's') return false;          // framework moves ↑↓
        return printable && k !== ' ';   // other letters do nothing inside the menu; space = Enter
      }
      if (qText !== null) {
        if (k === 'Escape') { endSearch(ctx); return true; }
        if (k === 'Backspace') { if (qText) setSearch(qText.slice(0, -1), ctx); else endSearch(ctx); return true; }
        if (k === 'ArrowLeft') { const f = ctx.focused(); if (!f || !hasLeft(f)) { endSearch(ctx); return true; } return false; }
        if ((k === 'Enter' || k === ' ') && ctx.focused() && ctx.focused().dataset.ref === 'none') return true;
        if (k === ' ' && !qText) return true;
        if (printable) { if (qText.length < 24) setSearch(qText + k, ctx); return true; }
        return false;
      }
      const f = ctx.focused();
      if ((k === 'm' || k === 'M') && f && f.dataset.ref && f.dataset.ref.startsWith('tray:')) { openMenu(f.dataset.ref.slice(5), ctx); return true; }
      if (printable && k !== ' ') { setSearch(k, ctx); return true; }
      return false;
    },
  });
})();
