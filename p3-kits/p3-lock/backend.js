/* ==========================================================================
   P3Lock — p3-lock 原型里所有系统相关操作的唯一入口（mock 实现）。
   lock.js 只管画面和按键，不直接碰用户名、密码校验、电源命令、Caps Lock。
   QML 移植时把本文件整体换成 shell.qml 里的真实实现，接口形状保持一致，见 INTEGRATION.md。

   CONTRACT
     P3Lock.state                 只读快照 { user, host, caps, secure, impl }
     P3Lock.auth.submit(pw)       Promise<{ ok: true }>
                                  reject { code: 'denied' | 'maxtries' | 'error', message }
     P3Lock.power.run(action)     action = 'suspend' | 'reboot' | 'poweroff'
                                  Promise<{ ok: true, msg }>   msg = 状态行文字
     P3Lock.release()             解锁动画播完后调用：真实实现里解除 session lock 并退出进程
     P3Lock.on('caps', fn)        fn(bool)，Caps Lock 变化
     P3Lock.on('*', fn)           任意变化 fn(state)

   每个操作的 @dms 标注 = QML 里的对应实现。

   MOCK
     ?user= ?host=   演示用户名 / 主机名
     ?caps           强制 Caps Lock
     ?lat=ms         校验延迟，默认 700；?static 时 0
     ?fail=auth|maxtries|autherror|power   注入失败
     密码 "fail" → denied；其他任意值 → 成功
   ========================================================================== */
(() => {
  "use strict";
  const Q = new URLSearchParams(location.search);
  const STATIC = Q.has("static");
  const LAT = STATIC ? 0 : +(Q.get("lat") || 700);
  const FAIL = new Set((Q.get("fail") || "").split(",").filter(Boolean));
  const FORCE_CAPS = Q.has("caps") || Q.get("state") === "caps";

  const subs = {};
  const emit = (ev, v) => {
    (subs[ev] || []).forEach((f) => f(v));
    (subs["*"] || []).forEach((f) => f(state));
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const err = (code, message) => ({ code, message });

  const state = {
    // @dms Quickshell.env("USER")
    user: Q.get("user") || "lyfmt",
    // @dms FileView /etc/hostname
    host: Q.get("host") || "archlinux",
    // @dms 轮询 /sys/class/leds/*::capslock/brightness（同 p5lock）
    caps: FORCE_CAPS,
    // @dms WlSessionLock.secure；为 true 时 touch $XDG_RUNTIME_DIR/p3lock.secure
    secure: true,
    impl: "mock",
  };

  const NAMES = { suspend: "SUSPEND", reboot: "REBOOT", poweroff: "POWER OFF" };
  const ZH = { suspend: "挂起", reboot: "重启", poweroff: "关机" };

  window.P3Lock = {
    state,
    impl: "mock",

    auth: {
      /* @dms PamContext { configDirectory: Quickshell.shellDir + "/pam"; config: "p3lock" }
              onResponseRequiredChanged → respond(password)
              onCompleted: Success → ok；Failed → denied；MaxTries → maxtries；Error → error */
      async submit(pw) {
        await wait(LAT);
        if (FAIL.has("maxtries")) throw err("maxtries", "TOO MANY TRIES");
        if (FAIL.has("autherror")) throw err("error", "AUTH ERROR");
        if (FAIL.has("auth") || pw === "fail") throw err("denied", "WRONG PASSWORD");
        return { ok: true };
      },
    },

    power: {
      /* @dms Quickshell.execDetached(["systemctl", action])
              锁屏进程不经 DMS：DMS 此时可能没在跑，且 SessionService 的确认弹窗不能出现在锁屏之上 */
      async run(action) {
        if (!NAMES[action]) throw err("error", "UNKNOWN ACTION");
        if (FAIL.has("power")) throw err("error", `${NAMES[action]} FAILED`);
        console.log(`[demo] systemctl ${action}`);
        return { ok: true, msg: `DEMO · ${NAMES[action]} · 已模拟${ZH[action]}` };
      },
    },

    /* @dms lock.locked = false; rm -f $XDG_RUNTIME_DIR/p3lock.secure；overlay 动画播完 Qt.quit()
       原型里只把状态记下，桌面由 lock.js 画出 */
    release() {
      state.secure = false;
      emit("secure", false);
    },

    /* 原型专用：按 L 重新锁定。真实实现里没有这一项，重新上锁 = 再次启动进程 */
    relock() {
      state.secure = true;
      emit("secure", true);
    },

    on(ev, fn) {
      (subs[ev] = subs[ev] || []).push(fn);
      return () => { subs[ev] = subs[ev].filter((f) => f !== fn); };
    },
  };

  /* mock 的 Caps Lock 来源：浏览器按键事件。真实实现读 LED，不依赖按键焦点 */
  const readCaps = (e) => {
    if (!e.getModifierState) return;
    const c = e.getModifierState("CapsLock") || FORCE_CAPS;
    if (c !== state.caps) { state.caps = c; emit("caps", c); }
  };
  addEventListener("keydown", readCaps, true);
  // CapsLock 自身的 keydown 在 Linux 上可能还是旧状态，keyup 时再读一次
  addEventListener("keyup", readCaps, true);
})();
