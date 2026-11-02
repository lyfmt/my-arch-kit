// CLIPBOARD · B "WEDGE 斜切" — behavior + mock data. See the header comment in b-wedge.html for the
// direction notes and the mapping to /tmp/dms-src/dux-shell/quickshell/Modals/Clipboard/*.qml.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const Q = new URLSearchParams(location.search);
  const STATIC = Q.get('static') === '1';
  const LONG = 200;                       // ClipboardService.longTextThreshold
  const SLOT = 88, VIS = 7;               // row pitch (80 + 8 gap), visible slots
  const LIST_TOP = 290, ROW_TOP = 14;     // .list top, first row offset inside it (row 0 at stage y 304)
  const ROW_END = 1790, WEDGE_END = 1520; // rows end at the safe-area edge; the white wedge stops before the meta
  const STRIP_TOP = 948;
  const edge = y => 660 - y / 6;          // slab left edge at stage y
  const rowTop = s => LIST_TOP + ROW_TOP + s * SLOT;
  const rowX = s => Math.round(edge(rowTop(s) + 40) + 34);
  const ROT = [-9, -6, -11, -7, -10];     // unfocused type word angle, by id % 5 (stable while scrolling)
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isZh = s => /[一-鿿]/.test(s);
  const ICON = { kitty: 'kitty.png', chromium: 'chromium.png', typora: 'typora.png', qq: 'qq.png', termius: 'termius.png', feishu: 'feishu.png' };
  const PIN_SVG = '<svg width="12" height="12" viewBox="0 0 24 24"><path fill="currentColor" d="M16 3v2h-1v6l3 3v2h-5v6h-2v-6H6v-2l3-3V5H8V3z"/></svg>';

  // ------------------------------------------------------------ mock data (id desc, timestamps monotonic)
  const QML = `Rectangle {
    id: bubble
    width: 1706; height: 48
    radius: height / 2
    color: "#14306e"
    Behavior on width {
        SpringAnimation { spring: 3.2; damping: 0.28 }
    }
    Behavior on height {
        SpringAnimation { spring: 3.2; damping: 0.28 }
    }
}`;
  const ZH = `十月月报摘要：
灵动岛完成了气泡颈子和展开动画的重写，帧时间稳定在 4ms 以内；菜单页新增 POWER 与 SYSTEM 两页，按住确认的交互已经在三台机器上验证。剩余问题主要是 16:10 屏幕的安全区裁切，以及通知中心在溢出时的渐隐遮罩。
下月计划：剪切板 P3 化、锁屏歌词联动、主题色从壁纸取样。所有动效只动 transform、opacity 和 clip，方便移植到 QML，避免在 Quickshell 里出现掉帧。另外需要整理一份令牌对照表，把 tokens.css 的色板映射到 Theme.qml，并补齐中文字体回退。`;
  const JSON_T = `{
  "theme": "p3",
  "island": { "w": 1706, "state": 2, "radius": 24 },
  "menu": { "bg": "water", "safe": [110, 1810] },
  "clipboard": { "maxPinned": 25, "enterToPaste": false },
  "fonts": ["P3", "BarlowC", "Noto Sans CJK SC"]
}`;
  const SEED = [
    { id: 214, text: 'git commit -m "fix(island): 修复气泡颈子抖动"', ts: 'NOW', app: 'kitty', kind: 'CODE' },
    { id: 213, img: '../shared/desk.jpg', mimeType: 'image/jpeg', w: 1920, h: 1080, kb: '336 KB', ts: '2 MIN', app: '截图', altMimeType: 'text/uri-list', alt: 'file:///home/lyfmt/Pictures/Screenshots/desk.jpg' },
    { id: 212, text: 'https://github.com/AvengeMedia/DankMaterialShell/releases/tag/v2.0.0', ts: '5 MIN', app: 'chromium', kind: 'LINK' },
    { id: 211, text: '#0b8fe8', ts: '8 MIN', app: 'typora', kind: 'COLOR' },
    { id: 210, text: QML, ts: '12 MIN', app: 'kitty', kind: 'CODE', pinned: true },
    { id: 209, text: '晚上七点在三楼会议室，记得带转接头', ts: '20 MIN', app: 'qq' },
    { id: 208, text: 'ssh lyfmt@192.168.1.24 -p 2222', ts: '28 MIN', app: 'termius', kind: 'CODE', pinned: true },
    { id: 207, img: '../shared/miku-bg.png', mimeType: 'image/png', w: 2560, h: 1440, kb: '1.3 MB', ts: '35 MIN', app: '浏览器' },
    { id: 206, text: ZH, ts: '15:12', app: 'feishu' },
    { id: 205, text: 'Memento mori.', ts: '15:02', app: 'chromium' },
    { id: 204, text: 'lyfmt@outlook.com', ts: '14:40', app: '', pinned: true },
    { id: 203, text: 'paru -S quickshell-git dms-shell-git', ts: '14:21', app: 'kitty', kind: 'CODE' },
    { id: 202, img: '../shared/shot-missing.png', mimeType: 'image/png', w: 1280, h: 800, kb: '212 KB', ts: 'YDA 18:02', app: '截图' },
    { id: 201, text: JSON_T, ts: 'YDA 10:40', app: 'typora', kind: 'CODE' },
  ];
  function mk(e) {
    const o = Object.assign({ pinned: false }, e);
    o.isImage = !!o.img;
    if (o.isImage) {
      o.size = 0; o.src = o.img;
      o.preview = `${o.mimeType} ${o.w}×${o.h} · ${o.kb}`;
    } else {
      o.mimeType = 'text/plain;charset=utf-8';
      o.size = o.text.length;
      o.preview = o.text.length > 100 ? o.text.slice(0, 100) + '…' : o.text;
    }
    o.hash = 'h' + (o.isImage ? o.src : o.text).length + '_' + o.id;
    return o;
  }
  // ------------------------------------------------------------ state
  const S = {
    entries: Q.get('mode') === 'empty' ? [] : SEED.map(mk),
    online: Q.get('mode') !== 'offline',
    tab: Q.get('tab') === 'saved' ? 'saved' : 'recents',
    q: Q.get('q') || '',
    filter: ['all', 'text', 'long_text', 'image'].includes(Q.get('filter')) ? Q.get('filter') : 'all',
    sel: 0, top: 0, kb: true,           // ClipboardKeyboardController.reset(): selectedIndex 0, nav active
    layer: 'list',                      // list | preview | editor | confirm | menu | closed
    hints: Q.get('hints') === '1',
    enterPaste: Q.get('enterPaste') === '1',
    pasteAvailable: true,
    busy: false,
  };
  const typeOf = e => e.isImage ? 'image' : e.size > LONG ? 'long_text' : 'text';       // getEntryType
  const canEdit = e => !!e && !e.isImage;                                                 // canEditEntry
  const word = e => e.isImage ? 'IMAGE' : e.kind || (typeOf(e) === 'long_text' ? 'LONG' : 'TEXT');
  const isMono = e => e.kind === 'CODE';
  const ext = e => e.mimeType.split('/')[1].toUpperCase();
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
  const pinnedCount = () => S.entries.filter(e => e.pinned).length;
  const unpinnedCount = () => S.entries.filter(e => !e.pinned).length;
  const filtered = () => !!S.q || S.filter !== 'all';
  function vis() {
    if (!S.online) return [];
    const ql = S.q.toLowerCase();
    return S.entries
      .filter(e => (S.tab === 'saved' ? e.pinned : !e.pinned))
      .filter(e => !ql || e.preview.toLowerCase().includes(ql))
      .filter(e => S.filter === 'all' || typeOf(e) === S.filter)
      .sort((a, b) => b.id - a.id);
  }
  const cur = () => vis()[S.sel] || null;

  // ------------------------------------------------------------ elements + layout
  const stage = $('#stage'), cb = $('#cb'), list = $('#list'), wcur = $('#wcur'), wecho = $('#wecho'), input = $('#q');
  const rows = new Map();               // id → row element
  if (STATIC) stage.classList.add('static');

  let scale = 1;
  function fit() {
    scale = Math.max(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `scale(${scale})`;
  }
  addEventListener('resize', fit); fit();
  const toStage = ev => { const r = stage.getBoundingClientRect(); return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }; };

  // every header element's left rides the slab edge: edge(its center y) + 40
  function layout() {
    const L = y => Math.round(edge(y) + 40);
    $('#hdT').style.left = `${L(150)}px`;
    const rl = L(150) + 6;
    $('#hdRule').style.left = `${rl}px`; $('#hdRule').style.width = `${1560 - rl}px`;
    const tabs = $('#tabs'); tabs.style.left = `${L(226)}px`;
    const flt = $('#flt'), srch = $('#srch');
    const sl = L(226) + tabs.offsetWidth + 24, fl = 1790 - flt.offsetWidth;
    srch.style.left = `${sl}px`; srch.style.width = `${fl - 24 - sl}px`;
    $('#range').style.left = `${L(277)}px`;
    $('#acts').style.left = `${L(STRIP_TOP + 24)}px`;
    $('#hints').style.left = `${L(1019)}px`;
    const em = $('#empty'); em.style.left = `${rowX(1)}px`; em.style.width = `${ROW_END - rowX(1)}px`;
  }

  // drifting ring bubbles inside the slab (static: frozen positions)
  (function bubbles() {
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const box = $('#bubbles');
    for (let k = 0; k < 12; k++) {
      const b = document.createElement('i'), s = 6 + r() * 14;
      b.style.cssText = `left:${720 + r() * 1180}px;top:${1100 + r() * 40}px;width:${s}px;height:${s}px;` +
        `animation-duration:${10 + r() * 10}s;animation-delay:${-r() * 18}s`;
      if (STATIC) b.style.transform = `translate(${r() * 14}px, ${-140 - r() * 860}px)`;
      box.appendChild(b);
    }
  })();

  // ------------------------------------------------------------ rows
  // highlight search matches (escaped); the needle is matched case-insensitively
  const hl = t => {
    const s = String(t);
    if (!S.q) return esc(s);
    const lo = s.toLowerCase(), ql = S.q.toLowerCase();
    let out = '', i = 0, j;
    while ((j = lo.indexOf(ql, i)) >= 0) { out += esc(s.slice(i, j)) + `<mark>${esc(s.slice(j, j + ql.length))}</mark>`; i = j + ql.length; }
    return out + esc(s.slice(i));
  };
  const appHTML = a => {
    if (!a) return '';
    const ic = ICON[a] ? `<img src="../shared/icons/${ICON[a]}" alt="" onerror="this.remove()">`
      : `<span class="gl ${isZh(a) ? 'zh' : 'd'}">${esc(a[0].toUpperCase())}</span>`;
    return '<span class="sep">·</span>' + ic + (isZh(a) ? `<span class="zh">${esc(a)}</span>` : `<span class="l">${esc(a)}</span>`);
  };
  // newlines → ' / ', except after full-width punctuation (its own width already reads as a break)
  const collapse = t => t.trim().replace(/\s*\n+\s*/g, (m, i, all) => /[：，。；！？、）」』】…]/.test(all[i - 1] || '') ? '' : ' / ');
  function previewHTML(e) {
    if (e.isImage) return `<span class="pr img l">${e.w}×${e.h} · ${esc(e.kb)} · ${ext(e)}</span>
      <span class="th"><span class="l">IMAGE</span><img src="${esc(e.src)}" alt="" onerror="this.remove()"></span>`;
    if (e.kind === 'COLOR') return `<span class="pr hex d">${hl(e.text)}</span><span class="sw" style="background:${esc(e.text)}"></span>`;
    if (e.kind === 'LINK') return `<span class="pr link l">${hl(e.preview)}</span>`;
    if (isMono(e)) {
      const lines = e.text.split('\n'), first = lines.find(l => l.trim()) || '';
      // +N = lines after the shown first line (the 12-line QML entry reads "+11 LINES")
      const more = lines.length > 1 ? `<span class="more l">+${lines.length - 1} LINES</span>` : '';
      return `<span class="pr mono"><span class="ln">${hl(first)}</span>${more}</span>`;
    }
    if (typeOf(e) === 'long_text') return `<span class="pr long zh">${hl(collapse(e.preview))}</span>`;
    return `<span class="pr zh">${hl(e.preview)}</span>`;
  }
  function rowHTML(e) {
    const w = word(e);
    const pin = e.pinned && S.tab === 'recents' ? `<span class="l pin">${PIN_SVG}SAVED</span>` : '';
    return `<div class="ri">
      <span class="ty"><span class="d tw" style="--c:var(--c${(e.id % 5) + 1});--r:${ROT[e.id % 5]}deg">${w}<span class="echo">${w}</span></span></span>
      ${previewHTML(e)}
      <span class="mt">${pin}<span class="wh"><span class="l">${esc(e.ts)}</span>${appHTML(e.app)}</span></span></div>`;
  }
  function rowEl(e) {
    let el = rows.get(e.id);
    const rev = `${e.pinned}|${e.preview}|${S.q}|${S.tab}`;
    if (!el) {
      el = document.createElement('div');
      el.className = 'row';
      el.dataset.id = e.id;
      el.addEventListener('click', () => {
        if (S.layer !== 'list') return;
        if (cur() && cur().id === e.id && S.kb) act('copy'); else focusId(e.id);
      });
      el.addEventListener('dblclick', () => { if (S.layer === 'list') { focusId(e.id); act('copy'); } });
      el.addEventListener('contextmenu', ev => { ev.preventDefault(); if (S.layer === 'list' || S.layer === 'menu') { if (S.layer === 'menu') closeMenu(true); focusId(e.id); openMenu(); } });
      list.appendChild(el);
      rows.set(e.id, el);
    }
    if (el.dataset.rev !== rev) { el.innerHTML = rowHTML(e); el.dataset.rev = rev; }
    return el;
  }
  function focusId(id) {
    const i = vis().findIndex(e => e.id === id);
    if (i >= 0 && (i !== S.sel || !S.kb)) { S.sel = i; S.kb = true; render(); }
  }

  let lastSel = null, savedBounce = false;
  function render(opts = {}) {
    const v = vis();
    if (S.tab === 'saved' && pinnedCount() === 0 && S.online && !savedBounce) {           // saved empty → recents
      savedBounce = true;
      requestAnimationFrame(() => { savedBounce = false; setTab('recents'); toast('NO SAVED ENTRIES'); });
    }
    S.sel = Math.max(0, Math.min(S.sel, v.length - 1));
    // scroll margin 1: keep one row visible past the cursor while more exist
    if (S.sel < S.top + 1) S.top = S.sel - 1;
    if (S.sel > S.top + VIS - 2) S.top = S.sel - VIS + 2;
    S.top = Math.max(0, Math.min(S.top, Math.max(0, v.length - VIS)));

    const keep = new Set(v.map(e => e.id));
    for (const [id, el] of rows) if (!keep.has(id)) { rows.delete(id); dropRow(el, opts.cause || 'filter'); }
    v.forEach((e, i) => {
      const fresh = !rows.has(e.id);
      const el = rowEl(e), s = i - S.top;
      const x = rowX(s);
      if (fresh && !STATIC && !opts.enter) {            // place new rows without sliding from 0,0
        el.style.transition = 'none'; el.style.transform = `translate(${x}px, ${s * SLOT}px)`; el.style.width = `${ROW_END - x}px`;
        void el.offsetWidth; el.style.transition = '';
      }
      el.style.transform = `translate(${x}px, ${s * SLOT}px)`;
      el.style.width = `${ROW_END - x}px`;
      el.classList.toggle('gone', s < 0 || s >= VIS);
      const f = S.kb && i === S.sel;
      if (f && !el.classList.contains('is-focus') && lastSel !== null && !STATIC) {
        const ri = $('.ri', el); ri.classList.remove('p-wob'); void ri.offsetWidth; ri.classList.add('p-wob');
      }
      el.classList.toggle('is-focus', f);
      if (opts.enter) {
        el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
        el.style.setProperty('--i', Math.max(0, s));
        el.style.setProperty('--d0', opts.delay ? `${opts.delay}s` : '');
      }
    });

    // wedge cursor: white + separate red twin (CSS lag), same target
    const se = v[S.sel], on = !!se && S.kb;
    if (on) {
      const s = S.sel - S.top, x = rowX(s);
      const tf = `translate(${x}px, ${s * SLOT}px)`;
      if (lastSel !== null && lastSel !== se.id && !STATIC) { wcur.classList.remove('mv'); void wcur.offsetWidth; wcur.classList.add('mv'); }
      [wcur, wecho].forEach(w => { w.style.transform = tf; w.style.width = `${WEDGE_END - x}px`; });
    }
    wcur.classList.toggle('on', on); wecho.classList.toggle('on', on);
    lastSel = on ? se.id : null;

    // header: one headline count (visible), per-tab totals, context line
    const total = S.tab === 'saved' ? pinnedCount() : unpinnedCount();
    const hn = $('#hdN');
    if (hn.textContent !== String(v.length)) { hn.textContent = v.length; bump($('.hd-n')); }
    $('#nRec').textContent = S.online ? unpinnedCount() : 0;
    $('#nSav').textContent = S.online ? pinnedCount() : 0;
    const ctx = [];
    if (S.tab === 'saved') ctx.push('SAVED');
    if (S.q) ctx.push(`SEARCH “<span class="zh">${esc(S.q)}</span>”`);
    if (S.filter !== 'all') ctx.push(`FILTER · ${S.filter === 'long_text' ? 'LONG TEXT' : S.filter.toUpperCase()}`);
    $('#hdCtx').innerHTML = ctx.join(' · ');
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === S.tab));
    $$('.fc').forEach(t => t.classList.toggle('on', t.dataset.f === S.filter));
    moveInd($('#tabInd'), $('.tab.on'));
    moveInd($('#fcInd'), $('.fc.on'));
    $('#srch').classList.toggle('has', !!S.q);

    // range: position only (+ hidden rows above / below)
    const p2 = n => String(n).padStart(2, '0');
    const below = v.length - (S.top + VIS), above = S.top;
    $('#range').innerHTML = v.length
      ? `${p2(S.top + 1)}–${p2(Math.min(v.length, S.top + VIS))}${filtered() ? ` · FILTERED FROM ${total}` : ''}` +
        `${above > 0 ? ` · <b>▲ +${above}</b>` : ''}${below > 0 ? ` · <b>▼ +${below}</b>` : ''}`
      : '';

    // empty state (ClipboardContent.qml)
    const em = $('#empty'), was = em.classList.contains('on');
    em.style.animationDelay = opts.cause === 'wipe' ? '.42s' : '';     // wait for the wiped rows to leave
    em.classList.toggle('on', !v.length);
    if (!v.length) {
      const msg = !S.online ? 'Connecting to clipboard service...' : filtered() ? 'No entries match the current search' :
        S.tab === 'saved' ? 'No saved clipboard entries' : 'No recent clipboard entries found';
      const w = !S.online ? 'OFFLINE' : filtered() ? 'NO MATCH' : 'EMPTY';
      if (!was || em.dataset.w !== w) {
        em.dataset.w = w;
        em.innerHTML = `<span class="d">${w}</span><span class="em"><span class="l">${!S.online ? 'CLIPBOARD SERVICE' : 'CLIPBOARD HISTORY'}</span>
          <span class="l">${!S.online ? '<i class="dot"></i>' : ''}${msg}</span></span>`;
      }
    }
    renderActs(se);
    if (S.layer === 'preview') fillPreview();
  }
  function moveInd(ind, el) {
    if (!el) return;
    ind.style.width = `${el.offsetWidth}px`;
    ind.style.transform = `translateX(${el.offsetLeft}px)`;
  }
  // exits by cause: tab → slide left (staggered) · filter → fade in place · del → red flash + fold · wipe → out right · pin → instant
  function dropRow(el, cause) {
    if (STATIC || cause === 'pin') { el.remove(); return; }
    el.classList.remove('is-focus', 'in');
    if (cause === 'tab') {
      const s = Math.round((parseFloat(el.style.transform.split(',')[1]) || 0) / SLOT);
      el.style.setProperty('--d', `${Math.max(0, s) * 20}ms`);
    } else if (cause === 'wipe') el.style.setProperty('--d', `${Math.random() * .12}s`);
    el.classList.add('out-' + cause);
    setTimeout(() => el.remove(), cause === 'wipe' ? 620 : 420);
  }
  function bump(el) { if (STATIC) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  // ------------------------------------------------------------ action strip (fixed slots, nothing reflows)
  function renderActs(e) {
    const acts = $('#acts');
    acts.classList.toggle('hide', !vis().length);
    const canClear = S.online && vis().some(x => !x.pinned);
    const A = [
      { id: 'preview', t: 'PREVIEW', k: 'CTRL+SPACE', off: !e },
      { id: 'copy', t: 'COPY', k: S.enterPaste ? 'SHIFT+ENTER' : 'ENTER', hot: !S.enterPaste, off: !e },
      { id: 'paste', t: 'PASTE', k: S.enterPaste ? 'ENTER' : 'SHIFT+ENTER', hot: S.enterPaste, off: !e || !S.pasteAvailable },
      { id: 'pin', t: e && e.pinned ? 'UNPIN' : 'PIN', k: 'CTRL+S', off: !e },
      { id: 'edit', t: 'EDIT', k: 'CTRL+E', off: !canEdit(e) },
      { id: 'del', t: 'DELETE', k: 'DEL', off: !e },
      { id: 'clear', t: 'CLEAR ALL', k: 'SHIFT+DEL', sp: 1, clr: 1, off: !canClear },
    ];
    const key = A.map(a => a.t + a.off + a.hot).join();
    if (acts.dataset.key === key) return;
    acts.dataset.key = key;
    acts.innerHTML = A.map((a, i) => `<div class="act l${a.hot ? ' hot' : ''}${a.sp ? ' sp' : ''}${a.clr ? ' clr' : ''}${a.off ? ' off' : ''}" data-a="${a.id}" style="--i:${i}">` +
      `${a.t}${a.clr ? '<span class="p3k">HOLD</span>' : ''}<span class="k">${a.k}</span></div>`).join('');
  }
  $('#acts').addEventListener('click', ev => {
    const b = ev.target.closest('.act'); if (!b || b.classList.contains('off') || S.layer !== 'list') return;
    press(b); act(b.dataset.a);
  });
  function press(el) { if (STATIC) return; el.classList.remove('p-press'); void el.offsetWidth; el.classList.add('p-press'); }

  // ------------------------------------------------------------ actions
  let toastT;
  function toast(word2, id) {
    const t = $('#toast');
    t.innerHTML = `${esc(word2)}${id != null ? ` <span class="d">#${id}</span>` : ''}`;
    t.classList.add('on');
    clearTimeout(toastT); if (!STATIC) toastT = setTimeout(() => t.classList.remove('on'), 2200);
  }
  function pop(el) { if (STATIC) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  function stamp(e, word2, keep) {
    const v = vis(), i = v.indexOf(e), s = Math.max(0, i - S.top);
    const st = document.createElement('div');
    const w = `<span class="l">${word2}</span><span class="d">#${e.id}</span>`;
    st.className = 'stamp';
    st.innerHTML = `<span class="w echo">${w}</span><span class="w">${w}</span>`;
    st.style.left = `${rowX(s) - 30}px`;
    cb.appendChild(st);
    // rotate(-7deg) around the left middle lifts the right end by W·sin7°: keep the ink ≥ 8px under the range rule (270)
    const W = st.offsetWidth, lift = W * Math.sin(7 * Math.PI / 180) - 32 * (1 - Math.cos(7 * Math.PI / 180));
    st.style.top = `${Math.round(Math.max(rowTop(s) - 34, 270 + 8 + lift))}px`;
    const rel = rows.get(e.id); if (rel) rel.classList.add('stamped');
    pop(wcur); pop(wecho);
    if (!STATIC && !keep) setTimeout(() => { st.remove(); if (rel) rel.classList.remove('stamped'); }, 1300);
    return st;
  }
  function copy(e, how) {                // modal.copyEntry / pasteEntry → copy then hide
    if (!e || S.busy) return;
    const txt = e.isImage ? e.src : e.text;
    try { navigator.clipboard && navigator.clipboard.writeText(txt).catch(() => {}); } catch (_) {}
    stamp(e, how === 'paste' ? 'PASTED' : 'COPIED');
    if (STATIC) return;
    S.busy = true;
    setTimeout(() => { S.busy = false; close(); toast(how === 'paste' ? 'PASTED' : 'COPIED', e.id); }, 560);
  }
  // pin / unpin: a ghost of the row flies to the other tab, then the real row leaves without a slide
  function flyTo(e, tabEl) {
    const el = rows.get(e.id);
    if (!el || STATIC) return Promise.resolve();
    const g = document.createElement('div');
    g.className = 'ghost';
    const m = el.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/) || [0, 0, 0];
    const x0 = +m[1], y0 = +m[2] + LIST_TOP + ROW_TOP;
    g.style.cssText = `left:0;top:0;width:${el.offsetWidth}px;height:80px;transform:translate(${x0}px,${y0}px)`;
    g.innerHTML = el.innerHTML;
    cb.appendChild(g);
    const tabs = $('#tabs'), tx = tabs.offsetLeft + tabEl.offsetLeft + tabEl.offsetWidth / 2, ty = tabs.offsetTop + 26;
    void g.offsetWidth;
    g.style.transform = `translate(${tx}px,${ty - 10}px) scale(.25)`;
    g.style.opacity = '0';
    return new Promise(r => setTimeout(() => { g.remove(); r(); }, 450));
  }
  function togglePin(e) {
    if (!e) return;
    let target = e, msg;
    if (e.pinned) { e.pinned = false; msg = 'UNPINNED'; }
    else {
      const dup = S.entries.find(x => x.pinned && x.hash === e.hash);   // getPinnedEntryByHash
      if (dup) { dup.pinned = false; target = dup; msg = 'UNPINNED'; }
      else { e.pinned = true; msg = 'SAVED'; }
    }
    const to = $(`.tab[data-tab="${target.pinned ? 'saved' : 'recents'}"]`);
    flyTo(target, to).then(() => bump(to));
    render({ cause: 'pin' });
    toast(msg, target.id);
  }
  function del(e) {
    if (!e) return;
    if (e.pinned) { confirm({ kind: 'delpin', e }); return; }        // deletePinnedEntry asks first
    S.entries = S.entries.filter(x => x !== e); render({ cause: 'del' });
    toast('DELETED', e.id);
  }
  function act(a, e = cur()) {
    switch (a) {
      case 'copy': return copy(e, 'copy');
      case 'paste': return S.pasteAvailable && copy(e, 'paste');
      case 'copyText': return e && copy(Object.assign({}, e, { isImage: false, text: e.alt }), 'copy');
      case 'pin': return togglePin(e);
      case 'edit': return canEdit(e) && openEditor(e);
      case 'del': return del(e);
      case 'preview': return e && openPreview();
      case 'clear': return confirm({ kind: 'clear' });
    }
  }
  function setTab(t) {
    if (t === 'saved' && !pinnedCount()) return;
    if (t === S.tab) return;
    S.tab = t; S.sel = 0; S.top = 0;
    if (STATIC) { render(); return; }
    // old rows leave left, new rows enter after 120ms
    for (const [id, el] of rows) { rows.delete(id); dropRow(el, 'tab'); }
    render({ enter: true, delay: .12 });
  }

  // ------------------------------------------------------------ context menu (ClipboardContextMenu.qml, strip order)
  let menuItems = [], menuSel = 0, cmT;
  const cm = $('#cm');
  function openMenu() {
    const e = cur(); if (!e) return;
    menuItems = [{ a: 'copy', t: 'COPY', k: 'ENTER' }];
    if (e.altMimeType) menuItems.push({ a: 'copyText', t: 'COPY TEXT', k: '' });
    if (S.pasteAvailable) menuItems.push({ a: 'paste', t: 'PASTE', k: 'SHIFT+ENTER' });
    menuItems.push({ a: 'pin', t: e.pinned ? 'UNPIN' : 'PIN', k: 'CTRL+S' });
    if (canEdit(e)) menuItems.push({ a: 'edit', t: 'EDIT', k: 'CTRL+E' });
    menuItems.push({ a: 'del', t: 'DELETE', k: 'DEL', danger: 1, hr: 1 });
    menuSel = 0; S.layer = 'menu';
    clearTimeout(cmT);
    drawMenu();
    cm.classList.remove('off', 'up'); cm.classList.add('on');
    const s = S.sel - S.top, h = cm.offsetHeight, top = rowTop(s);
    const left0 = 1500 - cm.offsetWidth;
    cm.style.left = `${left0}px`;
    if (top + h > STRIP_TOP - 12) { cm.classList.add('up'); cm.style.top = `${top + 80 - h}px`; }
    else cm.style.top = `${top}px`;
    // the -3deg tilt swings one right corner out and the white backing sits +6px: measure the rotated box (no
    // entry animation) and pull the menu in so its visible right edge lands on x 1500
    cm.style.animation = 'none';
    const sr = stage.getBoundingClientRect(), r = cm.getBoundingClientRect();
    const right = (r.right - sr.left) / scale + 6;
    cm.style.left = `${Math.round(left0 - (right - 1500))}px`;
    cutRows(cm.getBoundingClientRect());
    cm.style.animation = '';
    // the wedge (ends at 1520) and its red twin would peek out past the menu: end them under it
    const x = rowX(s), wEnd = 1500 - 60;
    [wcur, wecho].forEach(w => { w.style.width = `${wEnd - x}px`; });
  }
  // rows the menu overlaps end their preview text with an ellipsis 24px before the menu's left edge, and media that
  // would sit under or beside the menu step out, so no half-glyph strip shows around it
  function cutRows(r) {
    const sr = stage.getBoundingClientRect();
    const L = (r.left - sr.left) / scale - 24, T = (r.top - sr.top) / scale, B = (r.bottom - sr.top) / scale;
    vis().slice(S.top, S.top + VIS).forEach((e, s) => {
      const el = rows.get(e.id); if (!el) return;
      const y = rowTop(s); if (y + 80 < T || y > B) return;
      const x = rowX(s);
      el.classList.add('cm-cut');
      const pr = $('.pr', el);
      if (pr) pr.style.maxWidth = `${Math.max(0, L - x - pr.offsetLeft)}px`;
      $$('.th, .sw', el).forEach(m => { if (x + m.offsetLeft + m.offsetWidth > L) m.classList.add('cm-hide'); });
    });
  }
  function uncutRows() {
    $$('.row.cm-cut', list).forEach(el => {
      el.classList.remove('cm-cut');
      const pr = $('.pr', el); if (pr) pr.style.maxWidth = '';
      $$('.cm-hide', el).forEach(m => m.classList.remove('cm-hide'));
    });
  }
  function drawMenu() {
    cm.innerHTML = menuItems.map((m, i) => `${m.hr ? '<div class="cm-hr"></div>' : ''}<div class="cm-i l${m.danger ? ' danger' : ''}${i === menuSel ? ' on' : ''}" data-i="${i}">` +
      `<span>${m.t}</span><span class="k">${m.k}</span></div>`).join('');
  }
  function closeMenu(instant) {
    if (!cm.classList.contains('on')) return;
    S.layer = 'list';
    cm.classList.remove('on');
    uncutRows();
    if (cur()) { const x = rowX(S.sel - S.top); [wcur, wecho].forEach(w => { w.style.width = `${WEDGE_END - x}px`; }); }
    if (STATIC || instant) return;
    cm.classList.add('off');
    cmT = setTimeout(() => cm.classList.remove('off'), 140);
  }
  function runMenu(i) { const m = menuItems[i]; closeMenu(); act(m.a); }
  cm.addEventListener('click', ev => { const it = ev.target.closest('.cm-i'); if (it) runMenu(+it.dataset.i); });
  stage.addEventListener('pointerdown', ev => {
    if (S.layer === 'menu' && !ev.target.closest('#cm') && ev.button !== 2) closeMenu();
  });

  // ------------------------------------------------------------ preview (ClipboardImagePreview.qml)
  const pv = $('#pv');
  function openPreview() { S.layer = 'preview'; cb.classList.add('under', 'pving'); fillPreview(); pv.classList.add('on'); }
  function closePreview() { pv.classList.remove('on'); cb.classList.remove('under', 'pving'); S.layer = 'list'; }
  function fillPreview() {
    const e = cur(); if (!e) { closePreview(); return; }
    let body;
    if (e.isImage) body = `<div class="miss"><span class="d">IMAGE</span><span class="l">FILE NOT AVAILABLE</span></div><img src="${esc(e.src)}" alt="" style="position:absolute;max-width:100%;max-height:100%" onerror="this.remove()">`;
    else body = `<div class="tx ${isMono(e) ? 'mono' : 'zh'}${e.text.length < 80 ? ' big' : ''}">${esc(e.text)}</div>`;
    const lines = e.isImage ? 0 : e.text.split('\n').length;
    const app = e.app ? (isZh(e.app) ? `<span class="zh">${esc(e.app)}</span>` : esc(e.app)) : 'UNKNOWN SOURCE';
    const cap = e.isImage ? `${e.w}×${e.h} · ${esc(e.kb)} · ${ext(e)} · ${app} · ${esc(e.ts)}`
      : `${plural(e.size, 'CHAR')} · ${plural(lines, 'LINE')} · ${app} · ${esc(e.ts)}`;
    // height from content: 380..700, bottom ≤ 936
    const big = !e.isImage && e.text.length < 80;
    const h = e.isImage ? 640 : big ? 380 : Math.min(700, Math.max(380, 230 + Math.ceil(e.text.length / 40 + lines) * 34));
    // the panel never leaves a cut row edge below it: it either covers the focused row (wedge included) with a
    // gap, or, when that would run past 936, it ends above the row. The -2deg tilt raises its right end by ~34px.
    const rt = rowTop(Math.max(0, S.sel - S.top));
    const coverH = rt + 88 + 14 - 236 + 34, aboveH = rt - 48 - 236;
    pv.style.height = `${236 + coverH <= 936 ? Math.min(700, Math.max(h, coverH)) : Math.min(h, aboveH)}px`;
    pv.innerHTML = `<div class="pv-bk"></div><div class="pv-p">
      <div class="pv-h"><span class="d pv-t" style="--c:var(--c${(e.id % 5) + 1})">${word(e)}</span>
        <span class="l pv-x" data-x>CLOSE</span></div>
      <div class="pv-b">${body}</div>
      <div class="pv-f"><span class="pv-n"><span class="d">${String(S.sel + 1).padStart(2, '0')}</span><span class="l">/ ${vis().length}</span></span>
        <span class="l pv-c">${cap}</span></div></div>`;
    if (!STATIC) { pv.classList.remove('swap'); void pv.offsetWidth; pv.classList.add('swap'); }
  }
  pv.addEventListener('click', ev => { if (ev.target.closest('[data-x]')) closePreview(); });

  // ------------------------------------------------------------ editor (ClipboardEditor.qml)
  const ed = $('#ed');
  let edEntry = null, edT;
  function openEditor(e) {
    edEntry = e; S.layer = 'editor'; cb.classList.add('under', 'eding');
    const app = e.app ? (isZh(e.app) ? `<span class="zh">${esc(e.app)}</span>` : esc(e.app)) : 'UNKNOWN SOURCE';
    ed.innerHTML = `<div class="ed-bk"></div><div class="ed-p">
      <div class="ed-h"><span class="l ed-btn" data-e="back">← BACK / ESC</span>
        <span class="ed-hm"><span class="d ed-n">EDIT</span><span class="l ed-t">${app} · ${esc(e.ts)}</span><span class="l ed-id">#${e.id}</span></span></div>
      <div class="ed-box"><textarea class="${isMono(e) ? 'mono' : 'zh'}" placeholder="Edit clipboard text" spellcheck="false"></textarea>
        <div class="ed-msg l"></div></div>
      <div class="ed-f"><span class="l ed-info" id="edInfo"></span>
        <div class="act l" data-e="cancel">CANCEL</div>
        <div class="act l hot" data-e="save">SAVE</div><div class="act l hot dd" data-e="dd">▾</div>
        <div class="ed-dd" id="edDD">
          <div class="cm-i l" data-e="save"><span>SAVE</span><span class="k">CTRL+S</span></div>
          <div class="cm-i l" data-e="saveClose"><span>SAVE AND CLOSE</span><span class="k">CTRL+SHIFT+S</span></div>
          <div class="cm-i l${S.pasteAvailable ? '' : ' off'}" data-e="savePaste"><span>SAVE AND PASTE</span><span class="k">CTRL+SHIFT+V</span></div>
        </div></div></div>`;
    ed.classList.add('on'); ed.classList.remove('failed', 'loading');
    const ta = $('textarea', ed), msg = $('.ed-msg', ed);
    const fail = Q.get('fail') === '1';
    const done = () => {
      ed.classList.remove('loading');
      if (fail) { ed.classList.add('failed'); msg.textContent = 'Failed to load clipboard entry'; return; }
      ta.value = e.text; info(); if (!STATIC) ta.focus();
    };
    clearTimeout(edT);
    ta.addEventListener('input', info);
    // full-text load only for long entries (DMS fetches the full text when the preview was truncated)
    const slow = typeOf(e) === 'long_text' || Q.get('loading') === '1';
    if (!slow) { done(); return; }
    ed.classList.add('loading'); msg.textContent = 'Loading full text, please wait...';
    if (STATIC && Q.get('loading') === '1') return;
    if (STATIC) done(); else edT = setTimeout(done, 420);
  }
  function info() {
    const ta = $('textarea', ed);
    $('#edInfo').textContent = `${plural(ta.value.length, 'CHAR')} · ${plural(ta.value.split('\n').length, 'LINE')}${ta.value !== edEntry.text ? ' · MODIFIED' : ''}`;
  }
  function closeEditor() {
    clearTimeout(edT); ed.classList.remove('on'); cb.classList.remove('under', 'eding'); S.layer = 'list';
    const ta = $('textarea', ed); if (ta) ta.blur();
    if (!STATIC) input.focus();                                            // typing goes back to the search field
  }
  function saveEditor(how) {
    const ta = $('textarea', ed); if (ed.classList.contains('loading') || ed.classList.contains('failed')) return;
    if (how === 'paste' && !S.pasteAvailable) return;
    const e = edEntry;
    if (ta.value !== e.text) { e.text = ta.value; Object.assign(e, mk(e)); }
    $('#edDD').classList.remove('on');
    closeEditor(); render();
    if (how === 'close') { stamp(e, 'SAVED', true); setTimeout(close, STATIC ? 0 : 500); }
    else if (how === 'paste') copy(e, 'paste');
    else toast('SAVED', e.id);
  }
  ed.addEventListener('click', ev => {
    const b = ev.target.closest('[data-e]'); if (!b) return;
    const k = b.dataset.e;
    if (k === 'back' || k === 'cancel') closeEditor();
    else if (k === 'dd') $('#edDD').classList.toggle('on');
    else if (k === 'save') saveEditor('history');
    else if (k === 'saveClose') saveEditor('close');
    else if (k === 'savePaste') saveEditor('paste');
  });

  // ------------------------------------------------------------ hold-to-confirm (replaces clearConfirmDialog)
  const cf = $('#cf'), HOLD = 1000;
  let cfJob = null, holdStart = 0, raf = 0, prog = 0;
  function confirm(job) {
    let title, n, unit, msg, btn, w;
    if (job.kind === 'clear') {
      const v = vis().filter(e => !e.pinned);
      if (!v.length) return;
      job.ids = filtered() ? v.map(e => e.id) : S.entries.filter(e => !e.pinned).map(e => e.id);
      n = job.ids.length; w = 'CLEAR'; title = 'CLEAR HISTORY'; btn = 'HOLD TO CLEAR ALL';
      unit = `${n === 1 ? 'ENTRY' : 'ENTRIES'}${pinnedCount() ? ` · ${pinnedCount()} SAVED KEPT` : ''}`;
      msg = filtered() ? `Deletes the entries matching the current search / filter. Saved entries are kept.`
        : pinnedCount() ? `Deletes all unpinned entries. Saved entries are kept.` : 'Permanently deletes all clipboard history.';
    } else {
      n = '#' + job.e.id; w = 'DELETE'; title = 'DELETE SAVED ITEM'; btn = 'HOLD TO DELETE';
      unit = `SAVED ENTRY #${job.e.id}`;
      msg = 'Permanently removes this saved clipboard item. This cannot be undone.';
    }
    cfJob = job; S.layer = 'confirm'; prog = 0; cb.classList.add('cfing');
    cf.className = 'cf on';
    cf.innerHTML = `<div class="cf-cl"><div class="cf-cv"></div><div class="cf-s"></div></div><div class="cf-c">
      <span class="l cf-t">${title}</span>
      <div class="cf-nr"><span class="d cf-w">${w}</span><span class="d cf-n">${job.kind === 'clear' ? n : ''}</span></div>
      <span class="l cf-u">${unit}</span>
      <div class="zh cf-m">${msg}</div>
      <div class="cf-b" id="cfB"><i class="fl"></i><span class="l bl">${btn}</span><span class="d cd" id="cfCd">1.0</span></div>
      <div class="cf-tk" id="cfTk">${'<i></i>'.repeat(20)}</div>
      <span class="l cf-x" data-x>ESC CANCEL</span></div>`;
    const b = $('#cfB');
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); holdOn(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, holdOff));
    $('[data-x]', cf).addEventListener('click', () => closeConfirm());
    if (Q.get('hold')) setProg(Math.min(1, +Q.get('hold') || 0));
  }
  function setProg(p) {
    prog = p;
    $('#cfB').style.setProperty('--p', p);
    $('#cfCd').textContent = ((1 - p) * HOLD / 1000).toFixed(1);
    [...$('#cfTk').children].forEach((t, i) => t.classList.toggle('on', i < Math.round(p * 20)));
  }
  function holdOn() {
    if (!cfJob || holdStart) return;
    holdStart = performance.now(); cf.classList.add('holding');
    const tick = now => {
      const p = Math.min(1, (now - holdStart) / HOLD); setProg(p);
      if (p >= 1) { holdStart = 0; cf.classList.remove('holding'); cf.classList.add('done'); setTimeout(runConfirm, 200); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function holdOff() {
    if (!holdStart) return;
    cancelAnimationFrame(raf); holdStart = 0; cf.classList.remove('holding'); setProg(0);   // spring back via CSS transition
  }
  function runConfirm() {
    const job = cfJob;
    // curtain lifts first; the wipe runs when the lift ends
    closeConfirm(() => {
      if (job.kind === 'clear') {
        const ids = new Set(job.ids);
        S.entries = S.entries.filter(e => !ids.has(e.id));
        if (!STATIC) { const bar = $('#wipeBar'); bar.classList.remove('go'); void bar.offsetWidth; bar.classList.add('go'); }
        render({ cause: 'wipe' });
        toast(pinnedCount() ? `CLEARED · ${pinnedCount()} SAVED KEPT` : 'HISTORY CLEARED');
      } else {
        S.entries = S.entries.filter(e => e !== job.e); render({ cause: 'del' });
        toast('DELETED', job.e.id);
      }
    });
  }
  function closeConfirm(after) {
    cancelAnimationFrame(raf); holdStart = 0; cfJob = null; S.layer = 'list'; cb.classList.remove('cfing');
    if (STATIC) { cf.className = 'cf'; after && after(); return; }
    cf.classList.add('out');
    const cv = $('.cf-cv', cf);
    let fired = false;
    const fin = () => { if (fired) return; fired = true; if (!cfJob) cf.className = 'cf'; after && after(); };
    cv.addEventListener('animationend', ev => { if (ev.animationName === 'cfLift') fin(); });
    setTimeout(fin, 520);                                                  // fallback
  }

  // ------------------------------------------------------------ open / close (Mod+Alt+V = dms ipc call clipboard toggle)
  let closeT;
  function close() {
    if (S.layer === 'closed') return;
    if (S.layer === 'preview') closePreview();
    if (S.layer === 'menu') closeMenu(true);
    S.layer = 'closed'; input.blur();
    stage.classList.add('shut');
    cb.classList.remove('opening');
    if (STATIC) { cb.classList.add('closed'); return; }
    cb.classList.add('closing');
    closeT = setTimeout(() => { cb.classList.replace('closing', 'closed'); $$('.stamp', cb).forEach(s => s.remove()); $$('.row.stamped').forEach(r => r.classList.remove('stamped')); }, 600);
  }
  function open() {
    clearTimeout(closeT);
    S.layer = 'list'; S.sel = 0; S.top = 0; S.kb = true;           // reset()
    S.hints = false; $('#hints').classList.remove('on');
    stage.classList.remove('shut');
    cb.classList.remove('closing', 'closed');
    $$('.stamp', cb).forEach(s => s.remove()); $$('.row.stamped').forEach(r => r.classList.remove('stamped'));
    if (!STATIC) { void cb.offsetWidth; cb.classList.add('opening'); setTimeout(() => cb.classList.remove('opening'), 1200); }
    render({ enter: !STATIC });
    if (!STATIC) input.focus();
  }
  $('#reopen').addEventListener('click', open);

  // ------------------------------------------------------------ inputs
  input.value = S.q;
  let typing = false;                     // true between a search edit and the next list move
  input.addEventListener('input', () => { typing = true; S.q = input.value; S.sel = 0; S.top = 0; render(); });
  $('#tabs').addEventListener('click', ev => { const t = ev.target.closest('.tab'); if (t && S.layer === 'list') setTab(t.dataset.tab); });
  $('#flt').addEventListener('click', ev => {
    const f = ev.target.closest('.fc'); if (!f || S.layer !== 'list') return;
    S.filter = f.dataset.f; S.sel = 0; S.top = 0; render();
  });
  // wheel over the slab only: accumulate, one step per 100 units, at most one per 70ms
  let wAcc = 0, wLast = 0;
  stage.addEventListener('wheel', ev => {
    if (S.layer !== 'list' && S.layer !== 'preview') return;
    const p = toStage(ev);
    if (p.x < edge(p.y)) return;
    ev.preventDefault();
    wAcc += ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
    const now = performance.now();
    if (Math.abs(wAcc) < 100 || now - wLast < 70) return;
    const d = Math.sign(wAcc); wAcc = 0; wLast = now;
    move(d);
  }, { passive: false });

  const move = d => {
    const n = vis().length; if (!n) return;
    typing = false;
    if (!S.kb) { S.kb = true; S.sel = 0; } else S.sel = Math.max(0, Math.min(n - 1, S.sel + d));
    render();
  };
  // ClipboardKeyboardController.handleKey — same layer order: confirm → editor → preview → menu → list
  document.addEventListener('keydown', ev => {
    const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey, shift = ev.shiftKey;
    const stop = () => { ev.preventDefault(); ev.stopPropagation(); };

    if (S.layer === 'closed') {
      if ((k === 'v' || k === 'V') && ev.altKey) { stop(); open(); }
      else if (k === 'Enter' || k === ' ') { stop(); open(); }
      return;
    }
    if ((k === 'v' || k === 'V') && ev.altKey) { stop(); if (S.layer === 'list') close(); return; } // Mod+Alt+V toggles
    if (S.layer === 'confirm') {
      if (k === 'Escape') { stop(); closeConfirm(); }
      else if (k === 'Enter' || k === ' ') { stop(); if (!ev.repeat) holdOn(); }
      return;
    }
    if (S.layer === 'editor') {
      if (k === 'Escape') { stop(); if ($('#edDD').classList.contains('on')) $('#edDD').classList.remove('on'); else closeEditor(); }
      else if (ctrl && (k === 's' || k === 'S')) { stop(); saveEditor(shift ? 'close' : 'history'); }
      else if (ctrl && shift && (k === 'v' || k === 'V')) { stop(); saveEditor('paste'); }
      return;
    }
    if (S.layer === 'preview') {                                     // handlePreviewKey
      if (k === 'Escape' || (ctrl && k === ' ')) { stop(); closePreview(); }
      else if (k === 'ArrowDown' || (k === 'Tab' && !shift) || (ctrl && /^[nNjJ]$/.test(k))) { stop(); move(1); }
      else if (k === 'ArrowUp' || (k === 'Tab' && shift) || (ctrl && /^[pPkK]$/.test(k))) { stop(); move(-1); }
      else if (ctrl && (k === 'e' || k === 'E')) { stop(); closePreview(); act('edit'); }
      else if (k === 'Enter') { stop(); closePreview(); act((shift !== S.enterPaste) ? 'paste' : 'copy'); }
      return;
    }
    if (S.layer === 'menu') {
      stop();
      if (k === 'Escape') closeMenu();
      else if (k === 'ArrowDown' || k === 'Tab') { menuSel = (menuSel + 1) % menuItems.length; drawMenu(); }
      else if (k === 'ArrowUp') { menuSel = (menuSel - 1 + menuItems.length) % menuItems.length; drawMenu(); }
      else if (k === 'Enter') runMenu(menuSel);
      return;
    }

    // list
    if (k === 'Escape') { stop(); if (S.q) { S.q = input.value = ''; S.sel = 0; render(); } else close(); return; }
    if (k === 'Tab' && ctrl) { stop(); setTab(S.tab === 'saved' ? 'recents' : 'saved'); return; }
    if (k === 'ArrowDown' || k === 'Tab' && !shift) { stop(); move(1); return; }
    if (k === 'ArrowUp' || k === 'Tab' && shift) { stop(); move(-1); return; }
    if (k === 'ContextMenu' || (shift && k === 'F10')) { stop(); openMenu(); return; }
    if (k === 'F10') { stop(); S.hints = !S.hints; $('#hints').classList.toggle('on', S.hints); renderActs(cur()); return; }
    if (ctrl) {
      if (/^[nNjJ]$/.test(k)) { stop(); move(1); return; }
      if (/^[pPkK]$/.test(k)) { stop(); move(-1); return; }
      if (/^[cC]$/.test(k) && S.kb && !(input.selectionStart !== input.selectionEnd)) { stop(); act('copy'); return; }
      if (/^[sS]$/.test(k)) { stop(); if (S.kb && !shift) act('pin'); return; }
      if (/^[eE]$/.test(k)) { stop(); act('edit'); return; }
      if (shift && /^[vV]$/.test(k)) { stop(); return; }              // editor-only shortcut; never a native paste into #q
      if (k === ' ') { stop(); if (S.kb) act('preview'); return; }
      return;
    }
    if ((k === 'ArrowLeft' || k === 'ArrowRight') && !shift && !ev.altKey && !input.value) {
      stop(); const F = ['all', 'text', 'long_text', 'image'];
      S.filter = F[(F.indexOf(S.filter) + (k === 'ArrowRight' ? 1 : F.length - 1)) % F.length]; S.sel = 0; S.top = 0; render(); return;
    }
    if (shift && k === 'Delete') { stop(); act('clear'); return; }
    if (k === 'Enter' && S.kb) { stop(); act((shift !== S.enterPaste) ? 'paste' : 'copy'); return; }
    if (k === 'Delete' && S.kb) {
      if (document.activeElement === input && input.value && (typing || input.selectionStart < input.value.length)) return;   // let the field delete chars
      stop(); act('del'); return;
    }
    // typing goes to the search field (it never takes Tab)
    if (k.length === 1 && !ev.altKey && document.activeElement !== input) input.focus();
  });

  document.addEventListener('keyup', ev => { if (S.layer === 'confirm' && (ev.key === 'Enter' || ev.key === ' ')) holdOff(); });


  // ------------------------------------------------------------ boot (+ static URL modes)
  if (Q.get('sel')) { S.sel = Math.max(0, +Q.get('sel') || 0); }
  if (S.hints) $('#hints').classList.add('on');
  layout();
  if (!STATIC) { cb.classList.add('opening'); setTimeout(() => cb.classList.remove('opening'), 1200); }
  render({ enter: !STATIC });
  if (!STATIC) input.focus();
  const relayout = () => { layout(); moveInd($('#tabInd'), $('.tab.on')); moveInd($('#fcInd'), $('.fc.on')); };
  if (document.fonts) document.fonts.ready.then(relayout);
  const mode = Q.get('mode');
  if (mode === 'preview') openPreview();
  else if (mode === 'editor') { const e = cur(); if (canEdit(e)) openEditor(e); else openEditor(vis().find(canEdit)); }
  else if (mode === 'confirm') confirm({ kind: 'clear' });
  else if (mode === 'menu') openMenu();
  else if (mode === 'copied') { const e = cur(); if (e) stamp(e, 'COPIED', true); }
  else if (mode === 'closed') close();
})();
