/* c-island · 剪切板灵动岛 activity。设计说明和 QML 文件映射见 c-island.html 顶部注释。
   状态：st = idle | toast | open（岛的形状）；mode = list | preview | editor | confirm（面板内容，对应 ClipboardContent 的 mode）。
   数据：ITEMS 是 ClipboardService.internalEntries 的假快照；view() = unpinnedEntries / pinnedEntries 按 searchText + activeFilter 过滤。
   动作：ACT.* 与 ClipboardService / ClipboardActions 同名（copyEntry、pasteEntry、pinEntry、unpinEntry、deleteEntry、deletePinnedEntry、clearAll、clearFiltered）。 */
(() => {
'use strict';
const Q = new URLSearchParams(location.search);
const STATIC = Q.get('static') === '1';
const W = Q.get('w') === '1706' ? 1706 : 2560, H = W === 1706 ? 1066 : 1600;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const later = (fn, ms) => STATIC ? fn() : setTimeout(fn, ms);
if (STATIC) document.body.classList.add('static');

const stage = $('#stage'), isl = $('#isl'), pin = $('#panel');

/* ---------------------------------------------------------------- 舞台缩放（同 island-b：contain） */
stage.style.width = W + 'px'; stage.style.height = H + 'px';
let scale = 1;
function fit() {
  scale = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
}
addEventListener('resize', fit); fit();

const half = (W - 36) / 2;
$('#wins').innerHTML = [
  { x: 12, w: half, t: 'kitty · ~/Projects/my-arch-kit' },
  { x: 24 + half, w: half, t: 'chromium · dms-p3' },
].map(o => `<div class="win" style="left:${o.x}px;top:54px;width:${o.w}px;height:${H - 66}px"><div class="tb l">${o.t}</div>
  ${[0, 1, 2, 3, 4].map(i => `<div class="ln" style="top:${52 + i * 22}px;width:${[38, 52, 24, 44, 30][i]}%"></div>`).join('')}</div>`).join('');

/* ---------------------------------------------------------------- 图标 */
const IC = {
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M15 3l6 6-2 1-3.5 3.5L16 18l-2 2-4-4-5 5-1-1 5-5-4-4 2-2 4.5.5L15 6z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path d="M8 3h11v13h-3v-2h1V5H10v1H8zM4 8h11v13H4z"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><path d="M9 2h6v3H9zM5 4h3v3h8V4h3v17H5z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M16 3l5 5-12 12H4v-5zM3 21h18v1H3z"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M12 5c5 0 9 4 10 7-1 3-5 7-10 7S3 15 2 12c1-3 5-7 10-7zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M9 2h6v2h5v2H4V4h5zM6 8h12l-1 14H7z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M14 5l2 2-5 5 5 5-2 2-7-7z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 4.6 12 10.6l6-6L19.4 6l-6 6 6 6-1.4 1.4-6-6-6 6L4.6 18l6-6-6-6z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-7 8z"/></svg>',
};

/* ---------------------------------------------------------------- 假数据（简报 C 节，id 倒序） */
const QML = `Rectangle {
    id: neck
    width: 42; height: 18
    color: Theme.isl
    Behavior on width {
        SpringAnimation { spring: 3.2; damping: 0.28 }
    }
    Behavior on y { NumberAnimation { duration: 260 } }
}`;
const ZH_LONG = `十月月报摘要
本月 dms-p3 完成了灵动岛 B 方案的气泡串原型，通知中心改为平涂深海蓝，去掉了全部卡片阴影。菜单页统一了 tide 焦点模型，斜排列表和按住确认在 POWER 页落地。
下月计划：把剪切板、启动器和设置三块界面迁到同一套 P3 规则下，先出静态原型，再逐个移植到 QML。风险是 SDF 着色器在低端核显上的帧率，需要准备 CSS 近似方案作为降级。
另外，niri 的 overview 动画和岛的展开曲线要对齐，避免两套弹簧在同一帧里打架。`;
const JSON_TX = `{
  "theme": "p3",
  "island": { "w": 1706, "state": 2, "neck": 12 },
  "menu": { "focus": "tide", "static": false },
  "accent": "#e3121b"
}`;
const ICO = n => `../shared/icons/${n}`;
let ITEMS = [
  { id: 214, mimeType: 'text/plain', preview: 'git commit -m "fix(island): 修复气泡颈子抖动"', t: '16:29', app: 'kitty', icon: ICO('kitty.png'), mono: 1 },
  { id: 213, mimeType: 'image/jpeg', isImage: 1, size: '336 KB', w: 1920, h: 1080, src: '../shared/desk.jpg', preview: '[[ binary data 336 KiB jpeg 1920x1080 ]]', t: '16:27', app: '截图' },
  { id: 212, mimeType: 'text/plain', preview: 'https://github.com/AvengeMedia/DankMaterialShell/releases/tag/v2.0.0', t: '16:24', app: 'chromium', icon: ICO('chromium.png'), mono: 1 },
  { id: 211, mimeType: 'text/plain', preview: '#0b8fe8', t: '16:21', app: 'typora', icon: ICO('typora.png'), mono: 1, swatch: '#0b8fe8' },
  { id: 210, mimeType: 'text/plain', preview: QML, pinned: 1, t: '16:17', app: 'kitty', icon: ICO('kitty.png'), mono: 1 },
  { id: 209, mimeType: 'text/plain', preview: '晚上七点在三楼会议室，记得带转接头', t: '16:09', app: 'QQ', icon: ICO('qq.png') },
  { id: 208, mimeType: 'text/plain', preview: 'ssh lyfmt@192.168.1.24 -p 2222', pinned: 1, day: 'YDAY', t: '21:14', app: 'termius', icon: ICO('termius.png'), mono: 1 },
  { id: 207, mimeType: 'image/png', isImage: 1, size: '1.3 MB', w: 2560, h: 1440, src: '../shared/miku-bg.png', preview: '[[ binary data 1.3 MiB png 2560x1440 ]]', t: '15:54', app: '浏览器',
    altMimeType: 'text/uri-list', altText: 'file:///home/lyfmt/Pictures/miku-bg.png' },
  { id: 206, mimeType: 'text/plain', preview: ZH_LONG, t: '15:29', app: '飞书', icon: ICO('feishu.png') },
  { id: 205, mimeType: 'text/plain', preview: 'Memento mori.', t: '15:20', app: 'chromium', icon: ICO('chromium.png') },
  { id: 204, mimeType: 'text/plain', preview: 'lyfmt@outlook.com', pinned: 1, day: '10/27', t: '09:02', app: '', mono: 1 },
  { id: 203, mimeType: 'text/plain', preview: 'paru -S quickshell-git dms-shell-git', t: '14:29', app: 'kitty', icon: ICO('kitty.png'), mono: 1 },
  { id: 202, mimeType: 'image/png', isImage: 1, size: '88 KB', w: 1280, h: 720, src: '../shared/shot-missing.png', preview: '[[ binary data 88 KiB png 1280x720 ]]', day: 'YDAY', t: '18:02', app: '截图' },
  { id: 201, mimeType: 'text/plain', preview: JSON_TX, day: 'YDAY', t: '10:40', app: 'typora', icon: ICO('typora.png'), mono: 1 },
];
ITEMS.forEach(e => { e.hash = 'h' + e.id; e.pinned = !!e.pinned; });
/* C 键模拟一次新复制（ClipboardService 收到 cliphist 新条目） */
const POOL = [
  { mimeType: 'text/plain', preview: 'dms ipc call clipboard toggle', app: 'kitty', icon: ICO('kitty.png'), mono: 1 },
  { mimeType: 'text/plain', preview: '明天上午十点前把 P3 剪切板原型发群里', app: '飞书', icon: ICO('feishu.png') },
  { mimeType: 'text/plain', preview: 'rgba(11,143,232,.85)', app: 'typora', icon: ICO('typora.png'), mono: 1, swatch: 'rgba(11,143,232,.85)' },
  { mimeType: 'image/jpeg', isImage: 1, size: '336 KB', w: 1920, h: 1080, src: '../shared/desk.jpg', preview: '[[ image ]]', app: '截图' },
];
let nextId = 215, poolI = 0, clockM = 29;

/* ---------------------------------------------------------------- 状态 */
const S = {
  st: 'open', mode: 'list', tab: 'recents', q: '', filter: 'all', sel: 0,
  offline: false, hints: false, ctx: null, cmI: 0, dd: false, ddI: 0,
  confirm: null, edit: null, prevMode: 'list',
};
const PASTE_OK = true;          // ClipboardService.pasteAvailable
const ENTER_TO_PASTE = false;   // SettingsData.clipboardEnterToPaste

const typeOf = e => e.isImage ? 'image' : e.preview.length > 200 ? 'long' : 'text';   // longTextThreshold 200
const FILTERS = [['all', 'All'], ['text', 'Text'], ['long', 'Long'], ['image', 'Image']];
const tabList = tab => ITEMS.filter(e => tab === 'saved' ? e.pinned : !e.pinned);
function view() {
  const q = S.q.trim().toLowerCase();
  return tabList(S.tab).filter(e => (S.filter === 'all' || typeOf(e) === S.filter) && (!q || e.preview.toLowerCase().includes(q)));
}
const filterActive = () => S.q.trim().length > 0 || S.filter !== 'all';
const cur = () => view()[S.sel] || null;

/* ---------------------------------------------------------------- 条目渲染（ClipboardEntry.qml / ClipboardThumbnail.qml） */
function lead(e, big) {
  const ty = typeOf(e);
  if (e.swatch) return `<span class="lead sw" style="background:${esc(e.swatch)}"></span>`;
  const img = e.isImage ? e.src : e.icon;
  const gl = `<span class="${big ? 'd' : 'l'} gl">${e.isImage ? 'IMG' : ty === 'long' ? 'TXT' : 'T'}</span>`;
  return `<span class="lead${e.isImage ? ' th' : ''}" style="position:relative">${gl}${img ? `<img src="${esc(img)}" alt="" style="position:absolute;inset:0" onerror="this.remove()">` : ''}</span>`;
}
function typeLabel(e) {
  const ty = typeOf(e);
  if (ty === 'image') return `Image <i>• ${e.w}×${e.h} ${esc(e.mimeType.split('/')[1])}</i>`;
  return ty === 'long' ? 'Long Text' : 'Text';
}
const isLatin = s => /^[\x20-\x7e]*$/.test(s);
function hl(text) {
  const q = S.q.trim();
  if (!q) return esc(text);
  const lo = text.toLowerCase(), ql = q.toLowerCase();
  let out = '', i = 0, j;
  while ((j = lo.indexOf(ql, i)) >= 0) { out += esc(text.slice(i, j)) + '<mark>' + esc(text.slice(j, j + q.length)) + '</mark>'; i = j + q.length; }
  return out + esc(text.slice(i));
}
function pvText(e) {
  const ty = typeOf(e);
  if (ty === 'image') return e.altText || `${e.size} · ${e.mimeType}`;   // 来源应用已在 r1，不重复
  const s = e.preview.slice(0, 100);     // 预览截断 100 字符
  return ty === 'long' ? s.replace(/\n{2,}/g, '\n') + '…' : s.replace(/\s+/g, ' ');
}
function timeHTML(e) { return `${e.day ? `<span class="l">${esc(e.day)}</span> ` : ''}<span class="d">${esc(e.t)}</span>`; }
function rowHTML(e, i) {
  const ty = typeOf(e);
  const pv = ty === 'image' ? esc(pvText(e)) : hl(pvText(e));
  const mono = e.mono && ty !== 'image' ? ' mono' : '';
  const acts = [
    ['copy', IC.copy, 'Copy', 'ENTER'],
    PASTE_OK && ['paste', IC.paste, 'Paste', 'SHIFT ENTER'],
    ['pin', IC.pin, e.pinned ? 'Unpin' : 'Pin', '^S'],
    !e.isImage && ['edit', IC.edit, 'Edit', '^E'],
    ['preview', IC.eye, 'Preview', '^SPACE'],
  ].filter(Boolean).map(([a, ic, t, k]) => `<button class="ca" data-a="${a}">${ic}<span class="l">${t}</span><kbd>${k}</kbd></button>`).join('');
  return `<div class="ck ${ty}" data-id="${e.id}" data-i="${i}" ${STATIC ? '' : `data-in style="--i:${Math.min(i, 8)}"`}>
    ${lead(e)}
    <span class="tx"><span class="r1"><span class="l ty">${typeLabel(e)}</span>
      ${e.app ? `<span class="${isLatin(e.app) ? 'l' : 'zh'} ap">${esc(e.app)}</span>` : ''}
      ${e.pinned ? IC.pin.replace('<svg', '<svg class="pm"') : ''}<span class="sp"></span><span class="t">${timeHTML(e)}</span></span>
      <span class="zh pv${mono}">${pv}</span></span>
    <span class="ex"><span class="exi"><span class="acts">${acts}<span class="sp"></span>
      <button class="ca dim" data-a="delete">${IC.del}<span class="l">Delete</span><kbd>DEL</kbd></button></span></span></span>
  </div>`;
}

/* ---------------------------------------------------------------- 面板（ClipboardHeader + ClipboardHistoryContent） */
function headHTML() {
  const nR = tabList('recents').length, nS = tabList('saved').length;
  if (S.mode === 'preview') {
    return `<div class="ch"><button class="cb" data-a="back">${IC.back}</button><span class="l tl" style="padding-top:2px;color:var(--tx)">Preview</span>
      <span class="sp"></span><button class="cb" data-a="close">${IC.x}</button></div>`;
  }
  if (S.mode === 'confirm') {
    return `<div class="ch"><button class="cb" data-a="back">${IC.back}</button><span class="l tl" style="padding-top:2px;color:var(--tx)">${S.confirm && S.confirm.kind === 'delpin' ? 'Saved' : S.tab === 'saved' ? 'Clipboard Saved' : 'Clipboard History'}</span>
      <span class="sp"></span><button class="cb" data-a="close">${IC.x}</button></div>`;
  }
  if (S.mode === 'editor') {
    return `<div class="ch"><button class="cb" data-a="back">${IC.back}</button><span class="l tl" style="padding-top:2px;color:var(--tx)">Edit Clipboard</span>
      <span class="sp"></span><button class="cb" data-a="close">${IC.x}</button></div>`;
  }
  const v = view(), all = tabList(S.tab).length;
  return `<div class="ch"><b class="d nn">${S.offline ? '–' : v.length}</b>
    <span class="l tl">${S.tab === 'saved' ? 'Clipboard Saved' : 'Clipboard History'}${filterActive() && !S.offline ? ` / ${all}` : ''}</span>
    <span class="sp"></span>
    <span class="tabs">
      <button class="cb${S.tab === 'recents' ? ' on' : ''}" data-a="tab" data-v="recents"><span class="l">Recents</span><span class="d">${nR}</span></button>
      <button class="cb${S.tab === 'saved' ? ' on' : ''}" data-a="tab" data-v="saved" ${nS ? '' : 'disabled'}>${IC.pin}<span class="l">Saved</span><span class="d">${nS}</span></button>
    </span><span class="vr"></span>
    <button class="cb" data-a="clear" ${S.offline || !nR ? 'disabled' : ''}><span class="l">Clear</span></button></div>`;
}
const HINTS = [['UP DOWN', 'Select'], ['ENTER', 'Copy'], ['SHIFT ENTER', 'Paste'], ['^S', 'Pin'], ['^E', 'Edit'], ['^SPACE', 'Preview'], ['DEL', 'Delete'], ['SHIFT DEL', 'Clear'],
  ['^TAB', 'Recents / Saved'], ['ALT 1–4', 'Type'], ['MENU', 'Actions'], ['ESC', 'Back / Close'], ['F10', 'Hints']];
function render() {
  pin.classList.toggle('hints', S.hints);
  let body = '';
  if (S.mode === 'list') {
    body = `<div class="cs">${IC.search}<input id="q" class="zh" placeholder="Search…" spellcheck="false" autocomplete="off" value="${esc(S.q)}">
      <span class="fl">${FILTERS.map(([k, t]) => `<button class="cb${S.filter === k ? ' on' : ''}" data-a="filter" data-v="${k}"><span class="l">${t}</span></button>`).join('')}</span></div>
      <div class="clw"><div class="cl" id="cl"></div></div>`;
  } else if (S.mode === 'preview') body = previewHTML();
  else if (S.mode === 'editor') body = editorHTML();
  else if (S.mode === 'confirm') body = confirmHTML();
  pin.innerHTML = headHTML() + body + `<div class="hint l">${HINTS.map(([k, t]) => `<span><b>${k}</b>${t}</span>`).join('')}</div><div class="cm" id="cm"></div>`;
  if (S.mode === 'list') renderList();
  if (S.mode === 'confirm') paintHold();
  bindImgs();
  shape();
}
function renderList() {
  const cl = $('#cl'); if (!cl) return;
  const v = view();
  if (S.offline) {
    cl.innerHTML = `<div class="ce"><span class="dots"><i></i><i></i><i></i></span><span class="l">Connecting to clipboard service...</span></div>`;
  } else if (!v.length) {
    const msg = S.tab === 'saved' ? 'No saved clipboard entries' : 'No recent clipboard entries found';
    cl.innerHTML = `<div class="ce"><span class="d">0</span><span class="l">${msg}</span></div>`;
  } else cl.innerHTML = v.map(rowHTML).join('');
  S.sel = Math.max(0, Math.min(S.sel, v.length - 1));
  paintSel(false);
  ovf();
  if (!STATIC) setTimeout(() => $$('[data-in]', cl).forEach(el => el.removeAttribute('data-in')), 800);
}
function bindImgs() { /* 缩略图缺失：<img onerror> 自己移除，露出底下的 IMG 占位字 */ }

/* 选中：只切 class，让行的展开和光点走 CSS 过渡；新获得焦点时 wob 一次 */
let lastSel = null;
function paintSel(wob = true) {
  const cl = $('#cl'); if (!cl) return;
  const rows = $$('.ck', cl);
  rows.forEach((r, i) => r.classList.toggle('sel', i === S.sel));
  const r = rows[S.sel];
  if (r && wob && !STATIC && r.dataset.id !== lastSel) {
    r.classList.remove('wob'); void r.offsetWidth; r.classList.add('wob');
    setTimeout(() => r.classList.remove('wob'), 360);
  }
  lastSel = r ? r.dataset.id : null;
  keep();
}
/* ListView.positionViewAtIndex 的等价：展开后的行高要等过渡结束才准，先按 168 估算 */
function keep() {
  const cl = $('#cl'), r = cl && $$('.ck', cl)[S.sel]; if (!r) return;
  const top = r.offsetTop, h = Math.max(r.offsetHeight, r.classList.contains('image') ? 140 : 120);
  if (top < cl.scrollTop) cl.scrollTop = top;
  else if (top + h + 40 > cl.scrollTop + cl.clientHeight) cl.scrollTop = top + h + 40 - cl.clientHeight;
  ovf();
}
function ovf() {
  const cl = $('#cl'); if (!cl) return;
  cl.classList.toggle('ovf', cl.scrollHeight > cl.clientHeight + 1);
  cl.classList.toggle('end', cl.scrollTop + cl.clientHeight >= cl.scrollHeight - 2);
}
document.addEventListener('scroll', e => { if (e.target.id === 'cl') ovf(); }, true);

/* ---------------------------------------------------------------- 预览 / 编辑器 / 确认 */
function previewHTML() {
  const e = cur(); if (!e) return '';
  const v = view(), ty = typeOf(e);
  const media = e.isImage
    ? `<div class="im"><span class="d gl">IMG</span><img src="${esc(e.src)}" alt="" style="position:absolute;inset:0" onerror="this.remove()"></div>`
    : e.swatch ? `<div class="im"><div class="sw-big" style="background:${esc(e.swatch)}"></div></div>`
    : `<div class="txt zh${e.mono ? ' mono' : ''}">${esc(e.preview)}</div>`;
  const meta = e.isImage ? e.size : `${e.preview.length} chars`;   // 尺寸 / 格式已在 typeLabel
  return `<div class="pvw swap" ${STATIC ? '' : ''}>${media}<div class="cap"><span class="l ty">${typeLabel(e)}</span><span class="l m">${esc(meta)}${e.app ? ' · ' : ''}</span>${e.app ? `<span class="${isLatin(e.app) ? 'l' : 'zh'} m">${esc(e.app)}</span>` : ''}
    <span class="sp"></span><span class="d ix">${S.sel + 1}<small> / ${v.length}</small></span></div></div>`;
}
function editorHTML() {
  const E = S.edit; if (!E) return '';
  const ddItems = [['save', 'Save', '^S'], ['saveClose', 'Save and close', '^ENTER'], ['savePaste', 'Save and paste', '']];
  const area = E.state === 'loading' ? `<div class="ld l">Loading full text, please wait...</div>`
    : E.state === 'error' ? `<div class="ld l err">Failed to load clipboard entry</div>`
    : `<textarea id="ta" class="zh${E.mono ? ' mono' : ''}" placeholder="Edit clipboard text" spellcheck="false">${esc(E.text)}</textarea>`;
  return `<div class="ed">${area}<div class="ft2"><span class="l m" id="ecount">${E.state === 'ready' ? E.text.length + ' chars' : ''}</span><span class="sp"></span>
    <button class="cb" data-a="back"><span class="l">Cancel</span></button>
    <span class="split"><button class="cb on" data-a="save" ${E.state === 'ready' ? '' : 'disabled'}><span class="l">Save</span></button><button class="cb on" data-a="dd" ${E.state === 'ready' ? '' : 'disabled'}>${IC.down}</button>
      <div class="dd${S.dd ? ' on' : ''}" id="dd">${ddItems.map(([a, t, k], i) => `<div class="mi${S.dd && S.ddI === i ? ' f' : ''}" data-a="${a}"><span class="l">${t}</span><kbd>${k}</kbd></div>`).join('')}</div></span></div></div>`;
}
function confirmHTML() {
  const C = S.confirm;
  let n, title, ds, act;
  if (C.kind === 'delpin') {
    n = 1; title = 'Delete saved entry?'; act = 'Delete';
    ds = '这条已置顶的内容会被永久删除。';
  } else {
    const pinned = tabList('saved').length;
    n = C.ids.length; title = 'Clear History?'; act = 'Clear All';
    ds = filterActive() ? `只删除当前搜索 / 筛选匹配的 ${n} 条未置顶记录。`
      : pinned ? `将删除所有未置顶条目，${pinned} 条置顶会保留。` : '将永久删除全部剪切板历史。';
  }
  return `<div class="cf2 swap"><div class="big"><span class="d">${n}</span><span class="l">${n === 1 ? 'Entry' : 'Entries'}</span></div>
    <div class="l q">${title}</div><div class="zh ds">${ds}</div>
    <div class="row"><button class="cb" data-a="back"><span class="l">Cancel</span></button><span class="sp"></span>
      <button class="hold" id="hold" data-a="hold"><span class="l">Hold · ${act}</span><span class="l k" id="holdk">ENTER · 1.0s</span></button></div></div>`;
}

/* 按住 1s（POWER 同款）：按住时 --p 匀速涨满，松手按阻尼弹簧回落 */
let hp = Q.has('hold') ? +Q.get('hold') : 0, hv = 0, holding = false, hraf = 0, hlast = 0;
function paintHold() {
  const b = $('#hold'); if (!b) return;
  b.style.setProperty('--p', hp.toFixed(3));
  b.classList.toggle('full', hp > .5);
  const k = $('#holdk'); if (k) k.textContent = holding || hp > 0 ? (1 - hp).toFixed(1) + 's' : 'ENTER · 1.0s';
}
function holdTick(t) {
  const dt = Math.min(50, t - (hlast || t)) / 1000; hlast = t;
  if (holding) { hp = Math.min(1, hp + dt); hv = 0; }
  else { const k = 260, c = 22; hv += (-k * hp - c * hv) * dt; hp += hv * dt; if (hp < 0.002 && Math.abs(hv) < .02) hp = 0; }
  paintHold();
  if (hp >= 1) { holding = false; hraf = 0; hlast = 0; return doConfirm(); }
  if (holding || hp > 0) hraf = requestAnimationFrame(holdTick); else { hraf = 0; hlast = 0; }
}
function holdStart() { if (holding) return; holding = true; if (!hraf) hraf = requestAnimationFrame(holdTick); }
function holdEnd() { if (!holding) return; holding = false; if (!hraf) hraf = requestAnimationFrame(holdTick); }

/* ---------------------------------------------------------------- 岛形状 */
const IW = 680, IH = 1200, TOP = 8;
let fitT = 0;
function shape() {
  let w, h, r;
  if (S.st === 'idle') { w = 100; h = 34; r = 17; }
  else if (S.st === 'toast') { w = 460; h = 44; r = 22; }
  else { w = 600; h = Math.min(IH - TOP - 4, pin.offsetHeight); r = 22; }
  const sx = (IW - w) / 2;
  isl.style.clipPath = `inset(${TOP}px ${sx}px ${IH - TOP - h}px ${sx}px round ${r}px)`;
}
/* 面板内容高度变化（行展开、模式切换）：短过渡跟随，不重放开面板的弹簧 */
new ResizeObserver(() => {
  if (S.st !== 'open') return;
  isl.style.transition = STATIC ? 'none' : 'clip-path .22s var(--ease)';
  shape();
  clearTimeout(fitT); fitT = setTimeout(() => { isl.style.transition = ''; }, 260);
}).observe(pin);

let toastT = 0;
function setState(st, fromKey) {
  if (st === S.st && st !== 'toast') return;
  const prev = S.st; S.st = st; isl.dataset.s = st;
  clearTimeout(toastT); clearTimeout(fitT); isl.style.transition = STATIC ? 'none' : '';
  isl.classList.toggle('closing', prev === 'open' && st !== 'open');
  $$('.face', isl).forEach(f => {
    const on = f.dataset.f === st;
    f.style.setProperty('--fd', st === 'open' ? '90ms' : '60ms');
    if (on && st === 'toast') { f.classList.remove('on'); void f.offsetWidth; }
    f.classList.toggle('on', on);
  });
  if (st === 'open') {
    S.mode = Q.get('mode') && !opened ? S.mode : 'list'; S.ctx = null; S.dd = false;
    if (!opened) opened = true; else { S.sel = 0; S.q = ''; S.filter = 'all'; }
    render();
    setTimeout(() => { const q = $('#q'); if (q && !STATIC) q.focus({ preventScroll: true }); }, 30);
  } else { shape(); document.activeElement && document.activeElement.blur(); }
  if (st === 'toast' && !STATIC) toastT = setTimeout(() => setState('idle'), 2000);
  dock();
}
let opened = false;

/* toast：刚复制 / 粘贴 / 保存的那条 */
function toast(e, verb = 'Copied', text) {
  const ty = typeOf(e);
  const pv = text || (e.isImage ? `${e.w}×${e.h} ${e.mimeType.split('/')[1]}` : e.preview.replace(/\s+/g, ' ').slice(0, 60));
  const mono = (e.mono || text) && !e.isImage ? ' mono' : '';
  const ld = e.swatch ? `<span class="lead sw" style="background:${esc(e.swatch)}"></span>`
    : e.isImage ? `<span class="lead" style="position:relative"><span class="l gl" style="font-size:9px;color:var(--dim)">IMG</span><img src="${esc(e.src)}" alt="" style="position:absolute;inset:0" onerror="this.remove()"></span>`
    : `<span class="lead">${IC.copy}</span>`;
  $('.ft', isl).innerHTML = `<i class="rip"></i>${ld}<span class="l lb">${verb}</span>
    <span class="${e.isImage ? 'l' : 'zh'} pv${mono}">${esc(pv)}</span>
    <span class="n"><b class="d">${tabList('recents').length + tabList('saved').length}</b><i class="l">Items</i></span>`;
  setState('toast');
}

/* ---------------------------------------------------------------- 动作（ClipboardService / ClipboardActions） */
const ACT = {
  copy(e, textOnly) {
    if (!e) return;
    stamp(e, textOnly ? 'Text copied' : 'Copied');
    // cliphist：复制一条旧记录 = 它成为最新一条
    if (!e.pinned) { ITEMS = [e, ...ITEMS.filter(x => x !== e)]; e.day = ''; e.t = nowT(); }
    later(() => toast(e, 'Copied', textOnly ? e.altText : ''), 340);
  },
  paste(e) { if (!e || !PASTE_OK) return; stamp(e, 'Paste'); later(() => toast(e, 'Pasted'), 340); },
  pin(e) {
    if (!e) return;
    if (e.pinned) return ACT.unpin(e);
    const dup = ITEMS.find(x => x.pinned && x.hash === e.hash && x !== e);   // 已有同 hash 的置顶 → 对它取消置顶
    if (dup) return ACT.unpin(dup);
    leave(e, () => { e.pinned = true; });
  },
  unpin(e) { leave(e, () => { e.pinned = false; if (!tabList('saved').length) S.tab = 'recents'; }); },
  delete(e) {
    if (!e) return;
    if (e.pinned) { S.confirm = { kind: 'delpin', ids: [e.id] }; return mode('confirm'); }
    leave(e, () => { ITEMS = ITEMS.filter(x => x !== e); });
  },
  clear() {
    const ids = (filterActive() ? view().filter(e => !e.pinned) : tabList('recents')).map(e => e.id);
    if (S.tab === 'saved' && filterActive()) ids.length = 0;
    if (!ids.length) return shake();
    S.confirm = { kind: 'clear', ids }; mode('confirm');
  },
};
function nowT() { clockM++; const h = 16 + Math.floor(clockM / 60); return `${h}:${String(clockM % 60).padStart(2, '0')}`; }
function rowEl(e) { return $(`.ck[data-id="${e.id}"]`, pin); }
function stamp(e, t) {
  const r = rowEl(e); if (!r) return;
  r.insertAdjacentHTML('beforeend', `<span class="stamp l">${t}</span>`);
}
/* 行离开列表（删除 / 置顶 / 取消置顶）：先滑走，再改数据重排；选中停在原位置 */
function leave(e, apply) {
  const r = rowEl(e);
  const go = () => { apply(); if (S.mode === 'list') { const h = pin.querySelector('.ch'); render(); rollCount(); } };
  if (!r || STATIC) return go();
  r.classList.remove('sel'); r.classList.add('gone'); setTimeout(go, 280);
}
function rollCount() { const n = $('.ch .nn', pin); if (n && !STATIC) n.classList.add('roll'); }
function shake() { const b = $('[data-a="clear"]', pin); if (b && !STATIC) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } }
function doConfirm() {
  const C = S.confirm; if (!C) return;
  const ids = new Set(C.ids);
  S.confirm = null; hp = 0;
  mode('list');
  const rows = $$('.ck', pin).filter(r => ids.has(+r.dataset.id));
  const apply = () => { ITEMS = ITEMS.filter(x => !ids.has(x.id)); if (!tabList('saved').length) S.tab = 'recents'; S.sel = 0; render(); rollCount(); };
  if (STATIC || !rows.length) return apply();
  rows.forEach((r, i) => { r.style.setProperty('--dl', Math.min(i, 8) * 35 + 'ms'); r.classList.add('fly'); });
  setTimeout(apply, 340 + Math.min(rows.length, 8) * 35);
}
function mode(m) {
  if (m === 'editor') {
    const e = cur(); if (!e || e.isImage) return;
    const fail = Q.get('fail') === '1';
    S.edit = { id: e.id, text: e.preview, state: 'loading', mono: !!e.mono };
    later(() => { if (S.edit && S.edit.id === e.id) { S.edit.state = fail ? 'error' : 'ready'; if (S.mode === 'editor') { render(); const ta = $('#ta'); if (ta) ta.focus(); } } }, 420);
  }
  if (m === 'preview' && !cur()) return;
  S.mode = m; S.dd = false; S.ctx = null;
  render();
  if (m === 'list') setTimeout(() => { const q = $('#q'); if (q) q.focus({ preventScroll: true }); }, 10);
  else document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.blur();
}
function save(how) {
  const E = S.edit, ta = $('#ta'); if (!E || !ta) return;
  const e = ITEMS.find(x => x.id === E.id); if (!e) return;
  e.preview = ta.value; E.text = ta.value; S.dd = false;
  if (how === 'save') { render(); const t = $('#ta'); if (t) t.focus(); const c = $('#ecount'); if (c) c.textContent = 'Saved · ' + e.preview.length + ' chars'; return; }
  S.mode = 'list';
  toast(e, how === 'savePaste' ? 'Pasted' : 'Saved');
}

/* ---------------------------------------------------------------- 右键菜单（ClipboardContextMenu.qml） */
function ctxItems(e) {
  return [
    ['copy', 'Copy', 'ENTER'],
    e.altMimeType && ['copyText', 'Copy Text', ''],
    ['pin', e.pinned ? 'Unpin' : 'Pin', '^S'],
    !e.isImage && ['edit', 'Edit', '^E'],
    PASTE_OK && ['paste', 'Paste', 'SHIFT ENTER'],
    ['delete', 'Delete', 'DEL'],
  ].filter(Boolean);
}
function openCtx(x, y) {
  const e = cur(); if (!e) return;
  const cm = $('#cm'); if (!cm) return;
  const its = ctxItems(e);
  S.ctx = { id: e.id, its }; S.cmI = 0;
  const pr = pin.getBoundingClientRect();
  let lx = (x - pr.left) / scale, ly = (y - pr.top) / scale;
  lx = Math.max(8, Math.min(lx, 600 - 218)); ly = Math.max(60, Math.min(ly, pin.offsetHeight - its.length * 34 - 30));
  cm.style.left = lx + 'px'; cm.style.top = ly + 'px';
  paintCtx(); cm.classList.add('on');
}
function paintCtx() {
  const cm = $('#cm'); if (!cm || !S.ctx) return;
  cm.innerHTML = S.ctx.its.map(([a, t, k], i) => `${a === 'delete' ? '<div class="rule"></div>' : ''}<div class="mi${i === S.cmI ? ' f' : ''}" data-a="${a}"><span class="l">${t}</span><kbd>${k}</kbd></div>`).join('');
}
function closeCtx() { S.ctx = null; const cm = $('#cm'); if (cm) cm.classList.remove('on'); }
function runAct(a) {
  const e = cur();
  closeCtx();
  if (a === 'copy') ACT.copy(e);
  else if (a === 'copyText') ACT.copy(e, true);
  else if (a === 'paste') ACT.paste(e);
  else if (a === 'pin') ACT.pin(e);
  else if (a === 'edit') { if (e && !e.isImage) mode('editor'); }
  else if (a === 'preview') mode('preview');
  else if (a === 'delete') ACT.delete(e);
}

/* ---------------------------------------------------------------- 导航 */
function move(d) {
  const n = view().length; if (!n) return;
  S.sel = Math.max(0, Math.min(n - 1, S.sel + d));
  if (S.mode === 'preview') render(); else paintSel(true);
}
function switchTab(t) {
  t = t || (S.tab === 'recents' ? 'saved' : 'recents');
  if (t === 'saved' && !tabList('saved').length) t = 'recents';     // saved 为空自动退回 recents
  if (t === S.tab) return;
  S.tab = t; S.sel = 0; lastSel = null; render();
  const q = $('#q'); if (q) q.focus({ preventScroll: true });
}
function setFilter(f) { S.filter = f; S.sel = 0; lastSel = null; render(); const q = $('#q'); if (q) q.focus({ preventScroll: true }); }

/* ClipboardKeyboardController.handleKey / handlePreviewKey */
document.addEventListener('keydown', ev => {
  const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey, shift = ev.shiftKey, alt = ev.altKey;
  const inInput = ev.target && ev.target.id === 'q', inTa = ev.target && ev.target.id === 'ta';
  const stop = () => { ev.preventDefault(); ev.stopPropagation(); };

  if (S.st !== 'open') {
    if (k === 'v' || k === 'V' || (k === 'Enter' && S.st === 'toast')) { stop(); setState('open'); }
    else if (k === 'c' || k === 'C') { stop(); newCopy(); }
    return;
  }
  if (k === 'F10') { stop(); S.hints = !S.hints; pin.classList.toggle('hints', S.hints); return; }

  if (S.ctx) {
    stop();
    if (k === 'ArrowDown' || (k === 'Tab' && !shift)) { S.cmI = (S.cmI + 1) % S.ctx.its.length; paintCtx(); }
    else if (k === 'ArrowUp' || (k === 'Tab' && shift)) { S.cmI = (S.cmI - 1 + S.ctx.its.length) % S.ctx.its.length; paintCtx(); }
    else if (k === 'Enter') runAct(S.ctx.its[S.cmI][0]);
    else if (k === 'Escape' || k === 'ContextMenu') closeCtx();
    return;
  }

  if (S.mode === 'confirm') {
    if (k === 'Escape') { stop(); holding = false; hp = 0; S.confirm = null; mode('list'); }
    else if (k === 'Enter' || k === ' ') { stop(); if (!ev.repeat) holdStart(); }
    return;
  }

  if (S.mode === 'editor') {
    if (S.dd) {
      const n = 3;
      if (k === 'ArrowDown') { stop(); S.ddI = (S.ddI + 1) % n; render(); }
      else if (k === 'ArrowUp') { stop(); S.ddI = (S.ddI + n - 1) % n; render(); }
      else if (k === 'Enter') { stop(); save(['save', 'saveClose', 'savePaste'][S.ddI]); }
      else if (k === 'Escape') { stop(); S.dd = false; render(); }
      return;
    }
    if (k === 'Escape') { stop(); mode('list'); }
    else if (ctrl && (k === 's' || k === 'S')) { stop(); save('save'); }
    else if (ctrl && k === 'Enter') { stop(); save('saveClose'); }
    return;
  }

  if (S.mode === 'preview') {
    stop();
    if (k === 'Escape' || (ctrl && k === ' ')) mode('list');
    else if (k === 'ArrowDown' || (k === 'Tab' && !shift) || (ctrl && /^[njNJ]$/.test(k))) move(1);
    else if (k === 'ArrowUp' || (k === 'Tab' && shift) || (ctrl && /^[pkPK]$/.test(k))) move(-1);
    else if (k === 'Enter') { const p = shift ? !ENTER_TO_PASTE : ENTER_TO_PASTE; mode('list'); p ? ACT.paste(cur()) : ACT.copy(cur()); }
    return;
  }

  // list
  if (k === 'Escape') { stop(); if (S.q) { S.q = ''; S.sel = 0; lastSel = null; render(); $('#q') && $('#q').focus(); } else setState('idle'); return; }
  if (ctrl && k === 'Tab') { stop(); switchTab(); return; }
  if (k === 'ArrowDown' || (k === 'Tab' && !shift) || (ctrl && /^[njNJ]$/.test(k))) { stop(); move(1); return; }
  if (k === 'ArrowUp' || (k === 'Tab' && shift) || (ctrl && /^[pkPK]$/.test(k))) { stop(); move(-1); return; }
  if (k === 'Enter') { stop(); const p = shift ? !ENTER_TO_PASTE : ENTER_TO_PASTE; p ? ACT.paste(cur()) : ACT.copy(cur()); return; }
  if (ctrl && (k === 'c' || k === 'C')) {
    const q = $('#q'); if (q && q.selectionStart !== q.selectionEnd) return;
    stop(); ACT.copy(cur()); return;
  }
  if (ctrl && (k === 's' || k === 'S')) { stop(); ACT.pin(cur()); return; }
  if (ctrl && (k === 'e' || k === 'E')) { stop(); runAct('edit'); return; }
  if (ctrl && k === ' ') { stop(); mode('preview'); return; }
  if (alt && /^[1-4]$/.test(k)) { stop(); setFilter(FILTERS[+k - 1][0]); return; }
  if (k === 'Delete') {
    if (shift) { stop(); ACT.clear(); return; }
    const q = $('#q'); if (inInput && q.selectionStart < q.value.length) return;   // 光标后还有字：让输入框删字
    stop(); ACT.delete(cur()); return;
  }
  if (k === 'ContextMenu' || (shift && k === 'F10')) {
    stop(); const r = $$('.ck', pin)[S.sel]; if (!r) return;
    const b = r.getBoundingClientRect(); openCtx(b.left + 60 * scale, b.top + 40 * scale); return;
  }
}, true);
document.addEventListener('keyup', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && S.mode === 'confirm') holdEnd(); });

document.addEventListener('input', ev => {
  if (ev.target.id === 'q') { S.q = ev.target.value; S.sel = 0; lastSel = null; const v = $('.ch', pin); pin.querySelector('.ch').outerHTML = headHTML(); renderList(); }
  if (ev.target.id === 'ta') { const c = $('#ecount'); if (c) c.textContent = ev.target.value.length + ' chars'; }
});

/* ---------------------------------------------------------------- 点击（全部操作都能用指针完成） */
function press(el) { if (STATIC || !el) return; el.classList.remove('p-press'); void el.offsetWidth; el.classList.add('p-press'); }
pin.addEventListener('click', ev => {
  const b = ev.target.closest('[data-a]');
  const row = ev.target.closest('.ck');
  if (S.ctx && !ev.target.closest('#cm')) { closeCtx(); if (!b) return; }
  if (S.dd && !ev.target.closest('.split')) { S.dd = false; render(); return; }
  if (b) {
    press(b);
    const a = b.dataset.a;
    if (row) { S.sel = +row.dataset.i; paintSel(false); }
    if (a === 'tab') return switchTab(b.dataset.v);
    if (a === 'filter') return setFilter(b.dataset.v);
    if (a === 'clear') return ACT.clear();
    if (a === 'close') return setState('idle');
    if (a === 'back') { if (S.mode === 'confirm') { S.confirm = null; hp = 0; } return mode('list'); }
    if (a === 'hold') return;
    if (a === 'dd') { S.dd = !S.dd; S.ddI = 0; return render(); }
    if (a === 'save' || a === 'saveClose' || a === 'savePaste') return save(a);
    return runAct(a);
  }
  if (row) {
    const i = +row.dataset.i;
    if (i === S.sel) ACT.copy(cur());      // 第二次点 = 复制（ClipboardEntry onClicked → copyEntry）
    else { S.sel = i; paintSel(true); }
    const q = $('#q'); if (q) q.focus({ preventScroll: true });
  }
});
pin.addEventListener('contextmenu', ev => {
  const row = ev.target.closest('.ck'); ev.preventDefault();
  if (!row || S.mode !== 'list') return;
  S.sel = +row.dataset.i; paintSel(false); openCtx(ev.clientX, ev.clientY);
});
pin.addEventListener('pointerdown', ev => { if (ev.target.closest('#hold')) { ev.preventDefault(); holdStart(); } });
addEventListener('pointerup', holdEnd); addEventListener('pointercancel', holdEnd);
/* 岛外点击 = 关闭；点胶囊 = 打开 */
stage.addEventListener('click', ev => {
  if (ev.target.closest('#isl')) { if (S.st !== 'open') setState('open'); return; }
  if (S.st === 'open') setState('idle');
});

/* C：模拟一次新复制 */
function newCopy() {
  const p = POOL[poolI++ % POOL.length];
  const e = { ...p, id: nextId++, t: nowT(), pinned: false };
  e.hash = 'h' + e.id;
  ITEMS = [e, ...ITEMS];
  if (S.st === 'open') { render(); rollCount(); } else toast(e);
}

/* ---------------------------------------------------------------- 调试坞 */
const dockEl = $('#dock');
function dock() {
  const B = [['idle', '1', 'Idle'], ['toast', '2', 'Toast'], ['open', 'V', 'Open']];
  dockEl.innerHTML = B.map(([s, kb, t]) => `<button data-s="${s}" class="${S.st === s ? 'on' : ''}"><kbd>${kb}</kbd>${t}</button>`).join('')
    + `<span class="sep"></span><button data-x="copy"><kbd>C</kbd>New copy</button><button data-x="off" class="${S.offline ? 'on' : ''}">Offline</button><button data-x="hint" class="${S.hints ? 'on' : ''}"><kbd>F10</kbd>Hints</button>`;
}
dockEl.addEventListener('click', ev => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.s === 'toast') toast(ITEMS[0]);
  else if (b.dataset.s) setState(b.dataset.s);
  else if (b.dataset.x === 'copy') newCopy();
  else if (b.dataset.x === 'off') { S.offline = !S.offline; if (S.st === 'open') render(); dock(); }
  else if (b.dataset.x === 'hint') { S.hints = !S.hints; pin.classList.toggle('hints', S.hints); dock(); }
});
document.addEventListener('keydown', ev => {
  if (S.st === 'open' || ev.ctrlKey || ev.altKey) return;
  if (ev.key === '1') setState('idle');
  else if (ev.key === '2') toast(ITEMS[0]);
});

/* ---------------------------------------------------------------- URL 初始状态 */
if (Q.get('tab') === 'saved') S.tab = 'saved';
if (Q.has('q')) S.q = Q.get('q');
if (Q.has('filter')) { const f = Q.get('filter'); S.filter = f === 'long_text' ? 'long' : FILTERS.some(x => x[0] === f) ? f : 'all'; }
if (Q.has('sel')) S.sel = Math.max(0, +Q.get('sel') || 0);
const M = Q.get('mode');
if (M === 'empty') ITEMS = [];
if (M === 'offline') S.offline = true;
if (Q.get('hints') === '1') S.hints = true;
if (!tabList('saved').length) S.tab = 'recents';
const st0 = ['idle', 'toast', 'open'].includes(Q.get('state')) ? Q.get('state') : 'open';
isl.style.transition = 'none';
S.st = '';
if (st0 === 'toast') toast(ITEMS[0] || POOL[0]);
else setState(st0);
if (st0 === 'open' && M) {
  if (M === 'preview') mode('preview');
  else if (M === 'editor') { if (cur() && cur().isImage) S.sel = view().findIndex(e => !e.isImage); mode('editor'); }
  else if (M === 'confirm') {
    if (Q.get('kind') === 'delpin') { S.tab = 'saved'; S.confirm = { kind: 'delpin', ids: [tabList('saved')[0].id] }; mode('confirm'); }
    else ACT.clear();
  }
}
if (Q.get('ctx') === '1' && S.st === 'open' && S.mode === 'list') {
  const r = $$('.ck', pin)[S.sel]; if (r) { const b = r.getBoundingClientRect(); openCtx(b.left + 120 * scale, b.top + 46 * scale); }
}
requestAnimationFrame(() => requestAnimationFrame(() => { if (!STATIC) isl.style.transition = ''; }));
})();
