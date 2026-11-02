// APPS 面板：顶栏托盘（StatusNotifierItem）的替代品。托盘移出顶栏后，这里是托盘项唯一的入口
//
// 数据：本机 StatusNotifierWatcher 的注册顺序快照 + 各项 dbusmenu GetLayout 快照（2026-10，原样标签）
//   QML 端：SystemTray.items，只按 DMS_HIDE_TRAYIDS 环境变量过滤（SystemTrayBar.qml:30-42），
//   按 SessionData.trayItemOrder + getTrayItemKey 排序（:44-60, :180-196）。
//   不按 SessionData.isHiddenTrayId 过滤：DMS 里它只是把项挪进溢出弹层，不是删除；
//   托盘移出顶栏后"在栏里隐藏"没有意义，隐藏 / 排序冻结在 session.json 当前值（现在都为空），这是接受的取舍
//   名字：title → tooltipTitle 首行 → 本地别名 → id（DMS 用 tooltipTitle||id，会把 Fcitx 叫成 "Rime"）
//   状态行：tooltipTitle / tooltipDescription 里第一条与名字不同的非空行，去 HTML，原样显示，按宽度省略
//   图标：原型离线，一律用字母徽兜底；QML 端用 item.icon（含 ?path= / file:// 改写，:72-94），加载失败才用字母徽
//   NeedsAttention：磁贴右上角红碎片，无数字（SNI 没有计数字段）；QQ/飞书是否真的会发这个状态未验证
//   Passive：磁贴变暗，位置不变（DMS 也不按 status 排序，位置稳定方便记忆）
//
// 操作（磁贴）：Enter / Space / 左键 = activate() 并关闭 P3 菜单；onlyMenu 项改为打开菜单，onlyMenu 且无菜单则什么都不做
//   M / ContextMenu / 右键 = 托盘菜单子页面（hasMenu）；无菜单 → flash "NO MENU"
//   中键 = secondaryActivate()（只有鼠标入口，键盘不绑定）。悬停即选中
//   ←→ 线性移动（越过页尾 / 页首翻页，末页回到首页），↑↓ 页内按列循环，PgUp/PgDn 或滚轮翻页（多于 6 项时）
// 操作（子页面）：↑↓ / 滚轮 在可用行间移动（跳过分隔线与禁用行）；→ / Enter 进入子菜单
//   Enter / Space / 点击：勾选 / 单选行、会被应用改名的开关行（Fcitx 英标 等）与选项子菜单里的项 triggered() 后留在本页、原地刷新；
//   其他普通动作 triggered() 后关闭 P3 菜单（同 DMS）；退出类标签 → 托盘项注销、回网格
//   ← / M / ContextMenu / 右键 / 返回块 / Esc / Backspace = 上一级；在网格里 Esc 才关闭面板
//   （Esc / Backspace 由本面板在 window 捕获阶段先截获，外壳不用改）
//
// dbusmenu 映射：isSeparator → 16px 分隔线；buttonType 1 → 这一层过半是勾选框时画勾号（选项表，互斥），否则画 .tg 开关；
//   buttonType 2 → 单选菱形（只有 Fcitx 的键盘 / Rime）；hasChildren → "→"；enabled=false → 变暗、键盘跳过；
//   标签 /^(quit|exit|退出)/i → 红字（dbusmenu 没有危险标记，只能按标签猜）。QsMenuEntry.icon 不画：这些快照里没有一项带图标
// 子菜单水合（QML 端必须做）：push 条目 → opener.updateLayout() → 用 QsMenuAnchor 打开再关闭一次，
//   让应用收到 AboutToShow 才会填 children（SystemTrayBar.qml:1601-1616, 1879-1882）。children 为空时显示一行暗的
//   LOADING，没等到就显示 EMPTY。触发后应用可能整棵重建菜单（Clash 会）：按父级标签文字从根重新解析路径，
//   文字对不上时退回同位置的子菜单项，再对不上就退到最深的可解析层并 flash；托盘项注销时退回网格并 flash
//
// URL 参数（都可与 ?static、?theme=lavender 叠加）：
//   ?open=apps                    打开本面板
//   ?menu=<项>                    直接打开某项的托盘菜单；<项> = 序号(1 起) / 简称 magpie fcitx clash sunshine feishu qq / 完整 key
//   ?path=<标签>/<标签>            配合 ?menu 直接进入子菜单，按子串匹配每级标签，例：?menu=clash&path=代理/节点选择
//   ?msel=N                       子页面初始选中第 N 个可用行（1 起）；网格用 ?tile=N
//   ?n=0 | 1..6 | 8               托盘项数量：0 = 空状态 NO TRAY，8 = 加两项评审用假数据，出现翻页器
//   ?page=2                       初始页
//   ?attn=<项>[,<项>]              预览 NeedsAttention 红碎片        ?passive=<项>   预览 Passive 变暗
//   ?nomenu=<项>                  该项 hasMenu=false                ?onlymenu=<项>  该项 onlyMenu=true
//   ?loading=1                    未抓到的子菜单停在 LOADING（默认短暂 LOADING 后 EMPTY）
//   ?vanish=<项>                  1.5 秒后该项注销（演示子页面退回网格；?static 下不触发）
(() => {
  const q = new URLSearchParams(location.search);
  const PER = 6, COLS = 3;

  // ---------- 菜单条目构造 ----------
  // e(text, {bt, on, off(禁用)}), sub(text, kids)；kids 为 null = 快照里没抓到，走水合空状态
  const SEP = { sep: true };
  const e = (t, o = {}) => ({ t, bt: o.bt || 0, on: !!o.on, en: !o.off });
  const ck = (t, on) => e(t, { bt: 1, on });
  const rd = (t, on) => e(t, { bt: 2, on });
  const sub = (t, kids) => ({ t, bt: 0, en: true, kids });

  const ITEMS = [
    { key: "magpie", alias: "magpie", id: "magpie", title: "",
      tip: "magpie\nToday: 469M tokens (283M in · 4.1M out · 182M cached) / ≈$1248+ · 5214 requests", mono: "MG",
      menu: [e("打开 magpie"), SEP, e("版本 0.1.2121", { off: true }), e("重启以更新到 0.1.2168"), e("退出 magpie")] },
    { key: "Fcitx", alias: "fcitx", id: "Fcitx", title: "Input Method", tip: "Rime", mono: "IM",
      menu: [rd("Keyboard - English (US)"), rd("Rime", true), SEP,
        sub("万象拼音", [e("Latin Mode"), e("万象拼音"), e("雾凇拼音"), SEP, e("Deploy"), e("Synchronize")]),
        e("英标"), e("半角"), e("表情关"), e("翻译关"), e("上下文关"),
        sub("原编码", [e("原编码"), e("有声调"), e("无声调")]),
        sub("简体", [e("简体"), e("通繁"), e("港繁"), e("臺繁")]),
        e("简码开"),
        sub("注释关", null), // 3 个子项，快照没抓到
        e("提示关"), e("大字集"), e("词组先"), e("英文开"), SEP,
        e("Restart"), e("Input Method Settings"), e("Exit")] },
    { key: "tray-icon tray app clash-verge-rev-tray", alias: "clash", id: "tray-icon tray app clash-verge-rev-tray",
      title: "clash-verge", tip: "", mono: "CV",
      menu: [e("仪表板"), SEP,
        sub("出站模式 (规则)", [ck("规则模式", true), ck("全局模式"), ck("直连模式")]), SEP,
        sub("订阅", [ck("clash.yaml"), ck("clash.yaml"), ck("clash.yaml"), ck("clash.yaml", true)]),
        sub("代理", [
          sub("🚀 节点选择", [e("测试延迟"), SEP, ck("🇭🇰 香港 | 103ms"), ck("🇹🇼 台湾 | 128ms"), ck("🇯🇵 日本 | 103ms"),
            ck("🇺🇸 美国 | 159ms"), ck("🇩🇪 德国备用 | T/O"), ck("♻️ 自动选择 | 103ms", true), ck("DIRECT | -ms")]),
          sub("🇭🇰 香港", [ck("ZOUTER-HK-TMP-v6 | 103ms", true), ck("LEC-ZOUTER-HK-v6 | 107ms"), ck("ZOUTER-HK-TMP | T/O")]),
          // 以下分组的子项快照没抓到
          sub("🇹🇼 台湾", null), sub("🇯🇵 日本", null), sub("🇺🇸 美国", null), sub("🇩🇪 德国备用", null),
          sub("♻️ 自动选择", null), sub("AI", null), sub("国内", null)]),
        SEP, ck("系统代理"), ck("TUN 模式", true), SEP, ck("轻量模式"),
        sub("打开目录", [e("配置目录"), e("内核目录"), e("日志目录"), e("应用日志"), e("内核日志")]),
        sub("更多", [e("复制环境变量"), e("关闭所有连接"), e("重启 Clash 内核"), e("重启应用"), e("Verge 版本 2.5.8")]),
        SEP, e("退出")] },
    { key: "Sunshine", alias: "sunshine", id: "Sunshine", title: "Sunshine", tip: "Sunshine", mono: "SU",
      menu: [e("Open Sunshine"), SEP, sub("Donate", [e("GitHub Sponsors"), e("Patreon"), e("PayPal")]), SEP,
        e("Restart"), e("Quit")] },
    { key: "lark_status_icon_1", alias: "feishu", id: "lark_status_icon_1", title: "", tip: "飞书", mono: "飞",
      menu: [e("打开飞书"), e("退出飞书")] },
    { key: "chrome_status_icon_1", alias: "qq", id: "chrome_status_icon_1", title: "", tip: "", mono: "QQ",
      menu: [e("显示"), sub("状态", [ck("在线", true), ck("离开"), ck("隐身"), SEP, ck("离线")]), e("退出 QQ"), e("关于")] },
  ];
  // ?n=8 评审用的两项假数据（本机没有运行），只为演示翻页
  const EXTRA = [
    { key: "steam", alias: "steam", id: "steam", title: "Steam", tip: "", mono: "ST",
      menu: [e("Library"), e("Store"), SEP, e("Exit Steam")] },
    { key: "nm-applet", alias: "nm", id: "nm-applet", title: "", tip: "Network\nWired connection 1", mono: "NM",
      menu: [ck("Enable Networking", true), SEP, e("Edit Connections…")] },
  ];
  // 本地别名（不是 DMS 数据）：QQ 什么名字都不暴露。尽力而为：只在 title 与 tooltip 都为空、key 完全相同时生效；
  // 其他 Chromium/Electron 应用也可能注册成 chrome_status_icon_1，QQ 后启动则会变成 ::1 而失去别名
  const ALIAS = { chrome_status_icon_1: "QQ" };

  // ---------- 派生字段 ----------
  const lines = s => String(s || "").replace(/<[^>]*>/g, "").split("\n").map(x => x.trim()).filter(Boolean);
  const nameOf = it => it.title || lines(it.tip)[0] || (!it.title && !it.tip && ALIAS[it.key]) || it.id;
  const statusOf = it => lines(it.tip).concat(lines(it.desc)).find(x => x !== nameOf(it)) || "";
  const CJK = /[⺀-鿿가-힯＀-￯]|\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
  const face = (s, latin) => CJK.test(s) ? "zh" : latin; // 中文 / emoji 用 .zh，拉丁用 .d 或 .l
  const DANGER = /^(quit|exit|退出)/i;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = v => String(v).padStart(2, "0");

  // 原地改名模拟：Fcitx 的 Rime 开关行 / 选项子菜单、Clash 的出站模式在 triggered() 后由应用重写标签（下列"另一态"为推测）
  const FLIP = { 英标: "中标", 半角: "全角", 表情关: "表情开", 翻译关: "翻译开", 上下文关: "上下文开", 简码开: "简码关",
    提示关: "提示开", 大字集: "常用字", 词组先: "单字先", 英文开: "英文关" };
  for (const [a, b] of Object.entries(FLIP)) FLIP[b] = a;
  // 子菜单里选一项后父级标签跟着变（Fcitx 原编码 / 简体 / 万象拼音；Clash 出站模式），用来演示"按文字重解析路径"
  const PICK = {
    "原编码": c => c.t, "简体": c => c.t, "万象拼音": c => /^(Deploy|Synchronize)$/.test(c.t) ? null : c.t,
    "出站模式": c => `出站模式 (${c.t.replace("模式", "")})`,
  };
  const pickOf = t => PICK[t] || PICK[t.replace(/ \(.*\)$/, "")];

  // ---------- 状态 ----------
  const keyOf = s => { // 序号 / 简称 / 完整 key → item
    if (!s) return null;
    if (/^\d+$/.test(s)) return items[+s - 1] || null;
    return items.find(it => it.alias === s || it.key === s) || null;
  };
  const listParam = k => (q.get(k) || "").split(",").filter(Boolean);
  let items = [];
  let root, body, P, page = 0, sel = 0, view = "grid", swapT = 0, vanishT = 0, loadT = 0, wheelAt = 0;
  let cur = null;          // 当前打开菜单的托盘项
  let stack = [];          // [{t 父级标签, i 父级在上一级 entries 里的位置, msel}]；stack[0] = 根
  let msel = 0, off = 0;   // 子页面：选中行（-1 = 头部行）与窗口偏移
  const hidden = new Set(), attn = new Set(), passive = new Set();

  const pages = () => Math.max(1, Math.ceil(items.length / PER));

  // ---------- 文字适配：先缩字号到下限，再（卡片）两行，最后省略号 ----------
  function fit(el, max, min, wrap) {
    el.classList.remove("wrap");
    let s = max; el.style.fontSize = s + "px";
    while (s > min && el.scrollWidth > el.clientWidth + 1) { s -= 2; el.style.fontSize = s + "px"; }
    if (wrap && el.scrollWidth > el.clientWidth + 1) el.classList.add("wrap");
  }
  function fitAll() {
    root.querySelectorAll(".ap-nm").forEach(el => fit(el, 46, 34));
    root.querySelectorAll(".ap-hn").forEach(el => fit(el, 56, 40, true));
  }

  // ---------- 网格 ----------
  function head() {
    const n = pages();
    return `<div class="pn-head"><span class="d t">APPS</span><span class="l s">TRAY</span>` +
      (n > 1 ? `<span class="ap-pg d" data-pg="1"><b>${page + 1}</b><i>/</i>${n}</span>` : "") + `</div>`;
  }
  function tile(it, gi) {
    const nm = nameOf(it), stl = statusOf(it);
    const tag = hidden.has(it.key) ? "HIDDEN" : passive.has(it.key) ? "PASSIVE" : "";
    return `<div class="ap-t${tag ? " dimd" : ""}" data-i="${gi}">
      <div class="ap-top"><span class="ap-g ${face(it.mono, "d")}">${esc(it.mono)}</span>` +
      (tag ? `<span class="l ap-tag">${tag}</span>` : "") + (attn.has(it.key) ? `<i class="ap-at"></i>` : "") + `</div>
      <div class="ap-nm ${face(nm, "d")}">${esc(nm)}</div>
      <div class="ap-sl ${face(stl, "l")}">${esc(stl)}</div></div>`;
  }
  // 提示栏：外壳在 mount 后写一次 #keys 并补 "ESC 返回"；网格里 Esc 关面板，这里按视图就地改
  const KEYS = [["↑↓←→", "选择"], ["ENTER", "唤起"], ["M", "托盘菜单"]];
  function hints() {
    const el = document.getElementById("keys");
    if (!el || !root) return;
    const k = KEYS.concat([["ESC", view === "grid" ? "关闭" : "返回"]]);
    el.innerHTML = k.map(([a, b]) => `<span><kbd>${a}</kbd><span class="zh">${b}</span></span>`).join("");
  }
  function showGrid(animate = true) {
    view = "grid"; cur = null; stack = []; hints();
    root.querySelector(".pn-head").outerHTML = head();
    if (!items.length) {
      body.innerHTML = `<div class="ap-none"><span class="d">NO TRAY</span></div>`;
      if (animate) P.stagger(body, ".ap-none > *");
      return;
    }
    page = Math.min(page, pages() - 1);
    sel = Math.max(page * PER, Math.min(sel, Math.min(items.length, page * PER + PER) - 1));
    const slice = items.slice(page * PER, page * PER + PER);
    body.innerHTML = `<div class="ap-grid">${slice.map((it, k) => tile(it, page * PER + k)).join("")}</div>`;
    const grid = body.firstChild;
    markTile();
    fitAll();
    if (animate) {
      P.stagger(grid, ".ap-t");
      const hl = grid.querySelector(":scope > .p3-hl");
      hl.style.setProperty("--i", sel - page * PER); hl.classList.add("st");
    }
  }
  function markTile() {
    const grid = body.querySelector(".ap-grid");
    if (!grid) return;
    grid.querySelectorAll(".ap-t").forEach(t => t.classList.toggle("sel", +t.dataset.i === sel));
    P.slideSel(grid, grid.querySelector(`.ap-t[data-i="${sel}"]`));
  }
  function moveTile(to) {
    const p = Math.floor(to / PER);
    sel = to;
    if (p !== page) { page = p; swap(() => showGrid()); } else markTile();
  }
  function flipPage(d) {
    if (pages() < 2) return;
    page = (page + d + pages()) % pages();
    sel = page * PER;
    swap(() => showGrid());
  }
  function gridKey(e) {
    const n = items.length, k = e.key;
    if (!n) return;
    const local = sel - page * PER, onPage = Math.min(PER, n - page * PER);
    if (k === "ArrowRight" || k === "d") moveTile((sel + 1) % n);
    else if (k === "ArrowLeft" || k === "a") moveTile((sel - 1 + n) % n);
    else if (k === "ArrowDown" || k === "ArrowUp" || k === "s" || k === "w") {
      // 页内按列上下循环；这一列只有一块时不动
      const c = local % COLS, rows = Math.ceil(onPage / COLS);
      let r = Math.floor(local / COLS);
      for (let t = 0; t < rows; t++) {
        r = (r + (k === "ArrowDown" || k === "s" ? 1 : rows - 1)) % rows;
        if (r * COLS + c < onPage) break;
      }
      moveTile(page * PER + r * COLS + c);
    }
    else if (k === "PageDown") flipPage(1);
    else if (k === "PageUp") flipPage(-1);
    else if (k === "Enter" || k === " ") activate(items[sel]);
    else if (k === "m" || k === "M" || k === "ContextMenu") openMenu(items[sel]);
    else return;
    e.preventDefault();
  }
  // Enter / 左键：activate()；onlyMenu 项改开菜单；onlyMenu 且无菜单什么都不做（SystemTrayBar.qml:99-104）
  function activate(it) {
    if (it.onlyMenu) { if (it.hasMenu !== false) openMenu(it); return; }
    P.flash("ACTIVATE " + nameOf(it));
    P.close();
  }
  function openMenu(it) {
    if (it.hasMenu === false) { P.flash("NO MENU"); return; }
    cur = it; stack = [{ t: null, i: -1, msel: 0 }]; msel = firstRow();
    swap(() => showMenu());
  }

  // ---------- 托盘菜单子页面 ----------
  // 从根按父级标签文字重新解析整条路径（应用可能整棵重建了菜单，旧句柄已失效）。
  // 文字对不上 → 退回同位置且有子菜单的项 → 再不行就停在最深的可解析层，返回被截掉的层数
  function resolve() {
    let list = cur.menu;
    for (let d = 1; d < stack.length; d++) {
      const st = stack[d];
      let hit = list.findIndex(x => x.kids !== undefined && x.t === st.t);
      if (hit < 0 && list[st.i] && list[st.i].kids !== undefined) hit = st.i;
      if (hit < 0) { stack.length = d; P.flash("MENU CHANGED"); return list; }
      st.i = hit; st.t = list[hit].t; list = list[hit].kids;
      if (list === null) return null; // 未水合：只可能是最深一层，显示 LOADING / EMPTY
    }
    return list;
  }
  // 当前层的行：根层第一行是 DMS 的头部行（项名 + 隐藏开关，SystemTrayBar.qml:1919-1966）
  function rows() {
    const list = resolve();
    const r = [];
    if (stack.length === 1) r.push({ hdr: true, t: "HIDE TILE", en: true }, SEP);
    if (list === null) r.push({ t: loading ? "LOADING" : "EMPTY", en: false, ph: true });
    else if (!list.length) r.push({ t: "EMPTY", en: false, ph: true });
    else r.push(...list);
    return r;
  }
  const can = x => x && !x.sep && x.en;
  const firstRow = () => { const r = rows(); return Math.max(0, r.findIndex((x, i) => can(x) && !x.hdr)); };
  // 选项表 = 这一层过半的行是勾选框（Clash 模式 / 订阅 / 节点、QQ 状态）：画勾号、互斥；
  // 否则勾选框是独立开关（Clash 根层的 系统代理 / TUN / 轻量）：画 .tg、各自翻转
  const optList = list => { const r = list.filter(x => !x.sep); return r.filter(x => x.bt === 1).length * 2 > r.length; };
  function ctl(x, list, i) {
    if (x.hdr) return `<span class="tg${hidden.has(cur.key) ? " on" : ""}"></span>`;
    if (x.kids !== undefined) return `<span class="ap-go">→</span>`;
    if (x.bt === 2) return `<span class="ap-rd${x.on ? " on" : ""}"></span>`;
    if (x.bt === 1) return optList(list) ? `<span class="ap-ck${x.on ? " on" : ""}"></span>`
      : `<span class="tg${x.on ? " on" : ""}"></span>`;
    return "";
  }
  let loading = q.get("loading") === "1", R = [];
  function showMenu(animate = true) {
    view = "menu"; hints();
    R = rows();
    const parent = stack.length > 1 ? stack[stack.length - 1].t : null;
    const noun = parent || nameOf(cur);
    const back = stack.length > 2 ? stack[stack.length - 2].t : stack.length > 1 ? nameOf(cur) : "APPS";
    body.innerHTML = `<div class="ap-sub">
      <div class="ap-card">
        <span class="ap-g ${face(cur.mono, "d")}">${esc(cur.mono)}</span>
        <div class="ap-hn ${face(noun, "d")}">${esc(noun)}</div>
        <div class="ap-ro d"><b></b><i>/</i><span></span></div>
        <div class="ap-back" data-back="1"><span class="l">←</span><span class="${face(back, "l")}">${esc(back)}</span></div>
      </div>
      <div class="ap-menu"><div class="ap-win"><div class="ap-list">${R.map((x, i) => x.sep ? `<i class="ap-sep"></i>` :
        `<div class="li ap-mi${x.en ? "" : " off"}${DANGER.test(x.t) ? " ap-danger" : ""}${x.hdr ? " ap-hdr" : ""}${x.ph ? " ap-ph" : ""}" data-r="${i}">
          <span class="ap-ml ${x.hdr || x.ph ? "l" : face(x.t, "zh")}">${esc(x.t)}</span><span class="ap-c">${ctl(x, R.filter(y => !y.hdr), i)}</span></div>`).join("")}
      </div></div></div></div>`;
    fitAll();
    if (!can(R[msel])) msel = Math.max(0, R.findIndex(can));
    off = 0; markRow(true);
    if (animate) P.stagger(body, ".ap-card, .ap-list > .li, .ap-list > .ap-sep");
    clearTimeout(loadT);
    // 水合等待：没抓到的子菜单先显示 LOADING，超时变 EMPTY（QML 端是 childrenChanged 到达或超时）
    if (R.some(x => x.ph && x.t === "LOADING") && !P.STATIC) loadT = setTimeout(() => { loading = false; showMenu(false); loading = q.get("loading") === "1"; }, 1200);
  }
  // 窗口：固定像素高，内层列表用 translateY 滑动；只有键盘 / 滚轮移动会滑窗口，悬停不会（避免悬停-滑动反馈环）
  function markRow(slide) {
    const list = body.querySelector(".ap-list"), win = body.querySelector(".ap-win");
    if (!list) return;
    const el = list.querySelector(`[data-r="${msel}"]`);
    list.querySelectorAll(".li").forEach(n => n.classList.toggle("sel", n === el));
    const H = win.clientHeight, full = list.scrollHeight;
    if (slide && el && full > H) {
      const pad = 14, top = el.offsetTop - pad, bot = el.offsetTop + el.offsetHeight + pad;
      if (top < off) off = Math.max(0, top);
      else if (bot > off + H) off = Math.min(full - H, bot - H);
      list.style.transform = `translateY(${-off}px)`;
    }
    P.slideSel(list, can(R[msel]) ? el : null);
    // 读数：在可用的 dbusmenu 行里的序号（不含头部行），只在内容超出窗口时显示
    const ro = body.querySelector(".ap-ro"), pick = R.filter(x => can(x) && !x.hdr);
    ro.hidden = full <= H;
    ro.querySelector("b").textContent = R[msel]?.hdr ? "--" : pad2(pick.indexOf(R[msel]) + 1);
    ro.querySelector("span").textContent = pad2(pick.length);
  }
  const pad2 = pad;
  function stepRow(d) {
    const n = R.length;
    for (let k = 1; k <= n; k++) { const i = ((msel + d * k) % n + n) % n; if (can(R[i])) { msel = i; break; } }
    markRow(true);
  }
  function enter() {
    const x = R[msel];
    if (!can(x) || x.kids === undefined) return false;
    stack[stack.length - 1].msel = msel;
    stack.push({ t: x.t, i: (resolve() || []).indexOf(x), msel: 0 });
    msel = 0;
    swap(() => { msel = firstRow(); showMenu(); });
    return true;
  }
  function up() {
    if (stack.length <= 1) { swap(() => showGrid()); return; }
    stack.pop();
    msel = stack[stack.length - 1].msel || 0;
    swap(() => showMenu());
  }
  // 触发：DMS 先 activate() 再 triggered()（:2051-2056）。勾选 / 单选行与会被应用改名的开关行留在本页、原地刷新并 flash；
  // 普通动作 flash 后关闭 P3 菜单（同 DMS）；退出类 → 项注销、回网格
  function run() {
    const x = R[msel];
    if (!can(x)) return;
    if (x.kids !== undefined) { enter(); return; }
    if (x.hdr) {
      hidden.has(cur.key) ? hidden.delete(cur.key) : hidden.add(cur.key);
      P.flash((hidden.has(cur.key) ? "HIDE " : "SHOW ") + nameOf(cur));
      return showMenu(false);
    }
    if (DANGER.test(x.t)) { P.flash(x.t); return unregister(cur); }
    if (!x.bt && !FLIP[x.t] && !(stack.length > 1 && pickOf(stack[stack.length - 1].t))) { P.flash(x.t); P.close(); return; }
    const list = resolve();
    let msg = x.t;
    if (x.bt === 2 || (x.bt === 1 && optList(list))) {
      // 单选 / 选项表：应用侧互斥（模拟）
      list.filter(y => y.bt === x.bt).forEach(y => { y.on = y === x; });
    } else if (x.bt === 1) { x.on = !x.on; msg += x.on ? " ON" : " OFF"; }
    else if (FLIP[x.t]) { x.t = FLIP[x.t]; msg = x.t; }
    // 父级标签随选择改名（应用重建菜单）：改真实数据，之后 resolve() 按文字找不到旧标签就退回同位置
    if (stack.length > 1) {
      const pf = pickOf(stack[stack.length - 1].t), lvl = stack[stack.length - 1];
      const nt = pf && pf(x);
      if (nt) { const pl = parentList(); pl[lvl.i].t = nt; }
    }
    P.flash(msg);
    showMenu(false);
  }
  function parentList() {
    let list = cur.menu;
    for (let d = 1; d < stack.length - 1; d++) list = list[stack[d].i].kids;
    return list;
  }
  // 托盘项注销（应用退出 / SystemTray.onItemUnregistered）：打开着的子页面退回网格，选中落到同位置
  function unregister(it) {
    const i = items.indexOf(it);
    if (i < 0) return;
    items.splice(i, 1);
    hidden.delete(it.key);
    if (sel >= items.length) sel = Math.max(0, items.length - 1);
    if (cur === it) { P.flash(nameOf(it) + " GONE"); swap(() => showGrid()); }
    else if (view === "grid") showGrid(false);
  }

  // ---------- 视图切换 ----------
  function swap(build) {
    clearTimeout(swapT);
    if (P.STATIC) { build(); swapT = 0; return; }
    body.classList.add("out");
    swapT = setTimeout(() => { swapT = 0; body.classList.remove("out"); build(); }, 160);
  }

  function menuKey(e) {
    const k = e.key;
    if (k === "ArrowDown" || k === "s") stepRow(1);
    else if (k === "ArrowUp" || k === "w") stepRow(-1);
    else if (k === "ArrowRight" || k === "d") enter();
    else if (k === "Enter" || k === " ") run();
    else if (k === "ArrowLeft" || k === "a" || k === "m" || k === "M" || k === "ContextMenu") up();
    else return;
    e.preventDefault();
  }
  // Esc / Backspace 在子页面里返回上一级：window 捕获阶段先于外壳的冒泡监听，截下后停止传播；网格里放行给外壳关面板
  function onEsc(e) {
    if ((e.key !== "Escape" && e.key !== "Backspace") || view !== "menu") return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!swapT) up();
  }

  function bindMouse() {
    root.addEventListener("mouseover", e => {
      if (swapT) return;
      const t = e.target.closest("[data-i]"), r = e.target.closest("[data-r]");
      if (view === "grid" && t && +t.dataset.i !== sel) { sel = +t.dataset.i; markTile(); }
      if (view === "menu" && r && +r.dataset.r !== msel && can(R[+r.dataset.r])) { msel = +r.dataset.r; markRow(false); }
    });
    root.addEventListener("click", e => {
      if (swapT) return;
      if (e.target.closest("[data-pg]")) return flipPage(1);
      if (e.target.closest("[data-back]")) return up();
      const t = e.target.closest("[data-i]"), r = e.target.closest("[data-r]");
      if (view === "grid" && t) { sel = +t.dataset.i; activate(items[sel]); }
      if (view === "menu" && r && can(R[+r.dataset.r])) { msel = +r.dataset.r; markRow(false); run(); }
    });
    root.addEventListener("contextmenu", e => {
      e.preventDefault();
      if (swapT) return;
      const t = e.target.closest("[data-i]");
      if (view === "grid" && t) { sel = +t.dataset.i; markTile(); openMenu(items[sel]); }
      else if (view === "menu") up();
    });
    // 中键 = secondaryActivate()，只有鼠标入口
    root.addEventListener("auxclick", e => {
      const t = e.target.closest("[data-i]");
      if (e.button === 1 && view === "grid" && t) { e.preventDefault(); P.flash("SECONDARY " + nameOf(items[+t.dataset.i])); }
    });
    root.addEventListener("mousedown", e => { if (e.button === 1) e.preventDefault(); });
    // 外壳在面板打开时不处理滚轮；这里：网格翻页，子页面逐行移动选中并滑窗口
    root.addEventListener("wheel", e => {
      const now = performance.now();
      if (now < wheelAt || swapT || !e.deltaY) return;
      wheelAt = now + 90;
      if (view === "menu") stepRow(Math.sign(e.deltaY));
      else if (pages() > 1) { wheelAt = now + 300; flipPage(Math.sign(e.deltaY)); }
    }, { passive: true });
  }

  P3.register("apps", {
    title: "APPS", sub: "托盘应用",
    keys: KEYS,
    mount(el, p3) {
      P = p3;
      // 每次打开都从快照重建（深拷贝，模拟期间的改动不跨次保留）
      items = JSON.parse(JSON.stringify(ITEMS)); // kids:null 会保留，kids 不存在的仍不存在
      const n = q.get("n");
      if (n === "8") items = items.concat(JSON.parse(JSON.stringify(EXTRA)));
      else if (n !== null && /^\d$/.test(n)) items = items.slice(0, +n);
      const mark = (set, k, f) => listParam(k).forEach(s => { const it = keyOf(s); if (it) { set && set.add(it.key); f && f(it); } });
      hidden.clear(); attn.clear(); passive.clear();
      mark(hidden, "hidden"); mark(attn, "attn"); mark(passive, "passive");
      mark(null, "nomenu", it => { it.hasMenu = false; }); mark(null, "onlymenu", it => { it.onlyMenu = true; });
      page = Math.max(0, Math.min(pages() - 1, (+q.get("page") || 1) - 1));
      sel = Math.max(0, Math.min(items.length - 1, q.has("tile") ? +q.get("tile") - 1 : page * PER));
      page = Math.floor(sel / PER);
      root = document.createElement("div"); root.className = "ap";
      root.innerHTML = head() + `<div class="ap-body"></div>`;
      el.appendChild(root);
      body = root.querySelector(".ap-body");
      const m = keyOf(q.get("menu"));
      if (m && m.hasMenu !== false) {
        cur = m; stack = [{ t: null, i: -1, msel: 0 }]; sel = items.indexOf(m); page = Math.floor(sel / PER);
        for (const seg of (q.get("path") || "").split("/").filter(Boolean)) {
          const list = resolve();
          const i = (list || []).findIndex(x => x.kids !== undefined && x.t.includes(seg));
          if (i < 0) break;
          stack[stack.length - 1].msel = i + (stack.length === 1 ? 2 : 0);
          stack.push({ t: list[i].t, i, msel: 0 });
        }
        root.querySelector(".pn-head").outerHTML = head();
        R = rows();
        const pick = R.map((x, i) => i).filter(i => can(R[i]) && !R[i].hdr);
        msel = q.has("msel") ? pick[Math.min(pick.length - 1, +q.get("msel") - 1)] ?? 0 : (pick[0] ?? 0);
        showMenu();
      } else showGrid();
      addEventListener("keydown", onEsc, true);
      queueMicrotask(hints); // 外壳在 mount 之后才写 #keys
      bindMouse();
      const v = keyOf(q.get("vanish"));
      if (v && !P.STATIC) vanishT = setTimeout(() => unregister(v), 1500);
    },
    unmount() {
      clearTimeout(swapT); clearTimeout(vanishT); clearTimeout(loadT); swapT = 0;
      removeEventListener("keydown", onEsc, true);
      root = body = cur = null; view = "grid";
    },
    key(e) {
      if (swapT) { e.preventDefault(); return; }
      if (view === "menu") menuKey(e); else gridKey(e);
    },
  });
})();
