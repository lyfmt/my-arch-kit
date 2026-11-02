/* c-quiet 锁屏原型：演示模式，纯键盘驱动（鼠标可用于电源菜单） */
(() => {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const Q = new URLSearchParams(location.search);
  const STATIC = Q.has("static");
  if (STATIC) root.classList.add("static");
  if (Q.get("theme") === "lavender") root.classList.add("lavender");

  const IDLE_MS = 10000, VERIFY_MS = 700, MAX_GLYPHS = 24;
  let pw = "", phase = "idle"; // idle | active | verify | error | power | unlocking | unlocked
  let idleT = 0, errT = 0, toastT = 0;
  let psel = 0, armed = -1;

  /* ---------- 舞台缩放 ---------- */
  const stage = $("stage");
  const fit = () => { stage.style.transform = `scale(${Math.max(innerWidth / 1920, innerHeight / 1080)})`; };
  addEventListener("resize", fit); fit();

  /* ---------- 气泡 + 视差 ---------- */
  const bub = $("bubbles");
  for (let n = 0; n < 16; n++) {
    const i = document.createElement("i"), s = 6 + Math.random() * 16, d = 9 + Math.random() * 10;
    Object.assign(i.style, { left: 760 + Math.random() * 1140 + "px", top: 1100 + Math.random() * 40 + "px",
      width: s + "px", height: s + "px", animationDuration: d + "s", animationDelay: -Math.random() * d + "s" });
    bub.appendChild(i);
  }
  const bg = $("bg");
  if (!STATIC) addEventListener("mousemove", (e) => {
    const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
    if (phase !== "unlocking") bg.style.transform = `translate(${nx * -18}px,${ny * -12}px)`;
  });

  /* ---------- 时钟 ---------- */
  const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const tod = (h) => h < 5 ? "DARK HOUR" : h < 9 ? "EARLY MORNING" : h < 12 ? "MORNING" : h < 13 ? "LUNCHTIME"
    : h < 17 ? "AFTERNOON" : h < 19 ? "AFTER SCHOOL" : "EVENING";
  const timeEl = $("time");
  let lastT = "";
  function clock() {
    const d = new Date(), hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
    const t = hh + ":" + mm;
    if (t !== lastT) {
      // 每个字符独立一个 span，变化的数字做一次下落进场
      const prev = lastT; lastT = t;
      timeEl.innerHTML = [...t].map((c, k) => {
        const cls = c === ":" ? "c colon" : "c" + (prev && prev[k] !== c ? " tick" : "");
        return `<span class="${cls}">${c}</span>`;
      }).join("");
      $("deskTime").textContent = t;
    }
    $("md").textContent = `${d.getMonth() + 1}/${d.getDate()}`;
    $("dow").textContent = DOW[d.getDay()];
    $("tod").textContent = tod(d.getHours());
  }
  clock(); setInterval(clock, 1000);

  /* ---------- 状态切换 ---------- */
  const status = $("status"), glyphs = $("glyphs");
  const STATUS = { active: "TYPE PASSWORD · ENTER", verify: "VERIFYING", error: "WRONG PASSWORD" };
  function setPhase(p) {
    phase = p;
    const c = root.classList;
    c.toggle("active", p !== "idle" && p !== "unlocked");
    c.toggle("verify", p === "verify");
    c.toggle("error", p === "error");
    c.toggle("poweron", p === "power");
    c.toggle("unlocking", p === "unlocking" || p === "unlocked");
    c.toggle("unlocked", p === "unlocked");
    if (STATUS[p]) status.textContent = STATUS[p];
    if (p === "idle" || (p === "active" && !pw)) status.textContent = STATUS.active;
    kick();
  }
  function kick() {
    clearTimeout(idleT);
    root.classList.remove("fading");
    if (["active", "error", "power"].includes(phase) && !Q.get("state")) idleT = setTimeout(goIdle, IDLE_MS);
  }
  function goIdle() {
    root.classList.add("fading");
    pw = ""; renderGlyphs(true); closePower(true); setPhase("idle");
    root.classList.add("fading");
  }

  /* ---------- 掩码字符 ---------- */
  function renderGlyphs(clearAll) {
    if (clearAll) { glyphs.innerHTML = ""; }
    const want = Math.min(pw.length, MAX_GLYPHS);
    const live = [...glyphs.children].filter((g) => !g.classList.contains("out"));
    for (let k = live.length; k < want; k++) {
      const i = document.createElement("i"); i.style.setProperty("--i", k); glyphs.appendChild(i);
    }
    for (let k = live.length - 1; k >= want; k--) {
      const g = live[k]; g.classList.add("out");
      g.addEventListener("animationend", () => g.remove(), { once: true });
      if (STATIC) g.remove();
    }
    root.classList.toggle("typing", pw.length > 0);
    $("field").style.setProperty("--fillx", Math.min(1, .18 + pw.length * .07).toFixed(3));
  }
  function clearPw() {
    pw = "";
    [...glyphs.children].forEach((g, k) => { g.style.animationDelay = k * 18 + "ms"; });
    renderGlyphs();
  }

  /* ---------- 提交 ---------- */
  function submit() {
    if (!pw) return; // 与 p5lock 一致：从不提交空密码
    setPhase("verify");
    setTimeout(() => {
      if (pw === "fail") {
        setPhase("error");
        clearTimeout(errT);
        errT = setTimeout(() => { if (phase === "error") { clearPw(); setPhase("active"); } }, 1600);
        // 抖动需要每次重新触发
        const f = $("field"); f.style.animation = "none"; void f.offsetWidth; f.style.animation = "";
      } else unlock();
    }, STATIC ? 0 : VERIFY_MS);
  }
  function unlock() {
    setPhase("unlocking");
    setTimeout(() => { pw = ""; renderGlyphs(true); setPhase("unlocked"); }, STATIC ? 0 : 900);
  }
  function relock() {
    root.classList.remove("unlocked", "unlocking");
    bg.style.transform = "";
    setPhase("idle");
  }

  /* ---------- 电源菜单 ---------- */
  const items = [...document.querySelectorAll(".pi")];
  const LABEL = { poweroff: "POWER OFF", reboot: "REBOOT", suspend: "SUSPEND" };
  function openPower() { armed = -1; setPhase("power"); select(psel); }
  function closePower(silent) {
    armed = -1; items.forEach((i) => i.classList.remove("on", "arm"));
    if (!silent && phase === "power") setPhase(pw ? "active" : "active");
  }
  function select(k) {
    psel = (k + items.length) % items.length;
    if (armed !== psel) { armed = -1; }
    items.forEach((it, n) => {
      const on = n === psel;
      if (on && !it.classList.contains("on")) { it.classList.remove("on"); void it.offsetWidth; }
      it.classList.toggle("on", on);
      it.classList.toggle("arm", n === armed);
    });
  }
  function activate(k) {
    select(k);
    const act = items[psel].dataset.act;
    if (act !== "suspend" && armed !== psel) { armed = psel; select(psel); kick(); return; }
    toast(`DEMO · ${LABEL[act]} REQUESTED`);
    console.log("[c-quiet] power action:", act);
    closePower();
  }
  items.forEach((it, n) => {
    it.addEventListener("mouseenter", () => { if (phase === "power" && psel !== n) select(n); });
    it.addEventListener("click", () => { if (phase === "power") activate(n); });
  });
  $("hint").addEventListener("click", () => { phase === "power" ? closePower() : openPower(); });

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ---------- Caps Lock ---------- */
  const caps = (on) => root.classList.toggle("capson", !!on || Q.has("caps"));
  caps(false);

  /* ---------- 键盘 ---------- */
  addEventListener("keydown", (e) => {
    if (e.getModifierState) caps(e.getModifierState("CapsLock"));
    const k = e.key;
    if (phase === "unlocking") return;
    if (phase === "unlocked") { if (k === "l" || k === "L") relock(); return; }
    if (k === "Tab") { e.preventDefault(); phase === "power" ? closePower() : openPower(); return; }

    if (phase === "power") {
      e.preventDefault(); kick();
      if (k === "ArrowDown" || k === "ArrowRight") select(psel + 1);
      else if (k === "ArrowUp" || k === "ArrowLeft") select(psel - 1);
      else if (k === "Enter" || k === " ") activate(psel);
      else if (k === "Escape") { if (armed >= 0) { armed = -1; select(psel); } else closePower(); }
      return;
    }
    if (phase === "verify") { e.preventDefault(); return; }

    const wasIdle = phase === "idle";
    if (wasIdle || phase === "error") setPhase("active");
    else kick();

    if (k === "Enter") { e.preventDefault(); submit(); return; }
    if (k === "Escape" || (e.ctrlKey && (k === "u" || k === "U" || k === "Backspace"))) {
      e.preventDefault();
      if (!pw && !wasIdle) goIdle(); else clearPw();
      return;
    }
    if (k === "Backspace") { e.preventDefault(); pw = pw.slice(0, -1); renderGlyphs(); return; }
    if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (phase === "error") clearPw();
      pw += k; renderGlyphs();
    }
  });
  addEventListener("keyup", (e) => { if (e.getModifierState) caps(e.getModifierState("CapsLock")); });
  addEventListener("mousedown", (e) => {
    if (phase === "idle" && !e.target.closest("#power")) setPhase("active");
    else if (phase === "power" && !e.target.closest("#power")) closePower();
  });

  /* ---------- 调试参数 ?state= ---------- */
  const st = Q.get("state");
  const demoPw = (s) => { pw = s; renderGlyphs(); };
  if (st === "typing" || st === "active") { setPhase("active"); demoPw("hunter2"); }
  else if (st === "verify") { setPhase("active"); demoPw("hunter22"); setPhase("verify"); }
  else if (st === "error") { setPhase("active"); demoPw("fail"); setPhase("error"); }
  else if (st === "power") { setPhase("active"); openPower(); if (Q.has("arm")) { armed = 0; select(0); } }
  else if (st === "caps") { root.classList.add("capson"); setPhase("active"); demoPw("abc"); }
  else if (st === "unlocked") { setPhase("unlocked"); }
  if (Q.has("caps")) root.classList.add("capson");
  window.__cq = { get phase() { return phase; }, setPhase, submit };
})();
