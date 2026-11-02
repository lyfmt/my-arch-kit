/* ==========================================================================
   P3Sys — the single system interface of the dms-p3 prototype (menu-x.html + island-b.html).

   Pages never touch fake data or build command strings. They read a synchronous
   snapshot, call async actions, and subscribe to change events. That is the same
   shape the QML port has: service properties (sync, bound) + service functions
   (fire-and-forget, the property changes later) + signals.

   CONTRACT
     P3Sys.<ns>.state            live read-only snapshot of that namespace (do not mutate)
     P3Sys.<ns>.<action>(...)    Promise<Result>; Result = { ok: true, msg }   msg = short Chinese result line, or null
                                 rejects with P3Error { code, message }       message = Chinese
     P3Sys.on(ns, fn)            fn(state, ns) after every change of that namespace; returns unsubscribe()
     P3Sys.on('notify:new', fn)  fn(item) when a notification arrives (island card)
     P3Sys.on('*', fn)           any change
     P3Sys.ui(ctx, promise, { revert, done })   helper for menu pages: revert() on error, done(result) on success
     P3Sys.impl                  'mock' here; the QML port has no mode (real services only)

   Every action carries a @dms tag: the DMS 2.0 (dux-shell 2.0.0) call the QML port makes,
   then the `dms ipc call …` equivalent for testing from a terminal. @gap = DMS 2.0 has no API;
   the tag says how to implement it. INTEGRATION.md collects the gaps.

   MOCK (this file)
     Seeds from window.P3DATA plus the SEED fakes below.
     Latency 350ms (?lat=ms), 0 with ?static=1. Live ticks (stats, media position) off with ?static=1.
     Failure injection: ?fail=net.connect,bt.connect,… makes those actions reject.
     Built-in failures, so error states can be seen without URL flags:
       net.connect with password "wrongpass"  → auth error
       bt.connect on "MX Master 3"            → device unreachable
       proc.kill(pid ≤ 1000, force)           → refused (same rule as DMS ProcessContextMenu)
   ========================================================================== */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const STATIC = Q.has('static');
  const LAT = STATIC ? 0 : +(Q.get('lat') || 350);
  const FAIL = new Set((Q.get('fail') || '').split(',').filter(Boolean));
  const D = window.P3DATA || {};
  const clone = o => JSON.parse(JSON.stringify(o));
  const I = n => `shared/icons/${n}`;

  // ------------------------------------------------------------ events
  const subs = {};
  function on(ns, fn) { (subs[ns] = subs[ns] || new Set()).add(fn); return () => subs[ns].delete(fn); }
  function emit(ns, payload) {
    const p = payload === undefined ? (api[ns] && api[ns].state) : payload;
    [ns, '*'].forEach(k => subs[k] && [...subs[k]].forEach(fn => { try { fn(p, ns); } catch (e) { console.error(e); } }));
  }

  // ------------------------------------------------------------ results
  class P3Error extends Error { constructor(code, message) { super(message); this.code = code; } }
  const wait = ms => new Promise(r => setTimeout(r, STATIC ? 0 : ms));
  // act(name, fn): run fn after latency; fn returns msg (string) or throws P3Error. Emits ns change.
  function act(name, fn, ms = LAT) {
    const ns = name.split('.')[0];
    return wait(ms).then(() => {
      if (FAIL.has(name)) throw new P3Error('injected', `${name} 失败（?fail 注入）`);
      const msg = fn();
      emit(ns);
      return { ok: true, msg: msg || null };   // null = silent (the control itself shows the change)
    });
  }
  function ui(ctx, promise, o = {}) {
    return promise.then(r => { if (o.done) o.done(r); return r; },
      e => { if (o.revert) o.revert(e); return null; });
  }

  // ------------------------------------------------------------ seed
  const hp = (D.bt && D.bt.devices || []).find(x => x.kind === 'headphones');
  const SEED = {
    procs: [
      [2841, 'chromium', 4.8, 1820], [1377, 'niri', 2.1, 214], [3120, 'feishu', 1.9, 960], [1502, 'quickshell', 1.6, 388],
      [4410, 'kitty', .9, 142], [2297, 'clash-verge', .7, 236], [3388, 'qq', .6, 742], [1981, 'pipewire', .5, 38],
      [5023, 'magpie', .4, 310], [1244, 'fcitx5', .2, 96], [3901, 'sunshine', .2, 120], [4777, 'node', .1, 412],
      [612, 'systemd-journald', 0, 52], [1, 'systemd', 0, 14],
    ].map(([pid, name, cpu, mem]) => ({ pid, name, cpu, mem })),
    apps: [
      ['kitty', 'kitty', I('kitty.png'), 'terminal'], ['Chromium', 'chromium', I('chromium.png'), 'browser'],
      ['Thunar', 'thunar', I('files.svg'), 'files'], ['magpie', 'magpie', I('magpie.png')],
      ['飞书', 'bytedance-feishu', I('feishu.png'), 'feishu lark'], ['QQ', 'qq', I('qq.png')],
      ['Clash Verge', 'clash-verge', I('clash-verge.png'), 'proxy'], ['Sunshine', 'sunshine', I('sunshine.png'), 'stream'],
      ['Fcitx5 配置', 'fcitx5-configtool', I('fcitx.svg'), 'fcitx rime input'], ['Buffin', 'buffin', I('buffin.svg')],
      ['Termius', 'termius-app', I('termius.png'), 'ssh'], ['网易云音乐', 'netease-cloud-music', I('netease.svg'), 'wangyiyun music netease'],
      ['Lutris', 'net.lutris.Lutris', I('lutris.png'), 'game'], ['Typora', 'typora', I('typora.png'), 'markdown'],
      ['Steam', 'steam', null, 'game'], ['OBS Studio', 'com.obsproject.Studio', null, 'record'],
      ['GIMP', 'gimp', null, 'image'], ['Inkscape', 'org.inkscape.Inkscape', null, 'svg'],
      ['Blender', 'blender', null, '3d'], ['Krita', 'org.kde.krita', null, 'paint'],
      ['LibreOffice Writer', 'libreoffice-writer', null, 'doc word'], ['mpv', 'mpv', null, 'video player'],
      ['Visual Studio Code', 'code', null, 'vscode editor'], ['Neovim', 'nvim', null, 'vim editor'],
      ['Obsidian', 'obsidian', null, 'notes'], ['Telegram', 'org.telegram.desktop', null, 'chat'],
      ['Thunderbird', 'thunderbird', null, 'mail'], ['qBittorrent', 'org.qbittorrent.qBittorrent', null, 'bt torrent'],
      ['pavucontrol', 'pavucontrol', null, 'audio volume'], ['btop', 'btop', null, 'monitor top'],
      ['Zathura', 'org.pwmt.zathura', null, 'pdf'], ['Firefox', 'firefox', null, 'browser'],
    ].map(([name, id, icon, k]) => ({ id, name, icon, keys: k || '' })),
    pinnedIds: { TERMINAL: 'kitty', BROWSER: 'chromium', FILES: 'thunar' },
    streams: [
      { id: 'chromium', name: 'Chromium', icon: I('chromium.png'), vol: 80 },
      { id: 'netease', name: '网易云音乐', icon: I('netease.svg'), vol: 64 },
      { id: 'qq', name: 'QQ', icon: I('qq.png'), vol: 100 },
    ],
    binds: [
      ['Mod+T', '终端', 'spawn "kitty"'], ['Mod+B', '浏览器', 'spawn "chromium"'], ['Mod+E', '文件管理', 'spawn "thunar"'],
      ['Mod+Space', '启动器', 'spawn "dms" "ipc" "call" "spotlight" "toggle"'],
      ['Mod+Backspace', '系统菜单', 'spawn "dms" "ipc" "call" "p3menu" "toggle"'],
      ['Mod+F2', 'DMS 设置', 'spawn "dms" "ipc" "call" "settings" "toggle"'],
      ['Mod+Alt+V', '剪贴板', 'spawn "dms" "ipc" "call" "clipboard" "toggle"'],
      ['Mod+Z', '存档轮盘', 'spawn "qs" "-c" "save-carousel" "ipc" "call" "carousel" "toggle"'],
      ['Mod+Y', '壁纸切换', 'spawn "qs" "-c" "wallpaper" "ipc" "call" "overlay" "toggle"'],
      ['Mod+O', '概览', 'toggle-overview'], ['Mod+Q', '关闭窗口', 'close-window'], ['Mod+F', '最大化列', 'maximize-column'],
      ['Mod+Shift+S', '截图', 'screenshot'], ['Mod+Alt+L', '锁屏', 'spawn "dms" "ipc" "call" "lock" "lock"'],
    ].map(([key, label, cmd]) => ({ key, key0: key, label, cmd })),
    autostart: [
      ['clash-verge', 'Clash Verge', 'clash-verge.png', true], ['fcitx5', 'Fcitx5', 'fcitx.svg', true],
      ['magpie', 'magpie', 'magpie.png', true], ['feishu', '飞书', 'feishu.png', true],
      ['sunshine', 'Sunshine', 'sunshine.png', false], ['qq', 'QQ', 'qq.png', false],
    ].map(([id, name, icon, on]) => ({ id, name, icon: I(icon), on })),
    events: {
      '2026-10-09': [['15:00', '15:40', '牙医复诊']], '2026-10-10': [['10:00', '11:00', 'dms-p5 周会']],
      '2026-10-15': [['19:30', '21:30', '羽毛球']], '2026-10-18': [['12:00', '14:00', '家庭聚餐 · 重阳']],
      '2026-10-19': [['10:00', '11:00', 'dms-p5 周会']], '2026-10-21': [['14:00', '15:30', 'dms-p5 2.0 迁移计划']],
      '2026-10-26': [['10:00', '11:00', 'dms-p5 周会']], '2026-10-28': [['20:00', '20:15', '交房租']],
      '2026-10-30': [['08:00', '08:30', '背单词 30 个'], ['10:00', '10:20', '站会'], ['14:00', '16:00', 'dms-p3 静态稿联调'],
        ['17:00', '18:00', '设计评审'], ['21:00', '22:00', '整理壁纸收藏']],
      '2026-10-31': [['15:00', '15:30', '回复飞书评审意见'], ['19:00', '22:00', '朋友聚会']],
      '2026-11-02': [['10:00', '11:00', 'dms-p5 周会']], '2026-11-05': [['08:30', '10:00', '体检 · 空腹']],
      '2026-11-09': [['10:00', '11:00', 'dms-p5 周会']], '2026-11-14': [['14:00', '17:00', 'Arch 社区线下聚会']],
      '2026-11-16': [['10:00', '11:00', 'dms-p5 周会']], '2026-11-23': [['10:00', '11:00', 'dms-p5 周会']],
      '2026-11-27': [['19:00', '21:00', '妈妈生日']], '2026-11-30': [['10:00', '11:00', 'dms-p5 周会']],
    },
    holidays: {   // 2026 only; real source in INTEGRATION.md (gap)
      off: ['2026-09-25', '2026-09-26', '2026-09-27', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'],
      work: ['2026-09-20', '2026-10-10'],
      fest: { '2026-09-10': '教师节', '2026-09-25': '中秋节', '2026-10-01': '国庆节', '2026-10-18': '重阳节', '2026-10-31': '万圣夜', '2026-11-09': '寒衣节', '2026-12-25': '圣诞节' },
      terms: { '2026-09-07': '白露', '2026-09-23': '秋分', '2026-10-08': '寒露', '2026-10-23': '霜降', '2026-11-07': '立冬', '2026-11-22': '小雪', '2026-12-07': '大雪', '2026-12-22': '冬至' },
    },
    notifs: [
      ['飞书', 'feishu.png', '设计评审', '下午 5 点 dms-p3 方案过一遍', '16:12'],
      ['飞书', 'feishu.png', '王一 · 私聊', '原型发我一份，晚上看看动效', '15:52'],
      ['QQ', 'qq.png', '群聊 · niri 吹水', '新版 overview 好丝滑', '15:58'],
      ['QQ', 'qq.png', '阿杰', '有人把 DMS 的顶栏换成水滴了吗', '15:31'],
      ['网易云音乐', 'netease.svg', '每日推荐已更新', '根据 ぬゆり 为你推荐了 30 首', '15:46'],
      ['Clash Verge', 'clash-verge.png', '订阅已更新', '42 个节点', '15:40'],
      ['QQ', 'qq.png', '小林', '周末还去打球吗', '13:05'],
      ['Sunshine', 'sunshine.png', '设备已配对', 'Steam Deck · 192.168.31.57', '12:48'],
      ['kitty', 'kitty.png', '命令已完成', 'paru -Syu · 用时 2m14s', '11:30'],
    ],
    incoming: [
      ['飞书', 'feishu.png', '设计评审 · 改期', '挪到 17:30，记得带 island 原型'],
      ['QQ', 'qq.png', '群聊 · niri 吹水', '新版 overview 的模糊是怎么做的'],
      ['网易云音乐', 'netease.svg', 'ぬゆり 发布了新歌', '「フィクサー」 已加入每日推荐'],
    ],
  };

  const api = {};
  const fmtT = () => { const n = STATIC ? api.clock.now() : new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; };

  // ============================================================ apps
  /* @dms AppSearchService.searchApplications(q) · AppUsageHistoryData.getRankedApps() · SettingsData.barPinnedApps
     launch: SessionService.launchDesktopEntry(entry, false, []) + AppUsageHistoryData.addAppUsage(entry) */
  const used = {}; (D.frequent || []).forEach(f => { const a = SEED.apps.find(x => x.name === f.name); if (a) used[a.id] = f.n; });
  api.apps = {
    state: { all: SEED.apps, pinned: SEED.pinnedIds, usage: used },
    /** ranked by usage then name. QML: AppUsageHistoryData.getRankedApps() */
    ranked() { return [...SEED.apps].sort((a, b) => (used[b.id] || 0) - (used[a.id] || 0) || a.name.localeCompare(b.name, 'zh')); },
    byId(id) { return SEED.apps.find(a => a.id === id) || null; },
    /** @dms SessionService.launchDesktopEntry(entry) ; AppUsageHistoryData.addAppUsage(entry)
        @cli gtk-launch <id>   (or `dms ipc call spotlight openQuery <name>` to hand off to the launcher) */
    launch(id) {
      const a = api.apps.byId(id);
      return act('apps.launch', () => { if (!a) throw new P3Error('notfound', `找不到应用 ${id}`); used[id] = (used[id] || 0) + 1;
        const t = tray.find(x => x.dead && (x.id === id || id.includes(x.id))); if (t) { t.dead = false; emit('tray'); }   // relaunch brings its tray item back
        return `已启动 ${a.name}`; }, 120);
    },
  };

  // ============================================================ tray
  /* @dms Quickshell.Services.SystemTray (SystemTray.items) — item.id/title/icon/status, item.activate(),
           item.menu → QsMenuOpener; `dms ipc call tray list|activate <id>|menu <id>|status <id>`
     Item-specific rows (Clash mode, fcitx IM, QQ presence) are gaps: see clash/ime/qq below. */
  const tray = clone(D.tray || []);
  api.tray = {
    state: { items: tray },
    /** @dms item.activate()  ·  dms ipc call tray activate <id> */
    activate(id) {
      const t = tray.find(x => x.id === id);
      return act('tray.activate', () => { if (!t || t.dead) throw new P3Error('gone', '托盘项已退出'); t.badge = 0; return `已打开 ${t.name}`; }, 120);
    },
    /** @dms QsMenuOpener { menu: item.menu } children → {text, enabled, checkState, isSeparator}, entry.triggered()
        @cli dms ipc call tray menu <id>   mock: generic entries; pages add item-specific rows from clash/ime/qq */
    menu(id) {
      const t = tray.find(x => x.id === id);
      return wait(LAT / 2).then(() => t ? [{ id: 'show', text: '显示主窗口' }, { sep: true }, { id: 'quit', text: '退出', danger: true }] : []);
    },
    /** @dms menu entry.triggered() — the item's own "Quit" */
    trigger(id, entry) {
      const t = tray.find(x => x.id === id);
      return act('tray.trigger', () => {
        if (!t) throw new P3Error('gone', '托盘项已退出');
        if (entry === 'quit') { t.dead = true; return `${t.name} 已退出`; }
        return `${t.name} · ${entry}`;
      });
    },
  };

  // ============================================================ clash · ime · qq  (tray-adjacent gaps)
  const clashT = tray.find(t => t.id === 'clash');
  api.clash = {
    state: { mode: 'rule', node: clashT ? String(clashT.status).split('·').pop().trim() : 'HK 02', sysproxy: true, tun: !!(D.net && D.net.vpn), nodes: ['HK 01', 'HK 02', 'JP 02', 'SG 01', 'US 05'] },
    /** @gap mihomo controller of Clash Verge: PATCH http://127.0.0.1:9097/configs {"mode":"rule|global|direct"}
             (port + secret from ~/.local/share/io.github.clash-verge-rev.clash-verge-rev/config.yaml external-controller) */
    setMode(m) { return act('clash.setMode', () => { api.clash.state.mode = m; return `代理模式 → ${m.toUpperCase()}`; }); },
    /** @gap PUT /proxies/<group> {"name":node} */
    setNode(n) { return act('clash.setNode', () => { api.clash.state.node = n; if (clashT) clashT.status = `规则模式 · ${n}`; emit('tray'); return `节点 → ${n}`; }); },
    /** @gap Clash Verge app config (verge.yaml enable_system_proxy) — only through its own UI/IPC; mock only */
    setSysProxy(on) { return act('clash.setSysProxy', () => { api.clash.state.sysproxy = on; return on ? '系统代理已开' : '系统代理已关'; }); },
    /** @gap PATCH /configs {"tun":{"enable":bool}} (needs the service mode of Clash Verge) */
    setTun(on) { return act('clash.setTun', () => { api.clash.state.tun = on; api.net.state.vpn = on; emit('net'); return on ? 'TUN 已开启' : 'TUN 已关闭'; }); },
  };
  api.ime = {
    state: { im: 'rime', list: [{ id: 'keyboard-us', name: '英语 (美国)' }, { id: 'rime', name: '中州韵 RIME' }], trigger: 'Ctrl+Space' },
    /** @gap no fcitx service in DMS. QML: Process ["fcitx5-remote","-s",id]; read with ["fcitx5-remote","-n"]
             (or DBus org.fcitx.Fcitx5 /controller SetCurrentIM). trigger keys live in ~/.config/fcitx5/config [Hotkey/TriggerKeys] */
    set(id) { return act('ime.set', () => { const x = api.ime.state.list.find(i => i.id === id); if (!x) throw new P3Error('notfound', '没有这个输入法'); api.ime.state.im = id; return `输入法 → ${x.name}`; }); },
    /** @gap write [Hotkey/TriggerKeys] 0=<key> then `fcitx5-remote -r` */
    setTrigger(k) { return act('ime.setTrigger', () => { api.ime.state.trigger = k; return `切换键 → ${k}`; }); },
  };
  api.qq = {
    state: { presence: 'online', list: [['online', '在线'], ['away', '离开'], ['busy', '忙碌'], ['invisible', '隐身']] },
    /** @gap QQ (NTQQ) has no presence API; tray menu entries only exist when the item exports them.
             Port: find the QsMenuEntry whose text matches and trigger() it; hide the row when absent. */
    set(p) { return act('qq.set', () => { api.qq.state.presence = p; return `QQ 状态 → ${(api.qq.state.list.find(x => x[0] === p) || [p, p])[1]}`; }); },
  };

  // ============================================================ proc + stats
  /* @dms DgopService (dgop binary): processes, cpuUsage, cpuTemperature, memoryUsage, processCount, loadAverage,
           uptime, diskMounts, networkRxRate/TxRate; DgopService.addRef(["processes","cpu","memory",…]) while visible,
           removeRef() on leave; setSortBy("cpu"|"memory"). `dms ipc call processlist toggle` opens DMS's own list. */
  const procs = clone(SEED.procs);
  const st = clone(D.stats || {});
  let refs = 0, tick = null;
  function stepStats() {
    st.cpu = Math.max(3, Math.min(97, Math.round(st.cpu + (Math.random() - .5) * 8)));
    st.cpuHist = (st.cpuHist || []).slice(1).concat(st.cpu);
    procs.forEach(p => { if (p.cpu > 0) p.cpu = Math.max(.1, +(p.cpu + (Math.random() - .5) * .6).toFixed(1)); });
    emit('stats'); emit('proc');
  }
  api.stats = {
    state: st,
    /** @dms DgopService.addRef(modules) — refcounted polling. Returns release(). */
    watch() { if (!refs++ && !STATIC) tick = setInterval(stepStats, 2000); return () => { if (!--refs) { clearInterval(tick); tick = null; } }; },
  };
  api.proc = {
    state: { list: procs, sort: 'cpu' },
    /** @dms DgopService.setSortBy(key) */
    sort(k) { api.proc.state.sort = k; procs.sort((a, b) => b[k] - a[k]); emit('proc'); },
    /** @dms Process { command: ["kill", force ? "-9" : "-15", pid] } — same as Modules/ProcessList/ProcessContextMenu.qml.
             guard: force-kill refused for pid ≤ 1000 (DMS rule); pid 1 always refused.
        @cli kill [-9] <pid> */
    kill(pid, force = false) {
      return act('proc.kill', () => {
        const i = procs.findIndex(p => p.pid === pid);
        if (i < 0) throw new P3Error('gone', `进程 ${pid} 已不存在`);
        if (pid === 1 || (force && pid <= 1000)) throw new P3Error('denied', `不能强制结束系统进程 ${procs[i].name} (${pid})`);
        const [p] = procs.splice(i, 1); st.procs = Math.max(0, (st.procs || procs.length) - 1); emit('stats');
        return `已${force ? '强制' : ''}结束 ${p.name} (${pid})`;
      });
    },
  };

  // ============================================================ battery + power profile
  const bat = clone(D.battery || {});
  api.battery = {
    state: bat,     // pct, charging, remain, watts, health, limit, profile
    /** @dms PowerProfileWatcher.applyProfile(id)  ·  dms ipc call powerprofile set <power-saver|balanced|performance> */
    setProfile(id) { return act('battery.setProfile', () => { bat.profile = id; return `性能模式 → ${{ 'power-saver': '省电', balanced: '均衡', performance: '性能' }[id] || id}`; }); },
    /** @dms SettingsData.batteryChargeLimit (notify only, no write)
        @gap real limit: write /sys/class/power_supply/BAT0/charge_control_end_threshold (root → polkit helper or udev rule
             granting the group write; or `tlp setcharge 0 <pct>`). Port keeps both: write sysfs, mirror the setting. */
    setLimit(pct) { return act('battery.setLimit', () => { bat.limit = pct; return `充电上限 → ${pct}%`; }); },
  };

  // ============================================================ power / session
  /* @dms SessionService.lock / suspend / logout / reboot / poweroff (+ isPowerActionSupported)
     lock: `dms ipc call lock lock` (the P3 lock screen replaces it once dms-p3 ships one); restart shell: `dms restart` */
  const P = { lock: '已锁屏', suspend: '正在睡眠', logout: '正在注销', reboot: '正在重启', poweroff: '正在关机', restartShell: 'Shell 正在重启' };
  api.power = {
    state: { supported: { lock: true, suspend: true, hibernate: false, logout: true, reboot: true, poweroff: true }, last: null },
    /** one of lock|suspend|logout|reboot|poweroff|restartShell. Mock never powers anything off. */
    run(a) { return act('power.run', () => { if (!P[a]) throw new P3Error('bad', `未知操作 ${a}`); if (!api.power.state.supported[a] && a !== 'restartShell') throw new P3Error('unsupported', '本机不支持该操作'); api.power.state.last = a; return P[a] + '（演示，未执行）'; }, 200); },
  };

  // ============================================================ net (Wi-Fi)
  /* @dms NetworkService: wifiEnabled, currentWifiSSID, wifiSignalStrength, wifiIP, wifiNetworks [{ssid,signal,secured,…}],
           savedWifiNetworks, isScanning, networkRxRate/TxRate (DgopService). */
  const n0 = D.net || {};
  const net = { wifi: !!n0.wifi, ssid: n0.ssid, signal: n0.signal, ip: n0.ip, vpn: !!n0.vpn, down: n0.down, up: n0.up,
    list: clone(D.wifiList || []), scanning: false, connecting: null };
  const IPS = s => /GUEST/.test(s) ? '10.0.12.87' : /CMCC/.test(s) ? '192.168.1.104' : '192.168.31.24';
  api.net = {
    state: net,
    /** @dms NetworkService.toggleWifiRadio()  (target state: compare wifiEnabled first)
        @cli nmcli radio wifi on|off */
    setWifi(on) { return act('net.setWifi', () => { net.wifi = on; if (!on) { net.ssid = null; net.list.forEach(w => w.on = false); } else { net.ssid = (net.list.find(w => w.sig >= 70) || {}).ssid || null; if (net.ssid) net.list.find(w => w.ssid === net.ssid).on = true; } return on ? 'Wi-Fi 已开启' : 'Wi-Fi 已关闭'; }); },
    /** @dms NetworkService.scanWifi(); watch isScanning → wifiNetworks */
    scan() { net.scanning = true; emit('net'); return act('net.scan', () => { net.scanning = false; return `找到 ${net.list.length} 个网络`; }, 1200); },
    /** @dms NetworkService.connectToWifi(ssid, password, "", "", "", false, "", "")
             saved network: password "" (NetworkManager reuses the profile). Result is async: watch
             currentWifiSSID === ssid (ok) vs NetworkService.connectionError / lastConnectionError (fail) and
             passwordDialogShouldReopen (wrong password → reopen the field). Enterprise / hidden prompts come via
             DMSNetworkService.credentialsNeeded(token, …) → NetworkService.submitCredentials(token, fields).
        @cli nmcli device wifi connect <ssid> password <pw> */
    connect(ssid, password = '') {
      const w = net.list.find(x => x.ssid === ssid);
      if (!w) return Promise.reject(new P3Error('notfound', `${ssid} 不在范围内`));
      if (w.sec && !w.saved && password.length < 8) return Promise.reject(new P3Error('auth', '密码至少 8 位'));
      net.connecting = ssid; emit('net');
      return act('net.connect', () => {
        net.connecting = null;
        if (password === 'wrongpass') throw new P3Error('auth', `${ssid} 密码错误`);
        net.ssid = ssid; net.ip = IPS(ssid); net.signal = w.sig; w.saved = true;
        net.list.forEach(x => x.on = x.ssid === ssid);
        return `已连接 ${ssid} · ${net.ip}`;
      }, 1300).catch(e => { net.connecting = null; emit('net'); throw e; });
    },
    /** @dms NetworkService.disconnectWifi() */
    disconnect() { return act('net.disconnect', () => { const s = net.ssid; net.ssid = null; net.ip = null; net.list.forEach(w => w.on = false); return `已断开 ${s}`; }); },
    /** @dms NetworkService.forgetWifiNetwork(ssid) */
    forget(ssid) { return act('net.forget', () => { const w = net.list.find(x => x.ssid === ssid); if (w) w.saved = false; if (net.ssid === ssid) { net.ssid = null; w.on = false; } return `已忘记 ${ssid}`; }); },
  };
  net.list.forEach(w => { w.saved = !!w.on; });

  // ============================================================ bt
  /* @dms BluetoothService (Quickshell.Bluetooth): adapter.enabled, adapter.discovering, devices, pairedDevices,
           getDeviceIcon(dev); device.connected/batteryAvailable/battery/paired/trusted. */
  const bt = { on: !!(D.bt && D.bt.on), scanning: false, devices: clone((D.bt && D.bt.devices) || []).map(x => ({ ...x, paired: true })), busy: null };
  api.bt = {
    state: bt,
    /** @dms BluetoothService.setBluetoothEnabled(on)  (adapter.enabled = on) */
    setPower(on) { return act('bt.setPower', () => { bt.on = on; if (!on) { bt.scanning = false; bt.devices.forEach(x => x.connected = false); } return on ? '蓝牙已开启' : '蓝牙已关闭'; }); },
    /** @dms adapter.discovering = on. Mock: a "Keychron K3" appears 1.6s later. */
    setScan(on) {
      bt.scanning = on; emit('bt');
      if (on && !STATIC) setTimeout(() => { if (bt.scanning && !bt.devices.some(x => x.name === 'Keychron K3')) { bt.devices.push({ name: 'Keychron K3', kind: 'kbd', connected: false, paired: false, nearby: true }); emit('bt'); } }, 1600);
      return act('bt.setScan', () => on ? '正在搜索附近设备' : '已停止搜索', 60);
    },
    /** @dms paired → device.connect() / disconnect(); new → BluetoothService.pairDevice(dev) then connectDeviceWithTrust(dev)
        @cli bluetoothctl connect|disconnect|pair <mac> */
    toggle(name) {
      const x = bt.devices.find(d => d.name === name);
      if (!x) return Promise.reject(new P3Error('notfound', `${name} 不在范围内`));
      bt.busy = name; emit('bt');
      return act('bt.connect', () => {
        bt.busy = null;
        if (!x.connected && name === 'MX Master 3') throw new P3Error('unreachable', `${name} 无响应，确认设备已开机`);
        x.connected = !x.connected; if (x.connected) { x.paired = true; x.nearby = false; if (x.battery == null && x.kind !== 'kbd') x.battery = 55; }
        return x.connected ? `已连接 ${name}` : `已断开 ${name}`;
      }, 1100).catch(e => { bt.busy = null; emit('bt'); throw e; });
    },
  };

  // ============================================================ audio
  /* @dms AudioService: sink / source (PwNode), sink.audio.volume (0..1) + muted, setVolume(pct), setSink(node), setSource(node).
           streams: Pipewire.nodes.values.filter(n => n.isStream && n.isSink) (PwObjectTracker to bind), node.audio.volume.
           `dms ipc call audio setvolume|increment|decrement|mute`, `dms ipc call mic mute`. */
  const a0 = D.audio || {};
  const head = hp ? hp.name : 'WH-1000XM4';
  const audio = { vol: a0.vol, muted: !!a0.muted, mic: a0.mic, micMuted: !!a0.micMuted,
    sinks: [{ id: 'alsa_output.pci-0000_00_1f.3.analog-stereo', name: a0.sink || 'Speakers', kind: 'out' }, { id: 'bluez_output.' + head, name: head, kind: 'head' }],
    sources: [{ id: 'alsa_input.pci-0000_00_1f.3.analog-stereo', name: 'Built-in Mic', kind: 'mic' }, { id: 'bluez_input.' + head, name: head, kind: 'head' }],
    sink: 0, source: 0, streams: clone(SEED.streams) };
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, Math.round(v)));
  api.audio = {
    state: audio,
    /** @dms AudioService.setVolume(pct) · dms ipc call audio setvolume <pct>. Sliders call this often and ignore msg. */
    setVolume(v) { return act('audio.setVolume', () => { audio.vol = clamp(v); if (audio.muted && v > 0) audio.muted = false; return `音量 ${audio.vol}%`; }, 0); },
    /** @dms AudioService.sink.audio.muted = m · dms ipc call audio mute */
    setMuted(m) { return act('audio.setMuted', () => { audio.muted = m; return m ? '已静音' : '已取消静音'; }, 0); },
    /** @dms AudioService.source.audio.volume = v/100 */
    setMic(v) { return act('audio.setMic', () => { audio.mic = clamp(v); return `麦克风 ${audio.mic}%`; }, 0); },
    /** @dms AudioService.source.audio.muted = m · dms ipc call mic mute */
    setMicMuted(m) { return act('audio.setMicMuted', () => { audio.micMuted = m; return m ? '麦克风已静音' : '麦克风已开启'; }, 0); },
    /** @dms AudioService.setSink(node)  (Pipewire.preferredDefaultAudioSink = node) */
    setSink(i) { return act('audio.setSink', () => { const s = audio.sinks[i]; if (!s) throw new P3Error('gone', '输出设备已断开'); if (s.kind === 'head' && !bt.devices.some(x => x.name === s.name && x.connected)) throw new P3Error('gone', `${s.name} 未连接`); audio.sink = i; return `输出 → ${s.name}`; }); },
    /** @dms AudioService.setSource(node) */
    setSource(i) { return act('audio.setSource', () => { const s = audio.sources[i]; if (!s) throw new P3Error('gone', '输入设备已断开'); if (s.kind === 'head' && !bt.devices.some(x => x.name === s.name && x.connected)) throw new P3Error('gone', `${s.name} 未连接`); audio.source = i; return `输入 → ${s.name}`; }); },
    /** @dms stream node.audio.volume = v/100 (PipewireAudioBackend; not exposed by AudioService) */
    setStream(id, v) { return act('audio.setStream', () => { const s = audio.streams.find(x => x.id === id); if (!s) throw new P3Error('gone', '该应用已停止播放'); s.vol = clamp(v); return `${s.name} ${s.vol}%`; }, 0); },
  };

  // ============================================================ display (+ night)
  /* @dms DisplayService.brightnessLevel / setBrightness(pct, device, suppressOsd) · dms ipc call brightness set <pct>
           NightModeService: enableNightMode/disableNightMode, temperature; SettingsData.nightModeAutoEnabled,
           nightModeStartHour/EndHour, nightModeTemperature · dms ipc call night toggle|setTargetTemp <k>
           monitors: niri outputs (NiriService.outputs / `dms ipc call outputs …`) — read-only here */
  const display = { bright: D.brightness, night: false, temp: 4500, sched: 1, monitors: clone(D.monitors || []) };
  api.display = {
    state: display,
    setBrightness(v) { return act('display.setBrightness', () => { display.bright = clamp(v, 1); return `亮度 ${display.bright}%`; }, 0); },
    /** @dms NightModeService.enableNightMode() / disableNightMode() · dms ipc call night enable|disable */
    setNight(on) { return act('display.setNight', () => { display.night = on; return on ? `夜间模式 ${display.temp}K` : '夜间模式已关'; }); },
    /** @dms dms ipc call night setTargetTemp <k>  (SettingsData.nightModeTemperature) */
    setTemp(k) { return act('display.setTemp', () => { display.temp = clamp(k, 2500, 6500); return `色温 ${display.temp}K`; }, 0); },
    /** 0 manual · 1 sunset→sunrise · 2 22:00–07:00
        @dms SettingsData.nightModeAutoEnabled = i>0; i==1 location mode (gammastep/wlsunset location); i==2 nightModeStartHour=22, EndHour=7 */
    setSchedule(i) { return act('display.setSchedule', () => { display.sched = i; return ['夜间模式 · 手动', '夜间模式 · 日落到日出', '夜间模式 · 22:00 – 07:00'][i]; }); },
  };

  // ============================================================ mode (DND · caffeine)
  const mode = { dnd: !!(D.notify && D.notify.dnd), dndUntil: 0, caffeine: false };
  api.mode = {
    state: mode,
    /** @dms SessionData.setDoNotDisturb(on, minutes, "p3menu") · dms ipc call notifications toggleDoNotDisturb
             timed: dms ipc call notifications enableDoNotDisturbFor <min> */
    setDnd(on, minutes = 0) { return act('mode.setDnd', () => { mode.dnd = on; mode.dndUntil = on && minutes ? Date.now() + minutes * 6e4 : 0; emit('notify'); return on ? (minutes ? `勿扰 ${minutes} 分钟` : '勿扰已开启') : '勿扰已关闭'; }, 80); },
    /** @dms SessionService.toggleIdleInhibit() (compare SessionService.idleInhibited) · dms ipc call inhibit enable|disable */
    setCaffeine(on) { return act('mode.setCaffeine', () => { mode.caffeine = on; return on ? '保持唤醒已开启' : '保持唤醒已关闭'; }); },
  };

  // ============================================================ settings (MORE: input · look · power · notices)
  /* Generic key/value store over DMS SettingsData. One table = the mapping, so pages stay data-driven.
     @dms SettingsData.set(key, value) (SettingsSpec coerces) · dms ipc call settings set <key> <value>
          Input keys trigger SettingsData.updateCompositorInput() → NiriService writes dms/input.kdl and niri reloads. */
  const MIN_S = [60, 180, 300, 600, 900, 1800, 0];
  const SET = {
    // key: [initial UI value, dms key, ui→dms]
    repeatDelay:  [300, 'keyboardRepeatDelay', v => v],
    repeatRate:   [40, 'keyboardRepeatRate', v => v],
    tapToClick:   [true, 'touchpadTapToClick', v => v],
    naturalScroll:[true, 'touchpadNaturalScroll', v => v],
    touchSpeed:   [50, 'touchpadAccelSpeed', v => +((v - 50) / 50).toFixed(2)],      // UI 0..100 → niri -1..1
    theme:        [0, null, v => ['p3-blue', 'dynamic'][v]],                          // Theme.switchTheme(name, true, true)
    font:         [0, 'fontFamily', v => ['Barlow Condensed', 'Inter', 'Noto Sans CJK SC'][v]],
    fontScale:    [100, 'fontScale', v => v / 100],
    motion:       [1, 'animationDuration', v => [0.5, 1, 1.4][v]],                     // + motionEffect for 夸张
    popupAlpha:   [85, 'popupTransparency', v => v / 100],
    acOff:  [3, 'acMonitorTimeout', v => MIN_S[v]],  acLock: [4, 'acLockTimeout', v => MIN_S[v]],  acSus: [5, 'acSuspendTimeout', v => MIN_S[v]],
    btOff:  [1, 'batteryMonitorTimeout', v => MIN_S[v]], btLock: [2, 'batteryLockTimeout', v => MIN_S[v]], btSus: [3, 'batterySuspendTimeout', v => MIN_S[v]],
    lockBeforeSuspend: [true, 'lockBeforeSuspend', v => v],
    lid:          [0, null, v => ['suspend', 'lock', 'ignore', 'ignore'][v]],          // @gap logind, see note
    dndSchedule:  [true, null, v => v], dndFrom: [23, null, v => v], dndTo: [7, null, v => v],   // @gap
    popTimeout:   [1, 'notificationTimeoutNormal', v => [3000, 5000, 8000, 0][v]],
    popPos:       [0, 'notificationPopupPosition', v => [0, 1, 3][v]],                // SettingsData enum: top-right, top-center, bottom-right
  };
  const GAPNOTE = {
    lid: 'logind HandleLidSwitch: drop-in /etc/systemd/logind.conf.d/50-p3.conf via pkexec, then `systemctl kill -s HUP systemd-logind`',
    dndSchedule: 'no DND schedule in DMS 2.0: a p3 Timer checks the hour each minute and calls SessionData.setDoNotDisturb(on, 0, "p3-schedule")',
  };
  GAPNOTE.dndFrom = GAPNOTE.dndTo = GAPNOTE.dndSchedule;
  const sv = Object.fromEntries(Object.entries(SET).map(([k, v]) => [k, v[0]]));
  api.settings = {
    state: sv,
    /** what the port writes: { dmsKey, value } or { gap } */
    describe(k, v = sv[k]) { const s = SET[k]; if (!s) return null; return s[1] ? { dmsKey: s[1], value: s[2](v) } : { gap: GAPNOTE[k] || (k === 'theme' ? `Theme.switchTheme("${s[2](v)}", true, true)` : '') }; },
    set(k, v) {
      return act('settings.set', () => {
        if (!(k in SET)) throw new P3Error('bad', `未知设置 ${k}`);
        sv[k] = v; return null;
      }, 0);
    },
  };

  // ============================================================ notification rules (per app)
  /* @dms SettingsData.notificationRules: [{ enabled, field: "appName", pattern, matchType: "exact", action, urgency, bypassDnd }]
          NotificationService.qml:511-530 actions: default · mute (no popup, kept in centre, so no sound) · popup_only
          (popup, not in centre/history) · no_history · ignore (dropped).
          UI level → action: 0 弹窗+声音 default · 1 仅弹窗 default + @gap per-app sound (DMS only has global
          soundsEnabled; port adds the app to a p3 "silent" list checked before playing) · 2 静默 mute · 3 关闭 ignore */
  const RULE_ACTION = ['default', 'default', 'mute', 'ignore'];
  const rules = { '飞书': 0, 'QQ': 1, 'Clash Verge': 2, '网易云音乐': 3 };
  api.rules = {
    state: rules,
    ACTION: RULE_ACTION,
    set(app, level) { return act('rules.set', () => { rules[app] = level; return `${app} · ${['弹窗 + 声音', '仅弹窗', '静默', '关闭'][level]}`; }, 80); },
  };

  // ============================================================ keybinds
  /* @dms KeybindsService (dms keybinds provider for niri): getFlatBinds() → [{key, desc, action}],
          saveBind(originalKey, {key, desc, action}, false, cb) writes ~/.config/niri/dms/binds.kdl, resetBind(key)
          niri reloads the file itself. Conflict check: getFlatBinds().some(b => b.key === newKey). */
  const binds = clone(SEED.binds);
  api.keybinds = {
    state: { list: binds },
    rebind(oldKey, newKey) {
      return act('keybinds.rebind', () => {
        const b = binds.find(x => x.key === oldKey); if (!b) throw new P3Error('gone', `${oldKey} 不存在`);
        const dup = binds.find(x => x !== b && x.key === newKey);
        if (dup) throw new P3Error('conflict', `${newKey} 已被「${dup.label}」占用`);
        b.key = newKey; return `${b.label} · ${oldKey} → ${newKey}`;
      }, 150);
    },
    /** @dms resetBind(key) for every changed bind */
    resetAll() { return act('keybinds.resetAll', () => { const n = binds.filter(b => b.key !== b.key0).length; binds.forEach(b => b.key = b.key0); return n ? `已恢复 ${n} 个快捷键` : '没有改动'; }); },
  };

  // ============================================================ autostart
  /* @dms same as Modules/Settings/AutoStartTab.qml: ~/.config/autostart/<id>.desktop, setHidden(entry, hidden)
          (copy from /usr/share/applications on first enable; Hidden=true to disable without deleting) */
  const autostart = clone(SEED.autostart);
  api.autostart = {
    state: { list: autostart },
    set(id, on) { return act('autostart.set', () => { const a = autostart.find(x => x.id === id); if (!a) throw new P3Error('notfound', id); a.on = on; return `${a.name} ${on ? '开机自启' : '不再自启'}`; }); },
  };

  // ============================================================ update
  /* @dms SystemUpdateService: availableUpdates, checkForUpdates(), runUpdates() (opens terminal with paru/yay),
          cancelUpdates(); `dms ipc call systemupdater …` */
  const upd = { count: 12, running: false, checked: '16:02' };
  api.update = {
    state: upd,
    check() { return act('update.check', () => { upd.checked = fmtT(); return upd.count ? `${upd.count} 个更新可用` : '已是最新'; }, 900); },
    run() {
      if (!upd.count) return Promise.reject(new P3Error('none', '没有可用更新'));
      upd.running = true; emit('update');
      return act('update.run', () => { const n = upd.count; upd.running = false; upd.count = 0; return `已更新 ${n} 个包`; }, 1500);
    },
  };

  // ============================================================ defaults (default apps)
  /* @gap DMS 2.0 has `dms ipc call defaultApp open` (a panel) but no setter. Port runs:
          browser  xdg-settings set default-web-browser <desk>
          files    xdg-mime default <desk> inode/directory
          music    xdg-mime default <desk> audio/mpeg audio/flac audio/ogg
          terminal SettingsData terminal (if present) else the Mod+T bind via keybinds.rebind action */
  const DEF = { browser: ['chromium', 'firefox'], files: ['thunar', 'org.gnome.Nautilus'], term: ['kitty', 'foot'], music: ['netease-cloud-music', 'mpv'] };
  const defs = { browser: 0, files: 0, term: 0, music: 0 };
  api.defaults = {
    state: defs, OPTIONS: DEF,
    set(role, i) { return act('defaults.set', () => { if (!DEF[role] || !DEF[role][i]) throw new P3Error('bad', '无效选项'); defs[role] = i; return `默认 → ${DEF[role][i]}`; }); },
  };

  // ============================================================ notify
  /* @dms NotificationService: notifications (centre, NotifWrapper: id, appName, appIcon, summary, body, time, actions),
          popups, dismissNotification(w), clearAllNotifications(), markNotificationsSeen(),
          action: w.actions[i].invoke() (default action = "default"); activate also focuses the app window
          (NiriService.focusWindowForApp(desktopEntry) — or DMS's handleNotificationClick).
          new item → NotificationService.notificationAdded / popups change. DND = SessionData.doNotDisturb.
          `dms ipc call notifications clearAll|toggle|dismiss <id>` */
  let nid = 1;
  const mk = ([app, icon, title, body, t]) => ({ id: nid++, app, icon: I(icon), title, body, t: t || fmtT() });
  const notify = { items: SEED.notifs.map(mk), get dnd() { return mode.dnd; } };
  const queue = clone(SEED.incoming);
  api.notify = {
    state: notify,
    dismiss(id) { return act('notify.dismiss', () => { const i = notify.items.findIndex(x => x.id === id); if (i < 0) return null; notify.items.splice(i, 1); return null; }, 0); },
    clearAll() { return act('notify.clearAll', () => { const n = notify.items.length; notify.items.length = 0; return n ? `已清除 ${n} 条通知` : null; }, 0); },
    /** default action + focus the app, then dismiss (DMS behaviour for "click") */
    activate(id) { const x = notify.items.find(n => n.id === id); return act('notify.activate', () => { if (!x) throw new P3Error('gone', '通知已失效'); notify.items.splice(notify.items.indexOf(x), 1); return `打开 ${x.app}`; }, 0); },
    setDnd(on) { return api.mode.setDnd(on); },
    /** mock only: push the next queued arrival (island demo / ?push). Emits 'notify:new' with the item unless DND. */
    simulate() {
      const s = queue.shift(); if (!s) return null; queue.push(s);
      const x = mk(s); notify.items.unshift(x); emit('notify');
      if (!mode.dnd) emit('notify:new', x);
      return x;
    },
  };

  // ============================================================ media
  /* @dms MprisController.activePlayer (MprisPlayer: trackTitle, trackArtist, trackArtUrl, position, length,
          isPlaying, canGoNext/Previous, identity), playPause(), next(), previous(); Mpris.players for the switcher.
          `dms ipc call mpris playPause|next|previous` */
  const m0 = D.media || {};
  const LEN0 = m0.len || 214;   // data.js gives pos as a 0..1 fraction; state.pos is seconds (MprisPlayer.position)
  const media = { title: m0.title, artist: m0.artist, playing: !!m0.playing, pos: m0.pos > 0 && m0.pos < 1 ? Math.round(m0.pos * LEN0) : m0.pos || 0, len: LEN0, player: m0.player || '网易云音乐',
    players: [m0.player || '网易云音乐', 'Chromium'], idx: 0 };
  const TRACKS = [[m0.title, m0.artist], ['フィクサー', 'ぬゆり'], ['命に嫌われている。', 'カンザキイオリ']];
  let ti = 0;
  const setTrack = d => { ti = (ti + d + TRACKS.length) % TRACKS.length; [media.title, media.artist] = TRACKS[ti]; media.pos = 0; };
  api.media = {
    state: media,
    playPause() { return act('media.playPause', () => { media.playing = !media.playing; return null; }, 0); },
    next() { return act('media.next', () => { setTrack(1); return null; }, 0); },
    previous() { return act('media.previous', () => { if (media.pos > 3) media.pos = 0; else setTrack(-1); return null; }, 0); },
    /** @dms MprisController.activePlayer = Mpris.players.values[i] (2.0: setActivePlayer) */
    cyclePlayer() { return act('media.cyclePlayer', () => { media.idx = (media.idx + 1) % media.players.length; media.player = media.players[media.idx]; return media.player; }, 0); },
  };
  if (!STATIC) setInterval(() => { if (media.playing) { media.pos++; if (media.pos >= media.len) setTrack(1); emit('media'); } }, 1000);

  // ============================================================ calendar
  /* @dms CalendarService (khal / evolution-data-server via dms): loadEvents(startDate, endDate) → eventsByDate map,
          getEventsForDate(date) → [{ title, start, end, allDay, calendar }], createEvent / deleteEvent.
     lunar: Intl zh-CN-u-ca-chinese (Qt has no Chinese calendar → port bundles a 1900–2100 table generated from this function, or a JS lunar lib).
     holidays: @gap — mainland off/work days change yearly (国务院公告). Port reads a json (holiday-cn project,
          github.com/NateScarlet/holiday-cn, <year>.json) cached in ~/.cache/p3/holiday-<year>.json. */
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const LD = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  let LF = null;
  try { LF = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { /* no ICU */ }
  const LFEST = { '正月1': '春节', '正月15': '元宵节', '五月5': '端午节', '七月7': '七夕', '七月15': '中元节', '八月15': '中秋节', '九月9': '重阳节', '十月1': '寒衣节', '腊月8': '腊八节' };
  function lunar(d) {
    if (!LF) return null;
    const p = {}; LF.formatToParts(d).forEach(x => { p[x.type] = x.value; });
    const day = +p.day, month = p.month.replace(/十一月$/, '冬月');   // Intl says 十一月; traditional name is 冬月
    return { year: p.yearName || '', month, day, dayZh: LD[day - 1] || p.day, leap: month.startsWith('闰'),
      label: day === 1 ? month : LD[day - 1], fest: LFEST[month + day] || null };
  }
  const evs = Object.fromEntries(Object.entries(SEED.events).map(([k, l]) => [k, l.map(([s, e, title]) => ({ start: s, end: e, title }))]));
  api.calendar = {
    state: { today: null },
    lunar, ymd,
    /** sync day info: lunar + term + festival + off/work. QML: same function, holiday table from cache */
    day(d) {
      const k = ymd(d), H = SEED.holidays, l = lunar(d);
      return { key: k, lunar: l, term: H.terms[k] || null, fest: H.fest[k] || (l && l.fest) || null,
        off: H.off.includes(k), work: H.work.includes(k) };
    },
    /** @dms CalendarService.loadEvents(from, to) → Promise<{ 'YYYY-MM-DD': [{start,end,title}] }> */
    events(from, to) {
      const a = ymd(from), b = ymd(to);
      return wait(LAT / 2).then(() => { if (FAIL.has('calendar.events')) throw new P3Error('injected', '日程加载失败'); return Object.fromEntries(Object.entries(evs).filter(([k]) => k >= a && k <= b)); });
    },
  };

  // ============================================================ clock
  /* @dms SystemClock { precision: SystemClock.Minutes } (Quickshell).
          Mock: always returns P3DATA.clock (2026-10-30 16:29) so screenshots stay stable. */
  api.clock = {
    now() { const c = D.clock || {}; return new Date(2026, (c.month || 10) - 1, c.day || 30, c.h ?? 16, c.m ?? 29); },
  };

  // ============================================================ export
  window.P3Sys = Object.assign(api, { on, emit, ui, P3Error, impl: 'mock', static: STATIC });
})();
