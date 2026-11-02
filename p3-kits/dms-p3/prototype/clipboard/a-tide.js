/* a-tide.js — direction A "TIDE 列表". See header comment in a-tide.html for the QML porting map. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const Q = new URLSearchParams(location.search);
const STATIC = Q.has('static') && Q.get('static') !== '0';
const LONG = 200, PREV = 100, ROW = 72, LIST_H = 528;   // ClipboardConstants.qml
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hasCJK = s => /[㐀-鿿　-〿＀-￯]/.test(s);

// ------------------------------------------------------------ mock data (ClipboardService entries)
const QML = `Rectangle {
    id: bubble
    width: 1706; height: 48
    radius: 24
    color: "#14306e"
    Behavior on y {
        SpringAnimation { spring: 3.2; damping: 0.28 }
    }
}`;
const ZH = `十月月报摘要

本月主要完成了 P3 风格外壳的第一轮落地：灵动岛的气泡形变改成了同一张 SDF，颈子在快速切换时不再抖动；全屏菜单补齐了 APPS、STATUS、CALENDAR、SYSTEM、POWER 五个页面，焦点统一为 tide 光点，导轨列表使用白色楔形加红色残影。

下个月计划把剪切板、通知中心和锁屏迁移到同一套视觉规则上，优先保证键盘操作完整、动效只使用位移、透明度和裁剪，方便之后移植到 QML。另外需要整理字体子集，确保中文正文统一使用思源黑体中等字重，展示字只出现在名词和数字上。`;
const JSON_T = `{
  "theme": "p3",
  "island": { "w": 1706, "state": 2, "spring": 3.2 },
  "menu": { "bg": "water", "cursor": "tide" },
  "clipboard": { "enterToPaste": false, "maxEntries": 300 }
}`;
const RAW = [
  { id: 214, t: 'text', preview: 'git commit -m "fix(island): 修复气泡颈子抖动"', ts: 'JUST NOW', clock: '16:29', app: 'kitty', code: 1 },
  { id: 213, t: 'image', src: '../shared/desk.jpg', mime: 'image/jpeg', w: 1920, h: 1080, kb: '336 KB', ts: '2 MIN AGO', clock: '16:27', app: '截图', altMimeType: 'text/uri-list', uri: 'file:///home/lyfmt/Pictures/Screenshots/2026-11-01_16-27.jpg' },
  { id: 212, t: 'text', preview: 'https://github.com/AvengeMedia/DankMaterialShell/releases/tag/v2.0.0', ts: '5 MIN AGO', clock: '16:24', app: 'chromium', code: 1 },
  { id: 211, t: 'text', preview: '#0b8fe8', ts: '8 MIN AGO', clock: '16:21', app: 'typora', code: 1 },
  { id: 210, t: 'text', preview: QML, ts: '12 MIN AGO', clock: '16:17', app: 'kitty', code: 1, pinned: true },
  { id: 209, t: 'text', preview: '晚上七点在三楼会议室，记得带转接头', ts: '20 MIN AGO', clock: '16:09', app: 'qq' },
  { id: 208, t: 'text', preview: 'ssh lyfmt@192.168.1.24 -p 2222', ts: 'YESTERDAY', clock: '21:14', app: 'termius', code: 1, pinned: true },
  { id: 207, t: 'image', src: '../shared/miku-bg.png', mime: 'image/png', w: 2560, h: 1440, kb: '1.3 MB', ts: '35 MIN AGO', clock: '15:54', app: '浏览器' },
  { id: 206, t: 'text', preview: ZH, ts: '1 HR AGO', clock: '15:30', app: 'feishu' },
  { id: 205, t: 'text', preview: 'Memento mori.', ts: '1 HR AGO', clock: '15:12', app: 'chromium' },
  { id: 204, t: 'text', preview: 'lyfmt@outlook.com', ts: '3 DAYS AGO', clock: '10:02', app: '', pinned: true },
  { id: 203, t: 'text', preview: 'paru -S quickshell-git dms-shell-git', ts: '2 HR AGO', clock: '14:31', app: 'kitty', code: 1 },
  { id: 202, t: 'image', src: '../shared/shot-missing.png', mime: 'image/png', w: 1280, h: 720, kb: '212 KB', ts: 'YESTERDAY', clock: '18:02', app: '截图' },
  { id: 201, t: 'text', preview: JSON_T, ts: 'YESTERDAY', clock: '10:40', app: 'typora', code: 1 },
];
const ICON = { kitty: 'kitty.png', chromium: 'chromium.png', typora: 'typora.png', qq: 'qq.png', termius: 'termius.png', feishu: 'feishu.png', '截图': 'files.svg', '浏览器': 'chromium.png' };
let ENTRIES = RAW.map(e => ({ ...e, isImage: e.t === 'image', pinned: !!e.pinned, hash: 'h' + e.id,
  mimeType: e.t === 'image' ? e.mime : 'text/plain;charset=utf-8' }));

// ClipboardHistoryModal.getEntryType / getEntryPreview
const typeOf = e => e.isImage ? 'image' : (e.preview.length > LONG ? 'long_text' : 'text');
const typeTag = e => e.isImage ? `IMAGE • ${e.w}×${e.h} / ${e.mime.split('/')[1].toUpperCase()}` : typeOf(e) === 'long_text' ? 'LONG TEXT' : 'TEXT';
const prevText = e => { const s = e.preview.replace(/\s+/g, ' ').trim(); return s.length > PREV ? s.slice(0, PREV) + '…' : s; };
const isHex = e => !e.isImage && /^#[0-9a-f]{6}$/i.test(e.preview.trim());

// ------------------------------------------------------------ state
const S = {
  tab: Q.get('tab') === 'saved' ? 'saved' : 'recents',
  filter: ['all', 'text', 'long_text', 'image'].includes(Q.get('filter')) ? Q.get('filter') : 'all',
  q: Q.get('q') || '',
  sel: Q.has('sel') ? Math.max(0, +Q.get('sel') || 0) : 0,
  kb: Q.has('sel'),          // keyboardNavigationActive: first nav key only activates
  mode: null,                // null | preview | editor | confirm | menu
  hints: Q.get('hints') === '1',
  online: Q.get('mode') !== 'offline',
  closed: false, scroll: 0, lastSel: -1, busy: false,
};
if (Q.get('mode') === 'empty' || Q.get('mode') === 'offline') ENTRIES = [];   // offline: service has no entries yet

const pinnedAll = () => ENTRIES.filter(e => e.pinned);
const unpinnedAll = () => ENTRIES.filter(e => !e.pinned);
const tabAll = () => S.tab === 'saved' ? pinnedAll() : unpinnedAll();
function view() {
  const q = S.q.toLowerCase();
  return tabAll().filter(e => (S.filter === 'all' || typeOf(e) === S.filter) &&
    (!q || (e.isImage ? typeTag(e) + ' ' + (e.uri || '') : e.preview).toLowerCase().includes(q)))
    .sort((a, b) => b.id - a.id);
}
const cur = () => view()[S.sel];

// ------------------------------------------------------------ glyphs
const G = {
  pin: '<path d="M16 3v2h-1v6l2 3v2h-4v5l-1 1-1-1v-5H7v-2l2-3V5H8V3z"/>',
  copy: '<path d="M8 3h11v13h-2V5H8zM5 7h10v14H5z"/>',
  paste: '<path d="M9 2h6v2h4v18H5V4h4zm0 4H7v14h10V6h-2v2H9z"/>',
  edit: '<path d="M15.5 3.5l5 5L9 20H4v-5zM4 22h16v-1H4z"/>',
  del: '<path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z"/>',
  eye: '<path d="M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
  down: '<path d="M6 9l6 6 6-6z"/>', back: '<path d="M14 5l-7 7 7 7 1.5-1.5L10 12l5.5-5.5z"/>',
  x: '<path d="M6.4 5L12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/>',
};
const g = (n, s = 18, c = '') => `<svg class="${c}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor">${G[n]}</svg>`;
const ico = app => ICON[app] ? `<img src="../shared/icons/${ICON[app]}" alt="" onerror="this.remove()">` : '';
const img = (e, cls = '') => `<img class="${cls}" src="${esc(e.src)}" alt="" onerror="this.remove()">`;
const pad = n => String(n).padStart(2, '0');

// ------------------------------------------------------------ render
function headerCount() { return tabAll().length; }
function renderHead() {
  $('#cnt').textContent = headerCount();
  $('#cntL').textContent = S.tab === 'saved' ? 'SAVED' : 'HISTORY';
  $('#nR').textContent = unpinnedAll().length;
  $('#nS').textContent = pinnedAll().length;
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === S.tab));
  const w = $('#wedge'), x = S.tab === 'saved' ? 184 : 0;
  if (w._x !== undefined && w._x !== x) { w.classList.add('moving'); requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('moving'))); }
  w._x = x; w.style.transform = `translateX(${x}px)`;
  const counts = { all: 0, text: 0, long_text: 0, image: 0 };
  tabAll().forEach(e => { counts.all++; counts[typeOf(e)]++; });
  $$('.ch').forEach(c => { c.classList.toggle('on', c.dataset.f === S.filter);
    c.innerHTML = c.textContent.replace(/\d+$/, '').trim() + ` <i>${counts[c.dataset.f]}</i>`; });
  $('#sf').classList.toggle('has', !!S.q);
  const v = view().length;
  $('#hit').textContent = (S.q || S.filter !== 'all') ? `${v} MATCH` : '';
  $('#clr').firstChild.textContent = (S.q || S.filter !== 'all') ? `CLEAR ${v} ` : 'CLEAR ALL ';
}

function rowHTML(e, i) {
  const t = typeOf(e), sel = i === S.sel && S.kb;
  const c = `var(--c${(i % 5) + 1})`;
  let lead = '';
  if (e.isImage) lead = `<div class="th"><span class="l">IMAGE</span>${img(e)}</div>`;
  else if (isHex(e)) lead = `<div class="sw" style="background:${e.preview.trim()}"></div>`;
  const pr = e.isImage ? `<div class="pr l" style="font-size:15px">${esc(e.kb)} · ${esc(e.src.split('/').pop())}</div>`
    : `<div class="pr ${e.code && !hasCJK(e.preview) ? 'mono' : 'zh'}">${esc(prevText(e))}</div>`;
  return `<div class="row ${t === 'long_text' ? 'long' : ''} ${sel ? 'sel' : ''}" data-i="${i}" data-id="${e.id}">
    <span class="d no" style="--c:${c}">${pad(i + 1)}</span>
    <div class="tx"><div class="tg l"><em>${typeTag(e)}</em><span>${e.ts}</span>${ico(e.app)}</div>${pr}</div>${lead}
    ${e.pinned ? g('pin', 18, 'pin') : ''}<div class="cp"></div></div>`;
}

function emptyState() {
  const em = $('#em');
  if (!S.online) return `<div class="d">OFFLINE</div><div class="l">Connecting to clipboard service...</div><div class="dots"><i></i><i></i><i></i></div>`;
  if (S.q || S.filter !== 'all') return `<div class="d">NO MATCH</div><div class="zh">没有匹配「${esc(S.q || S.filter)}」的条目</div><div class="l">ESC CLEAR SEARCH</div>`;
  return S.tab === 'saved' ? `<div class="d">EMPTY</div><div class="l">No saved clipboard entries</div><div class="l">CTRL+S PIN AN ENTRY</div>`
    : `<div class="d">EMPTY</div><div class="l">No recent clipboard entries found</div>`;
}

function renderList() {
  const v = S.online ? view() : [];
  if (S.sel >= v.length) S.sel = Math.max(0, v.length - 1);
  $('#lsi').innerHTML = v.map(rowHTML).join('');
  const em = $('#em');
  em.classList.toggle('on', !v.length); em.innerHTML = v.length ? '' : emptyState();
  $('#ls').style.visibility = v.length ? '' : 'hidden';
  $('#pv').style.visibility = v.length ? '' : 'hidden';
  $('#ls').classList.toggle('ovf', v.length * ROW > LIST_H);
  placeCursor(true);
}

function placeCursor(jump) {
  const v = view(), t = $('#tide');
  const max = Math.max(0, v.length * ROW - LIST_H);
  // ensureVisible (ClipboardContent.qml): keep the selected row inside the viewport
  const y = S.sel * ROW;
  if (y < S.scroll) S.scroll = y;
  if (y + ROW > S.scroll + LIST_H - 24) S.scroll = Math.min(max, y + ROW - LIST_H + 24);
  S.scroll = Math.max(0, Math.min(S.scroll, max));
  $('#lsi').style.transform = `translateY(${-S.scroll}px)`;
  t.style.top = (y - S.scroll) + 'px';
  t.classList.toggle('on', S.kb && v.length > 0);
  $$('.row').forEach(r => r.classList.toggle('sel', S.kb && +r.dataset.i === S.sel));
  if (!jump && S.lastSel !== S.sel && !STATIC) {
    const r = $(`.row[data-i="${S.sel}"]`);
    if (r) { r.classList.remove('wob'); void r.offsetWidth; r.classList.add('wob'); }
    t.classList.remove('wob'); void t.offsetWidth; t.classList.add('wob');
  }
  S.lastSel = S.sel;
  $('#ls').classList.toggle('ovf', v.length * ROW > LIST_H && S.scroll < max);
  renderPane();
}

function body(e) {
  if (e.isImage) return `<div class="im"><span class="d">IMAGE</span>${img(e)}</div>`;
  const big = e.preview.length <= 60 && !e.preview.includes('\n') ? ' big' : '';
  let h = e.code ? `<pre class="mono${big}">${esc(e.preview)}</pre>` : `<p class="zh${big}">${esc(e.preview)}</p>`;
  if (isHex(e)) h += `<div class="swb" style="background:${e.preview.trim()}"></div>`;
  return h;
}
function renderPane() {
  const e = cur(), pv = $('#pv');
  if (!e) { pv.innerHTML = ''; return; }
  const chars = e.isImage ? `${e.w}×${e.h} · ${e.kb}` : `${e.preview.length} CHARS · ${e.preview.split('\n').length} LINES`;
  const src = e.app ? `${hasCJK(e.app) ? `<span class="zh" style="font-size:13px;letter-spacing:.04em">${esc(e.app)}</span>` : esc(e.app)}` : 'UNKNOWN';
  pv.innerHTML = `<div class="ph"><span class="d">${pad(S.sel + 1)}</span>
      <div class="mt l"><b>${typeTag(e)}</b><span>${e.ts} · ${e.clock} · ${src}</span></div>
      ${e.pinned ? `<span class="p-chip l pinf" style="display:inline-flex;gap:6px;align-items:center;padding:5px 9px 4px;background:var(--fill);color:var(--ink);font-size:13px">${g('pin', 13)}SAVED</span>` : ''}</div>
    <div class="sec p-sec l" style="display:flex;align-items:center;gap:16px;font-size:15px;letter-spacing:.24em;color:var(--dim)">CONTENT<span style="flex:1;height:1px;background:var(--line)"></span><span>#${e.id}</span></div>
    <div class="ct ${S.lastPane !== e.id && !STATIC ? 'chg' : ''}" id="ct">${body(e)}</div>
    <div class="ac">
      <div class="b l" data-act="copy">${g('copy', 16)}COPY <kbd>↵</kbd></div>
      <div class="b l" data-act="paste">${g('paste', 16)}PASTE <kbd>⇧↵</kbd></div>
      <div class="b l" data-act="pin">${g('pin', 16)}${e.pinned ? 'UNPIN' : 'PIN'} <kbd>^S</kbd></div>
      <div class="b l" data-act="edit" ${e.isImage ? 'hidden' : ''}>${g('edit', 16)}EDIT <kbd>^E</kbd></div>
      <div class="b l" data-act="preview">${g('eye', 16)}VIEW <kbd>^␣</kbd></div>
      <div class="b l dg" data-act="delete">${g('del', 16)}DELETE</div>
    </div>`;
  S.lastPane = e.id;
  const ct = $('#ct');
  requestAnimationFrame(() => ct.classList.toggle('ovf', ct.scrollHeight > ct.clientHeight + 2));
}

// ------------------------------------------------------------ overlays
function setMode(m) {
  S.mode = m;
  ['ovPv', 'ovEd', 'ovCf'].forEach(id => $('#' + id).classList.remove('on'));
  $('#cx').classList.remove('on');
  $('.pn').classList.toggle('ov-cf', m === 'confirm');
  if (m === 'preview') renderPreview(), $('#ovPv').classList.add('on');
  if (m === 'editor') renderEditor(), $('#ovEd').classList.add('on');
  if (m === 'confirm') $('#ovCf').classList.add('on');
  if (m === 'menu') $('#cx').classList.add('on');
}
function renderPreview() {
  const e = cur(); if (!e) return setMode(null);
  const v = view();
  const box = e.isImage ? `<div class="ivw"><span class="d">IMAGE</span>${img(e)}</div>`
    : `<div class="ivw txt">${e.code ? `<pre class="mono">${esc(e.preview)}</pre>` : `<p class="zh">${esc(e.preview)}</p>`}</div>`;
  $('#ovPv').innerHTML = `<div class="oh"><span class="d">PREVIEW</span><span class="mt l">${typeTag(e)} · ${e.kb || e.preview.length + ' CHARS'}</span>
      <span class="sp"></span><div class="btn l" data-act="close-ov">${g('x', 16)}CLOSE <kbd style="font-size:12px;opacity:.7">ESC</kbd></div></div><div class="orl"></div>
    ${box}
    <div class="ocap l"><span>${e.ts} · ${e.clock}</span>${e.isImage ? `<span class="zh">${esc(e.src.split('/').pop())} · 来自${esc(e.app || '未知')}</span>` : ''}
      <span class="nav">↑↓ <span class="d">${pad(S.sel + 1)}</span>/ ${pad(v.length)}</span></div>`;
}
function renderEditor(loading) {
  const e = cur(); if (!e || e.isImage) return setMode(null);
  const ov = $('#ovEd');
  ov.innerHTML = `<div class="oh"><div class="btn l" data-act="close-ov">${g('back', 16)}BACK</div><span class="d">EDIT</span><span class="mt l">Edit Clipboard · #${e.id}</span>
      <span class="sp"></span><div class="btn l" data-act="close">${g('x', 16)}CLOSE</div></div><div class="orl"></div>
    <div class="ed loading" id="ed"><textarea id="ta" placeholder="Edit clipboard text" spellcheck="false"></textarea><div class="ld l">Loading full text, please wait...</div></div>
    <div class="ef"><span class="cn l" id="edc"></span>
      <div class="b l" data-act="close-ov">CANCEL <kbd style="font-size:12px;opacity:.7">ESC</kbd></div>
      <div class="b l sv" data-act="save">SAVE <kbd style="font-size:12px;opacity:.7">^↵</kbd></div><div class="b dd" data-act="savemenu">${g('down', 18)}</div></div>
    <div class="sm" id="sm"><div class="mi l sel" data-act="save">SAVE<kbd>^↵</kbd></div><div class="mi l" data-act="save-close">SAVE AND CLOSE</div><div class="mi l" data-act="save-paste">SAVE AND PASTE</div></div>`;
  const ta = $('#ta'), done = () => {
    $('#ed').classList.remove('loading'); ta.value = e.preview; cnt();
    if (!STATIC) ta.focus();
  }, cnt = () => $('#edc').textContent = `${ta.value.length} CHARS`;
  ta.addEventListener('input', cnt);
  if (STATIC) done(); else setTimeout(done, 380);
}
function renderConfirm(kind, entry) {
  S.cf = { kind, entry };
  const v = view(), filtered = S.q || S.filter !== 'all', pc = pinnedAll().length;
  let q, msg, lab;
  const keep = kind === 'clear' && !filtered && pc && S.tab !== 'saved';
  if (kind === 'clear') {
    q = 'CLEAR?'; lab = filtered ? `CLEAR ${v.length}` : 'CLEAR ALL';
    msg = filtered ? `只删除当前匹配的 <b>${v.length}</b> 条。<br><span class="l" style="font-size:15px;color:var(--dim)">Clear History? · ${v.length} matching entries</span>`
      : pc && S.tab !== 'saved' ? `将删除所有未置顶的条目，<b>${pc}</b> 条已置顶的会保留。<br><span class="l" style="font-size:15px;color:var(--dim)">This will delete all unpinned entries. ${pc} pinned entries will be kept.</span>`
      : `将永久删除全部剪贴板历史。<br><span class="l" style="font-size:15px;color:var(--dim)">This will permanently delete all clipboard history.</span>`;
  } else {
    q = 'DELETE?'; lab = 'DELETE';
    msg = `这条已置顶：<b>${esc(prevText(entry).slice(0, 40))}</b><br><span class="l" style="font-size:15px;color:var(--dim)">Delete pinned entry #${entry.id}?</span>`;
  }
  $('#ovCf').innerHTML = `<div class="oh"><span class="mt l">Clear History?</span></div>
    <div class="cf-side"><span class="d">${kind === 'clear' ? v.length : 1}</span><span class="l">${kind === 'clear' ? 'ENTRIES GO' : 'SAVED ENTRY GOES'}</span>${keep ? `<span class="l kp">${pc} SAVED STAY</span>` : ''}</div>
    <div class="ov-cf-box"><div class="l lt0">${kind === 'clear' ? 'Clear History?' : 'Delete pinned entry?'}</div><div class="d q">${q}</div><div class="zh">${msg}</div>
      <div class="hold" id="hold" data-act="hold"><div class="hf"></div><span class="d">${lab}</span><span class="l">HOLD ENTER · HOLD CLICK 1S</span><span class="d pc" id="pc">1.0</span></div>
      <div class="alt"><div class="b l" data-act="close-ov">CANCEL <kbd style="font-size:12px;opacity:.7">ESC</kbd></div></div></div>`;
  $('#ovCf .oh').style.display = 'none';
  setMode('confirm');
  if (Q.has('hold')) setHold(+Q.get('hold'));
}

// ------------------------------------------------------------ hold-to-confirm (POWER style)
let hp = 0, holding = false, raf = 0, last = 0;
function setHold(p) {
  hp = Math.max(0, Math.min(1, p));
  const h = $('#hold'); if (!h) return;
  h.style.setProperty('--p', hp);
  h.classList.toggle('hot', hp > .5);
  $('#pc').textContent = (1 - hp).toFixed(1);
}
function holdTick(t) {
  const dt = Math.min(64, t - (last || t)); last = t;
  if (holding) setHold(hp + dt / 1000);
  else setHold(hp - dt / 260);
  if (hp >= 1) { holding = false; last = 0; return confirmDone(); }
  if (holding || hp > 0) raf = requestAnimationFrame(holdTick); else { last = 0; raf = 0; }
}
function holdStart() { if (S.mode !== 'confirm' || holding) return; holding = true; if (!raf) raf = requestAnimationFrame(holdTick); }
function holdEnd() { holding = false; if (!raf && hp > 0) raf = requestAnimationFrame(holdTick); }
function confirmDone() {
  const { kind, entry } = S.cf;
  if (!STATIC) { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  if (kind === 'clear') {
    const ids = new Set(view().map(e => e.id));
    const keepPinned = !(S.q || S.filter !== 'all') && S.tab !== 'saved';
    ENTRIES = ENTRIES.filter(e => !ids.has(e.id) || (keepPinned && e.pinned));
    toast(ids.size, 'CLEARED');
  } else {
    ENTRIES = ENTRIES.filter(e => e.id !== entry.id); toast(entry.id, 'DELETED');
  }
  setHold(0); setMode(null); fallback(); renderAll();
}

// ------------------------------------------------------------ actions (ClipboardHistoryModal / ClipboardService)
let tt = 0;
function toast(n, label) {
  $('#tstN').textContent = n; $('#tstL').textContent = label;
  const t = $('#tst'); t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), STATIC ? 99999 : 1100);
  $('#st').textContent = `${label} #${n}`;
}
function fallback() { if (S.tab === 'saved' && !pinnedAll().length) S.tab = 'recents'; }
function renderAll() { renderHead(); renderList(); }

function copy(paste, close = true) {
  const e = cur(); if (!e || S.busy) return;
  const r = $(`.row[data-i="${S.sel}"]`);
  try { navigator.clipboard && navigator.clipboard.writeText(e.isImage ? (e.uri || e.src) : e.preview).catch(() => {}); } catch (_) {}
  toast(e.id, paste ? 'PASTED' : 'COPIED');
  if (r && !STATIC) { r.classList.add('copied'); }
  if (!close || STATIC) return;
  S.busy = true;
  setTimeout(() => { closePanel(); S.busy = false; if (r) r.classList.remove('copied'); }, 620);
}
function del() {
  const e = cur(); if (!e) return;
  if (e.pinned) return renderConfirm('pin', e);
  const r = $(`.row[data-i="${S.sel}"]`);
  const go = () => { ENTRIES = ENTRIES.filter(x => x.id !== e.id); fallback(); renderAll(); $('#st').textContent = `DELETED #${e.id}`; };
  if (r && !STATIC) { r.classList.add('out'); setTimeout(go, 180); } else go();
}
function pin() {
  const e = cur(); if (!e) return;
  // ClipboardKeyboardController.togglePinSelected: an unpinned dup of a pinned hash unpins that one
  const dup = !e.pinned && ENTRIES.find(x => x.pinned && x.hash === e.hash && x !== e);
  (dup || e).pinned = !(dup || e).pinned;
  toast(e.id, e.pinned ? 'SAVED' : 'UNPINNED');
  fallback(); renderAll();
}
function setTab(t) {
  if (t === 'saved' && !pinnedAll().length) { $('#st').textContent = 'No saved clipboard entries'; t = 'recents'; }
  if (t === S.tab) return;
  S.tab = t; S.sel = 0; S.scroll = 0; S.lastSel = -1; renderAll();
}
function setFilter(f) { S.filter = f; S.sel = 0; S.scroll = 0; renderAll(); }
function move(d) {
  const n = view().length; if (!n) return;
  if (!S.kb) { S.kb = true; S.sel = 0; placeCursor(); return; }
  S.sel = Math.max(0, Math.min(n - 1, S.sel + d)); placeCursor();
  if (S.mode === 'preview') renderPreview();
}
function closePanel() {
  setMode(null); $('#stage').classList.add('closed'); S.closed = true; $('#q').blur();
}
function open() {
  $('#stage').classList.remove('closed', 'enter'); S.closed = false;
  S.q = ''; $('#q').value = ''; S.sel = 0; S.kb = false; S.scroll = 0; S.lastSel = -1; renderAll();
  if (!STATIC) { void $('#stage').offsetWidth; $('#stage').classList.add('enter'); }
  $('#q').focus();
}

// context menu (ClipboardContextMenu.qml)
let cxSel = 0;
function menuItems(e) {
  const it = [['copy', 'COPY', '↵']];
  if (e.altMimeType) it.push(['copytext', 'COPY TEXT', '']);
  it.push(['pin', e.pinned ? 'UNPIN' : 'PIN', '^S']);
  if (!e.isImage) it.push(['edit', 'EDIT', '^E']);
  it.push(['paste', 'PASTE', '⇧↵'], ['delete', 'DELETE', 'DEL']);
  return it;
}
function openMenu(i, x, y) {
  S.sel = i; S.kb = true; placeCursor(true);
  const e = cur(); if (!e) return; cxSel = 0;
  const cx = $('#cx');
  cx.innerHTML = menuItems(e).map((m, k) => `<div class="mi l ${k === 0 ? 'sel' : ''}" data-act="${m[0]}" data-k="${k}">${m[1]}<kbd>${m[2]}</kbd></div>`).join('');
  const bd = $('.bd'), top = 266 + (S.sel * ROW - S.scroll);
  cx.style.left = (x != null ? x : 64 + 420) + 'px';
  cx.style.top = Math.min(864 - 320, (y != null ? y : top + 40)) + 'px';
  setMode('menu');
}
function menuMove(d) {
  const it = $$('#cx .mi'); cxSel = (cxSel + d + it.length) % it.length;
  it.forEach((m, k) => m.classList.toggle('sel', k === cxSel));
}

function run(a, el) {
  if (el && !STATIC) { el.classList.remove('press'); void el.offsetWidth; el.classList.add('press'); }
  const wasMenu = S.mode === 'menu'; if (wasMenu) setMode(null);
  switch (a) {
    case 'copy': return copy(false);
    case 'copytext': { const e = cur(); if (!e) return;
      try { navigator.clipboard && navigator.clipboard.writeText(e.uri || e.src).catch(() => {}); } catch (_) {}
      toast(e.id, 'COPIED URI'); return; }
    case 'paste': return copy(true);
    case 'pin': return pin();
    case 'edit': return cur() && !cur().isImage && setMode('editor');
    case 'preview': return setMode('preview');
    case 'delete': return del();
    case 'clear': return view().length && renderConfirm('clear');
    case 'close-ov': return setMode(null);
    case 'close': return closePanel();
    case 'savemenu': return $('#sm').classList.toggle('on');
    case 'save': case 'save-close': case 'save-paste': {
      const e = cur(), v = $('#ta') && $('#ta').value;
      if (e && v != null) { e.preview = v; }
      $('#sm') && $('#sm').classList.remove('on');
      if (a === 'save') { renderList(); $('#edc').textContent = `SAVED · ${v.length} CHARS`; toast(e.id, 'SAVED TEXT'); return; }
      setMode(null); renderList();
      return a === 'save-paste' ? copy(true) : (toast(e.id, 'SAVED TEXT'), closePanel());
    }
  }
}

// ------------------------------------------------------------ keyboard (ClipboardKeyboardController.handleKey)
function onKey(e) {
  const k = e.key, ctrl = e.ctrlKey, shift = e.shiftKey;
  if (S.closed) { if ((k === 'v' || k === 'V') && e.altKey || k === 'Enter' || k === ' ') { e.preventDefault(); open(); } return; }
  if (k === 'F10' && !shift) { e.preventDefault(); S.hints = !S.hints; $('#stage').classList.toggle('hints', S.hints); return; }
  const stop = () => { e.preventDefault(); e.stopPropagation(); };

  if (S.mode === 'confirm') {
    if (k === 'Escape') { stop(); setHold(0); holding = false; return setMode(null); }
    if (k === 'Enter') { stop(); if (!e.repeat) holdStart(); }
    return;
  }
  if (S.mode === 'editor') {
    if (k === 'Escape') { stop(); return $('#sm.on') ? $('#sm').classList.remove('on') : setMode(null); }
    if (ctrl && k === 'Enter') { stop(); return run(shift ? 'save-paste' : 'save'); }
    if (ctrl && (k === 's' || k === 'S')) { stop(); return run('save'); }
    return;
  }
  if (S.mode === 'menu') {
    stop();
    if (k === 'Escape') return setMode(null);
    if (k === 'ArrowDown' || (k === 'Tab' && !shift)) return menuMove(1);
    if (k === 'ArrowUp' || (k === 'Tab' && shift)) return menuMove(-1);
    if (k === 'Enter' || k === ' ') { const m = $$('#cx .mi')[cxSel]; return m && run(m.dataset.act, m); }
    return;
  }
  if (S.mode === 'preview') {   // handlePreviewKey
    if (k === 'Escape' || (ctrl && k === ' ')) { stop(); return setMode(null); }
    if (k === 'ArrowDown' || (k === 'Tab' && !shift) || (ctrl && /^[njNJ]$/.test(k))) { stop(); return move(1); }
    if (k === 'ArrowUp' || (k === 'Tab' && shift) || (ctrl && /^[pkPK]$/.test(k))) { stop(); return move(-1); }
    if (k === 'Enter') { stop(); setMode(null); return copy(shift); }
    return;
  }

  const inSearch = document.activeElement === $('#q');
  if (k === 'Escape') { stop(); if (S.q) { S.q = ''; $('#q').value = ''; S.sel = 0; S.scroll = 0; return renderAll(); } return closePanel(); }
  if (ctrl && k === 'Tab') { stop(); return setTab(S.tab === 'saved' ? 'recents' : 'saved'); }
  if (k === 'ArrowDown' || (k === 'Tab' && !shift) || (ctrl && /^[njNJ]$/.test(k))) { stop(); return move(1); }
  if (k === 'ArrowUp' || (k === 'Tab' && shift) || (ctrl && /^[pkPK]$/.test(k))) { stop(); return move(-1); }
  if (k === 'ArrowRight' && !inSearch) { stop(); return setFilter(['all', 'text', 'long_text', 'image'][(['all', 'text', 'long_text', 'image'].indexOf(S.filter) + 1) % 4]); }
  if (k === 'ArrowLeft' && !inSearch) { stop(); return setFilter(['all', 'text', 'long_text', 'image'][(['all', 'text', 'long_text', 'image'].indexOf(S.filter) + 3) % 4]); }
  if (k === 'Enter') { stop(); if (!S.kb && view().length) { S.kb = true; S.sel = 0; } return copy(shift); }
  if (ctrl && (k === 'c' || k === 'C') && !(inSearch && $('#q').selectionStart !== $('#q').selectionEnd)) { stop(); return copy(false, false); }
  if (ctrl && (k === 's' || k === 'S')) { stop(); return pin(); }
  if (ctrl && (k === 'e' || k === 'E')) { stop(); return run('edit'); }
  if (ctrl && k === ' ') { stop(); return run('preview'); }
  if (k === 'ContextMenu' || (shift && k === 'F10')) { stop(); return openMenu(S.sel); }
  if (k === 'Delete' && shift) { stop(); return run('clear'); }
  if (k === 'Delete' && (!inSearch || !S.q)) { stop(); return del(); }
}
addEventListener('keydown', onKey, true);
addEventListener('keyup', e => { if (e.key === 'Enter' && S.mode === 'confirm') holdEnd(); }, true);

// ------------------------------------------------------------ pointer (click only, no hover styles)
const qi = $('#q');
qi.value = S.q;
qi.addEventListener('input', () => { S.q = qi.value; S.sel = 0; S.scroll = 0; if (S.q) S.kb = true; renderAll(); });
$('#stage').addEventListener('click', e => {
  if (S.closed) { if (e.target.closest('#reo')) open(); return; }
  const a = e.target.closest('[data-act]');
  if (a && a.dataset.act !== 'hold') return run(a.dataset.act, a);
  if (S.mode === 'menu' && !e.target.closest('#cx')) return setMode(null);
  const t = e.target.closest('[data-tab]'); if (t) return setTab(t.dataset.tab);
  const f = e.target.closest('[data-f]'); if (f) { f.classList.add('press'); return setFilter(f.dataset.f); }
  const r = e.target.closest('.row');
  if (r) { const i = +r.dataset.i; if (S.kb && i === S.sel) return copy(false); S.kb = true; S.sel = i; placeCursor(); }
});
$('#stage').addEventListener('dblclick', e => { const r = e.target.closest('.row'); if (r) copy(false); });
$('#stage').addEventListener('contextmenu', e => {
  const r = e.target.closest('.row'); if (!r) return; e.preventDefault();
  const pb = $('.pn').getBoundingClientRect(), s = pb.width / 1460;
  openMenu(+r.dataset.i, (e.clientX - pb.left) / s, (e.clientY - pb.top) / s);
});
$('#stage').addEventListener('pointerdown', e => { if (e.target.closest('#hold')) { e.preventDefault(); holdStart(); } });
addEventListener('pointerup', holdEnd); addEventListener('pointercancel', holdEnd);
$('#ls').addEventListener('wheel', e => {
  e.preventDefault(); const n = view().length; if (!n) return;
  S.scroll = Math.max(0, Math.min(n * ROW - LIST_H, S.scroll + e.deltaY));
  $('#lsi').style.transform = `translateY(${-S.scroll}px)`;
  $('#tide').style.top = (S.sel * ROW - S.scroll) + 'px';
}, { passive: false });

// ------------------------------------------------------------ stage fit (same as menu.js fit(): cover 1920×1080)
const stage = $('#stage');
function fit() { stage.style.transform = `scale(${Math.max(innerWidth / 1920, innerHeight / 1080)})`; }
fit(); addEventListener('resize', fit);
if (STATIC) stage.classList.add('static');
if (S.hints) stage.classList.add('hints');
$$('[data-in]').forEach((el, i) => el.style.setProperty('--k', el.style.getPropertyValue('--k') || i));

fallback();
renderAll();
const m = Q.get('mode');
if (m === 'preview') setMode('preview');
else if (m === 'editor') { const i = view().findIndex(e => !e.isImage); if (!Q.has('sel') && i >= 0) { S.sel = i; } S.kb = true; placeCursor(true); setMode('editor'); }
else if (m === 'confirm') renderConfirm('clear');
else if (m === 'menu') { S.kb = true; openMenu(S.sel); }
else if (m === 'copied') { S.kb = true; placeCursor(true); copy(false, false); $(`.row[data-i="${S.sel}"]`)?.classList.add('copied'); }
else if (m === 'closed') closePanel();
if (!STATIC) { stage.classList.add('enter'); if (!m) qi.focus(); }
})();
