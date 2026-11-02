// P3 SHELL 外壳：背景、日期、主菜单列、底栏、子面板宿主
// 子面板在 panels/<id>.js 里调用 P3.register(id, { title, sub, keys, mount(el, api), unmount(), key(e, api) })
//
// 动效 helper（?static 下全部瞬时完成）：
//   P3.STATIC                         是否截图模式
//   P3.countUp(el, to, {dur, fmt, from})  数字从 from(默认 0) 滚到 to；fmt(v) 返回显示文本，默认取整
//   P3.stagger(container, selector)   给匹配元素加 .st 和 --i，按顺序错峰入场；返回元素数组
//                                     selector 默认 ":scope > *"；重复调用会重播
//   P3.slideSel(container, target)    容器内共用一个 .p3-hl 选中块，平滑滑到 target；target 为空则隐藏
//                                     容器加 .p3-slide，里面 .li.sel 自带的伪元素楔形自动关闭
// 外壳在 mount 之后自动对 .pn-head / .box 以及根节点的直接子元素调用 stagger；
// 面板自己的 unmount 在关闭动画结束后才调用，此时 el 仍在
(() => {
  const q = new URLSearchParams(location.search);
  const STATIC = q.has("static");
  if (STATIC) document.documentElement.classList.add("static");
  if (q.get("theme") === "lavender") document.documentElement.dataset.theme = "lavender";

  // 主菜单：只留系统入口。沿头发斜线排，上面靠右、下面靠左
  const ITEMS = [
    { id: "apps",     t: "APPS",     zh: "托盘应用", x: 1196, y: 300, r: -12, c: "--c1" },
    { id: "system",   t: "SYSTEM",   zh: "状态与控制", x: 1150, y: 404, r: -6, c: "--c3" },
    { id: "calendar", t: "CALENDAR", zh: "月历与日程", x: 1112, y: 508, r: -4, c: "--c2" },
    { id: "settings", t: "SETTINGS", zh: "DMS 设置", x: 1090, y: 612, r: -7, c: "--c4" },
    { id: "power",    t: "POWER",    zh: "锁屏与关机", x: 1056, y: 716, r: 3,  c: "--c5" },
  ];

  const panels = {};
  const P3 = window.P3 = {
    ITEMS,
    register(id, def) { panels[id] = def; },
    // 面板里的操作反馈：底栏标签变红，显示 "→ 动作"
    flash(text) { go(text); },
    close() { closePanel(); },
    STATIC,
    countUp(el, to, { dur = 700, fmt = Math.round, from = 0 } = {}) {
      cancelAnimationFrame(el._p3cu);
      if (STATIC || dur <= 0) { el.textContent = fmt(to); return; }
      const t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
        el.textContent = fmt(from + (to - from) * e);
        if (k < 1) el._p3cu = requestAnimationFrame(step);
      };
      el.textContent = fmt(from);
      el._p3cu = requestAnimationFrame(step);
    },
    stagger(container, selector = ":scope > *") {
      const list = [...container.querySelectorAll(selector)];
      list.forEach((n, i) => { n.classList.remove("st"); n.style.setProperty("--i", i); });
      if (!STATIC) void container.offsetWidth;
      list.forEach(n => n.classList.add("st"));
      return list;
    },
    slideSel(container, target) {
      container.classList.add("p3-slide");
      let hl = container.querySelector(":scope > .p3-hl");
      const fresh = !hl;
      if (fresh) { hl = document.createElement("div"); hl.className = "p3-hl"; container.prepend(hl); }
      if (!target) { hl.style.opacity = 0; return hl; }
      // offsetLeft/Top 相对最近的定位祖先；容器是 relative，目标若在更深的定位元素里则逐级累加
      let x = 0, y = 0, n = target;
      while (n && n !== container) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      const tf = `translate(${x}px, ${y}px) scale(${target.offsetWidth / 100}, ${target.offsetHeight / 100})`;
      if (fresh || STATIC) { hl.style.transition = "none"; hl.style.transform = tf; void hl.offsetWidth; hl.style.transition = ""; }
      else hl.style.transform = tf;
      hl.style.opacity = "";
      return hl;
    },
  };

  const stage = document.getElementById("stage");
  stage.insertAdjacentHTML("afterbegin", `
    <div class="bg" id="bg">
      <img src="../p3-miku/bg.png" alt="">
      <svg class="caustic" viewBox="0 0 1300 520" preserveAspectRatio="none" aria-hidden="true">
        <filter id="cf" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".008 .02" numOctaves="2" seed="7"/>
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -9 5.2"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#cf)"/>
      </svg>
      <div class="rays"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="bubbles" id="bubbles"></div>
    </div>
    <div class="date" id="date">
      <div class="d md"><span id="md"></span><small id="dow"></small></div>
      <div class="row"><span class="l tod" id="tod"></span><span class="l hm" id="hm"></span></div>
    </div>
    <div class="kin" aria-hidden="true"><i></i><i></i></div>
    <div id="menu"><div class="hl r"><i></i></div><div class="hl w"><i></i></div>
      <div class="big"><b class="d" id="bigno">01</b><span class="d">/ 05</span></div></div>
    <div id="panel"></div>
    <div class="desc" id="desc"><span class="l tag" id="tag"></span><span class="zh txt" id="txt"></span></div>
    <div class="keys l" id="keys"></div>`);

  const $ = id => document.getElementById(id);
  const menu = $("menu"), panelEl = $("panel"), tag = $("tag"), txt = $("txt"), desc = $("desc"), keys = $("keys");

  const els = ITEMS.map((it, i) => {
    const el = document.createElement("div");
    el.className = "it d";
    el.style.cssText = `--x:${it.x}px;--y:${it.y}px;--r:${it.r}deg;--c:var(${it.c});--i:${i}`;
    el.innerHTML = `<span class="echo">${it.t}</span><span class="tx">${it.t}</span>`;
    el.addEventListener("mouseenter", () => { if (!openId) select(i); });
    el.addEventListener("click", () => { select(i); confirm(); });
    menu.appendChild(el);
    return el;
  });

  const hlW = menu.querySelector(".hl.w"), hlR = menu.querySelector(".hl.r"), big = menu.querySelector(".big"), bigNo = $("bigno");
  big.lastChild.textContent = "/ " + String(ITEMS.length).padStart(2, "0");
  // 选中块对齐到当前项：用项的 left/top/rotate 和放大后的宽高
  function placeHl(i, instant) {
    const it = ITEMS[i], el = els[i];
    const h0 = el.offsetHeight, w = el.offsetWidth * 1.36, h = h0 * 1.36;
    // 与 .it.on 相同的变换链（原点 0 60%）：rotate → translate(-22px) → scale(1.36)
    const base = `translate(${it.x}px, ${it.y + h0 * .6}px) rotate(${it.r}deg) translate(-22px, ${-h * .6}px)`;
    const tw = `${base} scale(${w / 100}, ${h / 100})`;
    [hlW, hlR].forEach(n => {
      if (instant || STATIC) { n.style.transition = "none"; n.style.transform = tw; void n.offsetWidth; n.style.transition = ""; }
      else n.style.transform = tw;
    });
    const bt = `translate(0, ${it.y - 40}px) rotate(${it.r}deg)`;
    if (instant || STATIC) { big.style.transition = "none"; big.style.transform = bt; void big.offsetWidth; big.style.transition = ""; }
    else big.style.transform = bt;
    bigNo.textContent = String(i + 1).padStart(2, "0");
    if (!STATIC) { bigNo.classList.remove("flip"); void bigNo.offsetWidth; bigNo.classList.add("flip"); }
  }

  let cur = -1, openId = null, goTimer, closeTimer;
  function setDesc(t, zh) {
    tag.textContent = t;
    txt.classList.add("swap"); txt.textContent = zh;
    requestAnimationFrame(() => requestAnimationFrame(() => txt.classList.remove("swap")));
  }
  function setKeys() {
    const k = openId
      ? (panels[openId]?.keys || [["↑↓←→", "选择"], ["ENTER", "确认"]]).concat([["ESC", "返回"]])
      : [["↑↓", "选择"], ["ENTER", "打开"], ["ESC", "关闭菜单"]];
    keys.innerHTML = k.map(([a, b]) => `<span><kbd>${a}</kbd><span class="zh">${b}</span></span>`).join("");
  }
  function select(i) {
    i = (i + ITEMS.length) % ITEMS.length;
    if (i === cur) return;
    const first = cur < 0;
    if (cur >= 0) els[cur].classList.remove("on");
    cur = i; els[i].classList.add("on");
    placeHl(i, first);
    setDesc(ITEMS[i].t, ITEMS[i].zh);
  }
  function go(text) {
    tag.textContent = "→ " + text;
    desc.classList.add("go");
    clearTimeout(goTimer);
    goTimer = setTimeout(() => { desc.classList.remove("go"); tag.textContent = openId ? panels[openId]?.title || ITEMS[cur].t : ITEMS[cur].t; }, 900);
  }
  function confirm() {
    hlW.classList.remove("hit"); void hlW.offsetWidth; hlW.classList.add("hit");
    const it = ITEMS[cur];
    if (panels[it.id]) openPanel(it.id); else go(it.t);
  }
  // 关闭：先播反向擦出，结束后再 unmount 清空；重开前先把未完成的关闭做完
  let closingId = null;
  function finishClose() {
    clearTimeout(closeTimer);
    if (!closingId) return;
    panels[closingId]?.unmount?.();
    closingId = null;
    panelEl.classList.remove("out");
    panelEl.onclick = panelEl.onmouseover = null;
    panelEl.innerHTML = "";
  }
  function openPanel(id) {
    finishClose();
    openId = id;
    const p = panels[id];
    panelEl.innerHTML = "";
    panelEl.dataset.id = id;
    p.mount(panelEl, P3);
    // 错峰：标题、.box、包裹层里不含它们的块；标题和 .box 内部不再二次擦入
    P3.stagger(panelEl, ".pn-head, .box, :scope > * > *:not(.pn-head):not(.box):not(:has(.pn-head, .box)):not(.pn-head *):not(.box *)");
    document.body.classList.add("open");
    setDesc(p.title || id.toUpperCase(), p.sub || "");
    setKeys();
  }
  function closePanel() {
    if (!openId) return;
    closingId = openId; openId = null;
    panelEl.classList.add("out");
    document.body.classList.remove("open");
    if (STATIC) finishClose(); else closeTimer = setTimeout(finishClose, 340);
    setDesc(ITEMS[cur].t, ITEMS[cur].zh);
    setKeys();
  }

  addEventListener("keydown", e => {
    if (openId) {
      if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); closePanel(); return; }
      panels[openId].key?.(e, P3);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "Tab") { e.preventDefault(); select(cur + 1); }
    else if (e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); select(cur - 1); }
    else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); confirm(); }
    else if (e.key === "Escape") { e.preventDefault(); go("CLOSE MENU"); }
  });
  let wheelLock = 0;
  addEventListener("wheel", e => {
    if (openId) return;
    const now = performance.now();
    if (now < wheelLock) return;
    wheelLock = now + 90;
    select(cur + Math.sign(e.deltaY));
  }, { passive: true });

  const bg = $("bg"), date = $("date");
  addEventListener("mousemove", e => {
    const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
    bg.style.transform = `translate(${nx * -18}px, ${ny * -12}px)`;
    menu.style.translate = openId ? "" : `${nx * 10}px ${ny * 6}px`;
  });

  const bubbles = $("bubbles");
  for (let k = 0; k < 16; k++) {
    const b = document.createElement("i");
    const s = 6 + Math.random() * 16;
    b.style.cssText = `left:${760 + Math.random() * 1140}px;top:${1100 + Math.random() * 40}px;width:${s}px;height:${s}px;` +
      `animation-duration:${9 + Math.random() * 10}s;animation-delay:${-Math.random() * 18}s`;
    bubbles.appendChild(b);
  }

  function tick() {
    const d = new Date();
    $("md").textContent = `${d.getMonth() + 1}/${d.getDate()}`;
    $("dow").textContent = ["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()];
    const h = d.getHours();
    $("tod").textContent = h < 5 ? "DARK HOUR" : h < 9 ? "EARLY MORNING" : h < 12 ? "MORNING" : h < 13 ? "LUNCHTIME" :
      h < 17 ? "AFTERNOON" : h < 19 ? "AFTER SCHOOL" : "EVENING";
    $("hm").textContent = `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  tick(); setInterval(tick, 10000);

  // 1920×1080 舞台按 cover 缩放
  function fit() { stage.style.transform = `scale(${Math.max(innerWidth / 1920, innerHeight / 1080)})`; }
  fit(); addEventListener("resize", () => { fit(); });
  document.fonts?.ready.then(() => { if (cur >= 0) placeHl(cur, true); });

  // 面板脚本都在 shell.js 之后加载，等 DOM 就绪再处理 ?open=
  addEventListener("DOMContentLoaded", () => {
    const open = q.get("open");
    const si = ITEMS.findIndex(it => it.id === open);
    select(si >= 0 ? si : +(q.get("sel") ?? 0));
    setKeys();
    if (si >= 0 && panels[open]) openPanel(open);
  });
})();
