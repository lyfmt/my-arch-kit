// SYSTEM 面板：顶栏状态区与控制中心的替代品。主视图 = 读数水箱 + 控制格；NETWORK / AUDIO / BLUETOOTH 三个子页面
//
// 数据（mock = 本机 2026-10 快照；QML 端接对应服务）：
//   水箱：DgopService.cpuUsage / memoryUsage(13.0 / 30 GiB) / cpuTemperature（Tctl，轻载约 80 °C）
//     阈值：CPU 60 / 80、RAM 75 / 90（同 DMS），TEMP 90 / 95（按本机 Ryzen 的 Tctl 区间，70 会常亮告警）
//   网速：DgopService.networkInterfaces 里 name === NetworkService.ethernetInterface 的那一项，逐次 rx/tx 差值。
//     不用 networkRxRate/TxRate：那是所有接口之和（含 lo、Meta TUN、docker0、veth），开 Clash 时约翻倍
//   有线：NetworkService.ethernetDevices.find(d => d.name === ethernetInterface)（不取 [0]，网桥 / veth 也在列表里）
//     DETAILS（网关 / DNS / IPv6 / MAC）：sendRequest("network.ethernet.info")
//   Wi-Fi：wifiEnabled / wifiNetworks（按信号取前 5，多于 5 出现 MORE → 设置页）；savedConnections；本机电台默认关
//   PREFER：只在 Wi-Fi 开着且有线已连时出现，setNetworkPreference(auto|ethernet|wifi)，提示文字不声称路由已变
//   音频：AudioService.sink / source，名字 = node.nickname，端口 = getSinkPorts（行内只显示端口描述，不显示 PipeWire 长描述）
//     默认 sink = iFi (by AMR) HD USB Audio 100%（analog-output）；ALC256 Analog 5%（Speakers）、H24T7 HDMI 40% 不活动
//     音量按 sink 存（node.audio.volume），切换输出时 VOLUME 跟着换成该 sink 的音量
//   亮度：DisplayService.brightnessAvailable + 类 backlight 的设备；"eDP-1" 来自 NiriService.outputs，不是背光设备名
//   蓝牙：BluetoothService.adapter(ly-001) / devices；唯一设备是 Logi K580 键盘（input-keyboard）
//   夜间：DisplayService.nightModeEnabled + SessionData.nightModeTemperature(4500 K)
//   勿扰：SessionData.doNotDisturb / setDoNotDisturbUntilTimestamp（时长取 DMS 预设里的 1 H / UNTIL 8 AM / 8 H）
//
// 操作（主视图）：↑↓ 换行，←→ 在成对格之间移动，滑条上 ←→ / 滚轮 = ±5；悬停即选中
//   水箱 Enter / 点击 = 先 P3.close()，退场动画后再 processlist focusOrToggle（菜单是 Overlay 层独占键盘，
//     不先关会被盖住）。所有交给 DMS 弹层 / 设置页的操作都是这个顺序
//   NETWORK：Enter / M / 右键 进子页面；VOLUME：Enter 静音，M / 右键 进 AUDIO；MIC：Enter 静音，M 进 AUDIO 并选中 MIC MUTE
//   BLUETOOTH：Enter / M 进子页面，不在主视图开关电源（键盘就是蓝牙设备，一键关掉无法用键盘撤回）
//   BRIGHTNESS：只调节；NIGHT：Enter 开关；DND：Enter 开关，M / 右键 展开时长条（←→ 选、Enter 定、Esc 收起）
// 操作（子页面）：↑↓ / 滚轮 换行，Enter 执行；←→ 调节滑条 / 动作条 / PREFER，没有横向控件的行上 ← = 返回
//   提示栏的 ←→ 只在选中这三类行时出现（调节 / 选择 / 切换）
//   M / ContextMenu / 右键 / 标题右侧返回块 / Esc / Backspace = 回主视图，选中落回打开它的那一格；主视图里 Esc 才关闭面板
//   （Esc / Backspace 由本面板在 window 捕获阶段先截获，外壳不用改）
//   长按 0.5 s（同 powerActionHoldDuration，提前松开回落并提示 HOLD LONGER）：有线 DISCONNECT、FORGET、
//     有已连输入设备时关蓝牙电源、断开输入设备
//   Wi-Fi 行：已保存 → 展开动作条 CONNECT/DISCONNECT · FORGET · AUTOCONNECT；企业网（eduroam）→ 关菜单后
//     openSettingsWithTab("network_wifi")；未保存 PSK → 行下展开密码框
//   密码框：键盘全部交给输入框（含 Backspace / 字母 / ←→），Enter 连接，Tab 显示 / 隐藏，↑↓ 离开，Esc 只取消输入框
//     少于 8 位视为 WRONG PASSWORD（PSK 最短 8 位）。QML 端用同一个框回答 NetworkService.credentialsNeeded：
//     submitCredentials(token, {psk}, true) / cancelCredentials(token)；DMSShell 里弹 WifiPasswordModal 的处理器
//     要在 P3Menu 打开时跳过，否则会出现两个框，而且 Top 层的那个被菜单盖住
//   蓝牙配对的 passkey 确认走 PopoutService.bluetoothPairingModal，同样会被菜单盖住：PAIR 先关菜单再配对（原型不 mock）
//   提示栏按视图切换（主视图 / 子页面 / 密码框 / 勿扰时长条），本地写 #keys，并同步 register 的 keys 供外壳重绘
//
// URL 参数（都可与 ?static、?theme=lavender 叠加）：
//   ?open=system                 打开本面板
//   ?sub=net | audio | bt        直接进子页面
//   ?net=off                     有线断开：主视图 OFFLINE，子页面选中落在 CONNECT
//   ?wifi=on                     Wi-Fi 电台打开（列表 + PREFER）     ?wifi=badpw  密码错误：红色 WRONG PASSWORD，密码框重开
//   ?pw=<ssid>                   该网络的密码框已展开（隐含 wifi=on）
//   ?exp=<ssid>                  该已保存网络的动作条已展开（隐含 wifi=on）
//   ?details=0                   有线 DETAILS 默认收起
//   ?bt=none                     无蓝牙适配器：BT 格变暗、键盘跳过     ?bt=scan  扫描中，NEARBY 两台 mock 设备
//   ?temp=crit                   TEMP 96 °C（看告警样式）
//   ?dnd=menu                    勿扰时长条已展开                       ?dnd=on   勿扰开（UNTIL 08:00）
//   ?sel=<id>                    初始选中：cpu ram temp net vol mic bt bri night dnd，子页面里 eth ethx wifi pref …
//   ?hold=<0-100>                冻结选中行的长按进度（看长按中间帧）
(() => {
  const q = new URLSearchParams(location.search);
  const ST = P3.STATIC;
  const HOLD_MS = 500, DRAIN_MS = 420;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hm = d => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  // ---------- mock 状态 ----------
  const wq = q.get("wifi"), pwq = q.get("pw"), expq = q.get("exp");
  const S = {
    cpu: 7, ram: 13.0, ramT: 30, temp: q.get("temp") === "crit" ? 96 : 80,
    down: 1434, up: 86,                       // KB/s，enp3s0 单接口
    eth: q.get("net") !== "off", det: q.get("details") !== "0",
    wifi: wq === "on" || wq === "badpw" || !!pwq || !!expq, pref: 0,
    vol: 100, mute: false, sink: "ifi", mic: 58, micMute: false,
    bri: 20, night: false, nightK: 4500,
    dnd: q.get("dnd") === "on", until: q.get("dnd") === "on" ? "08:00" : "", dndMenu: q.get("dnd") === "menu", dndIdx: 0,
    bt: q.get("bt") !== "none", btPow: true, scan: q.get("bt") === "scan",
  };
  // ip6 = 全局地址（不是前缀）；dns = IP4.DNS 全部条目
  const ETH = { iface: "enp3s0", ip: "172.20.148.160", speed: 1000, gw: "172.20.148.254", dns: ["202.118.1.29", "202.118.1.53"],
    ip6: "2001:da8:9000:a796:7da8:bd5f:121b:1060/64", mac: "10:7C:61:B9:A1:7E" };
  // 按信号排好；sec: open | psk | eap
  const NETS = [
    { ssid: "NEU", sec: "open", saved: true, conn: true, sig: 78, auto: true },
    { ssid: "eduroam", sec: "eap", saved: false, conn: false, sig: 64 },
    { ssid: "ChinaNet-7F3A", sec: "psk", saved: false, conn: false, sig: 41 },
    { ssid: "TP-LINK_5G_9C2E", sec: "psk", saved: false, conn: false, sig: 33 },
    { ssid: "DIRECT-2B-HP M227", sec: "psk", saved: false, conn: false, sig: 22 },
  ];
  const SINKS = [
    { id: "ifi", nick: "iFi (by AMR) HD USB Audio", desc: "iFi (by AMR) HD USB Audio Analog Stereo", port: "Analog Output", vol: 100 },
    { id: "alc", nick: "ALC256 Analog", desc: "Ryzen HD Audio Controller Analog Stereo", port: "Speakers", vol: 5 },
    { id: "hdmi", nick: "H24T7", desc: "AD107 High Definition Audio Controller Digital Stereo (HDMI) [H24T7]", port: "HDMI", vol: 40 },
  ];
  const BTD = [{ name: "Logi K580 Keyboard", kind: "kb", conn: true, bat: 90, input: true }];
  // NEARBY 是 mock：本机扫描时周围设备不固定
  const NEAR = [{ name: "WH-1000XM4", kind: "hp" }, { name: "Galaxy Buds2 Pro", kind: "hp" }];
  const PREF = ["AUTO", "ETHERNET", "WI-FI"];
  const DND = [{ t: "1 H", h: 1 }, { t: "UNTIL 8 AM", at: 8 }, { t: "8 H", h: 8 }];
  const TANKS = [
    { k: "cpu", n: "CPU", u: "%", w: 60, c: 80 },
    { k: "ram", n: "RAM", u: "%", w: 75, c: 90, sb: "ramSb" },
    { k: "temp", n: "TEMP", u: "°C", w: 90, c: 95, sb: "tempSb" },
  ];

  // 网络行状态：exp = 展开动作条的行 id；pw = 密码框 {i, val, show, bad}；stripIdx = 动作条里选中的动作
  let exp = null, pw = null, stripIdx = 0;
  const ni = s => NETS.findIndex(n => n.ssid === s);
  if (wq === "badpw") pw = { i: 3, val: "", show: false, bad: true };
  if (pwq && ni(pwq) >= 0) pw = { i: ni(pwq), val: "", show: false, bad: false };
  if (expq && ni(expq) >= 0) { NETS[ni(expq)].saved = true; exp = "x:w:" + ni(expq); }

  // ---------- SVG ----------
  const ARR = dn => `<svg class="sy-ar" viewBox="0 0 10 12" aria-hidden="true"><path d="${dn ? "M5 12 0 6h3V0h4v6h3z" : "M5 0 0 6h3v6h4V6h3z"}"/></svg>`;
  const SIG = s => { const n = s >= 75 ? 4 : s >= 50 ? 3 : s >= 25 ? 2 : 1;
    return `<svg class="sy-sig" viewBox="0 0 20 16" aria-hidden="true">${[0, 1, 2, 3].map(i =>
      `<rect x="${i * 5.4}" y="${12 - i * 4}" width="3.6" height="${4 + i * 4}"${i < n ? "" : ' class="o"'}/>`).join("")}</svg>`; };
  const LOCK = `<svg class="sy-lk" viewBox="0 0 12 14" aria-hidden="true"><path fill-rule="evenodd" d="M1.5 6h9v8h-9zM3 6V4a3 3 0 0 1 6 0v2H7.4V4a1.4 1.4 0 0 0-2.8 0v2z"/></svg>`;
  const ICON = {
    kb: `<svg class="sy-ic" viewBox="0 0 24 16" aria-hidden="true"><path fill-rule="evenodd" d="M0 0h24v16H0zM3 3h3v3H3zm5 0h3v3H8zm5 0h3v3h-3zm5 0h3v3h-3zM3 8h3v3H3zm15 0h3v3h-3zM7 8h10v3H7zM6 12.5h12V14H6z"/></svg>`,
    hp: `<svg class="sy-ic" viewBox="0 0 24 20" aria-hidden="true"><path d="M12 0C5.4 0 1 4.6 1 11v7a2 2 0 0 0 2 2h3v-8H3.5C4 6 7.4 2.6 12 2.6S20 6 20.5 12H18v8h3a2 2 0 0 0 2-2v-7C23 4.6 18.6 0 12 0z"/></svg>`,
  };
  const HB = `<i class="sy-hb"></i>`;

  // ---------- 读数 ----------
  const rate = kb => kb >= 1024 ? [kb / 1024, 1, "MB/S"] : [kb, 0, "KB/S"];
  const lvl = m => { const v = N[m.k]()[0]; return v >= m.c ? "crit" : v >= m.w ? "warn" : ""; };
  const N = {   // 数字：[值, 小数位, 单位]
    cpu: () => [S.cpu, 0], ram: () => [Math.round(S.ram / S.ramT * 100), 0], temp: () => [S.temp, 0],
    down: () => rate(S.down), up: () => rate(S.up),
    vol: () => [S.vol, 0], mic: () => [S.mic, 0], bri: () => [S.bri, 0],
  };
  const SV = { vol: () => S.vol, mic: () => S.mic, bri: () => S.bri };
  const T = { mute: () => S.mute, micMute: () => S.micMute, night: () => S.night, dnd: () => S.dnd,
    wifi: () => S.wifi, btPow: () => S.btPow, scan: () => S.scan };
  const sink = () => SINKS.find(s => s.id === S.sink);
  const btConn = () => BTD.find(d => d.conn);
  const X = {
    ramSb: () => `${S.ram.toFixed(1)} / ${S.ramT} GiB`, tempSb: () => "TCTL",
    downU: () => rate(S.down)[2], upU: () => rate(S.up)[2],
    volSb: () => sink().nick, nightSb: () => S.night ? `${S.nightK} K` : "OFF",
    dndSb: () => S.dnd ? (S.until ? `UNTIL ${S.until}` : "ON") : "OFF",
    btSb: () => !S.bt ? "" : !S.btPow ? "OFF" : btConn() ? `${btConn().name} · ${btConn().bat}%` : "NO DEVICE",
    wifiV: () => S.wifi ? `wlan0 · ${NETS.length} NETWORKS` : "wlan0 · OFF",
    powV: () => S.btPow ? "ON" : "OFF", scanV: () => S.scan ? "SEARCHING" : "",
  };
  const TK = Object.fromEntries(TANKS.map(m => [m.k, m]));
  T.micOn = () => !S.micMute;
  const SLK = { vol: "vol", bri: "bri", micv: "mic" };          // 滑条格 → 状态键
  const NAME = { net: "NETWORK", audio: "AUDIO", bt: "BLUETOOTH" };

  // ---------- 视图状态 ----------
  let root, body, P, view = "main", sel = "vol", opener = "vol", swapT = 0, timer = 0, wheelAt = 0, first = true;
  let hold = null, holdSrc = "key", holdDoneAt = 0, frozen = false;
  const last = {};
  const reg = { title: "SYSTEM", sub: "状态与控制", keys: [] };
  const cellEl = id => body && body.querySelector(`[data-c="${CSS.escape(id)}"]`);
  const isStrip = id => id === "dm" || id.startsWith("x:");
  const cell = id => ` data-c="${id}"${view === "main" ? "" : " data-row"}`;   // 子页面每行自成一行
  const numTxt = k => (k in last ? last[k] : 0).toFixed(N[k]()[1]);

  // countUp 只写 els[0]，同键的其余元素在 fmt 里同步
  function roll(key, els, to, dec = 0, dur = 900) {
    const from = key in last ? last[key] : 0; last[key] = to;
    const f = v => v.toFixed(dec);
    P.countUp(els[0], to, { from, dur, fmt: v => { const s = f(v); for (let i = 1; i < els.length; i++) els[i].textContent = s; return s; } });
  }

  // 卡片大名：先缩字号到下限，再折成两行（同 APPS 卡片）
  function fit(el, max, min) {
    el.classList.remove("wrap");
    let z = max; el.style.fontSize = z + "px";
    while (z > min && el.scrollWidth > el.clientWidth + 1) { z -= 2; el.style.fontSize = z + "px"; }
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add("wrap");
  }

  // ---------- 片段 ----------
  const tg = (on, key) => `<i class="tg${on ? " on" : ""}"${key ? ` data-t="${key}"` : ""}></i>`;
  const nb = (n, sb = "") => `<span class="sy-nb"><span class="d nm">${n}</span>${sb}</span>`;
  const xs = (k, cls = "") => `<span class="l sb${cls}" data-x="${k}">${esc(X[k]())}</span>`;
  const num = k => `<b class="d" data-n="${k}">${numTxt(k)}</b>`;
  function slH(id, cls, name, sb, muteKey) {
    const k = SLK[id];
    return `<div class="${cls} sy-sl${muteKey && S[muteKey] ? " mute" : ""}"${cell(id)} data-sv="${k}"${muteKey ? ` data-mute="${muteKey}"` : ""} style="--v:${SV[k]() / 100}">
      ${nb(name, sb)}<span class="slider"><i></i><b class="kn"></b></span>
      <span class="vv">${num(k)}<span class="l pc">%</span><span class="l mt">MUTE</span></span></div>`;
  }
  function tankH(m) {
    // 读数在左栏，水只在右侧水柱里涨落（0–100 任何读数都碰不到文字），所以水里不再画第二份
    const f = `<span class="num">${num(m.k)}<span class="d u">${m.u}</span></span><span class="l nm">${m.n}</span>${m.sb ? xs(m.sb) : ""}`;
    const v = first && !ST ? 0 : clamp(N[m.k]()[0], 0, 100);
    return `<div class="tank sy-tk" data-c="${m.k}" data-tk="${m.k}" style="--v:${v}%">${f}<div class="w" aria-hidden="true"></div></div>`;
  }
  function strip(id) {
    if (id === "dm") return DND.map(o => ({ t: o.t }));
    const [, t, i] = id.split(":");
    if (t === "w") { const n = NETS[i]; return [{ t: n.conn ? "DISCONNECT" : "CONNECT" }, { t: "FORGET", hold: 1 }, { t: "AUTOCONNECT", tg: n.auto }]; }
    const d = BTD[i];
    return [{ t: d.conn ? "DISCONNECT" : "CONNECT", hold: d.conn && d.input }, { t: "FORGET", hold: 1 }];
  }
  const stripH = (id, cls) => `<div class="${cls} sy-strip"${cell(id)}>${strip(id).map((o, k) =>
    `<span class="sy-op l${k === stripIdx ? " on" : ""}" data-o="${k}">${o.hold ? HB : ""}<span>${o.t}</span>${o.tg !== undefined ? tg(o.tg) : ""}</span>`).join("")}</div>`;

  // ---------- 主视图 ----------
  function vMain() {
    const w = NETS.find(n => n.conn);
    const wchip = !S.wifi ? `<span class="chip ghost l">WI-FI OFF</span>`
      : w ? `<span class="chip ghost l lc">${esc(w.ssid)} ${w.sig}%</span>` : `<span class="chip ghost l">WI-FI ON</span>`;
    const net = `<div class="sy-c sy-net" data-c="net">${nb("NETWORK", `<span class="l sb">ETHERNET</span>`)}
      <span class="sy-ni"><span class="sy-nl">${S.eth ? `<span class="chip l">CONNECTED</span>` : `<span class="chip hot l">OFFLINE</span>`}${wchip}</span>
        <span class="l sb lc">${ETH.iface} · ${S.eth ? ETH.ip : "disconnected"}</span></span>
      <span class="sy-rt"><span class="r">${ARR(1)}${num("down")}${xs("downU", " u")}</span><span class="r">${ARR(0)}${num("up")}${xs("upU", " u")}</span></span></div>`;
    const bt = S.bt
      ? `<div class="sy-c sy-go" data-c="bt">${nb("BLUETOOTH", xs("btSb", " lc"))}<span class="sy-cv l">›</span></div>`
      : `<div class="sy-c sy-go na" data-c="bt">${nb("BLUETOOTH", `<span class="l sb">ly-001 · —</span>`)}<span class="chip ghost l">NO ADAPTER</span></div>`;
    const tc = (id, name, sb, key) => `<div class="sy-c sy-tc" data-c="${id}">${nb(name, sb)}${tg(T[key](), key)}</div>`;
    return `<div class="box sy-st"><div class="sec l">STATUS</div><div class="sy-ls sy-tanks" data-row>${TANKS.map(tankH).join("")}</div></div>
      <div class="box sy-ctl"><div class="sy-ls">
        <div class="sy-r sy-rn" data-row>${net}</div>
        <div class="sy-r" data-row>${slH("vol", "sy-c", "VOLUME", xs("volSb", " lc"), "mute")}</div>
        <div class="sy-r n2" data-row>${tc("mic", "MIC", `<span class="l sb"><b data-n="mic">${numTxt("mic")}</b>% · ALC256 Analog</span>`, "micOn")}${bt}</div>
        <div class="sy-r" data-row>${slH("bri", "sy-c", "BRIGHTNESS", `<span class="l sb lc">eDP-1</span>`)}</div>
        <div class="sy-r n2" data-row>${tc("night", "NIGHT", xs("nightSb"), "night")}${tc("dnd", "DND", xs("dndSb"), "dnd")}</div>
        ${S.dndMenu ? `<div class="sy-r sy-dm" data-row>${stripH("dm", "sy-c")}</div>` : ""}
      </div></div>`;
  }

  // ---------- NETWORK ----------
  function vNet() {
    const det = S.eth && S.det;
    let h = `<div class="box sy-bx"><div class="sec l">ETHERNET</div><div class="sy-ls">
      <div class="li sy-i"${cell("eth")}><span class="sy-ss">${ETH.iface}</span>${S.eth ? `<span class="chip l">CONNECTED</span>` : `<span class="chip hot l">DISCONNECTED</span>`}
        <span class="v l lc">${S.eth ? `${ETH.speed} Mb/s · ${ETH.ip}` : "no link"}</span>${S.eth ? `<span class="l sy-dt">DETAILS ${det ? "▴" : "▾"}</span>` : ""}</div>
      ${det ? `<div class="sy-det">${[["GATEWAY", ETH.gw], ["MAC", ETH.mac], ["DNS", ETH.dns.join(" · ")], ["IPV6", ETH.ip6]].map(([k, v]) =>
        `<span class="sy-kv${k === "IPV6" || k === "DNS" ? " w2" : ""}"><span class="l k">${k}</span><span class="l lc">${v}</span></span>`).join("")}</div>` : ""}
      <div class="li sy-i sy-act${S.eth ? " danger" : ""}"${cell("ethx")}>${S.eth ? HB : ""}<span class="d nm">${S.eth ? "DISCONNECT" : "CONNECT"}</span>
        <span class="v l">${S.eth ? "HOLD" : ETH.iface.toUpperCase()}</span></div>
    </div></div>
    <div class="box sy-bx"><div class="sec l">WI-FI</div><div class="sy-ls">
      <div class="li sy-i"${cell("wifi")}><span class="d nm">WI-FI</span><span class="v l lc">${S.wifi ? `wlan0 · ${NETS.length} networks` : "wlan0 · off"}</span>${tg(S.wifi)}</div>`;
    if (S.wifi) NETS.forEach((n, i) => {
      h += `<div class="li sy-i sy-w${n.conn ? " conn" : ""}"${cell("w:" + i)}>${SIG(n.sig)}<span class="sy-ss">${esc(n.ssid)}</span>${n.sec !== "open" ? LOCK : ""}
        ${n.conn ? `<span class="chip l">CONNECTED</span>` : n.saved ? `<span class="chip ghost l">SAVED</span>` : ""}${n.sec === "eap" ? `<span class="chip ghost l">802.1X</span>` : ""}
        <span class="v l">${n.sig}%</span></div>`;
      if (exp === "x:w:" + i) h += stripH(exp, "li sy-i");
      if (pw && pw.i === i) h += `<div class="li sy-i sy-pw${pw.bad ? " bad" : ""}"${cell("pw")}>${pw.bad ? `<span class="chip hot l">WRONG PASSWORD</span>` : `<span class="l k">PASSWORD</span>`}
        <input class="sy-in" type="${pw.show ? "text" : "password"}" value="${esc(pw.val)}" placeholder="8+ characters" spellcheck="false" autocomplete="off">
        <span class="l sy-rv">TAB ${pw.show ? "HIDE" : "SHOW"}</span></div>`;
    });
    if (S.wifi && S.eth) h += `<div class="li sy-i sy-pf"${cell("pref")}><span class="d nm">PREFER</span><span class="sy-seg">${PREF.map((p, k) =>
      `<span class="op l${k === S.pref ? " on" : ""}">${p}</span>`).join("")}</span></div>`;
    return h + `</div></div>`;
  }

  // ---------- AUDIO ----------
  function vAudio() {
    const s = sink();
    return `<div class="sy-sub"><div class="box sy-card"><div class="sec l">OUTPUT</div>
        <div class="sy-hn d">${esc(s.nick)}</div><div class="sy-cd lc">${esc(s.desc)}</div>
        <div class="sy-big">${num("vol")}<span class="d u">%</span></div>
        <span class="chip hot l sy-mc${S.mute ? " mute" : ""}" data-mute="mute">MUTED</span>
        <div class="sy-kv"><span class="l k">PORT</span><span class="l">${esc(s.port)}</span></div>
      </div>
      <div class="box sy-menu"><div class="sy-ls">
        <div class="sec l">OUTPUT</div>
        ${slH("vol", "li sy-i", "VOLUME", "", "mute")}
        <div class="li sy-i"${cell("mute")}><span class="d nm">MUTE</span>${tg(S.mute, "mute")}</div>
        ${SINKS.map(x => `<div class="li sy-i sy-sk"${cell("s:" + x.id)}><span class="sy-nb"><span class="sy-ss">${esc(x.nick)}</span>
          <span class="l sb">${esc(x.port)}</span></span>${x.id === S.sink ? `<span class="chip l">ACTIVE</span>` : ""}</div>`).join("")}
        <div class="sec l">INPUT</div>
        ${slH("micv", "li sy-i", "MIC", "", "micMute")}
        <div class="li sy-i"${cell("micm")}><span class="d nm">MIC MUTE</span>${tg(S.micMute, "micMute")}</div>
      </div></div></div>`;
  }

  // ---------- BLUETOOTH ----------
  function vBt() {
    const on = S.btPow, n = BTD.filter(d => d.conn).length;
    let h = `<div class="sy-sub"><div class="box sy-card"><div class="sec l">ADAPTER</div>
        <div class="sy-hn d lc">ly-001</div>
        <div class="sy-kv"><span class="l k">POWER</span><span class="l">${on ? "ON" : "OFF"}</span></div>
        <div class="sy-kv"><span class="l k">CONNECTED</span><span class="l">${on ? n : "—"}</span></div>
        <div class="sy-kv"><span class="l k">PAIRED</span><span class="l">${BTD.length}</span></div>
      </div>
      <div class="box sy-menu"><div class="sy-ls">
        <div class="li sy-i sy-act"${cell("pow")}>${HB}<span class="d nm">POWER</span><span class="v l">${on && BTD.some(d => d.conn && d.input) ? "HOLD TO TURN OFF" : ""}</span>${tg(on)}</div>
        <div class="sec l">PAIRED</div>`;
    if (!BTD.length) h += `<div class="sy-none l">NO PAIRED DEVICES</div>`;
    BTD.forEach((d, i) => {
      h += `<div class="li sy-i sy-dv${on ? "" : " na"}"${cell("d:" + i)}>${ICON[d.kind]}<span class="sy-ss">${esc(d.name)}</span>${on && d.conn ? `<span class="chip l">CONNECTED</span>` : ""}
        <span class="v l">${on && d.conn ? `BAT ${d.bat}%` : "PAIRED"}</span></div>`;
      if (on && exp === "x:d:" + i) h += stripH(exp, "li sy-i");
    });
    h += `<div class="li sy-i${on ? "" : " na"}"${cell("scan")}><span class="d nm">SCAN</span><span class="v l">${S.scan && on ? "SEARCHING" : ""}</span>${tg(S.scan && on)}</div>`;
    if (S.scan && on) h += `<div class="sec l">NEARBY</div>` + NEAR.map((d, i) => `<div class="li sy-i sy-dv"${cell("n:" + i)}>${ICON[d.kind]}<span class="sy-ss">${esc(d.name)}</span>
        <span class="chip l sy-pr">PAIR</span></div>`).join("");
    return h + `</div></div></div>`;
  }
  const V = { main: vMain, net: vNet, audio: vAudio, bt: vBt };

  // ---------- 渲染 ----------
  const head = () => `<div class="pn-head"><span class="d t">SYSTEM</span><span class="l s">${view === "main" ? "STATUS" : NAME[view]}</span>${
    view === "main" ? "" : `<span class="sy-back l" data-back>← SYSTEM</span>`}</div>`;
  const lastU = {};
  function refreshNums(dur = 900) {
    for (const k in N) {
      const els = [...body.querySelectorAll(`[data-n="${k}"]`)];
      if (!els.length) continue;
      const [v, d, u] = N[k]();
      if (k in lastU && u !== lastU[k]) last[k] = v;
      lastU[k] = u;   // 换单位（KB/S ↔ MB/S）时不从旧单位的数滚过来
      roll(k, els, v, d, dur);
    }
  }
  function updTanks() {
    TANKS.forEach(m => {
      const el = body.querySelector(`[data-tk="${m.k}"]`); if (!el) return;
      const l = lvl(m);
      el.style.setProperty("--v", clamp(N[m.k]()[0], 0, 100) + "%");
      el.classList.toggle("warn", l === "warn"); el.classList.toggle("crit", l === "crit");
    });
  }
  // 原地刷新：开关、副标题、静音、滑条（不重建，保留过渡）
  function soft(dur = 300) {
    body.querySelectorAll(".tg[data-t]").forEach(t => t.classList.toggle("on", !!T[t.dataset.t]()));
    body.querySelectorAll("[data-x]").forEach(x => { x.textContent = X[x.dataset.x](); });
    body.querySelectorAll("[data-mute]").forEach(x => x.classList.toggle("mute", !!S[x.dataset.mute]));
    body.querySelectorAll("[data-sv]").forEach(x => x.style.setProperty("--v", SV[x.dataset.sv]() / 100));
    refreshNums(dur);
    setHints();
  }
  function hard(focusPw) {
    body.innerHTML = V[view]();
    if (!first || ST) updTanks();
    refreshNums();
    const inp = body.querySelector(".sy-in");
    if (inp) {
      inp.addEventListener("keydown", pwKey);
      inp.addEventListener("input", () => { pw.val = inp.value; });
      inp.addEventListener("focus", () => { if (sel !== "pw") { sel = "pw"; mark(); } setHints(); });
      inp.addEventListener("blur", () => setTimeout(setHints));
    }
    body.querySelectorAll(".sy-hn").forEach(el => fit(el, 48, 34));
    mark();
    if (focusPw && inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    setHints();
  }
  function swap(build) {
    clearTimeout(swapT);
    cancelHold(true);
    const go = () => { root.querySelector(".pn-head").outerHTML = head(); build(); P.stagger(body, ".box"); };
    if (ST) { go(); swapT = 0; return; }
    body.classList.add("out");
    swapT = setTimeout(() => { swapT = 0; body.classList.remove("out"); go(); }, 160);
  }

  // ---------- 选中 ----------
  // 行 = [data-row]；主视图里一行可有多格，子页面每格自成一行；.na 跳过
  const rows = () => [...body.querySelectorAll("[data-row]")]
    .map(r => (r.matches("[data-c]") ? [r] : [...r.querySelectorAll("[data-c]")]).filter(c => !c.classList.contains("na")).map(c => c.dataset.c))
    .filter(r => r.length);
  function pos() { const R = rows(); for (let r = 0; r < R.length; r++) { const c = R[r].indexOf(sel); if (c >= 0) return [R, r, c]; } return [R, -1, 0]; }
  function mark() {
    let el = cellEl(sel);
    if (!el || el.classList.contains("na")) { const R = rows(); sel = R.length ? R[0][0] : ""; el = cellEl(sel); }
    body.querySelectorAll("[data-c].sel").forEach(x => x !== el && x.classList.remove("sel"));
    if (el) el.classList.add("sel");
    body.querySelectorAll(".sy-ls").forEach(ls => P.slideSel(ls, el && ls.contains(el) ? el : null));
    const inp = body.querySelector(".sy-in");
    if (inp && sel !== "pw" && document.activeElement === inp) inp.blur();
    if (inp && sel === "pw" && document.activeElement !== inp) inp.focus();
    setHints();
  }
  function select(id) { if (id && id !== sel) { sel = id; mark(); } }
  function move(d) {
    const [R, r, c] = pos();
    const n = r < 0 ? 0 : clamp(r + d, 0, R.length - 1);
    select(R[n][Math.min(c, R[n].length - 1)]);
  }
  function setStrip(i) {
    const el = cellEl(sel); if (!el) return;
    const ops = el.querySelectorAll(".sy-op");
    stripIdx = clamp(i, 0, ops.length - 1);
    ops.forEach((o, k) => o.classList.toggle("on", k === stripIdx));
    setHints();
  }
  function setPref(i) {
    S.pref = (i + PREF.length) % PREF.length;
    body.querySelectorAll(".sy-pf .op").forEach((o, k) => o.classList.toggle("on", k === S.pref));
    P.flash("PREFER " + PREF[S.pref]);
  }
  function adjust(k, dv, abs) {
    S[k] = clamp(Math.round(abs ? dv : S[k] + dv), 0, 100);
    body.querySelectorAll(`[data-sv="${k}"]`).forEach(x => x.style.setProperty("--v", S[k] / 100));
    refreshNums(260);
  }
  function horiz(d) {
    if (SLK[sel]) return adjust(SLK[sel], d * 5);
    if (isStrip(sel)) return setStrip(stripIdx + d);
    if (sel === "pref") return setPref(S.pref + d);
    if (view === "main") { const [R, r, c] = pos(); if (r >= 0) select(R[r][clamp(c + d, 0, R[r].length - 1)]); return; }
    if (d < 0) up();
  }

  // ---------- 动作 ----------
  const defSel = v => v === "net" ? (S.eth ? "eth" : "ethx") : v === "audio" ? "vol" : v === "bt" ? "pow" : "vol";
  function go(v, s) { opener = sel; view = v; exp = null; pw = null; stripIdx = 0; sel = s || defSel(v); swap(hard); }
  function up() { if (view === "main") return; exp = null; pw = null; stripIdx = 0; view = "main"; sel = opener; swap(hard); }
  function details(id) {
    if (TK[id]) { P.flash("PROCESSES"); return; }
    if (id === "net") return go("net");
    if (id === "vol") return go("audio", "vol");
    if (id === "mic") return go("audio", "micm");
    if (id === "bt" && S.bt) return go("bt");
    if (id === "dnd" || id === "dm") return dndMenu(!S.dndMenu);
  }
  function dndMenu(on) { S.dndMenu = on; stripIdx = 0; sel = on ? "dm" : "dnd"; hard(); }
  // 这些动作必须按住（断开有线 / 断开唯一输入设备 / FORGET）
  function needsHold(id, k = stripIdx) {
    if (id === "ethx") return S.eth;
    if (id === "pow") return S.btPow && BTD.some(d => d.conn && d.input);
    if (id.startsWith("x:")) { const o = strip(id)[k]; return !!(o && o.hold); }
    return false;
  }
  function stripAct(id, k) {
    if (id === "dm") {
      const o = DND[k];
      if (o.h) S.until = hm(new Date(Date.now() + o.h * 3600e3)); else S.until = "08:00";
      S.dnd = true; S.dndMenu = false; sel = "dnd"; hard(); P.flash("DND " + X.dndSb()); return;
    }
    const [, t, si] = id.split(":"), i = +si;
    if (t === "w") {
      const n = NETS[i];
      if (k === 0) { if (n.conn) n.conn = false; else { NETS.forEach(m => { m.conn = false; }); n.conn = true; } P.flash((n.conn ? "CONNECTED " : "DISCONNECTED ") + n.ssid); }
      if (k === 1) { n.saved = false; n.conn = false; exp = null; sel = "w:" + i; P.flash("FORGOT " + n.ssid); }
      if (k === 2) { n.auto = !n.auto; P.flash("AUTOCONNECT " + (n.auto ? "ON" : "OFF")); }
    } else {
      const d = BTD[i];
      if (k === 0) { d.conn = !d.conn; P.flash((d.conn ? "CONNECTED " : "DISCONNECTED ") + d.name); }
      if (k === 1) { BTD.splice(i, 1); exp = null; sel = "scan"; P.flash("FORGOT " + d.name); }
    }
    hard();
  }
  function submitPw() {
    const n = NETS[pw.i];
    if (pw.val.length < 8) { pw.bad = true; hard(true); return; }
    NETS.forEach(m => { m.conn = false; });
    Object.assign(n, { saved: true, conn: true, auto: true });
    sel = "w:" + pw.i; pw = null; hard(); P.flash("CONNECTED " + n.ssid);
  }
  function act(id) {
    if (!id) return;
    if (isStrip(id)) return stripAct(id, stripIdx);
    if (TK[id]) return details(id);
    const tog = k => { S[k] = !S[k]; soft(); };
    switch (id) {
      case "net": return go("net");
      case "bt": return S.bt && go("bt");
      case "vol": return tog("mute");
      case "mute": return tog("mute");
      case "mic": case "micv": case "micm": return tog("micMute");
      case "night": return tog("night");
      case "dnd": S.dnd = !S.dnd; S.until = ""; if (S.dndMenu) S.dndMenu = false; return hard();
      case "eth": if (S.eth) { S.det = !S.det; hard(); } return;
      case "ethx": S.eth = !S.eth; if (!S.eth && sel === "eth") sel = "ethx"; hard(); return P.flash(S.eth ? "CONNECTING " + ETH.iface : "ETHERNET OFF");
      case "wifi": S.wifi = !S.wifi; exp = null; pw = null; return hard();
      case "pref": return setPref(S.pref + 1);
      case "pw": return submitPw();
      case "pow": S.btPow = !S.btPow; exp = null; hard(); return P.flash("BLUETOOTH " + (S.btPow ? "ON" : "OFF"));
      case "scan": S.scan = !S.scan; return hard();
    }
    const [t, si] = id.split(":"), i = +si;
    if (t === "w") {
      const n = NETS[i];
      if (n.saved) { exp = exp === "x:w:" + i ? null : "x:w:" + i; stripIdx = 0; return hard(); }
      if (n.sec === "eap") { P.flash("802.1X → SETTINGS"); return; }
      pw = pw && pw.i === i ? null : { i, val: "", show: false, bad: false };
      exp = null; if (pw) sel = "pw";
      return hard(!!pw);
    }
    if (t === "s") { sink().vol = S.vol; S.sink = si; S.vol = sink().vol; hard(); return P.flash("OUTPUT " + sink().nick); }
    if (t === "d") { exp = exp === "x:d:" + i ? null : "x:d:" + i; stripIdx = 0; return hard(); }
    if (t === "n") { P.flash("PAIRING " + NEAR[i].name); return; }
  }

  // ---------- 按住 ----------
  const holdEl = () => { const c = cellEl(sel); return c && isStrip(sel) ? c.querySelectorAll(".sy-op")[stripIdx] : c; };
  function startHold(src) {
    if (hold) return;
    const el = holdEl(), id = sel, k = stripIdx;
    if (ST) { holdDoneAt = performance.now(); return isStrip(id) ? stripAct(id, k) : act(id); }
    holdSrc = src;
    hold = { id, k, el, t0: performance.now(), p: 0, raf: 0 };
    const f = now => {
      if (!hold) return;
      hold.p = Math.min(1, (now - hold.t0) / HOLD_MS);
      el && el.style.setProperty("--p", hold.p);
      if (hold.p >= 1) { hold = null; holdDoneAt = now; el && el.style.setProperty("--p", 0); isStrip(id) ? stripAct(id, k) : act(id); return; }
      hold.raf = requestAnimationFrame(f);
    };
    hold.raf = requestAnimationFrame(f);
  }
  function cancelHold(quiet) {
    if (!hold) return;
    const { el, p, raf } = hold; hold = null; cancelAnimationFrame(raf);
    if (!el) return;
    if (quiet || ST) { el.style.setProperty("--p", 0); return; }
    const t0 = performance.now(), ease = k => 1 - Math.pow(1 - k, 3);
    const d = now => { const k = Math.min(1, (now - t0) / DRAIN_MS); el.style.setProperty("--p", p * (1 - ease(k))); if (k < 1) requestAnimationFrame(d); };
    requestAnimationFrame(d);
    P.flash("HOLD LONGER");
  }
  function release(src) { if (hold && holdSrc === src) cancelHold(false); }

  // ---------- 提示栏（shell 的 setKeys 只在打开时写一次，这里本地覆盖 #keys） ----------
  function setHints() {
    let k;
    const inPw = body && document.activeElement && document.activeElement.classList.contains("sy-in");
    if (inPw) k = [["ENTER", "连接"], ["TAB", "显示"], ["ESC", "取消"]];
    else if (sel === "dm") k = [["←→", "选择"], ["ENTER", "设定"], ["ESC", "收起"]];
    else if (view === "main") k = [["↑↓←→", "选择"], ["ENTER", needsHold(sel) ? "按住" : "切换"], ["M", "详情"], ["ESC", "关闭"]];
    else {
      // ←→ 只在真有横向控件时提示：滑条 = 调节，PREFER = 切换，动作条 = 选择
      const lr = SLK[sel] ? "调节" : sel === "pref" ? "切换" : isStrip(sel) ? "选择" : "";
      k = [["↑↓", "选择"], ["ENTER", needsHold(sel) ? "按住" : "执行"], ...(lr ? [["←→", lr]] : []), ["ESC", "返回"]];
    }
    reg.keys = k.filter(x => x[0] !== "ESC");
    const el = document.getElementById("keys");
    if (el) el.innerHTML = k.map(([a, b]) => `<span><kbd>${a}</kbd><span class="zh">${b}</span></span>`).join("");
  }

  // ---------- 键盘 ----------
  function pwKey(e) {
    e.stopPropagation();                       // shell 的 Backspace/Esc 关闭面板不能吃掉输入
    if (e.key === "Enter") { e.preventDefault(); submitPw(); }
    else if (e.key === "Tab") { e.preventDefault(); pw.show = !pw.show; hard(true); }
    else if (e.key === "Escape") { e.preventDefault(); const i = pw.i; pw = null; sel = "w:" + i; hard(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); e.target.blur(); move(e.key === "ArrowUp" ? -1 : 1); }
  }
  function onEsc(e) {
    if (e.key !== "Escape" && e.key !== "Backspace") return;
    if (e.target && e.target.classList && e.target.classList.contains("sy-in")) return;
    let h = false;
    if (view === "main" && S.dndMenu) h = true;
    else if (view !== "main") h = true;
    if (!h) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (swapT) return;
    cancelHold(true);
    if (view === "main") dndMenu(false); else up();
  }
  function key(e) {
    if (e.target && e.target.classList && e.target.classList.contains("sy-in")) return;
    if (swapT) { e.preventDefault(); return; }
    const k = e.key;
    if (k === "ArrowUp" || k === "ArrowDown") { e.preventDefault(); if (!hold) move(k === "ArrowUp" ? -1 : 1); }
    else if (k === "ArrowLeft" || k === "ArrowRight") { e.preventDefault(); if (!hold) horiz(k === "ArrowLeft" ? -1 : 1); }
    else if (k === "Enter" || k === " ") {
      e.preventDefault(); if (e.repeat) return;
      if (needsHold(sel)) startHold("key"); else act(sel);
    }
    else if (k === "m" || k === "M") { e.preventDefault(); details(sel); }
  }
  const onKeyUp = e => { if (e.key === "Enter" || e.key === " ") release("key"); };
  const onPtrUp = () => release("ptr");

  // ---------- 鼠标 ----------
  const cOf = t => { const c = t.closest && t.closest("[data-c]"); return c && body.contains(c) && !c.classList.contains("na") ? c : null; };
  function onOver(e) { if (swapT || hold) return; const c = cOf(e.target); if (!c) return; select(c.dataset.c); if (isStrip(c.dataset.c)) opIdx(e, c); }
  function opIdx(e, c) { const o = e.target.closest(".sy-op"); if (o && c.contains(o)) setStrip(+o.dataset.o); }
  function onDown(e) {
    if (e.button !== 0 || swapT) return;
    const c = cOf(e.target); if (!c) return;
    select(c.dataset.c);
    if (isStrip(c.dataset.c)) opIdx(e, c);
    if (needsHold(sel)) { e.preventDefault(); startHold("ptr"); }
  }
  function onClick(e) {
    if (swapT) return;
    if (e.target.closest("[data-back]")) return up();
    const c = cOf(e.target); if (!c) return;
    const id = c.dataset.c;
    if (performance.now() - holdDoneAt < 250) return;     // 按住完成后的 click 不再触发
    if (needsHold(id)) return;
    if (SLK[id]) {
      const s = c.querySelector(".slider"), r = s.getBoundingClientRect();
      if (e.clientX >= r.left - 8 && e.clientX <= r.right + 8) return adjust(SLK[id], (e.clientX - r.left) / r.width * 100, true);
    }
    if (id === "pref") { const o = e.target.closest(".op"); if (o) return setPref([...o.parentNode.children].indexOf(o)); }
    if (id === "pw") return;
    if (isStrip(id)) { const o = e.target.closest(".sy-op"); if (!o) return; setStrip(+o.dataset.o); }
    act(id);
  }
  function onCtx(e) {
    e.preventDefault();
    if (swapT) return;
    if (view !== "main") return up();
    const c = cOf(e.target); if (c) { select(c.dataset.c); details(c.dataset.c); }
  }
  function onWheel(e) {
    const now = performance.now();
    if (swapT || hold || now - wheelAt < 90) return;
    wheelAt = now;
    const d = e.deltaY > 0 ? 1 : -1, c = cOf(e.target);
    if (c && SLK[c.dataset.c]) { select(c.dataset.c); adjust(SLK[c.dataset.c], -d * 5); return; }
    move(d);
  }

  // ---------- mock 实时读数 ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  function step() {
    if (view !== "main") return;
    S.cpu = Math.round(rnd(4, 15));
    S.ram = clamp(+(S.ram + rnd(-.1, .1)).toFixed(1), 12, 14);
    if (q.get("temp") !== "crit") S.temp = Math.round(rnd(78, 83));
    S.down = Math.round(rnd(900, 2200)); S.up = Math.round(rnd(40, 160));
    if (!S.eth) S.down = S.up = 0;
    updTanks(); soft(700);
  }

  // ---------- 挂载 ----------
  function mount(el, api) {
    P = api;
    view = NAME[q.get("sub")] ? q.get("sub") : "main";
    if (!S.eth) S.down = S.up = 0;
    sel = q.get("sel") || (S.dndMenu && view === "main" ? "dm" : view === "net" && pw ? "pw" : view === "net" && exp ? exp : defSel(view));
    if (view !== "main") opener = view === "net" ? "net" : view === "audio" ? "vol" : "bt";
    el.innerHTML = `<div class="sy">${head()}<div class="sy-body"></div></div>`;
    root = el.firstElementChild; body = root.querySelector(".sy-body");
    hard(pw && sel === "pw");
    const hq = q.get("hold");
    if (hq !== null) { frozen = true; const h = holdEl(); h && h.style.setProperty("--p", clamp(+hq, 0, 100) / 100); }
    addEventListener("keydown", onEsc, true);
    addEventListener("keyup", onKeyUp, true);
    addEventListener("pointerup", onPtrUp, true);
    addEventListener("pointercancel", onPtrUp, true);
    root.addEventListener("mouseover", onOver);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("click", onClick);
    root.addEventListener("contextmenu", onCtx);
    root.addEventListener("wheel", onWheel, { passive: true });
    setTimeout(setHints, 0);
    if (!ST) {
      timer = setInterval(step, 1200);
      if (first) requestAnimationFrame(() => requestAnimationFrame(() => { first = false; updTanks(); }));
    } else first = false;
  }
  function unmount() {
    clearInterval(timer); clearTimeout(swapT); timer = swapT = 0;
    cancelHold(true);
    removeEventListener("keydown", onEsc, true);
    removeEventListener("keyup", onKeyUp, true);
    removeEventListener("pointerup", onPtrUp, true);
    removeEventListener("pointercancel", onPtrUp, true);
    view = "main"; exp = null; pw = null; stripIdx = 0; S.dndMenu = false; frozen = false; first = true;
    root = body = null;
  }

  P3.register("system", Object.assign(reg, { mount, unmount, key }));
})();
