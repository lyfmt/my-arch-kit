/* P3 LOCK 演示逻辑（定稿，基于方案 A）
   系统操作（用户名、密码校验、电源、Caps Lock、解锁）全部走 backend.js 的 window.P3Lock，
   本文件只管画面和按键。mock 参数（?user ?host ?caps ?lat ?fail）写在 backend.js 文件头。
   ?static            关动画（截图用）
   ?theme=lavender    薰衣草主题
   ?state=idle|typing|verify|error|power|caps|unlock   冻结在某状态
   演示：输入 "fail" 回车 = 密码错误，其余任意 = 解锁；解锁后按 L 重新锁定
   20 秒无操作回到待机（清空密码） */
(() => {
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const body = document.body;
  const STATIC = q.has("static");
  if (STATIC) body.classList.add("static");
  if (q.get("theme")) document.documentElement.dataset.theme = q.get("theme");

  const sys = window.P3Lock;
  $("user").textContent = sys.state.user;
  $("host").textContent = "@ " + sys.state.host;

  /* ---------- 舞台缩放（cover） ---------- */
  const stage = $("stage");
  /* 比 16:9 窄的屏（16:10、4:3）横向溢出：靠右对齐，只裁左侧背景，右侧版心不被裁掉 */
  const fit = () => {
    const s = Math.max(innerWidth / 1920, innerHeight / 1080), over = Math.max(0, 1920 * s - innerWidth);
    stage.style.transform = `translateX(${-over / 2}px) scale(${s})`;
  };
  addEventListener("resize", fit); fit();

  /* ---------- 时钟 ---------- */
  const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const p2 = (n) => String(n).padStart(2, "0");
  /* 只有变化的那一位数字落下，其余不动 */
  const setDigits = (id, v) => {
    const el = $(id);
    if (el.dataset.v === v) return;
    const old = el.dataset.v || "";
    el.dataset.v = v; el.textContent = "";
    [...v].forEach((c, i) => {
      const s = document.createElement("span"); s.textContent = c;
      if (old && old[i] !== c && !STATIC) s.className = "tick";
      el.appendChild(s);
    });
  };
  const tick = () => {
    const d = new Date(), h = d.getHours();
    setDigits("hh", p2(h));
    setDigits("mm", p2(d.getMinutes()));
    $("md").textContent = `${p2(d.getMonth() + 1)}/${p2(d.getDate())}`;
    $("dow").textContent = DOW[d.getDay()];
    $("deskclock").textContent = `${p2(h)}:${p2(d.getMinutes())}`;
  };
  tick(); setInterval(tick, 1000);

  /* ---------- 气泡 + 视差（照搬 p3-shell） ---------- */
  const bubbles = $("bubbles"), bg = $("bg");
  for (let i = 0; i < 16; i++) {
    const b = document.createElement("i"), s = 6 + Math.random() * 16;
    Object.assign(b.style, { left: 760 + Math.random() * 1140 + "px", top: 1100 + Math.random() * 40 + "px",
      width: s + "px", height: s + "px", animationDuration: 9 + Math.random() * 10 + "s",
      animationDelay: -Math.random() * 19 + "s" });
    bubbles.appendChild(b);
  }
  addEventListener("mousemove", (e) => {
    if (body.classList.contains("up")) return;
    const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
    bg.style.transform = `translate(${nx * -18}px, ${ny * -12}px)`;
  });

  /* ---------- 状态 ---------- */
  let pw = "", busy = false, mode = "pass", sel = 0, ask = -1, unlocked = false;
  const line = $("line"), dots = $("dots"), cur = $("cur"), status = $("status");
  const row = document.createElement("div"); row.className = "row"; dots.appendChild(row);
  const STEP = 32, MAXV = Math.floor((820 - 40) / STEP);

  const setStatus = (el, text, red) => {
    if (el.textContent === text && el.classList.contains("red") === !!red) return;
    el.classList.add("swap");
    el.textContent = text; el.classList.toggle("red", !!red);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("swap")));
  };
  let denied = false, deniedMsg = "WRONG PASSWORD";
  const refreshStatus = () => {
    body.classList.toggle("caps", sys.state.caps);
    if (busy) setStatus(status, "VERIFYING");
    else if (denied) setStatus(status, deniedMsg, true);
    else setStatus(status, "");
  };

  const layout = () => {
    const n = pw.length, shift = Math.max(0, n - MAXV) * STEP;
    row.style.transform = `translateX(${-shift}px)`;
    cur.style.transform = `translateX(${Math.min(n, MAXV) * STEP}px)`;
  };
  const ripple = (x) => {
    if (STATIC) return;
    const r = document.createElement("i"); r.className = "rip"; r.style.left = x + "px";
    line.appendChild(r); r.addEventListener("animationend", () => r.remove());
  };
  const addChar = (c) => {
    if (busy) return;
    if (denied) { denied = false; line.classList.remove("err", "sink"); row.textContent = ""; pw = ""; }
    pw += c;
    const d = document.createElement("span"); d.className = "dot"; d.style.setProperty("--i", pw.length);
    d.appendChild(document.createElement("b")); row.appendChild(d);
    layout(); ripple(12 + (Math.min(pw.length, MAXV) - 1) * STEP); refreshStatus();
  };
  const backspace = () => {
    if (busy || !pw.length) return;
    pw = pw.slice(0, -1);
    const live = row.querySelectorAll(".dot:not(.out)"), last = live[live.length - 1];
    if (last) { last.classList.add("out"); STATIC ? last.remove() : setTimeout(() => last.remove(), 480); }
    layout();
  };
  const clear = () => {
    if (busy) return;
    pw = ""; denied = false; line.classList.remove("err", "sink");
    row.querySelectorAll(".dot").forEach((d) => d.classList.add("out"));
    setTimeout(() => { if (!pw) row.textContent = ""; }, STATIC ? 0 : 480);
    layout(); refreshStatus();
  };

  const submit = () => {
    if (busy || !pw.length) return;
    busy = true; line.classList.add("busy"); refreshStatus();
    /* 保证 VERIFYING 至少显示 700ms，PAM 很快返回时亮段也能走完一个来回 */
    const minT = STATIC ? 0 : 700, t0 = performance.now();
    const settle = (fn) => setTimeout(() => { busy = false; line.classList.remove("busy"); fn(); },
      Math.max(0, minT - (performance.now() - t0)));
    sys.auth.submit(pw).then(() => settle(unlock), (e) => settle(() => fail(e && e.message)));
  };
  const fail = (msg) => {
    denied = true; deniedMsg = msg || "WRONG PASSWORD"; refreshStatus();
    line.classList.remove("err"); void line.offsetWidth; line.classList.add("err");
    setTimeout(() => { if (denied) line.classList.add("sink"); }, 900);
    setTimeout(() => { if (denied) { row.textContent = ""; pw = ""; layout(); } }, 1600);
  };

  /* ---------- 解锁：上浮到水面 ---------- */
  const unlock = () => {
    unlocked = true;
    // 一次性涌出的气泡
    for (let i = 0; i < 46; i++) {
      const b = document.createElement("i"), s = 6 + Math.random() * 26;
      b.className = "burst";
      Object.assign(b.style, { left: 200 + Math.random() * 1700 + "px", top: 1060 + Math.random() * 120 + "px",
        width: s + "px", height: s + "px" });
      b.style.setProperty("--t", 1 + Math.random() * .9 + "s");
      b.style.setProperty("--dl", Math.random() * .5 + "s");
      b.style.setProperty("--dx", (Math.random() - .5) * 140 + "px");
      bubbles.appendChild(b);
      b.addEventListener("animationend", () => b.remove());
    }
    bg.style.transform = "";
    body.classList.add("up");
    /* 解锁分两段（见 INTEGRATION.md「解锁转场」）：
       0–450ms 锁屏表面上：UI 上浮、光束变亮、气泡涌出；
       450ms 起水下层下沉露出桌面，这一段在真实实现里由 overlay 播放，所以此刻解除 session lock */
    setTimeout(() => sys.release(), STATIC ? 0 : 450);
  };
  const relock = () => {
    sys.relock();
    unlocked = false; pw = ""; denied = false; row.textContent = ""; layout();
    body.classList.remove("up", "pmode"); mode = "pass";
    body.classList.add("idle"); refreshStatus();
  };

  /* ---------- 电源菜单 ---------- */
  const items = [...document.querySelectorAll(".pi")], pstatus = $("pstatus");
  const NAMES = { suspend: "SUSPEND", reboot: "REBOOT", poweroff: "POWER OFF" };
  const paint = () => {
    items.forEach((el, i) => {
      el.classList.toggle("sel", i === sel);
      el.classList.toggle("ask", i === ask);
      const t = i === ask ? NAMES[el.dataset.a] + "?" : NAMES[el.dataset.a];
      el.querySelector(".tx").textContent = t; el.querySelector(".echo").textContent = t;
    });
  };
  const openPower = () => { mode = "power"; sel = 0; ask = -1; body.classList.add("pmode"); setStatus(pstatus, ""); paint(); };
  const closePower = () => { mode = "pass"; ask = -1; body.classList.remove("pmode"); paint(); };
  const move = (d) => { sel = (sel + d + items.length) % items.length; ask = -1; setStatus(pstatus, ""); paint(); };
  const fire = () => {
    const el = items[sel], a = el.dataset.a;
    el.classList.remove("hit"); void el.offsetWidth; el.classList.add("hit");
    if (a !== "suspend" && ask !== sel) { ask = sel; setStatus(pstatus, "AGAIN TO CONFIRM", true); paint(); return; }
    ask = -1; paint();
    sys.power.run(a).then((r) => setStatus(pstatus, r.msg || ""), (e) => setStatus(pstatus, e.message, true));
  };
  items.forEach((el, i) => {
    el.addEventListener("mouseenter", () => { if (mode === "power" && sel !== i) { sel = i; ask = -1; setStatus(pstatus, ""); paint(); } });
    el.addEventListener("click", () => { if (mode === "power") { sel = i; fire(); } });
  });
  $("tabkey").addEventListener("click", (e) => { e.stopPropagation(); wake(); openPower(); });
  /* 电源模式下点空白水面 = 返回 */
  $("stage").addEventListener("click", (e) => { if (mode === "power" && !e.target.closest(".pi")) { closePower(); arm(); } });

  /* ---------- 待机唤醒 ---------- */
  const IDLE_MS = 20000; let idleT = 0;
  const goIdle = () => {
    if (unlocked || busy) return;
    if (mode === "power") closePower();
    pw = ""; denied = false; line.classList.remove("err", "sink"); row.textContent = ""; layout();
    body.classList.add("idle"); refreshStatus();
  };
  const arm = () => { clearTimeout(idleT); if (!q.get("state")) idleT = setTimeout(goIdle, IDLE_MS); };
  const wake = () => { if (body.classList.contains("idle")) body.classList.remove("idle"); arm(); };
  /* 只有明显的鼠标移动才唤醒，避免桌上轻微抖动 */
  let mx = null, my = null;
  addEventListener("mousemove", (e) => {
    if (unlocked) return;
    if (mx === null) { mx = e.clientX; my = e.clientY; return; }
    if (Math.abs(e.clientX - mx) + Math.abs(e.clientY - my) > 24) { mx = e.clientX; my = e.clientY; body.classList.add("pointer"); wake(); }
  }, { passive: true });
  addEventListener("mousedown", () => { if (!unlocked) wake(); });

  /* ---------- 键盘 ---------- */
  sys.on("caps", refreshStatus);
  addEventListener("keydown", (e) => {
    if (unlocked) { if (e.key === "l" || e.key === "L") relock(); return; }
    const wasIdle = body.classList.contains("idle");
    body.classList.remove("pointer");
    wake();
    if (mode === "power") {
      e.preventDefault();
      if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) move(-1);
      else if (e.key === "ArrowDown" || e.key === "Tab") move(1);
      else if (e.key === "Enter" || e.key === " ") fire();
      else if (e.key === "Escape") closePower();
      return;
    }
    if (e.key === "Tab") { e.preventDefault(); openPower(); return; }
    if (e.key === "Enter") { e.preventDefault(); submit(); return; }
    if (e.key === "Backspace") { e.preventDefault(); backspace(); return; }
    if (e.key === "Escape" && !pw && !wasIdle) { e.preventDefault(); goIdle(); return; }
    if (e.key === "Escape" || (e.ctrlKey && (e.key === "u" || e.key === "U"))) { e.preventDefault(); clear(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      // 唤醒用的第一个键也算输入（与 p5lock 一致：直接开始打字）
      addChar(e.key);
    }
  });

  /* ---------- 调试状态 ---------- */
  const st = q.get("state");
  const preset = (s) => { for (const c of s) addChar(c); };
  if (st && st !== "idle") {
    body.classList.remove("idle");
    if (st === "typing") preset("hunter2!");
    if (st === "caps") { preset("pass"); refreshStatus(); }
    if (st === "verify") { preset("password"); busy = true; line.classList.add("busy"); refreshStatus(); }
    if (st === "error") { preset("fail"); denied = true; line.classList.add("err"); refreshStatus(); }
    if (st === "power") { openPower(); sel = 2; ask = 2; setStatus(pstatus, "AGAIN TO CONFIRM", true); paint(); }
    if (st === "unlock") { body.classList.add("up"); unlocked = true; }
  }
  refreshStatus();
})();
