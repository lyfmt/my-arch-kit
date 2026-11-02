(() => {
const Q = new URLSearchParams(location.search);
const STATIC = Q.has("static");
const root = document.documentElement;
if (STATIC) root.classList.add("static");
if (Q.get("theme") === "lavender") root.dataset.theme = "lavender";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const wait = (ms) => STATIC ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

const ICON = { feishu: "icons/feishu.png", magpie: "icons/magpie.png", fcitx5: "icons/fcitx5.svg", sunshine: "icons/sunshine.svg",
  clash: "icons/clash-verge.png", chromium: "icons/chromium.png", netease: "icons/netease.svg", kitty: "icons/kitty.png", qq: "icons/qq.png" };
const ico = (k, cls = "ic", letter) => ICON[k] ? `<img class="${cls}" src="${ICON[k]}" alt="">` : `<span class="${cls} lt">${esc(letter || "?")}</span>`;

const SVG = {
  back: '<svg viewBox="0 0 14 14"><path d="M9 0l2 2-5 5 5 5-2 2L2 7z"/></svg>',
  chev: '<svg viewBox="0 0 7 10"><path d="M0 0h2l5 5-5 5H0l5-5z"/></svg>',
  x: '<svg viewBox="0 0 10 10"><path d="M1.4 0L5 3.6 8.6 0 10 1.4 6.4 5 10 8.6 8.6 10 5 6.4 1.4 10 0 8.6 3.6 5 0 1.4z"/></svg>',
  prev: '<svg viewBox="0 0 16 16"><path d="M2 2h2v12H2zM15 2v12L5 8z"/></svg>',
  next: '<svg viewBox="0 0 16 16"><path d="M12 2h2v12h-2zM1 2v12l10-6z"/></svg>',
  play: '<svg viewBox="0 0 16 16"><path d="M3 1v14l12-7z"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M3 1h4v14H3zM9 1h4v14H9z"/></svg>',
  clip: '<svg viewBox="0 0 14 14"><path d="M3 1h8v2H3zM1 3h2v10h10V3h-2V1h2l1 1v12H0V2l1-1zM4 6h6v1.5H4zM4 9h6v1.5H4z"/></svg>',
  gear: '<svg viewBox="0 0 14 14"><path d="M6 0h2l.4 2 1.3.6 1.7-1.2 1.4 1.4-1.2 1.7.6 1.3 2 .4v2l-2 .4-.6 1.3 1.2 1.7-1.4 1.4-1.7-1.2-1.3.6L8 14H6l-.4-2-1.3-.6-1.7 1.2-1.4-1.4 1.2-1.7L1.8 8.4 0 8V6l2-.4.6-1.3-1.2-1.7 1.4-1.4 1.7 1.2 1.3-.6zM7 4.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/></svg>',
  lock: '<svg viewBox="0 0 14 14"><path d="M3 6V4a4 4 0 018 0v2h1v8H2V6zm2 0h4V4a2 2 0 00-4 0z"/></svg>',
  power: '<svg viewBox="0 0 14 14"><path d="M6 0h2v7H6zM3.2 2.4l1.3 1.5A4 4 0 107 12 4 4 0 009.5 3.9l1.3-1.5A6 6 0 117 14a6 6 0 01-3.8-11.6z"/></svg>',
};
const wifiSvg = (lvl, off) => [0,1,2,3].map(i => `<path ${off || i >= lvl ? 'opacity=".3"' : ""} d="M${i*4} ${11 - i*3.4}h3v${3 + i*3.4}h-3z"/>`).join("");
const volSvg = (v, mute) => '<path d="M0 4h3l4-4v14L3 10H0z"/>' + (mute
  ? '<path class="mx" d="M9 4.4L10.4 3l1.8 1.8L14 3l1.4 1.4-1.8 1.8L15.4 8 14 9.4l-1.8-1.8-1.8 1.8L9 8l1.8-1.8z" transform="translate(-1 0.8)"/>'
  : [0,1,2].map(i => `<path ${v <= i*34 ? 'opacity=".3"' : ""} d="M${9 + i*2.2} ${5 - i*2}h1.6v${4 + i*4}h-1.6z"/>`).join(""));
const sunSvg = '<path d="M8 4a3 3 0 110 6 3 3 0 010-6zM7 0h2v2.5H7zM7 11.5h2V14H7zM0 6h2.5v2H0zM13.5 6H16v2h-2.5zM2 1.3l1.4-1 1.5 2-1.4 1zM11.1 10.7l1.4-1 1.5 2-1.4 1zM12.6 0.3l1.4 1-1.5 2-1.4-1zM3.5 10.7l1.4 1-1.5 2-1.4-1z"/>';

const S = {
  ws: 1, wsCount: 5,
  focus: { 1: 1, 2: 3, 3: 4, 4: 6, 5: null },
  wins: [
    { id: 1, app: "Chromium", key: "chromium", appId: "chromium", title: "lyfmt/my-arch-kit · GitHub", pid: 41822, out: "DP-1", ws: 1, mode: "TILED", size: "1270×1392" },
    { id: 2, app: "kitty", key: "kitty", appId: "kitty", title: "nvim ~/Projects/my-arch-kit/dms/bar", pid: 38107, out: "DP-1", ws: 1, mode: "TILED", size: "1270×1392" },
    { id: 3, app: "飞书", key: "feishu", appId: "bytedance-feishu", title: "消息 · 设计评审群", pid: 2291, out: "DP-1", ws: 2, mode: "TILED", size: "2540×1392" },
    { id: 4, app: "Buffin", key: "buffin", appId: "buffin-desktop", title: "buffin-desktop · Buffin", pid: 51740, out: "DP-1", ws: 3, mode: "TILED", size: "1690×1392" },
    { id: 5, app: "网易云音乐", key: "netease", appId: "netease-cloud-music-gtk", title: "Mass Destruction -Reload-", pid: 9934, out: "DP-1", ws: 3, mode: "FLOAT", size: "960×640" },
    { id: 6, app: "QQ", key: "qq", appId: "qq", title: "QQ · 群聊 (3)", pid: 12873, out: "DP-1", ws: 4, mode: "TILED", size: "1270×1392" },
    { id: 7, app: "Magpie", key: "magpie", appId: "magpie", title: "Magpie · 缩放", pid: 7710, out: "HDMI-A-1", ws: 1, mode: "TILED", size: "1904×1032" },
    { id: 8, app: "Termius", key: "termius", appId: "termius-app", title: "buffin-prod · ssh", pid: 66012, out: "HDMI-A-1", ws: 1, mode: "TILED", size: "1904×1032" },
  ],
  winSel: null, winOpen: null,
  notifs: [
    { id: 1, app: "飞书", key: "feishu", sum: "林舟", body: "明天的会改到上午 10 点", t: "16:27", un: true, acts: ["回复", "标为已读"] },
    { id: 2, app: "飞书", key: "feishu", sum: "设计评审群", body: "周五 17:00 例会改到 3 号会议室", t: "16:12", un: true },
    { id: 3, app: "飞书", key: "feishu", sum: "审批通知", body: "你的出差申请已通过", t: "15:40", un: true },
    { id: 4, app: "飞书", key: "feishu", sum: "陈一", body: "PR 我合进去了，CI 是绿的", t: "15:02", un: false },
    { id: 5, app: "飞书", key: "feishu", sum: "日程提醒", body: "18:30 健身", t: "14:00", un: false },
    { id: 6, app: "QQ", key: "qq", sum: "Arch 中文群", body: "[小秋] niri 25.08 出了，overview 好用", t: "16:20", un: true, acts: ["回复"] },
    { id: 7, app: "QQ", key: "qq", sum: "妈妈", body: "周末回家吃饭吗", t: "13:51", un: true, acts: ["回复"] },
    { id: 8, app: "Clash Verge", key: "clash", sum: "订阅已更新", body: "节点 42 个 · 延迟最低 HK-03 38ms", t: "12:30", un: true },
    { id: 9, app: "Sunshine", key: "sunshine", sum: "Moonlight 已连接", body: "Steam Deck · 1280×800 60fps", t: "11:08", un: true, acts: ["断开"] },
  ],
  nextNid: 10, dnd: false, expanded: {},
  bat: 100, charging: true, cpu: 4, ram: 29, ramUsed: 9.1, ramTot: 31.2,
  vol: 62, mute: false, mic: 70, micMute: false, bri: 80,
  wifi: true, bt: true,
  ssid: "Buffin-5G", btDev: "WH-1000XM4",
  profile: 1,
  nets: [ { n: "Buffin-5G", s: 4, sec: true }, { n: "Buffin", s: 3, sec: true }, { n: "CMCC-7F2A", s: 2, sec: true }, { n: "ChinaNet-Guest", s: 1, sec: false } ],
  devs: [ { n: "WH-1000XM4" }, { n: "MX Master 3S" }, { n: "Xbox Wireless" } ],
  playing: true, pos: 74, dur: 251, player: 0,
  procSort: 0, procSel: null,
};
S.unread = () => S.notifs.filter(n => n.un).length;
const TRAY = [
  { k: "feishu", n: "飞书", menu: ["显示主窗口", "免打扰", "退出"] },
  { k: "magpie", n: "Magpie", menu: ["缩放当前窗口", "设置", "退出"] },
  { k: "fcitx5", n: "Fcitx5", menu: ["中州韵", "英文", "重新加载配置", "配置"] },
  { k: "sunshine", n: "Sunshine", menu: ["打开 Web UI", "断开所有客户端", "重启", "退出"] },
  { k: "clash", n: "Clash Verge", menu: ["规则", "全局", "直连", "系统代理", "TUN 模式", "退出"] },
];
const PROCS = [
  ["chromium", 6.8, 1840, 41822], ["niri", 3.1, 212, 1203], ["feishu", 2.4, 1120, 2291], ["quickshell", 1.9, 388, 1388],
  ["kitty", 1.2, 164, 38107], ["netease-cloud-music", 1.1, 412, 9934], ["qq", 0.9, 690, 12873], ["sunshine", 0.8, 96, 3021],
  ["clash-verge", 0.6, 208, 2710], ["pipewire", 0.4, 38, 1150], ["fcitx5", 0.2, 72, 1402], ["magpie", 0.1, 58, 7710],
].map(([n, c, m, p]) => ({ n, c, m, p }));
const CLIPS = ["niri msg action focus-workspace 3", "https://github.com/lyfmt/my-arch-kit", "cubic-bezier(.22,.9,.24,1)", "Buffin-5G", "#a3f0ff"];

/* ---------------- face ---------------- */
const island = $("#island"), zWs = $("#z-ws"), zTime = $("#z-time"), zPulse = $("#z-pulse"), zUn = $("#z-unread"), zBat = $("#z-bat");
const ZONES = [zWs, zTime, zPulse, zUn, zBat];
const tw = $("#tw"), ww = $("#ww");
const sheetEl = $("#sheet"), body = $("#body");
let openKey = null, openZone = null;
const nameCls = (s) => /[^\x00-\x7f]/.test(s) ? "zh nmz" : "d";
const hhmm = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

function occupied(n) { return S.wins.some(w => w.out === "DP-1" && w.ws === n); }
function focusedWin() { const id = S.focus[S.ws]; return S.wins.find(w => w.id === id) || null; }

function buildWs() {
  $$(".wsb", zWs).forEach(b => b.remove());
  for (let i = 1; i <= S.wsCount; i++) {
    const b = h(`<button class="wsb d" data-ws="${i}">${i}</button>`);
    b.onclick = (e) => { e.stopPropagation(); if (i === S.ws) open("windows", zWs); else switchWs(i); };
    zWs.appendChild(b);
  }
}
/* wedges sit on a 100px base box and move by transform only */
function placeWedge(el, x, w, snap) {
  if (snap) el.classList.add("snap");
  el.style.transform = `translateX(${x}px) scaleX(${w / 100})`;
  if (snap) { el.offsetWidth; el.classList.remove("snap"); }
}
function paintWs(snap) {
  $$(".wsb", zWs).forEach(b => {
    const n = +b.dataset.ws;
    b.classList.toggle("act", n === S.ws);
    b.classList.toggle("occ", n !== S.ws && occupied(n));
  });
  const a = $(`.wsb[data-ws="${S.ws}"]`, zWs);
  placeWedge(ww, a.offsetLeft + 1, a.offsetWidth - 2, snap);
}
function paintTime() {
  const d = now();
  $(".d", zTime).textContent = hhmm(d);
  $(".dt", zTime).textContent = WD[d.getDay()] + " " + (d.getMonth() + 1) + "." + String(d.getDate()).padStart(2, "0");
}
function paintPulse() { zPulse.classList.toggle("play", S.playing); }
let lastUn = -1;
function paintUnread() {
  const n = S.unread(), el = $(".d", zUn);
  zUn.classList.toggle("hide", n === 0);
  if (n !== lastUn && lastUn >= 0 && n > lastUn && !STATIC) { el.classList.remove("pop"); el.offsetWidth; el.classList.add("pop"); }
  el.textContent = n; lastUn = n;
}
function paintBat() {
  $(".bat .d", zBat).textContent = S.bat;
  $(".bolt", zBat).style.display = S.charging ? "" : "none";
  zBat.classList.toggle("low", S.bat <= 15 && !S.charging);
}
function paintFace(snapWs) { paintWs(snapWs); paintTime(); paintPulse(); paintUnread(); paintBat(); place(); }

/* island is centered by CSS; zone offsets change when its content does */
function place() { if (openZone) setWedge(openZone, true); }
function setWedge(z, snap) { placeWedge(tw, z.offsetLeft - 6, z.offsetWidth + 12, snap); }
function markZone(z) { ZONES.forEach(x => x.classList.toggle("on", x === z)); }

/* ---------------- clock ---------------- */
const BASE = new Date(2026, 9, 30, 16, 29, 0).getTime(), T0 = Date.now();
const now = () => new Date(BASE + (STATIC ? 0 : Date.now() - T0));

/* ---------------- sheet engine ---------------- */
const SHEETS = {}; // key -> { zone(), page(id, arg) }
let stack = [];   // [{ id, arg }]

function fitHeight() {
  const pg = body.lastElementChild;
  if (!pg) return;
  sheetEl.style.setProperty("--h", Math.min(pg.scrollHeight, innerHeight - 60) + "px");
}
function mount(el, anim, d0) {
  el.classList.add("pg");
  if (anim) el.classList.add(anim);
  body.innerHTML = ""; body.appendChild(el);
  if (d0 != null) stagger(el, d0);
  const s = $(".row.sel", el); if (s) selRow(s, true);
  fitHeight();
  return el;
}
const build = () => { const top = stack[stack.length - 1]; return SHEETS[openKey].page(top.id, top.arg); };
function renderPage(anim) { return mount(build(), anim, 0); }
function stagger(el, d0 = 0) {
  if (STATIC) return;
  $$("[data-st]", el).forEach((x, i) => { x.classList.add("st"); x.style.setProperty("--i", i); x.style.setProperty("--d0", d0 + "ms"); });
}
function refresh() {
  if (!openKey) return;
  const st = body.lastElementChild ? body.lastElementChild.scrollTop : 0;
  mount(build()).scrollTop = st;
}

/* one shared selection wedge per page; it slides between rows */
function selRow(r, snap) {
  const pg = r.closest(".pg");
  if (!pg) { r.classList.add("sel"); return; }
  let hl = $(":scope > .hl", pg);
  if (!hl) { hl = h(`<i class="hl"></i>`); pg.appendChild(hl); snap = true; }
  $$(".row.sel", pg).forEach(x => x !== r && x.classList.remove("sel"));
  r.classList.add("sel");
  if (snap || !hl.classList.contains("on")) hl.classList.add("snap");
  hl.style.transform = `translate(${r.offsetLeft}px, ${r.offsetTop}px) scale(${r.offsetWidth / 100}, ${r.offsetHeight / 100})`;
  hl.offsetWidth; hl.classList.remove("snap"); hl.classList.add("on");
}
function clearSel(pg) {
  $$(".row.sel", pg).forEach(x => x.classList.remove("sel"));
  const hl = $(":scope > .hl", pg); if (hl) hl.classList.remove("on");
}

async function open(key, zone) {
  zone = zone || SHEETS[key].zone();
  if (openKey === key) return close();
  const was = openKey;
  openKey = key; openZone = zone; stack = [{ id: "main" }];
  markZone(zone);
  if (was) {
    tw.classList.add("sw"); setWedge(zone);
    stopCava();
    const cur = body.lastElementChild;
    if (cur) cur.classList.add("fade-out");
    await wait(90);
    if (openKey !== key) return;
    mount(SHEETS[key].page("main"), "fade-in", 40);
    return;
  }
  tw.classList.remove("sw");
  setWedge(zone, true);
  tw.offsetWidth; tw.classList.remove("off");
  sheetEl.style.setProperty("--h", "0px");
  sheetEl.offsetWidth;
  sheetEl.classList.add("open");
  mount(SHEETS[key].page("main"), null, 0);
}
function close() {
  if (!openKey) return;
  openKey = null; openZone = null; stack = [];
  sheetEl.classList.remove("open");
  sheetEl.style.setProperty("--h", "0px");
  tw.classList.add("off"); tw.classList.remove("sw");
  markZone(null);
  stopCava();
}
async function push(id, arg) {
  const cur = body.lastElementChild;
  if (cur) { cur.classList.add("out"); await wait(140); }
  if (!openKey) return;
  stack.push({ id, arg }); renderPage("in");
}
async function pop() {
  if (stack.length < 2) return close();
  const cur = body.lastElementChild;
  if (cur) { cur.classList.add("back-out"); await wait(140); }
  if (!openKey) return;
  stack.pop(); renderPage("back-in");
}
const backBtn = () => { const b = h(`<button class="back">${SVG.back}</button>`); b.onclick = () => pop(); return b; };
const flash = (el, then) => { el.classList.add("flash"); setTimeout(() => { el.classList.remove("flash"); if (then) then(); }, STATIC ? 0 : 180); };
const copy = (v) => { try { navigator.clipboard.writeText(String(v)); } catch (e) {} const i = CLIPS.indexOf(String(v)); if (i >= 0) CLIPS.splice(i, 1); CLIPS.unshift(String(v)); };

/* counters */
function countUp(el, to, fmt = (v) => Math.round(v)) {
  if (STATIC) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / 360); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
/* segmented control */
function seg(labels, sel, onPick) {
  const el = h(`<div class="seg"><i class="k"></i>${labels.map((l, i) => `<button class="l${i === sel ? " on" : ""}">${esc(l)}</button>`).join("")}</div>`);
  const k = $(".k", el), bs = $$("button", el);
  const mv = (i) => { k.style.width = (100 / labels.length) + "%"; k.style.transform = `translateX(${i * 100}%)`; bs.forEach((b, j) => b.classList.toggle("on", j === i)); };
  mv(sel);
  bs.forEach((b, i) => b.onclick = () => { mv(i); onPick(i); });
  return el;
}
function slider(v, onSet, cls = "") {
  const el = h(`<div class="slider ${cls}"><i style="--v:${v}%"></i></div>`);
  const set = (e) => { const r = el.getBoundingClientRect(); const p = Math.max(0, Math.min(100, Math.round((e.clientX - r.left) / r.width * 100))); $("i", el).style.setProperty("--v", p + "%"); onSet(p); };
  el.addEventListener("pointerdown", (e) => { el.setPointerCapture(e.pointerId); set(e); const mvf = (ev) => set(ev); el.addEventListener("pointermove", mvf); el.addEventListener("pointerup", () => el.removeEventListener("pointermove", mvf), { once: true }); });
  return el;
}
function toggle(on, onSet) {
  const el = h(`<button class="tg${on ? " on" : ""}"></button>`);
  el.onclick = () => { el.classList.toggle("on"); onSet(el.classList.contains("on")); };
  return el;
}

/* ---------------- WINDOWS ---------------- */
function winDetail(w) {
  const det = h(`<div class="det${S.winOpen === w.id ? " open" : ""}" data-w="${w.id}"><div class="in"></div></div>`);
  const inn = $(".in", det);
  [["TITLE", w.title], ["APP ID", w.appId], ["PID", w.pid], ["WS", w.out + " · " + w.ws], ["MODE", w.mode], ["SIZE", w.size]].forEach(([k, v]) => {
    inn.appendChild(h(`<span class="l">${k}</span>`));
    const b = h(`<button class="v zh">${esc(v)}</button>`);
    b.onclick = () => { copy(v); flash(b); };
    inn.appendChild(b);
  });
  const acts = h(`<div class="btns"><button class="btn l">FOCUS</button><button class="btn l">${w.mode === "FLOAT" ? "TILE" : "FLOAT"}</button><button class="btn l">RULE</button><span class="grow"></span><button class="btn l danger">CLOSE</button></div>`);
  const [bf, bfl, br, bc] = $$("button", acts);
  bf.onclick = () => { if (w.out === "DP-1") { S.ws = w.ws; S.focus[w.ws] = w.id; paintFace(); } close(); };
  bfl.onclick = () => { w.mode = w.mode === "FLOAT" ? "TILED" : "FLOAT"; refresh(); };
  br.onclick = () => { copy(`window-rule {\n  match app-id="^${w.appId}$"\n  open-floating ${w.mode === "FLOAT"}\n}`); flash(br); };
  bc.onclick = () => {
    S.wins = S.wins.filter(x => x !== w);
    Object.keys(S.focus).forEach(k => { if (S.focus[k] === w.id) { const o = S.wins.find(x => x.out === "DP-1" && x.ws === +k); S.focus[k] = o ? o.id : null; } });
    S.winSel = null; S.winOpen = null; paintFace(); refresh();
  };
  inn.appendChild(acts);
  return det;
}
SHEETS.windows = { zone: () => zWs, page() {
  const el = h(`<div></div>`);
  const fw = focusedWin();
  if (S.winSel == null && fw) S.winSel = fw.id;
  ["DP-1", "HDMI-A-1"].forEach(out => {
    const wsSet = [...new Set(S.wins.filter(w => w.out === out).map(w => w.ws))].sort();
    wsSet.forEach(ws => {
      el.appendChild(h(`<div class="gh l" data-st><span>${out} · ${ws}</span></div>`));
      S.wins.filter(w => w.out === out && w.ws === ws).forEach(w => {
        const r = h(`<button class="row win${w.id === S.winSel ? " sel" : ""}" data-st>${ico(w.key, "ic", w.app[0])}<span class="nm ${nameCls(w.app)}">${esc(w.app)}</span><span class="tl zh">${esc(w.title)}</span></button>`);
        const det = winDetail(w);
        r.onclick = () => {
          const pg = r.closest(".pg");
          if (S.winSel === w.id) S.winOpen = S.winOpen === w.id ? null : w.id;
          else { S.winSel = w.id; S.winOpen = null; }
          $$(".det", pg).forEach(d => d.classList.toggle("open", +d.dataset.w === S.winOpen));
          selRow(r);
          fitHeight();
        };
        el.appendChild(r); el.appendChild(det);
      });
    });
  });
  return el;
} };

/* ---------------- CALENDAR ---------------- */
const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const WDF = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
let calY, calM;
function calReset() { const d = now(); calY = d.getFullYear(); calM = d.getMonth(); }
calReset();
SHEETS.calendar = { zone: () => zTime, page() {
  const d = now();
  const el = h(`<div></div>`);
  const isCur = calY === d.getFullYear() && calM === d.getMonth();
  const hd = h(`<div class="calhd" data-st><span class="big d">${isCur ? d.getDate() : String(calM + 1).padStart(2, "0")}</span><div class="wd d">${isCur ? WDF[d.getDay()] + " · " + MON[calM].slice(0, 3) + " " + calY : MON[calM] + " " + calY}</div>
    <div class="calnav"><button class="back">${SVG.back}</button><button class="back" style="transform:scaleX(-1)">${SVG.back}</button></div></div>`);
  const [bp, bn] = $$(".calnav button", hd);
  bp.onclick = () => calStep(-1); bn.onclick = () => calStep(1);
  el.appendChild(hd);
  const g = h(`<div class="grid"></div>`);
  ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].forEach(w => g.appendChild(h(`<span class="h l">${w}</span>`)));
  const first = new Date(calY, calM, 1); const off = (first.getDay() + 6) % 7;
  const start = new Date(calY, calM, 1 - off);
  for (let i = 0; i < 42; i++) {
    const c = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const td = c.toDateString() === d.toDateString();
    const cls = ["c", "d", c.getMonth() !== calM ? "o" : "", (i % 7) >= 5 ? "we" : "", td ? "td" : ""].join(" ");
    g.appendChild(h(`<span class="${cls}" ${i % 7 === 0 ? "data-st" : ""}>${c.getDate()}</span>`));
  }
  el.appendChild(g);
  return el;
} };
function calStep(n) { calM += n; if (calM < 0) { calM = 11; calY--; } if (calM > 11) { calM = 0; calY++; } refresh(); }

/* ---------------- NOTIFICATIONS ---------------- */
SHEETS.notif = { zone: () => zUn, page() {
  const el = h(`<div></div>`);
  const n = S.unread();
  const hd = h(`<div class="hd nhd" data-st><span class="cnt d${n ? "" : " z0"}">0</span><span class="grow"></span><span class="tgw l">DND</span><button class="btn l">CLEAR</button></div>`);
  countUp($(".cnt", hd), n);
  const tg = toggle(S.dnd, (v) => { S.dnd = v; });
  $(".tgw", hd).appendChild(tg);
  $(".btn", hd).onclick = () => { S.notifs = []; paintUnread(); place(); refresh(); };
  el.appendChild(hd);
  const list = h(`<div class="nlist"></div>`);
  const apps = [...new Set(S.notifs.map(x => x.app))];
  if (!apps.length) list.appendChild(h(`<div class="empty">${SVG.x.replace("viewBox", 'style="width:28px;height:28px" viewBox')}</div>`));
  apps.forEach(app => {
    const items = S.notifs.filter(x => x.app === app);
    list.appendChild(h(`<div class="ngh l" data-st>${ico(items[0].key, "", app[0])}<span>${esc(app)}</span><span class="n">${items.length}</span></div>`));
    const show = S.expanded[app] ? items : items.slice(0, 3);
    show.forEach(it => list.appendChild(notifEl(it)));
    if (items.length > 3 && !S.expanded[app]) {
      const m = h(`<button class="more d" data-st>+${items.length - 3}</button>`);
      m.onclick = () => { S.expanded[app] = true; refresh(); };
      list.appendChild(m);
    }
  });
  el.appendChild(list);
  return el;
} };
function notifEl(it) {
  const e = h(`<div class="nt${it.un ? " un" : ""}" data-st><div class="tx"><div class="sm zh">${esc(it.sum)}</div><div class="bd zh">${esc(it.body)}</div>
    ${it.acts ? `<div class="chips">${it.acts.map(a => `<button class="chip zh">${esc(a)}</button>`).join("")}</div>` : ""}</div>
    <div class="rt"><span class="tm l">${it.t}</span><button class="x">${SVG.x}</button></div></div>`);
  const kill = () => { e.classList.add("gone"); setTimeout(() => { S.notifs = S.notifs.filter(x => x !== it); paintUnread(); place(); refresh(); }, STATIC ? 0 : 200); };
  $(".x", e).onclick = (ev) => { ev.stopPropagation(); kill(); };
  $$(".chip", e).forEach(c => c.onclick = (ev) => { ev.stopPropagation(); it.un = false; kill(); });
  e.onclick = () => { if (it.un) { it.un = false; e.classList.remove("un"); paintUnread(); place(); const c = $(".nhd .cnt"); if (c) { c.textContent = S.unread(); c.classList.toggle("z0", !S.unread()); } } };
  let x0 = null, dx = 0;
  e.addEventListener("pointerdown", (ev) => { if (ev.target.closest("button")) return; x0 = ev.clientX; dx = 0; e.setPointerCapture(ev.pointerId); e.classList.add("drag"); });
  e.addEventListener("pointermove", (ev) => { if (x0 == null) return; dx = Math.max(0, ev.clientX - x0); e.style.transform = `translateX(${dx}px)`; e.style.opacity = 1 - dx / 400; });
  e.addEventListener("pointerup", () => { if (x0 == null) return; x0 = null; e.classList.remove("drag"); if (dx > 120) { e.style.transform = ""; e.style.opacity = ""; kill(); } else { e.style.transform = ""; e.style.opacity = ""; if (dx > 4) e.onclickBlock = true; } });
  return e;
}

/* ---------------- STATUS ---------------- */
const fmtT = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
const TRACK = { t: "Mass Destruction -Reload-", a: "Lotus Juice · 高橋あず美" };
const PLAYERS = ["NETEASE", "MPV", "CHROMIUM"];

SHEETS.status = { zone: () => zBat, page(id, arg) {
  if (id === "net") return pgNet();
  if (id === "bt") return pgBt();
  if (id === "tray") return pgTray(arg);
  if (id === "power") return pgPower();
  if (id === "proc") return pgProc(arg);
  if (id === "bat") return pgBat();
  if (id === "clip") return pgClip();
  return pgStatus();
} };
SHEETS.media = { zone: () => zPulse, page() { return pgMedia(); } };

function readouts(items) {
  const rd = h(`<div class="rd" data-st>${items.map(([k, v, unit, red]) => `<button data-p="${k}"><div class="ln"><span class="l">${k.toUpperCase()}</span><span class="d"><b>0</b><small>${unit}</small></span></div><div class="lv${red ? " red" : ""}"><i></i></div></button>`).join("")}</div>`);
  items.forEach(([k, v, unit, red, lv, fmt], i) => { countUp($$("b", rd)[i], v, fmt); requestAnimationFrame(() => requestAnimationFrame(() => { $$(".lv i", rd)[i].style.transform = `scaleX(${(lv != null ? lv : v) / 100})`; })); });
  return rd;
}
function slRow(name, val, onSet, opt = {}) {
  const r = h(`<div class="sl" data-st><button class="nm l"></button><span class="sl-h"></span><span class="v d">${val}</span></div>`);
  const nm = $(".nm", r);
  const paint = () => { const m = opt.muted && opt.muted(); nm.textContent = m ? "MUTE" : name; nm.classList.toggle("mute", !!m); sl.classList.toggle("mute", !!m); };
  const sl = slider(val, (p) => { $(".v", r).textContent = p; onSet(p); paint(); });
  $(".sl-h", r).replaceWith(sl);
  if (opt.onName) nm.onclick = () => { opt.onName(); paint(); }; else nm.disabled = true;
  paint();
  return r;
}
function pgStatus() {
  const el = h(`<div></div>`);
  const low = S.bat <= 15 && !S.charging;
  const rd = readouts([["cpu", S.cpu, "%"], ["ram", S.ram, "%"], ["bat", S.bat, "%", low]]);
  $$("button", rd).forEach(b => b.onclick = () => b.dataset.p === "bat" ? push("bat") : push("proc", b.dataset.p));
  el.appendChild(rd);

  el.appendChild(slRow("VOLUME", S.vol, (p) => { S.vol = p; S.mute = false; osd("vol"); }, { muted: () => S.mute, onName: () => { S.mute = !S.mute; osd("vol"); } }));
  el.appendChild(slRow("MIC", S.mic, (p) => { S.mic = p; S.micMute = false; }, { muted: () => S.micMute, onName: () => { S.micMute = !S.micMute; } }));
  el.appendChild(slRow("BRIGHTNESS", S.bri, (p) => { S.bri = p; osd("bri"); }));

  const tgs = h(`<div class="tgs"></div>`);
  [["WI-FI", () => S.wifi ? S.ssid : "", "wifi", "net"], ["BLUETOOTH", () => S.bt ? S.btDev : "", "bt", "bt"]].forEach(([n, sub, k, pg]) => {
    const c = h(`<div class="tc" data-st><button class="nmw"><span class="l">${n}${SVG.chev}</span><span class="sub zh">${esc(sub())}</span></button></div>`);
    c.appendChild(toggle(S[k], (v) => { S[k] = v; $(".sub", c).textContent = sub(); }));
    $(".nmw", c).onclick = () => push(pg);
    tgs.appendChild(c);
  });
  el.appendChild(tgs);

  const tr = h(`<div class="trayr" data-st></div>`);
  TRAY.forEach((t, i) => {
    const b = h(`<button class="ti">${ico(t.k, "", t.n[0])}</button>`);
    b.onclick = () => push("tray", i);
    b.oncontextmenu = (e) => { e.preventDefault(); push("tray", i); };
    tr.appendChild(b);
  });
  tr.appendChild(h(`<span class="grow"></span>`));
  const bc = h(`<button class="ti sv">${SVG.clip}</button>`); bc.onclick = () => push("clip");
  const bp = h(`<button class="ti sv">${SVG.power}</button>`); bp.onclick = () => push("power");
  tr.append(bc, bp);
  el.appendChild(tr);
  return el;
}

function subHead(title) {
  const hd = h(`<div class="hd" data-st><span class="t d">${esc(title)}</span><span class="grow"></span></div>`);
  hd.prepend(backBtn());
  return hd;
}
function pgBat() {
  const el = h(`<div></div>`);
  el.appendChild(subHead("Battery"));
  const low = S.bat <= 15 && !S.charging;
  el.appendChild(readouts([
    [S.charging ? "full" : "left", S.charging ? 0 : 48, "MIN", low, S.charging ? 100 : S.bat],
    ["draw", S.charging ? 14.2 : 9.6, "W", false, 40, (v) => v.toFixed(1)],
    ["health", 91, "%"],
  ]));
  $$(".rd button", el).forEach(b => b.disabled = true);
  const pr = h(`<div class="segrow" data-st><span class="l">PROFILE</span></div>`);
  pr.appendChild(seg(["SAVER", "BALANCED", "PERFORM"], S.profile, (i) => S.profile = i));
  el.appendChild(pr);
  return el;
}
function listRows(el, items, isSel, onPick) {
  items.forEach(it => {
    const r = h(it.html);
    if (isSel(it)) r.classList.add("sel");
    r.onclick = () => { onPick(it, r); };
    el.appendChild(r);
  });
}
function pgNet() {
  const el = h(`<div></div>`);
  const hd = subHead("Wi-Fi");
  hd.appendChild(toggle(S.wifi, (v) => { S.wifi = v; refresh(); }));
  el.appendChild(hd);
  if (S.wifi) listRows(el, S.nets.map(n => ({ n: n.n, html: `<button class="row lrow" data-st><span class="bars">${[0,1,2,3].map(i => `<i class="${i < n.s ? "f" : ""}" style="height:${4 + i * 3.3}px"></i>`).join("")}</span><span class="nm zh">${esc(n.n)}</span>${n.sec ? SVG.lock.replace("<svg", '<svg class="lk"') : ""}</button>` })),
    (n) => n.n === S.ssid, (n, r) => { S.ssid = n.n; selRow(r); });
  return el;
}
function pgBt() {
  const el = h(`<div></div>`);
  const hd = subHead("Bluetooth");
  hd.appendChild(toggle(S.bt, (v) => { S.bt = v; refresh(); }));
  el.appendChild(hd);
  if (S.bt) listRows(el, S.devs.map(d => ({ n: d.n, html: `<button class="row lrow" data-st><span class="nm zh">${esc(d.n)}</span></button>` })),
    (d) => d.n === S.btDev, (d, r) => { S.btDev = d.n; selRow(r); });
  return el;
}
function pgTray(i) {
  const t = TRAY[i];
  const el = h(`<div></div>`);
  const hd = subHead(t.n);
  hd.insertBefore(h(`<span class="hdi">${ico(t.k, "ic", t.n[0])}</span>`), $(".t", hd));
  el.appendChild(hd);
  listRows(el, t.menu.map(m => ({ html: `<button class="row lrow" data-st><span class="nm zh">${esc(m)}</span></button>` })), () => false, (m, r) => { selRow(r); setTimeout(close, STATIC ? 0 : 220); });
  return el;
}
function pgClip() {
  const el = h(`<div></div>`);
  el.appendChild(subHead("Clipboard"));
  listRows(el, CLIPS.slice(0, 8).map(c => ({ c, html: `<button class="row lrow" data-st><span class="nm cl">${esc(c)}</span></button>` })), () => false,
    (it, r) => { copy(it.c); selRow(r); setTimeout(close, STATIC ? 0 : 220); });
  return el;
}
function pgPower() {
  const el = h(`<div></div>`);
  el.appendChild(subHead("Power"));
  const hs = h(`<div class="holds" data-st></div>`);
  [["LOCK", 0], ["SUSPEND", 0], ["LOGOUT", 0], ["REBOOT", 1], ["OFF", 1]].forEach(([n, dg]) => {
    const b = h(`<button class="hold l${dg ? " dg" : ""}"><i></i><span>${n}</span></button>`);
    let tm = null;
    const up = () => { clearTimeout(tm); if (!b.classList.contains("done")) b.classList.remove("fill"); };
    b.addEventListener("pointerdown", () => { b.classList.add("fill"); tm = setTimeout(() => { b.classList.add("done"); setTimeout(() => { b.classList.remove("done", "fill"); close(); }, 260); }, 500); });
    b.addEventListener("pointerup", up); b.addEventListener("pointerleave", up);
    hs.appendChild(b);
  });
  el.appendChild(hs);
  return el;
}
function pgProc(kind) {
  if (kind) S.procSort = kind === "ram" ? 1 : 0;
  const el = h(`<div></div>`);
  const hd = subHead("Processes");
  const acts = h(`<div class="btns"><button class="btn l">TERM</button><button class="btn l danger">KILL</button></div>`);
  hd.appendChild(acts);
  el.appendChild(hd);
  const ph = h(`<div class="proc ph" data-st><span class="l">NAME</span><button class="l">CPU</button><button class="l">MEM</button><button class="l">PID</button></div>`);
  $$("button", ph).forEach((b, i) => { b.classList.toggle("on", i === S.procSort); b.onclick = () => { S.procSort = i; stack[stack.length - 1].arg = null; refresh(); }; });
  el.appendChild(ph);
  const key = ["c", "m", "p"][S.procSort];
  const list = [...PROCS].sort((a, b) => key === "p" ? a.p - b.p : b[key] - a[key]);
  const ab = $$("button", acts);
  const sync = () => ab.forEach(b => b.disabled = S.procSel == null);
  list.forEach(p => {
    const r = h(`<button class="row proc${S.procSel === p.p ? " sel" : ""}" data-st><span class="nm">${p.n}</span><span class="nu">${p.c.toFixed(1)}</span><span class="nu">${p.m >= 1000 ? (p.m / 1024).toFixed(1) + "G" : p.m + "M"}</span><span class="pid">${p.p}</span></button>`);
    r.onclick = () => { if (S.procSel === p.p) { S.procSel = null; clearSel(el); } else { S.procSel = p.p; selRow(r); } sync(); };
    el.appendChild(r);
  });
  ab.forEach(b => b.onclick = () => {
    if (S.procSel == null) return;
    const row = $(".proc.sel", el); if (row) row.classList.add("killed");
    clearSel(el);
    setTimeout(() => { const i = PROCS.findIndex(p => p.p === S.procSel); if (i >= 0) PROCS.splice(i, 1); S.procSel = null; refresh(); }, STATIC ? 0 : 200);
  });
  sync();
  return el;
}
let cavaT = null;
function stopCava() { clearInterval(cavaT); cavaT = null; }
function pgMedia() {
  const el = h(`<div></div>`);
  const m = h(`<div class="media" data-st><div class="cv d">${esc(TRACK.t[0])}</div>
    <div class="mi"><div class="mt d">${esc(TRACK.t)}</div><div class="ma zh">${esc(TRACK.a)}</div>
    <div class="cava">${"<i></i>".repeat(32)}</div></div></div>`);
  el.appendChild(m);
  const pg = h(`<div class="prog" data-st><span class="ph"></span><div class="tms d"><span class="p">${fmtT(S.pos)}</span><span>${fmtT(S.dur)}</span></div></div>`);
  const pr = slider(S.pos / S.dur * 100, (p) => { S.pos = Math.round(p / 100 * S.dur); $(".p", pg).textContent = fmtT(S.pos); });
  $(".ph", pg).replaceWith(pr);
  el.appendChild(pg);
  const mc = h(`<div class="mcs" data-st><button class="mc">${SVG.prev}</button><button class="mc pl">${S.playing ? SVG.pause : SVG.play}</button><button class="mc">${SVG.next}</button><span class="grow"></span>
    ${PLAYERS.map((p, i) => `<button class="chip l${i === S.player ? " on" : ""}">${p}</button>`).join("")}</div>`);
  const [bp, bpl, bn] = $$(".mc", mc);
  bpl.onclick = () => { S.playing = !S.playing; bpl.innerHTML = S.playing ? SVG.pause : SVG.play; paintPulse(); };
  bp.onclick = () => { S.pos = 0; pr.firstChild.style.setProperty("--v", "0%"); $(".p", pg).textContent = fmtT(0); };
  bn.onclick = bp.onclick;
  $$(".chip", mc).forEach((c, i) => c.onclick = () => { S.player = i; $$(".chip", mc).forEach((x, j) => x.classList.toggle("on", j === i)); });
  el.appendChild(mc);
  const bars = $$(".cava i", m);
  stopCava();
  const tick = () => {
    if (S.playing) { S.pos = Math.min(S.dur, S.pos + .1); pr.firstChild.style.setProperty("--v", (S.pos / S.dur * 100) + "%"); $(".p", pg).textContent = fmtT(S.pos); }
    bars.forEach((b, i) => { const base = Math.sin(i / 32 * Math.PI) * .6 + .2; b.style.transform = `scaleY(${S.playing ? Math.max(.06, Math.min(1, base + (Math.random() - .5) * .5)) : .06})`; });
  };
  tick();
  if (!STATIC) cavaT = setInterval(tick, 100);
  return el;
}

/* ---------------- OSD in BAT zone ---------------- */
let osdT = null;
function osd(kind) {
  const svg = $(".osd svg", zBat);
  if (kind === "vol") { svg.setAttribute("viewBox", "0 0 15 14"); svg.innerHTML = volSvg(S.vol, S.mute); }
  else { svg.setAttribute("viewBox", "0 0 16 14"); svg.innerHTML = sunSvg; }
  $(".osd b i", zBat).style.width = (kind === "vol" ? (S.mute ? 0 : S.vol) : S.bri) + "%";
  zBat.classList.add("osdon"); place();
  clearTimeout(osdT);
  osdT = setTimeout(() => { zBat.classList.remove("osdon"); place(); }, 1200);
}

/* ---------------- workspace ---------------- */
function switchWs(n) {
  n = Math.max(1, Math.min(S.wsCount, n));
  if (n === S.ws) return;
  S.ws = n; S.winSel = null; S.winOpen = null;
  paintFace();
  if (openKey === "windows") refresh();
}
zWs.addEventListener("wheel", (e) => { e.preventDefault(); switchWs(S.ws + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });

/* ---------------- notification arrival ---------------- */
const INCOMING = [
  { app: "飞书", key: "feishu", sum: "林舟", body: "文件已发送，记得查收", acts: ["回复"] },
  { app: "QQ", key: "qq", sum: "Arch 中文群", body: "[阿树] 有人用 DankMaterialShell 吗" },
  { app: "Clash Verge", key: "clash", sum: "节点切换", body: "HK-03 → JP-01 · 52ms" },
  { app: "飞书", key: "feishu", sum: "陈一", body: "晚上一起吃饭？" },
];
let arrT = null, inIdx = 0;
const arrive = $("#arrive");
function notify() {
  const src = INCOMING[inIdx++ % INCOMING.length];
  const d = now();
  const it = { ...src, id: S.nextNid++, t: hhmm(d), un: true };
  S.notifs.unshift(it);
  paintUnread(); place();
  if (openKey === "notif") refresh();
  if (S.dnd) return;
  arrive.innerHTML = `${ico(it.key, "", it.app[0])}<span class="l">${esc(it.app)}</span><span class="zh">${esc(it.sum)} · ${esc(it.body)}</span>`;
  arrive.classList.add("show");
  clearTimeout(arrT);
  arrT = setTimeout(() => arrive.classList.remove("show"), 4000);
}
arrive.addEventListener("click", (e) => { e.stopPropagation(); arrive.classList.remove("show"); open("notif"); });

/* ---------------- events ---------------- */
ZONES.forEach(z => z.addEventListener("click", (e) => {
  e.stopPropagation();
  if (z === zTime && openKey !== "calendar") calReset();
  open(z.dataset.sheet, z);
}));
document.addEventListener("pointerdown", (e) => {
  if (!openKey) return;
  if (e.target.closest("#sheet") || e.target.closest("#island")) return;
  close();
});
sheetEl.addEventListener("wheel", (e) => {
  if (openKey !== "calendar") return;
  e.preventDefault(); calStep(e.deltaY > 0 ? 1 : -1);
}, { passive: false });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (stack.length > 1) pop(); else close(); return; }
  if (/^[1-9]$/.test(e.key)) { switchWs(+e.key); return; }
  if (openKey === "calendar") {
    if (e.key === "ArrowLeft") return calStep(-1);
    if (e.key === "ArrowRight") return calStep(1);
    if (e.key === "t" || e.key === "T") { calReset(); refresh(); return; }
  }
  if (e.key === "t" || e.key === "T") { root.dataset.theme = root.dataset.theme === "lavender" ? "" : "lavender"; return; }
  if (e.key === "n" || e.key === "N") { notify(); return; }
  if (e.key === "b" || e.key === "B") { S.charging = !S.charging; S.bat = S.charging ? 100 : 12; paintBat(); place(); if (openKey === "status") refresh(); return; }
});
addEventListener("resize", () => { place(); if (openKey) fitHeight(); });

/* live readouts */
setInterval(() => {
  paintTime();
  if (STATIC) return;
  S.cpu = Math.max(2, Math.min(18, S.cpu + Math.round((Math.random() - .5) * 4)));
}, 2000);

buildWs();
document.fonts.ready.then(() => paintFace(true));
paintFace(true);
})();
