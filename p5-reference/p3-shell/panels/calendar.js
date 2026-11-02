// CALENDAR 面板：本周 7 张日卡 + 当日日程（事件 + 本地任务），M 切到整页月历，事件详情是子页面
// 数据走面板内的模拟 CalendarService（接口同 DMS Services/CalendarService.qml）。
// 本机真实状态 = 默认渲染：activeBackend "none"、无 tasks.json，只有日期是真的。
// 本地任务存在 ~/.config/niri-calendar-todo/tasks.json，与看板 board.json 是两套存储。
//
// 键位（一条竖向流程）
//   日卡条：←→ 日；PgUp/PgDn 或滚轮 周；↓ / Enter 进日程；M 月历；T 今天；N 加任务
//   日程：↑↓ 行（首行再 ↑ 回日卡条）；←→ 仍换日；Enter 详情 / 勾选 / 添加；Space 勾选；
//         O 打开链接；X / Delete 删任务；N 加任务
//   详情子页 / 月历：Esc、Backspace、← 返回面板（再按 Esc 才关闭面板）
//   输入框：所有键只给输入框；Enter 保存（输入法组字中不算），Esc / 空 Enter / 点外面 取消
//
// 模拟状态 URL 参数（可组合，?static 照常可用）
//   ?cal=khal            khal 形态的样例日程（calendar / color 为空）+ 10/30 一条本地任务
//   ?cal=dank            同上但走 DankCalendar：带 calendar 名、tentative 状态、只读 VTODO，加任务是异步的
//   ?tasks=1             预置本地任务（相对今天）：前天一条未完成（今天显示为延续）、今天一条未完成一条已完成
//   ?installed=khal|dank 装了后端但未选用 / 未连接：底部提示行出现 SET UP（dank 还有 LAUNCH）
//   ?loading=1           isLoading：有后端的空日不显示 FREE，改显示暗色 LOADING 行
//   ?date=YYYY-MM-DD     初始选中日（默认今天）
//   ?view=month          直接打开月历
//   ?focus=agenda&row=N  焦点放在日程第 N 行（从 0 起，含 + ADD TASK 和底部按钮）
//   ?detail=N            打开选中日第 N 行事件的详情子页
//   ?add=文本            打开加任务输入框并预填文本
(() => {
  const q = new URLSearchParams(location.search);
  const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const WDF = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const MON = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diff = (a, b) => Math.round((day0(a) - day0(b)) / 864e5);
  const p2 = n => String(n).padStart(2, "0");
  const weekStart = d => addDays(d, -((d.getDay() + 6) % 7)); // zh_CN：周一开头
  const hm = d => p2(d.getHours()) + ":" + p2(d.getMinutes());
  const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
  const keyOf = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const fromKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const isTask = e => /^(task_|vtodo_)/.test(e.id);
  const mon3 = d => MON[d.getMonth()].slice(0, 3);

  // ---------- 模拟 CalendarService ----------
  const CAL = q.get("cal"), INST = q.get("installed");
  const S = {
    activeBackend: CAL === "khal" ? "khal" : CAL === "dank" ? "dankcal" : "none",
    khalInstalled: CAL === "khal" || INST === "khal",
    dankBinaryExists: CAL === "dank" || INST === "dank",
    dankConnected: CAL === "dank",
    isLoading: q.has("loading"),
    eventsByDate: {}, localTasks: {}, dankTasks: {}, loaded: null,
    get calendarAvailable() { return this.activeBackend !== "none"; },
    // 服务顺序：后端事件 + 任务拼接后按 start 排，_origIdx 定先后（任务 start = 当天零点）
    getEventsForDate(d) {
      const k = keyOf(d), m0 = day0(d);
      const tk = (t, pre) => ({ id: pre + t.id, title: t.text, completed: !!t.completed, readOnly: !!t.readOnly,
        start: m0, end: m0, allDay: true, isMultiDay: false, location: "", description: "", url: "" });
      const all = [...(this.eventsByDate[k] || []), ...(this.dankTasks[k] || []).map(t => tk(t, "vtodo_")),
        ...(this.localTasks[k] || []).map(t => tk(t, "task_"))];
      return all.map((e, i) => ({ e, i })).sort((a, b) => a.e.start - b.e.start || a.i - b.i).map(x => x.e);
    },
    addTaskForDate(d, text, done) {
      const k = keyOf(d);
      if (this.dankConnected) { // dankcal：createTask 走守护进程，回包后才有行
        setTimeout(() => { (this.dankTasks[k] ||= []).push({ id: Date.now() + "", text, completed: false }); done(true); }, P3.STATIC ? 0 : 450);
        return;
      }
      (this.localTasks[k] ||= []).push({ id: Date.now() + "-dms", text, completed: false });
      done(this.getEventsForDate(d).some(e => e.title === text && isTask(e)));
    },
    _find(id) {
      const local = id.startsWith("task_"), raw = id.replace(/^(task_|vtodo_)/, ""), store = local ? this.localTasks : this.dankTasks;
      for (const k in store) { const i = store[k].findIndex(t => t.id === raw); if (i >= 0) return { store, k, i }; }
      return null;
    },
    toggleTask(id) { const f = this._find(id); if (f) f.store[f.k][f.i].completed = !f.store[f.k][f.i].completed; },
    removeTask(id) {
      const f = this._find(id); if (!f) return;
      f.store[f.k].splice(f.i, 1);
      if (!f.store[f.k].length) delete f.store[f.k];
    },
    loadEvents(s, e) { if (this.activeBackend !== "none") this.loaded = { s, e }; },
  };

  // 样例日程：按 khal 后端的方式逐日拆开、按天夹紧 start / end，id 跨天不变
  function addEvent(title, s, e, o = {}) {
    const start = new Date(s), end = new Date(e), allDay = !!o.allDay;
    const id = title + "_" + s.slice(0, 10) + "_" + (allDay ? "allday" : s.slice(11));
    const base = { id, title, location: "", description: "", url: "", calendar: "", color: "", allDay,
      isMultiDay: start.toDateString() !== end.toDateString(), ...o };
    for (let d = day0(start); d <= end; d = addDays(d, 1)) {
      const first = +d === +day0(start), last = +d === +day0(end);
      (S.eventsByDate[keyOf(d)] ||= []).push({ ...base,
        start: first ? start : d, end: last ? end : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59) });
    }
  }
  if (CAL) {
    const dk = CAL === "dank";
    addEvent("组会", "2026-10-29T19:00", "2026-10-29T21:00", { location: "https://meeting.tencent.com/dm/8Nw3kq", description: "周报 + loopx 进度，带电脑", calendar: dk ? "Lab" : "" });
    addEvent("羽毛球", "2026-10-30T19:30", "2026-10-30T21:00", { location: "浑南体育馆", calendar: dk ? "Personal" : "", status: dk ? "tentative" : undefined });
    addEvent("大连", "2026-10-31T00:00", "2026-11-01T23:59", { location: "大连", allDay: true, calendar: dk ? "Personal" : "" });
    addEvent("算法设计与分析 期中考试", "2026-11-03T08:30", "2026-11-03T10:30", { location: "浑南 文管A 301", calendar: dk ? "Lab" : "" });
    S.localTasks["2026-10-30"] = [{ id: "1761800000000-dms", text: "提交 loopx 竞品调研", completed: false }];
    if (dk) S.dankTasks["2026-10-30"] = [{ id: "a91f", text: "复习 期中 第 5 章", completed: false, readOnly: true }];
  }
  if (q.get("tasks") === "1") { // 相对今天：前天一条未完成（延续到今天），今天一条未完成一条已完成
    const t0 = day0(new Date());
    S.localTasks[keyOf(addDays(t0, -2))] = [{ id: "1761600000000-dms", text: "交 线段树 作业", completed: false }];
    (S.localTasks[keyOf(t0)] ||= []).push({ id: "1761800000002-dms", text: "提交 loopx 竞品调研", completed: false },
      { id: "1761800000001-dms", text: "买 打印纸", completed: true });
  }
  // 链接规则同 CalendarOverviewCard.quickUrl：meetingUrl → URL 形态的 location → url；任务没有链接
  function quickUrl(e) {
    if (!e || isTask(e)) return "";
    if (e.meetingUrl) return e.meetingUrl;
    const loc = (e.location || "").trim();
    if (/^https?:\/\/\S+$/i.test(loc)) return loc;
    if (/^www\.\S+$/i.test(loc)) return "https://" + loc;
    return e.url || "";
  }
  const isUrlLoc = e => /^(https?:\/\/|www\.)\S+$/i.test((e.location || "").trim());
  const canModify = e => e.id.startsWith("task_") || (e.id.startsWith("vtodo_") && !e.readOnly);
  // 多日事件：从 eventsByDate 前后找同 id 的首尾日期（本面板的数据窗内）
  function span(e, d) {
    let a = day0(d), b = day0(d);
    const has = x => (S.eventsByDate[keyOf(x)] || []).some(o => o.id === e.id);
    for (let k = 0; k < 62 && has(addDays(a, -1)); k++) a = addDays(a, -1);
    for (let k = 0; k < 62 && has(addDays(b, 1)); k++) b = addDays(b, 1);
    return { a, b };
  }
  const hasDetail = e => !!(quickUrl(e) || e.description || e.calendar || e.isMultiDay || e.status === "tentative" || (e.attendees || []).length);

  // ---------- 面板状态 ----------
  let root = null, body = null, sel, focus = "strip", row = 0, view = "day", mc = null, detailEv = null;
  let editing = false, draft = "", swapT = 0, timer = 0, todayK = "", prevOpen = 0, wheelT = 0, loadT = 0;
  const today = () => day0(new Date());
  const keysEl = () => document.getElementById("keys");

  // 今天的延续：更早日期里未完成的本地任务（tasks.json 里只能在这里再次看到）
  function overdue() {
    const t = today(), out = [];
    for (const k of Object.keys(S.localTasks).sort()) {
      const d = fromKey(k);
      if (d >= t) continue;
      for (const e of S.getEventsForDate(d)) if (e.id.startsWith("task_") && !e.completed) out.push({ k: "task", e, from: d });
    }
    return out;
  }
  // 一条规则：事件 + 未完成任务（今天再加延续任务），标题计数、日卡点、月历点都用它
  function openCount(d) {
    return S.getEventsForDate(d).filter(e => !e.completed).length + (diff(d, today()) === 0 ? overdue().length : 0);
  }
  const pips = d => { const n = Math.min(3, openCount(d)); return n ? `<span class="cg-pips">${"<i></i>".repeat(n)}</span>` : ""; };

  // 日程行：事件按服务顺序 → 延续任务 → 当天任务 → 常驻 + ADD TASK；底部固定一行"无日历"提示
  function rowsFor(d) {
    const all = S.getEventsForDate(d);
    return [...all.filter(e => !isTask(e)).map(e => ({ k: "ev", e })),
      ...(diff(d, today()) === 0 ? overdue() : []),
      ...all.filter(isTask).map(e => ({ k: "task", e })), { k: "add" }];
  }
  function note() {
    if (S.calendarAvailable) return null;
    const b = [];
    if (S.dankBinaryExists && !S.dankConnected) b.push(["launch", "LAUNCH"]);
    if (S.khalInstalled || S.dankBinaryExists) b.push(["setup", "SET UP"]);
    return { k: "note", b };
  }
  const CAP = 6;
  function pageInfo(L, nt) {
    const cap = CAP - (nt ? 1 : 0), P = L.length <= cap ? cap : cap - 1;
    const r = Math.min(row, L.length - 1), pg = Math.floor(Math.max(0, r) / P);
    return { P, pg, from: pg * P, to: Math.min(L.length, pg * P + P), more: Math.max(0, L.length - (pg + 1) * P) };
  }

  // ---------- 标题 ----------
  function monthLabel() {
    if (view === "month") return String(mc.getFullYear());
    const a = weekStart(sel), b = addDays(a, 6);
    if (a.getMonth() === b.getMonth()) return `${mon3(sel)} ${sel.getFullYear()}`;
    return a.getFullYear() === b.getFullYear() ? `${mon3(a)}–${mon3(b)} ${b.getFullYear()}`
      : `${mon3(a)} ${a.getFullYear()}–${mon3(b)} ${b.getFullYear()}`;
  }
  function rel(d) {
    const off = diff(d, today());
    return off === 0 ? "" : off === 1 ? "TOMORROW" : off === -1 ? "YESTERDAY" : off > 0 ? `+${off} DAYS` : `${off} DAYS`;
  }
  function updHead() {
    const d = view === "month" ? mc : sel, h = root.querySelector(".pn-head");
    h.querySelector(".s").textContent = monthLabel();
    h.querySelector(".cg-rel").textContent = rel(d);
    const n = openCount(d), cn = h.querySelector(".cg-cn");
    cn.hidden = !n;
    if (n) P3.countUp(cn.querySelector("b"), n, { from: prevOpen, dur: 500 });
    prevOpen = n;
  }

  // ---------- 日卡条 ----------
  function stripHTML() {
    const t = today(), w0 = weekStart(sel);
    let h = "";
    for (let k = 0; k < 7; k++) {
      const d = addDays(w0, k), off = diff(d, t);
      h += `<div class="cg-card${off < 0 ? " past" : ""}${off === 0 ? " today" : ""}" data-t="${+d}">` +
        `<span class="l wd">${off === 0 ? "TODAY" : WD[d.getDay()]}</span>` +
        (d.getDate() === 1 ? `<span class="l mo">${mon3(d)}</span>` : "") +
        `<span class="d dn">${d.getDate()}</span>${pips(d)}</div>`;
    }
    return h;
  }
  function renderStrip(anim) {
    const strip = body.querySelector(".cg-strip");
    strip.querySelectorAll(".cg-card").forEach(c => c.remove());
    strip.insertAdjacentHTML("beforeend", stripHTML());
    if (anim) P3.stagger(strip, ".cg-card");
    markStrip();
  }
  function markStrip() {
    const strip = body.querySelector(".cg-strip"), t = String(+sel);
    let hit = null;
    strip.querySelectorAll(".cg-card").forEach(c => {
      const on = c.dataset.t === t; if (on) hit = c;
      c.classList.toggle("sel", on && focus === "strip");
      c.classList.toggle("cur", on && focus !== "strip"); // 焦点在日程里：选中日只留一条不斜的底边
    });
    P3.slideSel(strip, focus === "strip" ? hit : null);
  }

  // ---------- 日程 ----------
  function timeCol(r) {
    const e = r.e;
    if (r.k === "task") return `<span class="cg-tm"><span class="cg-ck${e.completed ? " on" : ""}"></span></span>`;
    if (e.isMultiDay) {
      const { a, b } = span(e, sel), first = +a === +sel;
      const top = first ? `→ ${md(b)}` : `${md(a)} →`;
      const sub = e.allDay ? "ALL DAY" : first ? hm(e.start) : "";
      return `<span class="cg-tm"><span class="l tl">${top}</span>${sub ? `<span class="l ts">${sub}</span>` : ""}</span>`;
    }
    if (e.allDay) return `<span class="cg-tm"><span class="l tl">ALL DAY</span></span>`;
    return `<span class="cg-tm"><span class="d t1">${hm(e.start)}</span><span class="d t2">${hm(e.end)}</span></span>`;
  }
  function rowHTML(r, i, on) {
    const a = `class="cg-r cg-${r.k}${on ? " sel" : ""}${r.e?.completed ? " done" : ""}" data-r="${i}"`;
    if (r.k === "add") {
      if (editing) return `<div ${a}><span class="cg-tm"><span class="l tl cg-plus">+</span></span>` +
        `<input class="zh cg-in" maxlength="80" placeholder="新任务" value="${esc(draft)}"></div>`;
      return `<div ${a}><span class="cg-tm"><span class="l tl cg-plus">+</span></span><span class="l nm cg-addl">ADD TASK</span></div>`;
    }
    const e = r.e;
    let v = "";
    if (r.k === "ev") {
      if (isUrlLoc(e)) v = `<span class="l chip cg-link" data-link>LINK</span>`;
      else if (e.location) v = `<span class="zh v">${esc(e.location)}</span>`;
    } else {
      if (r.from) v = `<span class="l v">FROM ${md(r.from)}</span>`;
      else if (!canModify(e)) v = `<span class="l v">READ ONLY</span>`;
      if (on && canModify(e)) v += `<span class="l chip cg-del" data-del>DEL</span>`;
    }
    return `<div ${a}>${timeCol(r)}<span class="zh nm">${esc(e.title)}</span>${v}</div>`;
  }
  function noteHTML(nt, on, i) {
    return `<div class="cg-note${on ? " sel" : ""}"${nt.b.length ? ` data-r="${i}"` : ""}>` +
      `<span class="l nl">NO CALENDAR</span><span class="zh nz">${S.dankBinaryExists ? "DankCalendar 未连接" : S.khalInstalled ? "khal 已安装，未启用" : "未安装 khal / DankCalendar"}</span>` +
      nt.b.map(([id, t], k) => `<span class="l btn${k === 0 ? " pri" : ""}" data-act="${id}">${t}</span>`).join("") + `</div>`;
  }
  let L = [], NT = null;
  function renderAgenda(anim) {
    L = rowsFor(sel); NT = note();
    const nIdx = NT && NT.b.length ? L.length : -1, maxRow = nIdx >= 0 ? nIdx : L.length - 1;
    row = Math.min(row, maxRow);
    const pi = pageInfo(L, NT), list = [];
    const t = today(), isToday = diff(sel, t) === 0, now = new Date();
    const evs = L.filter(r => r.k === "ev"), timed = evs.some(r => !r.e.allDay);
    let nowAt = -1;
    if (isToday && timed) {
      const i = L.findIndex(r => r.k === "ev" && !r.e.allDay && r.e.start > now);
      nowAt = i >= 0 ? i : L.lastIndexOf(evs[evs.length - 1]) + 1;
    }
    if (S.calendarAvailable && S.isLoading && !evs.length && pi.pg === 0)
      list.push(`<div class="cg-r cg-ld"><span class="cg-tm"></span><span class="l nm">LOADING</span></div>`);
    for (let i = pi.from; i < pi.to; i++) {
      if (i === nowAt) list.push(`<div class="cg-now"><span class="l">NOW ${hm(now)}</span></div>`);
      list.push(rowHTML(L[i], i, focus === "agenda" && i === row));
    }
    if (nowAt === pi.to && nowAt < L.length) list.push(`<div class="cg-now"><span class="l">NOW ${hm(now)}</span></div>`);
    if (pi.more) list.push(`<div class="cg-more" data-more><span class="l">+${pi.more} MORE</span></div>`);
    const free = S.calendarAvailable && !S.isLoading && L.length === 1;
    const ag = body.querySelector(".cg-agenda");
    ag.querySelector(".cg-ah").innerHTML = `<span class="d cg-wdn">${WDF[sel.getDay()]}</span><span class="d cg-md">${md(sel)}</span>` +
      (free ? `<span class="d cg-free">FREE</span>` : "") + (pi.pg ? `<span class="l cg-pg">PAGE ${pi.pg + 1}</span>` : "");
    const lst = ag.querySelector(".cg-list"), keep = lst.querySelector(":scope > .p3-hl");
    lst.innerHTML = list.join("");
    if (keep && !anim) lst.prepend(keep); // 保住旧楔子，slideSel 才是滑过去而不是瞬移
    ag.querySelector(".cg-foot").innerHTML = NT ? noteHTML(NT, focus === "agenda" && row === nIdx, nIdx) : "";
    if (anim) P3.stagger(lst, ".cg-r, .cg-more");
    markAgenda();
    if (editing) {
      const inp = lst.querySelector(".cg-in");
      bindInput(inp);
      inp.focus(); inp.setSelectionRange(draft.length, draft.length);
    }
  }
  function markAgenda() {
    const lst = body.querySelector(".cg-list"), foot = body.querySelector(".cg-foot");
    const tgt = focus === "agenda" ? (lst.querySelector(".cg-r.sel") || null) : null;
    P3.slideSel(lst, tgt);
    foot.querySelector(".cg-note")?.classList.toggle("sel", focus === "agenda" && row === L.length);
  }
  // 行选中变化：翻页时错峰重建，同页只重画、楔子滑过去
  function setRow(n) {
    if (n < 0) { focusStrip(); return; }
    const maxRow = NT && NT.b.length ? L.length : L.length - 1;
    n = Math.min(n, maxRow);
    if (n === row) return;
    const before = pageInfo(L, NT).pg;
    row = n;
    renderAgenda(pageInfo(L, NT).pg !== before);
    hints();
  }
  function focusStrip() { focus = "strip"; row = 0; editing = false; renderAgenda(false); markStrip(); hints(); }
  function focusAgenda(n = 0) { focus = "agenda"; row = n; markStrip(); renderAgenda(false); hints(); }

  // ---------- 选日 ----------
  function setSel(d, opt = {}) {
    d = day0(d);
    const prev = sel, weekChanged = +weekStart(prev) !== +weekStart(d);
    sel = d; editing = false;
    if (focus === "agenda") row = 0;
    ensureLoaded(d);
    if (weekChanged) renderStrip(true); else markStrip();
    renderAgenda(+prev !== +d || opt.force);
    updHead(); hints();
  }
  // 数据窗：选中日所在月的 6×7 格 ±7 天；只有选中日离开窗口时才重新 loadEvents，200ms 防抖
  function ensureLoaded(d) {
    const w = S.loaded;
    if (w && d >= w.s && d <= w.e) return;
    const g0 = weekStart(new Date(d.getFullYear(), d.getMonth(), 1)), a = addDays(g0, -7), b = addDays(g0, 48);
    clearTimeout(loadT);
    if (P3.STATIC) S.loadEvents(a, b); else loadT = setTimeout(() => S.loadEvents(a, b), 200);
  }
  // ---------- 视图互切（同 APPS：body.out 退场 → 重建） ----------
  function swap(build) {
    clearTimeout(swapT);
    if (P3.STATIC) { build(); return; }
    body.classList.add("out");
    swapT = setTimeout(() => { swapT = 0; if (!body) return; body.classList.remove("out"); build(); }, 160);
  }
  function showDay(anim) {
    view = "day"; detailEv = null;
    body.className = "cg-body";
    body.innerHTML = `<div class="cg-strip"></div><div class="box cg-agenda"><div class="cg-ah"></div><div class="cg-list"></div><div class="cg-foot"></div></div>`;
    renderStrip(anim);
    if (anim) P3.stagger(body, ":scope > .box");
    renderAgenda(anim);
    updHead(); hints();
  }
  function backToDay() { editing = false; swap(() => showDay(true)); }

  // ---------- 事件详情子页面 ----------
  function rangeText(e) {
    const f = d => `${WD[d.getDay()]} ${md(d)}`;
    if (e.isMultiDay) {
      const { a, b } = span(e, sel);
      return `${f(a)}${e.allDay ? "" : " " + hm(e.start)} → ${f(b)}${e.allDay ? " · ALL DAY" : ""}`;
    }
    return e.allDay ? `${f(sel)} · ALL DAY` : `${f(sel)} ${hm(e.start)} → ${hm(e.end)}`;
  }
  function showDetail() {
    view = "detail";
    const e = detailEv, u = quickUrl(e), loc = isUrlLoc(e) ? "" : e.location;
    body.className = "cg-body";
    body.innerHTML = `<div class="box cg-det">` +
      `<div class="zh cg-dt">${esc(e.title)}</div>` +
      `<div class="l cg-dr">${rangeText(e)}</div>` +
      (loc ? `<div class="zh cg-dl">${esc(loc)}</div>` : "") +
      (e.description ? `<div class="zh cg-dd">${esc(e.description)}</div>` : "") +
      `<div class="cg-dc">` +
      (e.calendar ? `<span class="l chip ghost">${esc(e.calendar)}</span>` : "") +
      (e.status === "tentative" ? `<span class="l chip ghost">TENTATIVE</span>` : "") +
      (e.attendees?.length ? `<span class="l chip ghost">${e.attendees.length} PEOPLE</span>` : "") +
      (u ? `<span class="l chip cg-dlk" data-link>LINK · ${esc(u.replace(/^https?:\/\//i, "").slice(0, 34))}</span>` : "") +
      `</div><div class="l ap-back cg-back" data-back>← DAY</div></div>`;
    P3.stagger(body.firstChild, ":scope > *");
    hints();
  }
  function openDetail(e) { detailEv = e; editing = false; swap(showDetail); }

  // ---------- 月历 ----------
  function monthHTML() {
    const t = today(), m = mc.getMonth(), g0 = weekStart(new Date(mc.getFullYear(), m, 1));
    let h = "";
    for (let k = 0; k < 42; k++) {
      const d = addDays(g0, k), out = d.getMonth() !== m, off = diff(d, t);
      h += `<div class="cg-c${out ? " out" : ""}${off === 0 ? " today" : ""}" data-t="${+d}"><b class="d">${d.getDate()}</b>${pips(d)}</div>`;
    }
    return h;
  }
  function showMonth(anim) {
    view = "month";
    body.className = "cg-body";
    body.innerHTML = `<div class="box cg-month"><div class="cg-mh"><span class="d cg-mn">${MON[mc.getMonth()]}</span>` +
      `<span class="l ap-back cg-back" data-back>← WEEK</span></div>` +
      `<div class="l cg-wds">${["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(w => `<span>${w}</span>`).join("")}</div>` +
      `<div class="cg-grid">${monthHTML()}</div></div>`;
    if (anim) P3.stagger(body.firstChild, ".cg-mh, .cg-wds, .cg-c");
    markMonth();
    updHead(); hints();
  }
  function markMonth() {
    const g = body.querySelector(".cg-grid"), t = String(+mc);
    let hit = null;
    g.querySelectorAll(".cg-c").forEach(c => { const on = c.dataset.t === t; c.classList.toggle("sel", on); if (on) hit = c; });
    P3.slideSel(g, hit);
  }
  function setMc(d, flash) {
    d = day0(d);
    const sameMonth = d.getMonth() === mc.getMonth() && d.getFullYear() === mc.getFullYear();
    mc = d;
    ensureLoaded(d);
    if (sameMonth) { markMonth(); updHead(); return; }
    const g = body.querySelector(".cg-grid");
    g.querySelectorAll(".cg-c").forEach(c => c.remove());
    g.insertAdjacentHTML("beforeend", monthHTML());
    body.querySelector(".cg-mn").textContent = MON[mc.getMonth()];
    P3.stagger(g, ".cg-c");
    markMonth(); updHead();
    if (flash) P3.flash(`${MON[mc.getMonth()]} ${mc.getFullYear()}`);
  }
  function addMonths(d, n) {
    const y = d.getFullYear(), m = d.getMonth() + n, last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(d.getDate(), last));
  }
  function openMonth() { mc = sel; editing = false; swap(() => showMonth(true)); }
  function pickMonth(d) { sel = day0(d); focus = "strip"; row = 0; ensureLoaded(sel); swap(() => showDay(true)); }

  // ---------- 行动作 ----------
  const curRow = () => (view === "day" && focus === "agenda") ? (row === L.length ? NT : L[row]) : null;
  function refreshAll() { renderStrip(false); renderAgenda(false); updHead(); hints(); }
  function toggle(r) {
    if (!canModify(r.e)) { P3.flash("READ ONLY"); return; }
    S.toggleTask(r.e.id);
    P3.flash(r.e.completed ? "TASK REOPENED" : "TASK DONE");
    // 延续任务勾掉后会离开列表：选中留在原位
    refreshAll();
  }
  function remove(r) {
    if (!canModify(r.e)) { P3.flash("READ ONLY"); return; }
    S.removeTask(r.e.id);
    P3.flash("TASK REMOVED");
    refreshAll();
  }
  function openLink(r) {
    const u = r && r.k === "ev" ? quickUrl(r.e) : view === "detail" ? quickUrl(detailEv) : "";
    if (u) P3.flash("OPEN LINK");
  }
  function act(id) {
    if (id === "setup") { P3.close(); P3.flash("SETTINGS · TIME & WEATHER"); }
    else if (id === "launch") P3.flash("LAUNCH DANKCALENDAR");
  }
  function activate(r) {
    if (!r) return;
    if (r.k === "ev") { if (hasDetail(r.e)) openDetail(r.e); }
    else if (r.k === "task") toggle(r);
    else if (r.k === "add") startEdit();
    else if (r.k === "note" && r.b.length) act(r.b[0][0]);
  }

  // ---------- 加任务输入框 ----------
  function startEdit(text = "") {
    if (view !== "day") return;
    editing = true; draft = text; focus = "agenda";
    L = rowsFor(sel); row = L.length - 1;
    markStrip(); renderAgenda(false); hints();
  }
  function cancelEdit() { if (!editing) return; editing = false; draft = ""; renderAgenda(false); hints(); }
  function save() {
    const text = draft.trim();
    if (!text) { cancelEdit(); return; }
    editing = false; draft = "";
    const d = sel;
    if (S.dankConnected) P3.flash("ADDING TASK");
    S.addTaskForDate(d, text, ok => {
      if (!root || view !== "day") return;
      P3.flash(ok ? "TASK ADDED" : "SAVE FAILED");
      if (+d === +sel) { L = rowsFor(sel); const i = L.findIndex(r => r.k === "task" && r.e.title === text); if (i >= 0) row = i; }
      refreshAll();
    });
    renderAgenda(false); hints();
  }
  function bindInput(inp) {
    inp.addEventListener("input", () => { draft = inp.value; });
    inp.addEventListener("mousedown", e => e.stopPropagation());
  }
  // 捕获阶段先于外壳：输入框拿走全部按键；子页面 / 月历里 Esc、Backspace 先返回面板
  function capture(e) {
    if (!root) return;
    if (editing && e.target.classList?.contains("cg-in")) {
      e.stopImmediatePropagation();
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") { e.preventDefault(); save(); }
      else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
      return;
    }
    if (editing) { e.stopImmediatePropagation(); e.preventDefault(); if (e.key === "Escape") cancelEdit(); return; }
    if ((e.key === "Escape" || e.key === "Backspace") && view !== "day") {
      e.stopImmediatePropagation(); e.preventDefault();
      if (!swapT) backToDay();
    }
  }

  // ---------- 键位提示（外壳只在开 / 关时写 #keys，这里按焦点就地改） ----------
  function hints() {
    const k = keysEl();
    if (!k || !root) return;
    let h;
    if (editing) h = [["ENTER", "保存"], ["ESC", "取消"]];
    else if (view === "month") h = [["←→↑↓", "日期"], ["PGUP/PGDN", "月份"], ["ENTER", "打开"], ["T", "今天"], ["M", "返回"], ["ESC", "返回"]];
    else if (view === "detail") h = [...(quickUrl(detailEv) ? [["O", "链接"]] : []), ["ESC", "返回"]];
    else if (focus === "strip") h = [["←→", "日期"], ["PGUP/PGDN", "周"], ["↓", "日程"], ["M", "月历"], ["T", "今天"], ["N", "任务"], ["ESC", "关闭"]];
    else {
      const r = curRow();
      h = [["↑↓", "选择"]];
      if (r?.k === "ev" && hasDetail(r.e)) h.push(["ENTER", "详情"]);
      if (r?.k === "task" && canModify(r.e)) h.push(["ENTER", "勾选"], ["X", "删除"]);
      if (r?.k === "add") h.push(["ENTER", "添加"]);
      if (r?.k === "note") h.push(["ENTER", r.b[0][1] === "LAUNCH" ? "启动" : "设置"]);
      if (r?.k === "ev" && quickUrl(r.e)) h.push(["O", "链接"]);
      h.push(["N", "任务"], ["ESC", "关闭"]);
    }
    k.innerHTML = h.map(([a, b]) => `<span><kbd>${a}</kbd><span class="zh">${b}</span></span>`).join("");
  }

  // ---------- 键盘 ----------
  function key(e) {
    const k = e.key, K = k.length === 1 ? k.toLowerCase() : k;
    if (swapT || editing) { e.preventDefault(); return; }
    if (view === "detail") {
      if (k === "ArrowLeft" || k === "Enter") backToDay();
      else if (K === "o") openLink();
      else return;
      e.preventDefault(); return;
    }
    if (view === "month") {
      const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[k];
      if (mv) setMc(addDays(mc, mv), true);
      else if (k === "PageUp" || k === "[") setMc(addMonths(mc, -1), true);
      else if (k === "PageDown" || k === "]") setMc(addMonths(mc, 1), true);
      else if (K === "t") { setMc(today(), false); P3.flash("TODAY"); }
      else if (k === "Enter" || k === " ") pickMonth(mc);
      else if (K === "m") backToDay();
      else return;
      e.preventDefault(); return;
    }
    if (k === "ArrowLeft") setSel(addDays(sel, -1));
    else if (k === "ArrowRight") setSel(addDays(sel, 1));
    else if (k === "PageUp") setSel(addDays(sel, -7));
    else if (k === "PageDown") setSel(addDays(sel, 7));
    else if (K === "t") { focus = "strip"; setSel(today(), { force: true }); P3.flash("TODAY"); }
    else if (K === "m") openMonth();
    else if (K === "n") startEdit();
    else if (focus === "strip") {
      if (k === "ArrowDown" || k === "Enter") focusAgenda(0);
      else return;
    } else {
      const r = curRow();
      if (k === "ArrowDown") setRow(row + 1);
      else if (k === "ArrowUp") setRow(row - 1);
      else if (k === "Enter") activate(r);
      else if (k === " ") { if (r?.k === "task") toggle(r); }
      else if (K === "o") openLink(r);
      else if (K === "x" || k === "Delete") { if (r?.k === "task") remove(r); }
      else return;
    }
    e.preventDefault();
  }

  // ---------- 鼠标 ----------
  function bindMouse() {
    root.addEventListener("mousedown", e => { if (editing && !e.target.closest(".cg-in")) cancelEdit(); });
    root.addEventListener("mouseover", e => {
      if (swapT || editing || view !== "day") return;
      const r = e.target.closest("[data-r]");
      if (!r) return;
      const n = +r.dataset.r;
      if (focus !== "agenda") { focus = "agenda"; row = n; markStrip(); renderAgenda(false); hints(); }
      else setRow(n);
    });
    root.addEventListener("click", e => {
      if (swapT) return;
      const t = e.target;
      if (t.closest("[data-month]")) return view === "month" ? backToDay() : view === "day" ? openMonth() : null;
      if (t.closest("[data-back]")) return backToDay();
      if (view === "detail") { if (t.closest("[data-link]")) openLink(); return; }
      if (view === "month") { const c = t.closest(".cg-c"); if (c) pickMonth(new Date(+c.dataset.t)); return; }
      const a = t.closest("[data-act]"); if (a) return act(a.dataset.act);
      if (t.closest("[data-more]")) { const pi = pageInfo(L, NT); focus = "agenda"; return setRow(Math.min(L.length - 1, pi.from + pi.P)); }
      const card = t.closest(".cg-card");
      if (card) { focus = "strip"; return setSel(new Date(+card.dataset.t)); }
      const rEl = t.closest(".cg-r");
      if (!rEl) return;
      const r = L[+rEl.dataset.r];
      if (t.closest("[data-link]")) return openLink(r);
      if (t.closest("[data-del]")) return remove(r);
      activate(r);
    });
    root.addEventListener("wheel", e => {
      if (view !== "day" || editing || !e.target.closest(".cg-strip")) return;
      e.preventDefault();
      const now = performance.now();
      if (now < wheelT) return;
      wheelT = now + 140;
      setSel(addDays(sel, 7 * Math.sign(e.deltaY)));
    }, { passive: false });
  }

  // ---------- 时钟：跨过午夜时今天跟着走；看今天时每 30 秒刷新 NOW 线 ----------
  function tick() {
    if (!root || view !== "day" || editing) return;
    const k = keyOf(today());
    if (k !== todayK) { todayK = k; renderStrip(false); renderAgenda(false); updHead(); }
    else if (diff(sel, today()) === 0) renderAgenda(false);
  }

  P3.register("calendar", {
    title: "CALENDAR",
    sub: "月历与日程",
    keys: [["←→", "日期"], ["↓", "日程"], ["M", "月历"], ["T", "今天"], ["N", "任务"]],
    mount(el) {
      // 每次打开都回到今天的日视图，焦点在日卡条
      const qd = q.get("date"), dm = qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) ? fromKey(qd) : null;
      sel = dm || today(); todayK = keyOf(today());
      focus = "strip"; row = 0; view = "day"; editing = false; draft = ""; prevOpen = 0; S.loaded = null;
      ensureLoaded(sel);
      root = document.createElement("div");
      root.className = "cg";
      root.innerHTML = `<div class="pn-head"><span class="d t">CALENDAR</span><span class="l s cg-mon" data-month></span>` +
        `<span class="l cg-rel"></span><span class="cg-cn" hidden><b class="d">0</b><span class="l">OPEN</span></span></div>` +
        `<div class="cg-body"></div>`;
      el.appendChild(root);
      body = root.lastChild;
      showDay(true);
      const hl = body.querySelector(".cg-strip > .p3-hl");
      if (hl) { hl.style.setProperty("--i", 8); hl.classList.add("st"); }
      if (q.get("focus") === "agenda") focusAgenda(+(q.get("row") || 0));
      if (q.has("detail")) { const r = L[+q.get("detail")]; if (r?.k === "ev") { detailEv = r.e; showDetail(); } }
      else if (q.get("view") === "month") { mc = sel; showMonth(false); }
      else if (q.has("add")) startEdit(q.get("add"));
      bindMouse();
      addEventListener("keydown", capture, true);
      timer = setInterval(tick, 30000);
      queueMicrotask(hints); // 外壳在 mount 之后才写 #keys
    },
    unmount() {
      clearInterval(timer); clearTimeout(swapT); clearTimeout(loadT); swapT = 0;
      removeEventListener("keydown", capture, true);
      root?.querySelectorAll(".cg-cn b").forEach(n => cancelAnimationFrame(n._p3cu));
      root = body = null; editing = false; view = "day";
    },
    key,
  });
})();
