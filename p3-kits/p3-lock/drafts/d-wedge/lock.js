// P3 LOCK · d-wedge 演示逻辑（纯前端，不做任何真实操作）
// 参数：?static  ?theme=lavender  ?caps  ?state=idle|type|error|verify|power|caps|unlock  ?user=  ?host=
(() => {
  const q = new URLSearchParams(location.search);
  const STATIC = q.has("static");
  const root = document.documentElement, body = document.body;
  if (STATIC) root.classList.add("static");
  if (q.get("theme") === "lavender") root.dataset.theme = "lavender";
  const $ = id => document.getElementById(id);

  const USER = (q.get("user") || "lyfmt").toUpperCase();
  const HOST = (q.get("host") || "archlinux").toUpperCase();
  $("user").textContent = USER;
  $("host").textContent = "@ " + HOST;

  // 背景气泡
  const bubbles = $("bubbles");
  for (let k = 0; k < 14; k++) {
    const b = document.createElement("i"), s = 6 + Math.random() * 16;
    b.style.cssText = `left:${760 + Math.random() * 1140}px;top:${1100 + Math.random() * 40}px;width:${s}px;height:${s}px;` +
      `animation-duration:${9 + Math.random() * 10}s;animation-delay:${-Math.random() * 18}s`;
    bubbles.appendChild(b);
  }

  // 时间
  function tick() {
    const d = new Date(), h = d.getHours();
    $("hh").textContent = String(h).padStart(2, "0");
    $("mm").textContent = String(d.getMinutes()).padStart(2, "0");
    $("dow").textContent = ["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()];
    $("md").textContent = `${d.getMonth() + 1}/${d.getDate()}`;
    $("tod").textContent = h < 5 ? "DARK HOUR" : h < 9 ? "EARLY MORNING" : h < 12 ? "MORNING" : h < 13 ? "LUNCHTIME" :
      h < 17 ? "AFTERNOON" : h < 19 ? "AFTER SCHOOL" : "EVENING";
  }
  tick(); setInterval(tick, 10000);

  // 入场错峰
  ["clock", "who", "hint", "field", "keys"].forEach((id, i) => { $(id).classList.add("in"); $(id).style.setProperty("--i", i); });

  // 舞台缩放：contain，保证锁屏元素不被裁
  const stage = $("stage");
  const fit = () => stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`;
  fit(); addEventListener("resize", fit);

  // ---------- 状态 ----------
  const field = $("field"), glyphs = $("glyphs"), caret = $("caret"), status = $("status"), msg = $("msg"), sub = $("sub");
  let pw = "", busy = false, locked = true, idleTimer;
  const PITCH = 32; // 字块宽 20 + 间距 12
  const MAX_SHOWN = 16;

  function setMsg(t, zh = "", cls = "") {
    msg.textContent = t; sub.textContent = zh;
    status.classList.remove("err", "swap"); void status.offsetWidth;
    if (cls) status.classList.add(cls);
  }
  function wake() {
    if (body.classList.contains("awake")) return armIdle();
    body.classList.add("awake");
    setMsg("ENTER PASSWORD", "输入密码解锁", "swap");
    armIdle();
  }
  // 30 秒无操作且没输入 → 收回楔形
  function armIdle() {
    clearTimeout(idleTimer);
    if (q.has("state")) return;
    idleTimer = setTimeout(() => { if (!pw && !busy && !body.classList.contains("pw")) body.classList.remove("awake"); }, 30000);
  }
  function render() {
    const shown = Math.min(pw.length, MAX_SHOWN);
    caret.style.setProperty("--cx", `${44 + shown * PITCH - (shown ? 4 : 0)}px`);
    field.classList.toggle("has", pw.length > 0);
    field.classList.remove("bump"); void field.offsetWidth; field.classList.add("bump");
  }
  function add(ch) {
    pw += ch;
    if (pw.length <= MAX_SHOWN) {
      const g = document.createElement("i");
      g.style.setProperty("--k", pw.length - 1);
      glyphs.appendChild(g);
    }
    render();
  }
  function del() {
    if (!pw) return;
    pw = pw.slice(0, -1);
    const live = [...glyphs.children].filter(n => !n.classList.contains("out") && !n.classList.contains("fall"));
    if (live.length > pw.length) {
      const g = live[live.length - 1];
      g.classList.add("out");
      setTimeout(() => g.remove(), STATIC ? 0 : 180);
    }
    render();
  }
  // 清空：字块散落沉下去
  function clear() {
    if (!pw) return;
    pw = "";
    [...glyphs.children].forEach((g, k) => {
      g.style.setProperty("--k", k);
      g.style.setProperty("--dx", `${(Math.random() - .5) * 60}px`);
      g.style.setProperty("--rot", `${(Math.random() - .5) * 70}deg`);
      g.classList.add("fall");
    });
    setTimeout(() => { glyphs.querySelectorAll(".fall").forEach(g => g.remove()); }, STATIC ? 0 : 900);
    render();
  }
  function submit() {
    if (!pw || busy) return;
    busy = true;
    field.classList.add("busy");
    [...glyphs.children].forEach((g, k) => g.style.setProperty("--k", k));
    setMsg("VERIFYING", "验证中", "swap");
    setTimeout(() => {
      busy = false;
      field.classList.remove("busy");
      if (pw === "fail") fail(); else unlock();
    }, 700);
  }
  function fail() {
    clear();
    field.classList.remove("err"); void field.offsetWidth; field.classList.add("err");
    setMsg("WRONG PASSWORD", "密码错误，请重试", "err");
    setTimeout(() => field.classList.remove("err"), 600);
  }
  function unlock() {
    locked = false;
    setMsg("WELCOME BACK", "", "swap");
    body.classList.add("unlock");
    // 楔形长满屏幕的那一刻切走锁屏层，再擦出桌面
    setTimeout(() => body.classList.add("revealed"), STATIC ? 0 : 560);
  }
  function relock() {
    body.classList.remove("unlock", "revealed", "awake");
    glyphs.innerHTML = ""; pw = ""; render(); locked = true;
    setMsg("ENTER PASSWORD", "输入密码解锁");
    ["clock", "who", "hint", "field", "keys"].forEach(id => { const n = $(id); n.classList.remove("in"); void n.offsetWidth; n.classList.add("in"); });
  }

  // ---------- 电源 ----------
  const ACTS = [
    { id: "suspend",  t: "SUSPEND",   zh: "挂起", confirm: false },
    { id: "reboot",   t: "REBOOT",    zh: "重启", confirm: true },
    { id: "poweroff", t: "POWER OFF", zh: "关机", confirm: true },
  ];
  const power = $("power");
  let psel = 0, armed = -1, toastTimer;
  power.innerHTML = ACTS.map((a, i) => `<div class="it" data-i="${i}"><span class="l">${a.zh}</span><span class="d">${a.t}</span></div>`).join("");
  const items = [...power.children];
  items.forEach((el, i) => {
    el.addEventListener("mouseenter", () => pselect(i));
    el.addEventListener("click", e => { e.stopPropagation(); pselect(i); trigger(); });
  });
  function pselect(i) {
    i = (i + ACTS.length) % ACTS.length;
    if (i !== psel) disarm();
    items[psel]?.classList.remove("sel"); psel = i; items[i].classList.add("sel");
  }
  function disarm() {
    if (armed < 0) return;
    items[armed].classList.remove("armed");
    items[armed].querySelector(".l").textContent = ACTS[armed].zh;
    armed = -1;
  }
  function trigger() {
    const a = ACTS[psel];
    if (a.confirm && armed !== psel) {
      disarm(); armed = psel;
      items[psel].classList.add("armed");
      items[psel].querySelector(".l").textContent = "再按一次";
      setMsg(a.t + "?", "再按一次 Enter 确认", "swap");
      return;
    }
    disarm();
    console.log("[p3-lock demo] power action:", a.id);
    setMsg("→ " + a.t, "演示模式：不会真的执行", "swap");
    closePower();
  }
  function openPower() {
    if (busy || !locked) return;
    wake();
    body.classList.add("pw");
    pselect(psel);
    setMsg("POWER", "↑↓ 选择 · Enter 执行 · Esc 返回", "swap");
    setKeys();
  }
  function closePower() {
    disarm();
    body.classList.remove("pw");
    setKeys();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (!body.classList.contains("pw") && !busy && locked) setMsg("ENTER PASSWORD", "输入密码解锁", "swap"); }, 1600);
  }

  // ---------- 按键提示 ----------
  const keys = $("keys");
  function setKeys() {
    const k = body.classList.contains("pw")
      ? [["↑↓", "选择", null], ["ENTER", "执行", null], ["ESC", "返回", closePower]]
      : [["ENTER", "解锁", null], ["ESC", "清空", null], ["TAB", "电源", openPower]];
    keys.innerHTML = k.map(([a, b], i) => `<span data-i="${i}"><kbd>${a}</kbd><span class="zh">${b}</span></span>`).join("");
    [...keys.children].forEach((n, i) => { if (k[i][2]) n.addEventListener("click", e => { e.stopPropagation(); k[i][2](); }); });
  }
  setKeys();

  // ---------- 输入 ----------
  const capsOn = e => { try { return e.getModifierState("CapsLock"); } catch { return false; } };
  function updateCaps(e) { if (!q.has("caps")) body.classList.toggle("caps", capsOn(e)); }
  if (q.has("caps")) body.classList.add("caps");

  addEventListener("keydown", e => {
    updateCaps(e);
    if (!locked) { if (e.key === "l" || e.key === "L") relock(); return; }
    const wasAwake = body.classList.contains("awake");
    wake();
    if (body.classList.contains("pw")) {
      e.preventDefault();
      if (e.key === "ArrowDown" || e.key === "Tab" && !e.shiftKey) pselect(psel + 1);
      else if (e.key === "ArrowUp" || e.key === "Tab") pselect(psel - 1);
      else if (e.key === "Enter" || e.key === " ") trigger();
      else if (e.key === "Escape") closePower();
      return;
    }
    if (busy) return;
    if (e.key === "Tab") { e.preventDefault(); openPower(); return; }
    if (e.key === "Enter") { e.preventDefault(); submit(); return; }
    if (e.key === "Backspace") { e.preventDefault(); (e.ctrlKey ? clear : del)(); return; }
    if (e.key === "Escape" || (e.ctrlKey && (e.key === "u" || e.key === "U"))) { e.preventDefault(); clear(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      // 第一次按键只用来唤醒时也计入（P3 里任意键 = 开始），空格除外
      if (!wasAwake && e.key === " ") return;
      add(e.key);
    }
  });
  addEventListener("keyup", updateCaps);

  const bg = $("bg");
  let lastMove = 0;
  addEventListener("mousemove", e => {
    const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
    bg.style.transform = `translate(${nx * -18}px, ${ny * -12}px)`;
    // 轻微移动不唤醒（防误触），累计移动才唤醒
    if (locked && Math.abs(e.movementX) + Math.abs(e.movementY) > 4 && performance.now() - lastMove < 200) wake();
    lastMove = performance.now();
  });
  addEventListener("mousedown", e => {
    if (!locked) return;
    if (body.classList.contains("pw") && !power.contains(e.target)) { closePower(); return; }
    wake();
  });

  // ---------- 冻结状态（截图用） ----------
  const st = q.get("state");
  const fill = s => { for (const c of s) add(c); };
  if (st && st !== "idle") {
    body.classList.add("awake");
    setMsg("ENTER PASSWORD", "输入密码解锁");
    if (st === "type") fill("hunter2s");
    if (st === "caps") { body.classList.add("caps"); fill("abc"); }
    if (st === "verify") { fill("hunter2s"); busy = true; field.classList.add("busy"); [...glyphs.children].forEach((g, k) => g.style.setProperty("--k", k)); setMsg("VERIFYING", "验证中"); }
    if (st === "error") { field.classList.add("err"); setMsg("WRONG PASSWORD", "密码错误，请重试", "err"); }
    if (st === "power") { openPower(); pselect(2); trigger(); }
    if (st === "unlock") { fill("hunter2s"); unlock(); }
  } else if (!st) {
    setMsg("ENTER PASSWORD", "输入密码解锁");
  }
})();
