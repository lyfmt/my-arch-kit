// P3 LOCK · 方案 b-column（演示模式，不做真实认证）
// 列：USER（不可选） / PASSWORD / POWER。POWER 确认后原地展开成 3 个子词（替换列，不弹面板）
// 键位：任意可见字符 → 输入；Backspace 删一个；Esc / Ctrl+U 清空；Enter 提交；
//       Tab / ↑↓ 在 PASSWORD 与 POWER 之间切换；POWER 上 Enter → 展开 SUSPEND / REBOOT / POWER OFF；
//       REBOOT 与 POWER OFF 要再按一次 Enter（行变 SURE?）；Esc 收回
// 演示：输入 fail 回车失败，其他任意内容回车解锁
// 调试：?static  ?theme=lavender  ?caps  ?state=idle|typing|verify|error|power|confirm|caps|desktop
(() => {
  const q = new URLSearchParams(location.search);
  const STATIC = q.has("static");
  const html = document.documentElement, body = document.body;
  if (STATIC) html.classList.add("static");
  if (q.get("theme") === "lavender") html.dataset.theme = "lavender";
  const STATE = q.get("state");
  const $ = id => document.getElementById(id);

  const USER = "lyfmt", HOST = "archlinux";
  $("uname").textContent = USER.toUpperCase();
  $("host").textContent = "◆ " + HOST + "  ·  LOCKED";

  // 列几何：沿头发从右上往左下，同 p3-shell 主菜单
  const MAIN = [
    { id: "pw",    t: "PASSWORD", zh: "输入密码", x: 1150, y: 470, r: -6 },
    { id: "power", t: "POWER",    zh: "关机与重启", x: 1080, y: 690, r: 3 },
  ];
  const POWER = [
    { id: "suspend",  t: "SUSPEND",   zh: "挂起",       x: 1150, y: 470, r: -6 },
    { id: "reboot",   t: "REBOOT",    zh: "重启 · 需确认", x: 1115, y: 590, r: -2, ask: true },
    { id: "poweroff", t: "POWER OFF", zh: "关机 · 需确认", x: 1080, y: 710, r: 3, ask: true },
  ];

  const rowsEl = $("rows"), hlW = $("hlW"), hlR = $("hlR"), statusEl = $("status"), stTag = $("stTag"), stZh = $("stZh");
  const capsEl = $("caps"), shakeEl = $("shake");
  let items = MAIN, els = [], cur = 0, mode = "main", asking = -1;
  let pw = "", busy = false, unlocking = false, idle = true, errTimer, idleTimer;

  function rowHTML(it) {
    if (it.id === "pw") return `<span class="echo"><span class="word">PASSWORD</span><span class="dots"></span></span>` +
      `<span class="tx"><span class="word">PASSWORD</span><span class="dots" id="dots"></span></span>`;
    return `<span class="echo">${it.t}</span><span class="tx">${it.t}</span>`;
  }
  function build(list, sel = 0) {
    items = list;
    rowsEl.innerHTML = "";
    els = list.map((it, i) => {
      const el = document.createElement("div");
      el.className = "it row d" + (it.id === "pw" ? " pw" : "");
      el.style.cssText = `--x:${it.x}px;--y:${it.y}px;--r:${it.r}deg;--i:${i + 1}`;
      el.innerHTML = rowHTML(it);
      el.addEventListener("mouseenter", () => { if (!unlocking) select(i); });
      el.addEventListener("click", () => { select(i); activate(); });
      rowsEl.appendChild(el);
      return el;
    });
    cur = -1; select(sel, true);
    renderPw(false);
  }

  // 白楔对齐当前行：与 .row.on 相同的变换链（原点 0 60%）rotate → translate(-18px) → scale(1.22)
  function place(instant) {
    const it = items[cur], el = els[cur];
    if (!el) return;
    const S = 1.22, h0 = el.offsetHeight, w = el.offsetWidth * S, h = h0 * S;
    const base = `translate(${it.x}px, ${it.y + h0 * .6}px) rotate(${it.r}deg) translate(-18px, ${-h * .6}px)`;
    const tw = `${base} scale(${w / 100}, ${h / 100})`;
    [hlW, hlR].forEach(n => {
      if (instant || STATIC) { n.style.transition = "none"; n.style.transform = tw; void n.offsetWidth; n.style.transition = ""; }
      else n.style.transform = tw;
    });
    // 状态行：贴在白楔下方；Caps 标签：挂在白楔右上
    statusEl.style.transform = `${base} translate(${10}px, ${h + 26}px)`;
    const pIt = items.find(x => x.id === "pw");
    if (pIt) {
      const pe = els[items.indexOf(pIt)], ph = pe.offsetHeight, pS = cur === items.indexOf(pIt) ? S : 1;
      capsEl.style.transform = `translate(${pIt.x}px, ${pIt.y + ph * .6}px) rotate(${pIt.r}deg) translate(${pe.offsetWidth * pS + 8}px, ${-ph * pS * .6 - 4}px)`;
      capsEl.style.display = "";
    } else capsEl.style.display = "none";
  }
  function select(i, instant) {
    i = (i + items.length) % items.length;
    if (i === cur) return;
    if (cur >= 0 && els[cur]) els[cur].classList.remove("on", "ask");
    if (asking >= 0) { asking = -1; restoreAskText(); }
    cur = i; els[i].classList.add("on");
    place(instant);
    hint();
  }
  function hint() {
    statusEl.className = "status";
    const it = items[cur];
    if (it.id === "pw") {
      if (busy) say("VERIFYING", "验证中…", "ok");
      else if (pw) say(`${[...pw].length} CHARS`, "Enter 解锁 · Esc 清空");
      else say("TYPE TO UNLOCK", "输入密码后按 Enter");
    } else if (mode === "power") say(it.t, it.zh);
    else say("POWER", "Enter 展开 · 挂起 / 重启 / 关机");
  }
  function say(t, zh, cls) { stTag.textContent = t; stZh.textContent = zh; if (cls) statusEl.classList.add(cls); }

  // ---------- 密码 ----------
  let lastN = 0;
  function renderPw(anim = true) {
    const dots = $("dots"); if (!dots) return;
    const echoDots = els[0].querySelector(".echo .dots");
    const n = [...pw].length;
    els[0].classList.toggle("has", n > 0);
    if (n > lastN && anim) {
      for (let k = lastN; k < n; k++) { const i = document.createElement("i"); i.style.setProperty("--k", k); dots.appendChild(i); }
      puff(dots);
    } else if (n < lastN) {
      const live = [...dots.querySelectorAll("i:not(.out)")];
      live.slice(n).forEach(i => {
        if (STATIC || !anim) return i.remove();
        i.style.left = i.offsetLeft + "px"; i.classList.add("out"); setTimeout(() => i.remove(), 420);
      });
    } else if (!anim) {
      dots.innerHTML = ""; for (let k = 0; k < n; k++) { const i = document.createElement("i"); i.style.setProperty("--k", k); dots.appendChild(i); }
    }
    echoDots.innerHTML = "<i></i>".repeat(n);
    lastN = n;
    if (items[cur]?.id === "pw") { place(); hint(); }
  }
  // 每个字符从光标处冒一颗气泡
  function puff(dots) {
    if (STATIC) return;
    const r = dots.getBoundingClientRect(), st = $("stage").getBoundingClientRect(), k = st.width / 1920;
    const b = document.createElement("i");
    b.className = "puff";
    b.style.left = (r.right - st.left) / k + "px";
    b.style.top = (r.top + r.height / 2 - st.top) / k + "px";
    b.style.setProperty("--dx", (Math.random() * 40 - 10).toFixed(0) + "px");
    const s = 8 + Math.random() * 12; b.style.width = b.style.height = s + "px";
    $("lock").appendChild(b);
    setTimeout(() => b.remove(), 1500);
  }
  function type(ch) { if (busy) return; endError(); if (items[cur].id !== "pw") build(MAIN, 0), mode = "main"; pw += ch; renderPw(); }
  function back() { if (busy || !pw) return; pw = [...pw].slice(0, -1).join(""); renderPw(); }
  function clear() { if (busy) return; pw = ""; renderPw(); }
  function submit() {
    if (busy || !pw) return;
    busy = true; body.classList.add("verify"); hint();
    setTimeout(() => {
      busy = false; body.classList.remove("verify");
      if (pw === "fail") fail(); else unlock();
    }, STATIC ? 0 : 700);
  }
  function fail(freeze) {
    body.classList.add("error");
    statusEl.className = "status"; void statusEl.offsetWidth;
    say("WRONG PASSWORD", "密码错误，请重试", "err");
    shakeEl.classList.remove("shake"); void shakeEl.offsetWidth; shakeEl.classList.add("shake");
    hlW.classList.remove("hit"); void hlW.offsetWidth; hlW.classList.add("hit");
    if (!freeze) setTimeout(() => { pw = ""; renderPw(); body.classList.add("error"); say("WRONG PASSWORD", "密码错误，请重试", "err"); }, 460);
    clearTimeout(errTimer);
    if (!freeze) errTimer = setTimeout(endError, 2200);
  }
  function endError() { clearTimeout(errTimer); if (!body.classList.contains("error")) return; body.classList.remove("error"); hint(); }

  // ---------- 解锁 ----------
  function unlock() {
    unlocking = true;
    say("WELCOME BACK", "欢迎回来", "ok");
    body.classList.add("unlock");
    const t = STATIC ? 0 : 1;
    setTimeout(() => body.classList.add("sweep"), 320 * t);
    setTimeout(() => body.classList.add("gone"), 1400 * t);
  }
  function relock() {
    body.classList.remove("unlock", "sweep", "gone", "error", "verify");
    unlocking = false; pw = ""; lastN = 0; mode = "main"; build(MAIN, 0); toIdle();
  }

  // ---------- 电源 ----------
  function openPower(sel = 0) { mode = "power"; build(POWER, sel); }
  function closePower() { mode = "main"; asking = -1; build(MAIN, 1); }
  function restoreAskText() { els.forEach((e, i) => { const t = items[i].t; if (items[i].id !== "pw") e.querySelectorAll(".tx,.echo").forEach(n => n.textContent = t); e.classList.remove("ask"); }); }
  function activate() {
    const it = items[cur];
    hlW.classList.remove("hit"); void hlW.offsetWidth; hlW.classList.add("hit");
    if (it.id === "pw") return submit();
    if (it.id === "power") return openPower(0);
    if (it.ask && asking !== cur) {
      asking = cur; const e = els[cur]; e.classList.add("ask");
      e.querySelectorAll(".tx,.echo").forEach(n => n.textContent = "SURE?");
      place(); say(it.t + " · CONFIRM", "再按一次 Enter 执行 · Esc 取消", "err");
      return;
    }
    // 演示：只打日志
    console.log("[demo] systemctl " + it.id);
    say("→ " + it.t, "演示模式：不会真的执行", "ok");
    asking = -1; restoreAskText(); place();
  }

  // ---------- 待机 ----------
  function wake() {
    if (STATE === "idle") return;
    if (!idle) { armIdle(); return; }
    idle = false; body.classList.remove("idle");
    // 重新播放行入场
    els.forEach(e => { e.style.animation = "none"; void e.offsetWidth; e.style.animation = ""; });
    requestAnimationFrame(() => place(true));
    armIdle();
  }
  function toIdle() { if (STATE) return; if (pw || busy || unlocking || mode !== "main") return armIdle(); idle = true; body.classList.add("idle"); }
  function armIdle() { clearTimeout(idleTimer); if (!STATIC && !STATE) idleTimer = setTimeout(toIdle, 12000); }

  addEventListener("keydown", e => {
    if (body.classList.contains("gone")) { relock(); return; }
    if (unlocking) return e.preventDefault();
    setCaps(e);
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (idle) {
      wake();
      // 待机时按下的可见字符直接算作第一个字符，Enter/Esc 只唤醒
      if (!(k.length === 1 && !ctrl)) { e.preventDefault(); return; }
    }
    if (k === "Tab" || k === "ArrowDown") { e.preventDefault(); select(cur + (e.shiftKey ? -1 : 1)); }
    else if (k === "ArrowUp") { e.preventDefault(); select(cur - 1); }
    else if (k === "Enter") { e.preventDefault(); activate(); }
    else if (k === "Escape") { e.preventDefault(); if (mode === "power") { if (asking >= 0) { asking = -1; restoreAskText(); place(); hint(); } else closePower(); } else clear(); }
    else if (ctrl && (k === "u" || k === "U" || k === "Backspace")) { e.preventDefault(); clear(); }
    else if (k === "Backspace") { e.preventDefault(); if (mode === "power") closePower(); else back(); }
    else if (k.length === 1 && !ctrl && !e.altKey) { e.preventDefault(); type(k); }
  });
  addEventListener("keyup", setCaps);

  function setCaps(e) {
    if (q.has("caps") || STATE === "caps") return body.classList.add("caps");
    try { body.classList.toggle("caps", !!e.getModifierState?.("CapsLock")); } catch {}
  }

  // 鼠标：视差 + 唤醒
  const bg = $("bg"), col = $("col");
  let lastMove = 0;
  addEventListener("mousemove", e => {
    const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
    bg.style.transform = `translate(${nx * -18}px, ${ny * -12}px)`;
    col.style.translate = `${nx * 10}px ${ny * 6}px`;
    const now = performance.now();
    if (now - lastMove > 200) { lastMove = now; if (!unlocking) wake(); }
  });
  addEventListener("mousedown", e => { if (body.classList.contains("gone")) relock(); });

  // 背景气泡（照搬 p3-shell）
  const bubbles = $("bubbles");
  for (let k = 0; k < 14; k++) {
    const b = document.createElement("i"), s = 6 + Math.random() * 16;
    b.style.cssText = `left:${760 + Math.random() * 1140}px;top:${1100 + Math.random() * 40}px;width:${s}px;height:${s}px;` +
      `animation-duration:${9 + Math.random() * 10}s;animation-delay:${-Math.random() * 18}s`;
    bubbles.appendChild(b);
  }

  // 时钟
  const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  function tick() {
    const d = new Date(), h = d.getHours();
    const tod = h < 5 ? "DARK HOUR" : h < 9 ? "EARLY MORNING" : h < 12 ? "MORNING" : h < 13 ? "LUNCHTIME" :
      h < 17 ? "AFTERNOON" : h < 19 ? "AFTER SCHOOL" : "EVENING";
    $("hm").textContent = `${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    $("sub").innerHTML = `${d.getMonth() + 1}/${d.getDate()} ${DOW[d.getDay()]}<b>·</b>${tod}`;
  }
  tick(); setInterval(tick, 10000);

  // 键位提示（右下一行小字）
  const lock = $("lock");
  lock.insertAdjacentHTML("beforeend", `<div class="l wake" id="wake">PRESS ANY KEY</div>
    <div class="l keys"><span><b>ENTER</b><span class="zh">解锁</span></span><span><b>TAB</b><span class="zh">电源</span></span><span><b>ESC</b><span class="zh">清空</span></span></div>`);
  $("user").style.setProperty("--i", 0);

  // 舞台按 cover 缩放
  const stage = $("stage");
  function fit() { stage.style.transform = `scale(${Math.max(innerWidth / 1920, innerHeight / 1080)})`; }
  fit(); addEventListener("resize", fit);

  build(MAIN, 0);
  body.classList.add("idle");
  if (q.has("caps")) body.classList.add("caps");
  document.fonts?.ready.then(() => place(true));

  // 冻结状态（截图用）
  function freeze() {
    if (!STATE) return armIdle();
    idle = false; body.classList.remove("idle");
    if (STATE === "idle") { idle = true; body.classList.add("idle"); return; }
    if (STATE === "typing" || STATE === "caps") { pw = "hunter2"; renderPw(false); }
    if (STATE === "caps") body.classList.add("caps");
    if (STATE === "verify") { pw = "hunter2"; renderPw(false); busy = true; body.classList.add("verify"); hint(); }
    if (STATE === "error") { pw = "fail"; renderPw(false); fail(true); }
    if (STATE === "power") openPower(1);
    if (STATE === "confirm") { openPower(2); activate(); }
    if (STATE === "desktop") body.classList.add("unlock", "sweep", "gone");
    place(true);
  }
  document.fonts?.ready.then(freeze) ?? freeze();
})();
