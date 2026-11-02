// POWER 面板（round 3）：DMS PowerMenu 的 1:1 镜像，一张 3×2 磁贴网格 + 标题里的真实 uptime
//
// 数据来源（QML 移植时照此接线）
//   磁贴   = SettingsData.powerMenuActions 经 SessionService.isPowerActionSupported 过滤，再接 customPowerButtons
//            （PowerMenuContent.qml:167-169），**按数组原顺序**排。用户默认值
//            [reboot, logout, poweroff, lock, suspend, restart] 本身就是：上排结束会话、下排留在会话，不需要改设置
//   文案/快捷键 = SessionService.getPowerActionData（:568-636）
//   长按规则 = powerActionConfirm && action ∉ {lock, restart}（PowerMenuContent.qml:52-54），SUSPEND 也要长按
//   长按时长 = powerActionHoldDuration × 1000（0.5 s，不写死）
//   默认选中 = powerMenuDefaultAction（"logout"，上排中间）
//   执行     = lock → lockRequested（customPowerActionLock = p5lock.sh）；其余 → SessionService.executePowerAction
//   SUSPEND  = 移植时设 customPowerActionSuspend = "$HOME/.config/quickshell/p5lock/p5lock.sh --wait && systemctl suspend"，
//              与用户 niri 的 Mod+Alt+P 一致（先锁再睡）；SessionService.suspend() 本身就读这个设置
//   uptime   = DgopService.shortUptime（"up 8h 17m" / "up 2d 3h" / "up 45m" / "up"），打开时 addRef(["system"])，
//              关闭时 removeRef。按 /(\d+)([dhm])/g 拆成 数字+单位 对；一个都没有（"" 或 "up"）则整个槽位留空。
//              跟随 shortUptime 变化（dgop 有引用时每 3 s 采样，值每分钟变一次），count-up 只在首次渲染播
//              与 P5HomeDash（保留的岛上 "UP " + shortUptime）重复，明知重复仍保留：重启/关机前要看的就是这一个数；
//              ControlCenter HeaderPane 的 uptime 随 controlCenterButton 一起被裁掉
//   失败反馈 = executePowerAction 是发出即走，失败靠 DMS 自己的 toast；面板不做假的"成功"状态，
//              P3.flash 名词只表示"已发出"
//   移植时：执行前先收起整个 P3 覆盖层（DMS executeAction 先 closeRequested），再跑动作。
//   原型：只 flash 名词，面板保持打开，水位回落
//
// 交互
//   键盘：↑↓←→ 移动（3 列网格内循环，Tab/Shift+Tab = 下/上一行，Ctrl+N/P/J/K 同 DMS）
//         Enter / Space（Space 是 P3 加的 Enter 别名，按下和松开都处理）执行；长按项按住 0.5 s 水从下往上涨满才执行
//         L 锁屏 S 睡眠 D 重启 DMS X 注销 R 重启 P 关机（Ctrl+P 不算）：选中并按下/开始长按，同 DMS
//         提前松开：水 420 ms 缓出回落（P3 加的，DMS 直接归零）+ P3.flash "HOLD LONGER"
//         自动连发的 keydown（e.repeat）一律忽略：打开面板那一下 Enter 按住不放只会产生连发，
//         不会触发默认选中的 LOG OUT；面板只对挂载后的全新 keydown 起长按
//         SUSPEND 键盘长按满后进入 committed：等松键才执行（DMS :56-58），期间吞掉所有按键（含 Esc），5 s 无松键兜底执行
//         Esc：先取消进行中的长按，再由外壳关面板
//   鼠标：悬停即选中（P3 加的，DMS 只高亮）；长按项 pointerdown 开始，pointerup 或移出磁贴即取消回落
//         （移出取消是 P3 加的）；点按项在磁贴内松开才执行（P3 改的，DMS 在按下时执行，这样拖出去不会误锁屏）；
//         鼠标长按 SUSPEND 涨满即执行，不等松开（同 DMS holdFromKeyboard=false）
//   危险色只在一处：结束会话的动作（logout / reboot / softreboot / poweroff）的水是 --red，其余长按项（suspend）是 --fill
//   长按项底部有一条空水槽（细平涂条），提示"这里要灌满"，点按项没有
//   SWITCH USER 在 DMS 里没有快捷键（PowerMenuContent 只绑 P R B X L S H D），磁贴不画字母
//   磁贴数 ≠ 6：≤3 一行；4 = 2×2；5-6 = 3×2；7-9 = 3×3（磁贴变矮，元素缩小）
//
// 截图 / mock 参数
//   ?psel=<序号>        冻结选中项（默认 = powerMenuDefaultAction 的位置）
//   ?hold=<0-100>       冻结选中项的水位，用于看长按中间帧
//   ?up=<shortUptime>   mock DgopService.shortUptime，默认 "up 8h 17m"；如 ?up=up%202d%203h、?up=up%2045m、?up=up
//   ?acts=a,b,c         mock powerMenuActions（逗号分隔，可含 hibernate / softreboot / switchuser）
//   ?holddur=<秒>       mock powerActionHoldDuration（默认 0.5）
//   ?confirm=0          mock powerActionConfirm=false（全部点按即执行）
(() => {
  const SVG = {
    lock:    '<path d="M5 11h14v10H5z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    sleep:   '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    snow:    '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/>',
    logout:  '<path d="M10 4H4v16h6M9 12h11M16 8l4 4-4 4"/>',
    reboot:  '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    soft:    '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/><path d="M12 9v6"/>',
    off:     '<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
    shell:   '<path d="M4.5 10A8 8 0 0 1 18 6.5"/><path d="M18 2.5v4h-4"/><path d="M19.5 14A8 8 0 0 1 6 17.5"/><path d="M6 21.5v-4h4"/>',
    user:    '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    term:    '<path d="M4 6l6 6-6 6M12 18h8"/>',
  };
  const icon = k => `<svg class="pw-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square">${SVG[k]}</svg>`;

  // SessionService.getPowerActionData 的镜像；ends = 结束会话（危险色水）
  const TABLE = {
    reboot:     { t: "REBOOT",      ic: "reboot", key: "R", ends: true },
    softreboot: { t: "SOFT REBOOT", ic: "soft",   key: "B", ends: true, br: "SOFT<br>REBOOT" },
    logout:     { t: "LOG OUT",     ic: "logout", key: "X", ends: true },
    poweroff:   { t: "POWER OFF",   ic: "off",    key: "P", ends: true },
    lock:       { t: "LOCK",        ic: "lock",   key: "L" },
    suspend:    { t: "SUSPEND",     ic: "sleep",  key: "S" },
    hibernate:  { t: "HIBERNATE",   ic: "snow",   key: "H" },
    restart:    { t: "RESTART DMS", ic: "shell",  key: "D", br: "RESTART<br>DMS" },
    switchuser: { t: "SWITCH USER", ic: "user",   key: "",   br: "SWITCH<br>USER" },
  };

  const q = new URLSearchParams(location.search);
  // mock SettingsData（用户 settings.json 未覆盖，全是默认值）
  const S = {
    powerMenuActions: q.get("acts")?.split(",").map(s => s.trim()).filter(Boolean)
      ?? ["reboot", "logout", "poweroff", "lock", "suspend", "restart"],
    powerActionConfirm: q.get("confirm") !== "0",
    powerActionHoldDuration: +(q.get("holddur") ?? 0.5) || 0.5,
    powerMenuDefaultAction: "logout",
  };
  const UPTIME = q.get("up") ?? "up 8h 17m"; // mock DgopService.shortUptime（2026-10-30 15:05 开机）
  const HOLD_MS = S.powerActionHoldDuration * 1000, DRAIN_MS = 420, COMMIT_FALLBACK_MS = 5000;
  const needsConfirm = a => S.powerActionConfirm && a !== "lock" && a !== "restart";
  const wakesOnRelease = a => a === "suspend" || a === "hibernate";
  const ACTIONS = S.powerMenuActions.filter(a => TABLE[a]); // isPowerActionSupported：mock 下全支持

  // 网格形状：≤3 一行，4 = 2×2，其余 3 列
  const n = ACTIONS.length;
  const COLS = n <= 3 ? Math.max(1, n) : n === 4 ? 2 : 3;
  const ROWS = Math.max(1, Math.ceil(n / COLS));

  let root, grid, sel = 0, p = 0, raf = 0, t0 = 0, drainFrom = 0, hitTimer = 0, fallbackTimer = 0, commitIdx = -1;
  // mode: idle | hold | drain | committed；src: key | mouse
  let mode = "idle", src = "key", holdIdx = -1, tapIdx = -1;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const isActKey = e => e.key === "Enter" || e.key === " " ||
    (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1 && ACTIONS.some(a => TABLE[a].key === e.key.toUpperCase()));

  // 磁贴内容画两份：一份常规，一份放在水里，水位用 clip-path 露出，任何进度下文字都清晰
  const face = a => {
    const d = TABLE[a];
    return `<span class="pw-c">${d.key ? `<span class="l pw-k">${d.key}</span>` : ""}${icon(d.ic)}<span class="d pw-nm">${d.br || d.t}</span></span>`;
  };

  function upHTML() {
    const toks = [...UPTIME.matchAll(/(\d+)([dhm])/g)];
    if (!toks.length) return "";
    return `<span class="pw-up"><span class="l s">UP</span>` +
      toks.map(m => `<span class="pw-u"><b class="d" data-cu="${+m[1]}">${+m[1]}</b><span class="l">${m[2].toUpperCase()}</span></span>`).join("") +
      `</span>`;
  }

  function render() {
    root.innerHTML = `
      <div class="pn-head"><span class="d t">POWER</span>${upHTML()}</div>
      <div class="pw-grid${ROWS > 2 ? " pw-r3" : ""}" style="--cols:${COLS};--rows:${ROWS}">${ACTIONS.map((a, i) => `
        <div class="pw-tile${needsConfirm(a) ? " hold" : ""}${TABLE[a].ends ? " ends" : ""}" data-i="${i}">
          ${needsConfirm(a) ? '<i class="pw-sill"></i>' : ""}${face(a)}<i class="pw-fill">${face(a)}</i>
        </div>`).join("")}
      </div>`;
    grid = root.querySelector(".pw-grid");
    grid.querySelectorAll(".pw-tile").forEach(el => {
      const i = +el.dataset.i;
      el.addEventListener("pointerenter", () => { if (mode === "idle" || mode === "drain") select(i); });
      el.addEventListener("pointerdown", e => {
        if (e.button !== 0 || mode === "committed") return;
        e.preventDefault();
        if (needsConfirm(ACTIONS[i])) startHold(i, "mouse");
        else { select(i); tapIdx = i; }
      });
      el.addEventListener("pointerup", e => {
        if (e.button !== 0) return;
        if (tapIdx === i) { tapIdx = -1; startHold(i, "mouse"); }
      });
      el.addEventListener("pointerleave", () => {
        if (tapIdx === i) tapIdx = -1;
        if (mode === "hold" && src === "mouse" && holdIdx === i) cancelHold(true);
      });
    });
    root.querySelectorAll(".pw-up [data-cu]").forEach(b => P3.countUp(b, +b.dataset.cu, { dur: 900 }));
  }

  const tileEl = i => grid.querySelector(`.pw-tile[data-i="${i}"]`);

  function select(i, force) {
    if (!n) return;
    i = Math.max(0, Math.min(n - 1, i));
    if (i === sel && !force) return;
    stopAnim(); clearTimeout(hitTimer);
    mode = "idle";
    sel = i;
    grid.querySelectorAll(".pw-tile").forEach(el => el.classList.toggle("sel", +el.dataset.i === sel));
    P3.slideSel(grid, tileEl(sel));
    setP(0);
  }

  function setP(v) {
    p = Math.max(0, Math.min(1, v));
    root.style.setProperty("--p", p);
    root.classList.toggle("pw-hold", p > 0);
  }
  function stopAnim() { cancelAnimationFrame(raf); raf = 0; }

  function frame(now) {
    if (mode === "hold") {
      setP((now - t0) / HOLD_MS);
      if (p >= 1) return completeHold();
    } else if (mode === "drain") {
      const k = Math.min(1, (now - t0) / DRAIN_MS);
      setP(drainFrom * (1 - easeOut(k)));
      if (k >= 1) { mode = "idle"; return; }
    } else return;
    raf = requestAnimationFrame(frame);
  }
  function drain() {
    stopAnim();
    mode = "drain"; drainFrom = p; t0 = performance.now();
    if (P3.STATIC) { setP(0); mode = "idle"; return; }
    raf = requestAnimationFrame(frame);
  }

  // PowerMenuContent.startHold
  function startHold(i, from) {
    if (mode === "committed" || i < 0 || i >= n) return;
    if (i !== sel) select(i);
    src = from;
    const a = ACTIONS[i];
    if (!needsConfirm(a)) {
      if (from === "key" && wakesOnRelease(a)) return commit(i);
      return execute(i);
    }
    if (mode === "hold") return;
    stopAnim(); clearTimeout(hitTimer);
    mode = "hold"; holdIdx = i; t0 = performance.now();
    setP(0);
    if (P3.STATIC) { setP(1); return completeHold(); }
    raf = requestAnimationFrame(frame);
  }
  // PowerMenuContent.cancelHold；hint = 提前松开时提示 HOLD LONGER
  function cancelHold(hint) {
    if (mode !== "hold") return;
    holdIdx = -1;
    if (hint && p > 0 && p < 1) P3.flash("HOLD LONGER");
    drain();
  }
  function completeHold() {
    stopAnim();
    const i = holdIdx; holdIdx = -1;
    if (src === "key" && wakesOnRelease(ACTIONS[i])) return commit(i);
    execute(i);
  }
  // 键盘 SUSPEND：水满后等松键；5 s 没有松键就兜底执行
  function commit(i) {
    mode = "committed"; setP(1);
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => runCommitted(), COMMIT_FALLBACK_MS);
    commitIdx = i;
  }
  function runCommitted() {
    if (mode !== "committed") return;
    clearTimeout(fallbackTimer);
    const i = commitIdx; commitIdx = -1;
    execute(i);
  }

  // 原型：只 flash 名词 + 磁贴弹一下，面板保持打开；移植时先收起整个覆盖层再执行
  function execute(i) {
    stopAnim(); clearTimeout(hitTimer);
    mode = "idle";
    const a = ACTIONS[i], el = tileEl(i), hl = grid.querySelector(":scope > .p3-hl");
    if (!P3.STATIC) {
      const cs = getComputedStyle(document.documentElement);
      const opt = { duration: parseFloat(cs.getPropertyValue("--d-med")) || 320,
                    easing: cs.getPropertyValue("--e-out").trim() || "ease-out" };
      [el, hl].forEach(nd => nd?.animate([{ scale: 1 }, { scale: "1.04 1.06", offset: .35 }, { scale: 1 }], opt));
    }
    P3.flash(TABLE[a].t);
    if (p > 0) hitTimer = setTimeout(() => { if (mode === "idle") drain(); }, 280);
  }

  // 3 列网格：←→ 同行循环，↑↓ / Tab 同列循环（末行不满时夹到最后一个）
  function move(dc, dr) {
    let r = Math.floor(sel / COLS), c = sel % COLS;
    if (dc) {
      const rowLen = Math.min(COLS, n - r * COLS);
      c = (c + dc + rowLen) % rowLen;
    } else r = (r + dr + ROWS) % ROWS;
    select(r * COLS + c);
  }

  // 外壳只把 keydown 转给面板；keyup 和 Esc 前置处理由面板自己挂监听
  const onKeyUp = e => {
    if (mode === "committed") { e.preventDefault(); return runCommitted(); }
    if (isActKey(e) && src === "key") cancelHold(true);
  };
  // 捕获阶段：先于外壳看到按键。committed 期间吞掉一切（含 Esc）；Esc/Backspace 先取消长按再让外壳关面板
  const onKeyCapture = e => {
    if (mode === "committed") { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.key === "Escape" || e.key === "Backspace") { cancelHold(false); tapIdx = -1; }
  };
  const onPointerUp = () => { tapIdx = -1; if (src === "mouse") cancelHold(true); };
  const onBlur = () => { tapIdx = -1; cancelHold(false); };

  const KEYS = [["↑↓←→", "选择"], ["ENTER", "执行 / 长按确认"]];
  P3.register("power", {
    title: "POWER",
    sub: "锁屏与关机",
    keys: KEYS,
    mount(el) {
      root = el;
      mode = "idle"; tapIdx = -1; holdIdx = -1; commitIdx = -1;
      render();
      const def = Math.max(0, ACTIONS.indexOf(S.powerMenuDefaultAction));
      select(q.has("psel") ? +q.get("psel") : def, true);
      if (q.has("hold")) setP(+q.get("hold") / 100);
      addEventListener("keydown", onKeyCapture, true);
      addEventListener("keyup", onKeyUp);
      addEventListener("pointerup", onPointerUp);
      addEventListener("blur", onBlur);
      // 外壳在 mount 后写 #keys 并补 "ESC 返回"；POWER 没有子页，Esc 直接关面板
      queueMicrotask(() => {
        const el = document.getElementById("keys");
        if (!el || root?.dataset.id !== "power") return;
        el.innerHTML = KEYS.concat([["ESC", "关闭"]]).map(([a, b]) => `<span><kbd>${a}</kbd><span class="zh">${b}</span></span>`).join("");
      });
    },
    unmount() {
      stopAnim(); clearTimeout(hitTimer); clearTimeout(fallbackTimer);
      mode = "idle"; holdIdx = -1; commitIdx = -1; tapIdx = -1; p = 0;
      root?.classList.remove("pw-hold"); root?.style.removeProperty("--p");
      removeEventListener("keydown", onKeyCapture, true);
      removeEventListener("keyup", onKeyUp);
      removeEventListener("pointerup", onPointerUp);
      removeEventListener("blur", onBlur);
    },
    key(e) {
      const k = e.key;
      if (e.repeat) { e.preventDefault(); return; }   // DMS 忽略 isAutoRepeat
      if (mode === "committed") return;
      if (k === "Enter" || k === " ") { e.preventDefault(); startHold(sel, "key"); return; }
      if (e.ctrlKey) {
        const m = { n: [1, 0], p: [-1, 0], j: [0, 1], k: [0, -1] }[k.toLowerCase()];
        if (m) { e.preventDefault(); if (mode !== "hold") move(...m); }
        return;
      }
      if (isActKey(e)) {
        e.preventDefault();
        startHold(ACTIONS.findIndex(a => TABLE[a].key === k.toUpperCase()), "key");
        return;
      }
      if (mode === "hold") return;
      if (k === "ArrowLeft") { e.preventDefault(); move(-1, 0); }
      else if (k === "ArrowRight") { e.preventDefault(); move(1, 0); }
      else if (k === "ArrowUp") { e.preventDefault(); move(0, -1); }
      else if (k === "ArrowDown") { e.preventDefault(); move(0, 1); }
      else if (k === "Tab") { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); }
    },
  });
})();
