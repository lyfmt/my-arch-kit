// d-deck — DECK 卡组 clipboard prototype controller. Porting notes: header of d-deck.html.
// State S mirrors ClipboardHistoryContent.qml; onKey() mirrors ClipboardKeyboardController.qml.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const Q = new URLSearchParams(location.search);
  const STATIC = Q.get('static') === '1';
  const PREVIEW_LEN = 100, LONG_TEXT = 200, HOLD_MS = 1000;   // ClipboardConstants.qml
  const ENTER_TO_PASTE = Q.get('enterPaste') === '1';           // SettingsData.clipboardEnterToPaste
  const PASTE_OK = Q.get('paste') !== '0';                       // ClipboardService paste support
  const later = (fn, ms) => (STATIC ? fn() : setTimeout(fn, ms));

  // ---------------------------------------------------------------- mock data (id desc, ★ = pinned)
  const QML = `Rectangle {
    id: neck
    width: 64; height: 18
    radius: height / 2
    color: Theme.isl
    anchors.horizontalCenter: parent.horizontalCenter
    Behavior on width {
        SpringAnimation { spring: 3.2; damping: 0.28 }
    }
}`;
  const LONGZH = `十月月报摘要
本月完成灵动岛 P3 化第二阶段：气泡颈子改用弹簧动画，抖动问题在 kitty 与 chromium 两种全屏场景下复现并修复；通知中心改为平涂深海蓝，选中行使用呼吸光点，行高统一为七十二像素。
菜单页完成状态、日历、系统、电源四页，电源页的危险操作改为按住一秒确认，并加入全屏幕布动画。
下月计划：剪切板、启动器、音量面板三处界面迁移到同一套色板与字体规则，所有动效只使用位移、透明度与裁切，方便移植到 QML。
风险：Nunito Sans 子集缺少部分符号，需要补字；16:10 屏两侧各裁约九十六像素，安全区需要再复核一次。`;
  const JSON_T = `{
  "theme": "p3",
  "island": { "w": 1706, "state": 2, "radius": 22 },
  "menu": { "bg": "water", "safe": [110, 1810] },
  "clipboard": { "direction": "d-deck", "itemHeight": 72, "maxPinned": 25 },
  "fonts": ["P3", "BarlowC", "Noto Sans CJK SC"]
}`;
  const RAW = [
    { id: 214, t: 'git commit -m "fix(island): 修复气泡颈子抖动"', ts: '16:29', ago: 'JUST NOW', app: 'kitty' },
    { id: 213, img: '../shared/desk.jpg', mime: 'image/jpeg', w: 1920, h: 1080, kb: '336 KB', ago: '2 MIN', ts: '16:27', app: '截图', alt: 'text/uri-list', uri: 'file:///home/lyfmt/Pictures/Screenshots/desk.jpg' },
    { id: 212, t: 'https://github.com/AvengeMedia/DankMaterialShell/releases/tag/v2.0.0', ago: '5 MIN', ts: '16:24', app: 'chromium' },
    { id: 211, t: '#0b8fe8', ago: '8 MIN', ts: '16:21', app: 'typora' },
    { id: 210, t: QML, pinned: 1, ago: '12 MIN', ts: '16:17', app: 'kitty' },
    { id: 209, t: '晚上七点在三楼会议室，记得带转接头', ago: '20 MIN', ts: '16:09', app: 'qq' },
    { id: 208, t: 'ssh lyfmt@192.168.1.24 -p 2222', pinned: 1, ago: 'YESTERDAY', ts: '21:14', app: 'termius' },
    { id: 207, img: '../shared/miku-bg.png', mime: 'image/png', w: 2560, h: 1440, kb: '1.3 MB', ago: '35 MIN', ts: '15:54', app: '浏览器' },
    { id: 206, t: LONGZH, ago: '1 HR', ts: '15:22', app: 'feishu' },
    { id: 205, t: 'Memento mori.', ago: '1 HR', ts: '15:10', app: 'chromium' },
    { id: 204, t: 'lyfmt@outlook.com', pinned: 1, ago: '3 DAYS', ts: '10/29', app: '' },
    { id: 203, t: 'paru -S quickshell-git dms-shell-git', ago: '2 HR', ts: '14:31', app: 'kitty' },
    { id: 202, img: '../shared/shot-missing.png', mime: 'image/png', w: 1280, h: 720, kb: '412 KB', ago: 'YESTERDAY', ts: '18:02', app: '截图' },
    { id: 201, t: JSON_T, ago: 'YESTERDAY', ts: '10:40', app: 'typora' },
  ];
  const ICON = { kitty: 'kitty.png', chromium: 'chromium.png', typora: 'typora.png', qq: 'qq.png', termius: 'termius.png', feishu: 'feishu.png' };
  const hashOf = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.codePointAt(0)) | 0; return (h >>> 0).toString(16); };
  function mk(r) {
    if (r.img) return { id: r.id, isImage: true, mimeType: r.mime, src: r.img, w: r.w, h: r.h, kb: r.kb, size: 0,
      preview: `${r.mime} ${r.w}x${r.h}`, pinned: !!r.pinned, hash: hashOf(r.img), ts: r.ts, ago: r.ago, app: r.app,
      altMimeType: r.alt, uri: r.uri };
    return { id: r.id, isImage: false, mimeType: 'text/plain;charset=utf-8', text: r.t, size: [...r.t].length,
      preview: [...r.t].slice(0, PREVIEW_LEN).join(''), pinned: !!r.pinned, hash: hashOf(r.t), ts: r.ts, ago: r.ago, app: r.app };
  }
  let ALL = RAW.map(mk);
  const MODE0 = Q.get('mode') || '';
  if (MODE0 === 'empty') ALL = [];

  // ---------------------------------------------------------------- state (ClipboardHistoryContent.qml)
  const S = {
    available: MODE0 !== 'offline',             // ClipboardService.clipboardAvailable
    tab: Q.get('tab') === 'saved' ? 'saved' : 'recents',
    filter: ['all', 'text', 'long_text', 'image'].includes(Q.get('filter')) ? Q.get('filter') : 'all',
    q: Q.get('q') || '',
    sel: 0, kb: Q.has('sel'),                    // selectedIndex, keyboardNavigationActive
    mode: 'history',                              // history | preview | editor
    ctx: null,                                    // { entry, idx } when the context menu is open
    hints: Q.get('hints') === '1',
    open: true,
  };
  const typeOf = e => (e.isImage ? 'image' : e.size > LONG_TEXT ? 'long_text' : 'text');   // getEntryType
  const pinnedByHash = h => ALL.find(e => e.pinned && e.hash === h) || null;               // getPinnedEntryByHash
  const canEdit = e => !!e && !e.isImage;                                                  // canEditEntry
  const canPreview = e => !!e && e.isImage;                                                // canPreviewEntry
  function filtered(pinned) {                                                              // updateFilteredModel
    const q = S.q.toLowerCase();
    return ALL.filter(e => !!e.pinned === pinned)
      .filter(e => S.filter === 'all' || typeOf(e) === S.filter)
      .filter(e => !q || e.preview.toLowerCase().includes(q))
      .sort((a, b) => b.id - a.id);
  }
  const list = () => (S.available ? filtered(S.tab === 'saved') : []);
  const cur = () => list()[S.sel] || null;

  // ---------------------------------------------------------------- glyphs (material, flat)
  const G = {
    pin: 'M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z',
    copy: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z',
    paste: 'M19 2h-4.18C14.4.84 13.3 0 12 0S9.6.84 9.18 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 18H5V4h2v3h10V4h2v16z',
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    del: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    text: 'M5 4v3h5.5v12h3V7H19V4z',
    img: 'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  };
  const svg = (n, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}"><path d="${G[n]}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hasCJK = s => /[　-鿿＀-￯]/.test(s);
  const isCode = s => /[{};=$]|^(git|ssh|paru|sudo|cd|npm|dms)\b|^[\[{]/m.test(s) || /\n\s{2,}/.test(s);
  const pad2 = n => String(n).padStart(2, '0');
  const CS = ['--c1', '--c2', '--c3', '--c4', '--c5'];

  // ---------------------------------------------------------------- card DOM
  function typeTag(e) {
    const t = typeOf(e);
    if (t === 'image') return { k: 'IMAGE', m: `${e.w}×${e.h} · ${e.mimeType.split('/')[1].toUpperCase()}` };
    if (t === 'long_text') return { k: 'LONG TEXT', m: `${e.size} CHARS` };
    if (/^#[0-9a-f]{3,8}$/i.test(e.text)) return { k: 'TEXT', m: 'COLOR' };
    if (/^https?:\/\//.test(e.text)) return { k: 'TEXT', m: 'URL' };
    return { k: 'TEXT', m: `${e.size} CHARS` };
  }
  function bodyHTML(e) {
    if (e.isImage) return `<div class="thumb"><img src="${esc(e.src)}" alt="" loading="eager" decoding="async"><div class="miss">${svg('img')}<span class="l">IMAGE</span></div></div>`;
    const t = e.text, p = e.preview;
    if (/^#[0-9a-f]{3,8}$/i.test(t)) return `<div class="sw" style="--hex:${esc(t)}"></div><div class="x-hex">${esc(t)}</div>`;
    if (/^https?:\/\//.test(t)) {
      const u = (() => { try { return new URL(t); } catch { return null; } })();
      return `<div class="x-url">${u ? `<span class="host">${esc(u.host)}</span>` : ''}${esc(u ? u.pathname : t)}</div>`;
    }
    const long = typeOf(e) === 'long_text';
    // card bodies are typeset excerpts: a little more than the 100-char list preview fits on a tall card
    const shown = long ? [...t].slice(0, 260).join('') : t;
    const fam = hasCJK(shown) && !isCode(shown) ? 'zh' : isCode(shown) ? 'x-mono' : 'zh';
    // short = fits ~3 lines at 30px: CJK counts 1em, Latin ~.6em, and no unbreakable Latin token wider than a line
    const em = [...t].reduce((a, c) => a + (hasCJK(c) ? 1 : .6), 0);
    const tok = Math.max(0, ...t.split(/\s+/).map(w => [...w].filter(c => !hasCJK(c)).length));
    const size = long ? 'x-long' : em <= 26 && tok <= 14 ? 'x-short' : 'x-text';
    const rest = e.size - [...shown].length;
    return `<div class="${fam} ${size}">${esc(shown)}</div>${long && rest > 0 ? `<span class="l x-more">+${rest} CHARS</span>` : ''}`;
  }
  function cardHTML(e, i) {
    const tg = typeTag(e), pin = e.pinned || !!pinnedByHash(e.hash);
    const app = e.app ? `${ICON[e.app] ? `<img src="../shared/icons/${ICON[e.app]}" alt="" onerror="this.remove()">` : ''}<span class="${hasCJK(e.app) ? 'zh' : 'l'}">${esc(e.app)}</span>` : '<span class="l">—</span>';
    return `<div class="fx"><i class="ec"></i><i class="sh"></i></div>
      <div class="face" style="--c:var(${CS[i % 5]})">
        <div class="c-top"><span class="d c-no">${pad2(i + 1)}</span>
          <span class="c-ty"><span class="l">${tg.k}</span><span class="p-meta">${tg.m}</span></span>
          ${pin ? `<span class="c-pin" title="">${svg('pin')}</span>` : ''}</div>
        <div class="c-hr"></div>
        <div class="c-bd">${bodyHTML(e)}</div>
        <div class="c-ft">${app}<span class="l t">${esc(e.ago)}</span></div>
        <i class="ghost"></i>
      </div><i class="ring"></i><i class="dot"></i>`;
  }

  // ---------------------------------------------------------------- deck layout (horizontal card row)
  const FX = 600;                          // x of the focused card centre on the 1920 stage
  function slot(d) {
    if (d === 0) return { x: FX, y: -26, s: 1.16, r: -4, o: 1, z: 50 };
    if (d > 0) {
      const x = FX + 174 + 36 + 132 + (d - 1) * 282;
      return { x, y: 14 + d * 6, s: .88, r: -2 + d * .4, o: x > 1880 ? 0 : 1, z: 40 - d };
    }
    const a = -d, x = FX - 174 - 30 - 123 - (a - 1) * 104;
    return { x, y: 26 + a * 10, s: .82, r: -7 - a * 1.5, o: a > 2 ? 0 : 1, z: 40 - a };
  }
  const deck = $('#deck');
  const cards = new Map();                 // id → element
  let lastSel = null;
  function render(opts = {}) {
    const L = list();
    if (S.sel >= L.length) S.sel = Math.max(0, L.length - 1);
    const keep = new Set(L.map(e => e.id));
    for (const [id, el] of cards) {
      if (keep.has(id)) continue;
      cards.delete(id);
      el.classList.add('gone'); el.classList.remove('sel');
      later(() => el.remove(), 360);
    }
    L.forEach((e, i) => {
      let el = cards.get(e.id);
      const fresh = !el;
      if (fresh) {
        el = document.createElement('div');
        el.className = 'card born'; el.dataset.id = e.id;
        const s0 = slot(i - S.sel + 1);
        el.style.cssText = `--x:${s0.x}px;--y:${s0.y + 60}px;--s:${s0.s};--r:${s0.r}deg;--o:0`;
        deck.appendChild(el); cards.set(e.id, el);
      }
      if (fresh || opts.rebuild || el.dataset.i !== String(i) || el.dataset.v !== String(e.v || 0)) {
        el.innerHTML = cardHTML(e, i); el.dataset.i = i; el.dataset.v = e.v || 0;
        const im = $('.thumb img', el);
        if (im) im.addEventListener('error', () => { im.remove(); el.querySelector('.thumb').classList.add('nopic'); }, { once: true });
      }
      const d = i - S.sel, s = slot(d);
      el.style.setProperty('--k', Math.max(0, d));
      el.style.zIndex = s.z;
      el.classList.toggle('far', d < 0);
      el.classList.toggle('sel', d === 0);
      if (fresh) { void el.offsetWidth; el.classList.remove('born'); }
      el.style.setProperty('--x', s.x + 'px'); el.style.setProperty('--y', s.y + 'px');
      el.style.setProperty('--s', s.s); el.style.setProperty('--r', s.r + 'deg'); el.style.setProperty('--o', s.o);
    });
    const now = L[S.sel];
    if (now && lastSel !== null && lastSel !== now.id && !STATIC) {
      const el = cards.get(now.id);
      el.classList.remove('wob', 'moving'); void el.offsetWidth; el.classList.add('wob', 'moving');
      setTimeout(() => el.classList.remove('moving'), 60);
      setTimeout(() => el.classList.remove('wob'), 360);
    }
    lastSel = now ? now.id : null;
    chrome(L);
  }

  // ---------------------------------------------------------------- header, bar, foot, empty
  function chrome(L) {
    const rec = S.available ? filtered(false).length : 0, sav = S.available ? filtered(true).length : 0;
    $('#subL').textContent = S.tab === 'saved' ? 'SAVED' : 'HISTORY';       // "Clipboard Saved (N)" / "Clipboard History (N)"
    $('#subN').textContent = L.length;
    $('#tabR').textContent = rec; $('#tabS').textContent = sav;
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === S.tab));
    $$('.chip').forEach(c => c.classList.toggle('on', c.dataset.f === S.filter));
    $('#ctr').classList.toggle('none', !L.length);
    $('#ctrI').textContent = pad2(S.sel + 1); $('#ctrN').textContent = '/' + pad2(L.length);
    $('#search').classList.toggle('has', !!S.q);
    $('#qn').textContent = S.q ? `${L.length} MATCH` : '';
    const em = $('#empty');
    em.classList.toggle('on', !L.length); em.classList.toggle('off', !S.available);
    $('#emptyMsg').innerHTML = !S.available ? 'Connecting to clipboard service...<i></i>'
      : S.q || S.filter !== 'all' ? `No matching entries<b>ESC CLEARS THE SEARCH · CHIPS RESET THE TYPE</b>`
      : S.tab === 'saved' ? 'No saved clipboard entries<b>CTRL+S PINS THE FOCUSED CARD</b>' : 'No recent clipboard entries found<b>COPY SOMETHING, IT LANDS HERE</b>';
    const e = L[S.sel];
    const tg = e && typeTag(e);
    $('#meta').innerHTML = e ? `<span class="l hi">#${e.id}</span><span class="l">${e.isImage ? `IMAGE • ${e.w}×${e.h} · ${e.kb}` : tg.k}</span>`
      + `<span class="l">${esc(e.mimeType.split(';')[0])}</span><span class="l">${esc(e.ts)}</span>` : '';
    const pinOn = e && (e.pinned || !!pinnedByHash(e.hash));
    const A = [
      ['preview', 'eye', 'PREVIEW', canPreview(e)],
      ['copy', 'copy', 'COPY', !!e],
      ['paste', 'paste', 'PASTE', !!e && PASTE_OK],
      ['pin', 'pin', pinOn ? 'UNPIN' : 'PIN', !!e],
      ['edit', 'edit', 'EDIT', canEdit(e)],
      ['delete', 'del', 'DELETE', !!e],
    ];
    $('#acts').innerHTML = A.map(([id, g, t, on]) => `<button class="act${id === 'delete' ? ' danger' : ''}" data-act="${id}"${on ? '' : ' hidden'}>${svg(g)}<span class="l">${t}</span></button>`).join('');
    $('#clr').style.opacity = canClear() ? '' : '.35';
    $('#hints').classList.toggle('on', S.hints);
  }
  const H = [['↑↓ ←→', 'NAVIGATE'], ['ENTER', ENTER_TO_PASTE ? 'PASTE' : 'COPY'], ['SHIFT+ENTER', ENTER_TO_PASTE ? 'COPY' : 'PASTE'],
    ['CTRL+SPACE', 'PREVIEW'], ['CTRL+E', 'EDIT'], ['CTRL+S', 'PIN'], ['DEL', 'DELETE'], ['SHIFT+DEL', 'CLEAR'],
    ['CTRL+TAB', 'SAVED'], ['MENU', 'ACTIONS'], ['F10', 'HINTS'], ['ESC', 'CLOSE']];
  $('#hints').innerHTML = H.map(([k, t]) => `<span><b>${k}</b>${t}</span>`).join('');
  // ---------------------------------------------------------------- feedback
  let toastT = 0;
  function toast(t, sub = '', err = false) {
    const el = $('#toast');
    $('#toastT').textContent = t; $('#toastS').textContent = sub;
    el.classList.toggle('err', err);
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(toastT); if (!STATIC) toastT = setTimeout(() => el.classList.remove('on'), 1150);
  }
  function flash(el, cls, ms = 420) {
    if (!el || STATIC) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }
  const short = e => (e.isImage ? `${e.mimeType} ${e.w}×${e.h}` : e.preview.replace(/\s+/g, ' ').slice(0, 48));

  // ---------------------------------------------------------------- open / close (ClipboardHistoryModal show/hide)
  const stage = $('#stage');
  function hide() {
    closeCtx(); S.mode = 'history'; $('#pv').classList.remove('on'); $('#ed').classList.remove('on');
    S.open = false; stage.classList.add('closed'); $('#q').blur();
  }
  function show() {
    S.open = true; S.q = ''; $('#q').value = ''; S.sel = 0; S.kb = false;
    stage.classList.remove('closed');
    stage.classList.remove('go'); void stage.offsetWidth; if (!STATIC) stage.classList.add('go');
    render(); $('#q').focus();
  }

  // ---------------------------------------------------------------- actions (ClipboardHistoryContent.qml)
  function copy(e, asText = false) {
    if (!e) return;
    flash(cards.get(e.id), 'copied', 640);
    toast(asText ? 'COPIED AS TEXT' : 'COPIED', asText && e.uri ? e.uri : short(e));
    later(hide, 620);                                 // copyEntry → requestClose(false)
  }
  function paste(e) {
    if (!e || !PASTE_OK) return;
    flash(cards.get(e.id), 'copied', 640);
    toast('PASTED', short(e));
    later(hide, 520);                                 // pasteEntry → requestClose(true)
  }
  function togglePin(e) {                             // togglePinSelected, with the hash-duplicate rule
    if (!e) return;
    const dup = !e.pinned && pinnedByHash(e.hash);
    const target = e.pinned ? e : dup || e;
    target.pinned = !target.pinned;
    toast(target.pinned ? 'PINNED' : 'UNPINNED', short(target));
    if (S.tab === 'saved' && !ALL.some(x => x.pinned)) S.tab = 'recents';   // onPinnedCountChanged
    render({ rebuild: true });
  }
  function del(e) {
    if (!e) return;
    if (e.pinned) {                                   // deletePinnedEntry → confirm
      confirm({ k: 'DELETE SAVED', t: 'ITEM?', m: 'This will permanently remove this saved clipboard item. This action cannot be undone.',
        b: 'DELETE', run: () => { ALL = ALL.filter(x => x !== e); toast('DELETED', short(e)); afterRemove(); } });
      return;
    }
    ALL = ALL.filter(x => x !== e); afterRemove();
  }
  function afterRemove() {
    if (S.tab === 'saved' && !ALL.some(x => x.pinned)) S.tab = 'recents';
    render({ rebuild: true });
  }
  const clearsFilteredOnly = () => !!S.q || S.filter !== 'all';
  const canClear = () => (clearsFilteredOnly() ? filtered(false).length > 0 : ALL.some(e => !e.pinned));
  function confirmClearAll() {
    if (!S.available || !canClear()) { flash(cards.get(cur()?.id), 'nudge'); return; }
    if (clearsFilteredOnly()) {
      const n = filtered(false).length, ids = new Set(filtered(false).map(e => e.id));
      confirm({ k: 'CLEAR', t: 'HISTORY?', m: `This will delete the ${n} entries matching the current filter. Pinned entries are kept.`, b: `CLEAR ${n}`,
        run: () => { ALL = ALL.filter(e => !ids.has(e.id)); toast('CLEARED', `${n} entries`); afterRemove(); } });
      return;
    }
    const pc = ALL.filter(e => e.pinned).length;
    confirm({ k: 'CLEAR', t: 'HISTORY?', b: 'CLEAR ALL',
      m: pc ? `This will delete all unpinned entries. ${pc} pinned entries will be kept.` : 'This will permanently delete all clipboard history.',
      run: () => { ALL = ALL.filter(e => e.pinned); afterRemove(); later(hide, 300); } });   // clearAll(); hide()
  }
  function act(id, e = cur()) {
    if (!e) return;
    const b = $(`.act[data-act="${id}"]`); flash(b, 'press', 280);
    ({ preview: () => openPreview(), copy: () => copy(e), copytext: () => copy(e, true), paste: () => paste(e),
      pin: () => togglePin(e), edit: () => openEditor(e), delete: () => del(e) })[id]?.();
  }
  function select(i) {
    const L = list(); if (!L.length) return;
    S.kb = true;
    const n = Math.max(0, Math.min(L.length - 1, i));
    if (n === S.sel) { flash(cards.get(L[n].id), 'nudge'); return; }
    S.sel = n; render();
    if (S.mode === 'preview') { if (!canPreview(cur())) closePreview(); else fillPreview(true); }   // onCurrentEntryChanged
  }
  // first key press only activates keyboard navigation and selects entry 0 (ClipboardKeyboardController)
  function next() { if (!S.kb) { S.kb = true; S.sel = 0; render(); return; } select(S.sel + 1); }
  function prev() { if (!S.kb) { S.kb = true; S.sel = 0; render(); return; } select(S.sel - 1); }
  function setTab(t) {
    if (t === 'saved' && !ALL.some(e => e.pinned)) { flash($('.tab[data-tab="saved"]'), 'nudge'); return; }   // falls back to recents
    if (S.tab === t) return;
    S.tab = t; S.sel = 0; S.kb = true;
    const tb = $(`.tab[data-tab="${t}"]`); flash(tb, 'moving', 60);
    for (const el of cards.values()) el.remove(); cards.clear(); lastSel = null;
    stage.classList.remove('go'); void stage.offsetWidth; if (!STATIC) stage.classList.add('go');
    render();
  }
  function setFilter(f) { S.filter = f; S.sel = 0; S.kb = true; render(); }   // onActiveFilterChanged

  // ---------------------------------------------------------------- context menu (ClipboardContextMenu.qml)
  const ctx = $('#ctx');
  function openCtx(e, x, y) {
    if (!e) return;
    const items = [
      ['copy', 'copy', 'COPY', 'ENTER'],
      e.altMimeType ? ['copytext', 'text', 'COPY TEXT', ''] : null,
      ['pin', 'pin', e.pinned || pinnedByHash(e.hash) ? 'UNPIN' : 'PIN', 'CTRL+S'],
      canEdit(e) ? ['edit', 'edit', 'EDIT', 'CTRL+E'] : null,
      PASTE_OK ? ['paste', 'paste', 'PASTE', 'SHIFT+ENTER'] : null,
      ['delete', 'del', 'DELETE', 'DEL'],
    ].filter(Boolean);
    ctx.innerHTML = items.map(([id, g, t, k], i) => `<button class="it${id === 'delete' ? ' danger' : ''}${i ? '' : ' sel'}" data-act="${id}">${svg(g)}<span class="l">${t}</span><span class="l k">${k}</span></button>`).join('');
    S.ctx = { e, i: 0, n: items.length };
    ctx.style.left = Math.min(x, 1920 - 300) + 'px'; ctx.style.top = Math.min(y, 1080 - items.length * 48 - 30) + 'px';
    ctx.classList.add('on');
  }
  function ctxMove(d) {
    if (!S.ctx) return;
    S.ctx.i = (S.ctx.i + d + S.ctx.n) % S.ctx.n;
    $$('.it', ctx).forEach((b, i) => b.classList.toggle('sel', i === S.ctx.i));
  }
  function closeCtx() { S.ctx = null; ctx.classList.remove('on'); }
  function ctxRun(id) { const e = S.ctx?.e; closeCtx(); act(id, e); }
  function ctxAtCard(e) {
    const el = cards.get(e.id); if (!el) return;
    const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect(), k = sr.width / 1920;
    openCtx(e, (r.right - sr.left) / k + 16, (r.top - sr.top) / k + 40);
  }

  // ---------------------------------------------------------------- preview (ClipboardImagePreview.qml)
  function openPreview() {
    const e = cur(); if (!canPreview(e)) { flash(cards.get(e?.id), 'nudge'); return; }
    closeCtx(); S.mode = 'preview'; fillPreview(false);
    $('#pv').classList.add('on');
  }
  function fillPreview(swap) {
    const e = cur(); if (!e) return;
    $('#pvCap').textContent = `IMAGE • ${e.w}×${e.h} · ${e.mimeType.split('/')[1].toUpperCase()} · ${e.kb}`;
    $('#pvPos').textContent = `#${e.id} · ${pad2(S.sel + 1)} / ${pad2(list().length)}`;
    const box = $('#pvIm');
    box.innerHTML = `<div class="frame"><img src="${esc(e.src)}" alt=""></div>`;
    const im = $('img', box);
    im.style.maxHeight = '660px'; im.style.maxWidth = '1500px';
    im.addEventListener('error', () => { box.innerHTML = `<div class="miss">${svg('img')}<span class="l">IMAGE NOT AVAILABLE · ${esc(e.src.split('/').pop())}</span></div>`; }, { once: true });
    if (swap) flash($('#pv'), 'swap', 320);
  }
  function closePreview() { S.mode = 'history'; $('#pv').classList.remove('on'); }

  // ---------------------------------------------------------------- editor (ClipboardEditor.qml)
  let edEntry = null, edLoaded = false, edMenuI = -1;
  function openEditor(e) {
    e = e || list()[0];                                // editSelected falls back to index 0
    if (!canEdit(e)) { flash(cards.get(e?.id), 'nudge'); return; }
    closeCtx(); edEntry = e; edLoaded = false; S.mode = 'editor';
    const ed = $('#ed'); ed.classList.add('on', 'loading');
    $('#edId').textContent = '#' + e.id; $('#edTx').value = '';
    later(() => {                                       // full text fetch
      if (S.mode !== 'editor' || edEntry !== e) return;  // editor closed (or another entry opened) while loading
      if (Q.get('edfail') === '1') { ed.classList.remove('loading'); toast('Failed to load clipboard entry', '', true); return; }
      edLoaded = true; ed.classList.remove('loading'); $('#edTx').value = e.text; if (!STATIC) $('#edTx').focus();
    }, Q.get('edload') === '1' ? 1e9 : 380);
  }
  function closeEditor() { S.mode = 'history'; $('#ed').classList.remove('on', 'loading'); edMenu(false); $('#q').focus(); }
  function saveEntry(how) {
    if (!edLoaded) { toast('Loading full text, please wait...', '', true); return; }
    const t = $('#edTx').value;
    edEntry.text = t; edEntry.size = [...t].length; edEntry.preview = [...t].slice(0, PREVIEW_LEN).join('');
    edEntry.hash = hashOf(t); edEntry.v = (edEntry.v || 0) + 1;
    edMenu(false); closeEditor(); render();
    if (how === 'history') { toast('SAVED', short(edEntry)); return; }
    if (how === 'close') { toast('SAVED', short(edEntry)); later(hide, 500); return; }
    if (how === 'paste') paste(edEntry);
  }
  function edMenu(on) { $('#edMenu').classList.toggle('on', on); edMenuI = on ? 0 : -1; edMenuSel(); }
  function edMenuSel() { $$('#edMenu button').forEach((b, i) => b.classList.toggle('sel', i === edMenuI)); }
  // ---------------------------------------------------------------- confirm curtain + 1s hold (replaces DConfirmDialog)
  const cf = $('#cf');
  let cfRun = null, holdT0 = 0, holdRaf = 0, holding = false;
  function confirm({ k, t, m, b, run }) {
    closeCtx();
    $('#cfK').textContent = k; $('#cfT').textContent = t; $('#cfM').textContent = m; $('#cfBL').textContent = b;
    cfRun = run; cf.classList.remove('out', 'done', 'holding', 'back'); cf.style.setProperty('--p', 0);
    cf.classList.add('on'); $('#q').blur();
  }
  const cfOpen = () => cf.classList.contains('on') && !cf.classList.contains('out');
  function cfClose(done) {
    stopHold(false); cf.classList.add('out');
    later(() => { cf.classList.remove('on', 'out', 'done'); if (S.open && S.mode === 'history') $('#q').focus(); }, 420);
    if (done && cfRun) { const r = cfRun; cfRun = null; r(); }
  }
  function startHold() {
    if (holding || !cfOpen()) return;
    holding = true; holdT0 = performance.now(); cf.classList.add('holding'); cf.classList.remove('back');
    const tick = now => {
      const p = Math.min(1, (now - holdT0) / HOLD_MS);
      cf.style.setProperty('--p', p);
      if (p >= 1) { holding = false; cf.classList.remove('holding'); cf.classList.add('done'); later(() => cfClose(true), 260); return; }
      holdRaf = requestAnimationFrame(tick);
    };
    holdRaf = requestAnimationFrame(tick);
  }
  function stopHold(spring = true) {
    if (!holding) return;
    holding = false; cancelAnimationFrame(holdRaf); cf.classList.remove('holding');
    if (spring) cf.classList.add('back');
    cf.style.setProperty('--p', 0);
  }

  // ---------------------------------------------------------------- keyboard (ClipboardKeyboardController.qml)
  function onKey(ev) {
    const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey, shift = ev.shiftKey;
    const eat = () => { ev.preventDefault(); ev.stopPropagation(); };
    if (!S.open) { if (k === 'v' || k === 'V' || k === 'Enter' || k === ' ') { eat(); show(); } return; }

    if (cfOpen()) {                                     // confirm curtain swallows everything
      eat();
      if (k === 'Escape') cfClose(false);
      else if (k === 'Enter' && !ev.repeat) startHold();
      return;
    }
    if (S.mode === 'editor') {
      if ($('#edMenu').classList.contains('on')) {
        if (k === 'ArrowDown' || k === 'ArrowUp') { eat(); edMenuI = (edMenuI + (k === 'ArrowDown' ? 1 : 2)) % 3; edMenuSel(); return; }
        if (k === 'Enter') { eat(); saveEntry($$('#edMenu button')[edMenuI].dataset.save); return; }
        if (k === 'Escape') { eat(); edMenu(false); return; }
      }
      if (k === 'Escape') { eat(); closeEditor(); return; }
      if (ctrl && (k === 's' || k === 'S')) { eat(); saveEntry(shift ? 'close' : 'history'); return; }
      if (ctrl && shift && (k === 'v' || k === 'V')) { eat(); saveEntry('paste'); return; }
      return;
    }
    if (S.mode === 'preview') {                         // handlePreviewKey
      eat();
      if (k === 'Escape' || (ctrl && k === ' ')) closePreview();
      else if (k === 'ArrowDown' || k === 'ArrowRight' || (k === 'Tab' && !shift) || (ctrl && /^[nj]$/i.test(k))) select(S.sel + 1);
      else if (k === 'ArrowUp' || k === 'ArrowLeft' || (k === 'Tab' && shift) || (ctrl && /^[pk]$/i.test(k))) select(S.sel - 1);
      else if (k === 'Enter') { (shift ? !ENTER_TO_PASTE : ENTER_TO_PASTE) ? paste(cur()) : copy(cur()); }
      return;
    }
    if (S.ctx) {                                        // context menu: arrows move, Enter runs, Esc closes
      eat();
      if (k === 'Escape') closeCtx();
      else if (k === 'ArrowDown' || k === 'Tab') ctxMove(1);
      else if (k === 'ArrowUp') ctxMove(-1);
      else if (k === 'Enter') ctxRun($$('.it', ctx)[S.ctx.i].dataset.act);
      return;
    }
    const inQ = document.activeElement === $('#q');
    if (k === 'Escape') { eat(); if (S.q) { S.q = ''; $('#q').value = ''; S.sel = 0; render(); } else hide(); return; }
    if (k === 'Tab') {
      eat();
      if (ctrl) { setTab(S.tab === 'saved' ? 'recents' : 'saved'); return; }
      shift ? prev() : next(); return;
    }
    if (k === 'ArrowDown' || k === 'ArrowRight' && !(inQ && $('#q').selectionStart < S.q.length)) { eat(); next(); return; }
    if (k === 'ArrowUp' || k === 'ArrowLeft' && !(inQ && $('#q').selectionStart > 0)) { eat(); prev(); return; }
    if (k === 'F10') { eat(); S.hints = !S.hints; chrome(list()); return; }
    if (k === 'ContextMenu' || (shift && k === 'F10')) { eat(); if (cur()) ctxAtCard(cur()); return; }
    if (k === 'Home' && !inQ) { eat(); select(0); return; }
    if (k === 'End' && !inQ) { eat(); select(list().length - 1); return; }
    if (ctrl) {
      const c = k.toLowerCase();
      if (c === 'n' || c === 'j') { eat(); next(); return; }
      if (c === 'p' || c === 'k') { eat(); prev(); return; }
      if (c === 'c' && S.kb && !(inQ && $('#q').selectionStart !== $('#q').selectionEnd)) { eat(); copy(cur()); return; }
      if (c === 's' && S.kb) { eat(); togglePin(cur()); return; }
      if (c === 'e') { eat(); openEditor(cur()); return; }
      if (k === ' ' && S.kb) { eat(); openPreview(); return; }
      return;
    }
    if (shift && k === 'Delete') { eat(); confirmClearAll(); return; }
    if (shift && k === 'Enter') { if (S.kb) { eat(); ENTER_TO_PASTE ? copy(cur()) : paste(cur()); } return; }
    if (S.kb && k === 'Enter') { eat(); ENTER_TO_PASTE ? paste(cur()) : copy(cur()); return; }
    if (S.kb && k === 'Delete' && !(inQ && S.q)) { eat(); del(cur()); return; }
    if (!inQ && k.length === 1 && !ev.altKey) $('#q').focus();   // typing anywhere goes to search
  }
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', ev => { if (ev.key === 'Enter' && holding) stopHold(true); }, true);

  // ---------------------------------------------------------------- pointer (click only, no hover styles)
  $('#q').addEventListener('input', () => { S.q = $('#q').value; S.sel = 0; S.kb = true; render(); });
  deck.addEventListener('click', ev => {
    const el = ev.target.closest('.card'); if (!el || el.classList.contains('gone')) return;
    closeCtx();
    const i = list().findIndex(e => e.id === +el.dataset.id);
    if (i < 0) return;
    if (i === S.sel && S.kb) { const e = cur(); canPreview(e) ? openPreview() : copy(e); }   // click focused card = open / copy
    else { S.kb = true; select(i); render(); }
  });
  deck.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    const el = ev.target.closest('.card'); if (!el) return;
    const i = list().findIndex(e => e.id === +el.dataset.id); if (i < 0) return;
    if (i !== S.sel) select(i);
    const sr = stage.getBoundingClientRect(), k = sr.width / 1920;
    openCtx(cur(), (ev.clientX - sr.left) / k, (ev.clientY - sr.top) / k);
  });
  stage.addEventListener('contextmenu', ev => ev.preventDefault());
  $('#deck').addEventListener('wheel', ev => { ev.preventDefault(); (ev.deltaY || ev.deltaX) > 0 ? next() : prev(); }, { passive: false });
  $('#acts').addEventListener('click', ev => { const b = ev.target.closest('.act'); if (b) { S.kb = true; act(b.dataset.act); } });
  ctx.addEventListener('click', ev => { const b = ev.target.closest('.it'); if (b) ctxRun(b.dataset.act); });
  $('#tabs').addEventListener('click', ev => { const t = ev.target.closest('.tab'); if (t) setTab(t.dataset.tab); });
  $('#chips').addEventListener('click', ev => { const c = ev.target.closest('.chip'); if (c) setFilter(c.dataset.f); $('#q').focus(); });
  $('#clr').addEventListener('click', confirmClearAll);
  document.addEventListener('pointerdown', ev => {
    if (S.ctx && !ev.target.closest('#ctx')) closeCtx();
    if ($('#edMenu').classList.contains('on') && !ev.target.closest('.split')) edMenu(false);
  }, true);
  $('#pv').addEventListener('click', ev => { if (!ev.target.closest('img')) closePreview(); });
  $('#edBack').addEventListener('click', closeEditor);
  $('#edClose').addEventListener('click', () => { closeEditor(); hide(); });
  $('#edCancel').addEventListener('click', closeEditor);
  $('#edSave').addEventListener('click', () => saveEntry('history'));
  $('#edDd').addEventListener('click', () => edMenu(!$('#edMenu').classList.contains('on')));
  $('#edMenu').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) saveEntry(b.dataset.save); });
  const cfB = $('#cfB');
  cfB.addEventListener('pointerdown', ev => { ev.preventDefault(); startHold(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => cfB.addEventListener(t, () => stopHold(true)));
  $('.cf-v').addEventListener('click', () => cfClose(false));
  $('#reopen').addEventListener('click', show);

  // ---------------------------------------------------------------- stage fit (menu-x: 1920×1080 cover scale)
  function fit() { stage.style.transform = `scale(${Math.max(innerWidth / 1920, innerHeight / 1080)})`; }
  addEventListener('resize', fit); fit();

  // ---------------------------------------------------------------- boot + URL params
  if (STATIC) stage.classList.add('static');
  $$('[data-in]').forEach((el, i) => el.style.setProperty('--i', i));
  if (S.tab === 'saved' && !ALL.some(e => e.pinned)) S.tab = 'recents';
  $('#q').value = S.q;
  if (Q.has('sel')) S.sel = Math.max(0, +Q.get('sel') || 0);
  if (!STATIC) stage.classList.add('go');
  render();
  if (!STATIC) $('#q').focus();
  const M = MODE0;
  if (M === 'preview') { const i = list().findIndex(canPreview); if (i >= 0) { if (!Q.has('sel') || !canPreview(cur())) S.sel = i; S.kb = true; render(); openPreview(); } }
  if (M === 'editor') { const e = canEdit(cur()) ? cur() : list().find(canEdit); if (e) { S.sel = list().indexOf(e); S.kb = true; render(); openEditor(e); } }
  if (M === 'confirm') { S.kb = true; confirmClearAll(); if (Q.has('hold')) { cf.style.setProperty('--p', +Q.get('hold')); cf.classList.add('holding'); } }
  if (M === 'ctx') { S.kb = true; render(); ctxAtCard(cur()); }
  if (M === 'copied') { S.kb = true; render(); const e = cur(); cards.get(e.id).classList.add('copied'); toast('COPIED', short(e)); }
  if (M === 'closed') hide();
  if (STATIC) document.documentElement.dataset.ready = '1';
})();
