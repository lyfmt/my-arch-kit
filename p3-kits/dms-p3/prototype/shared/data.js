// dms-p3 原型假数据：取自本机 2026-10-30 的快照（托盘、appusage、board.json、DgopService 读数）
// 静态原型只读这里，不连任何服务
window.P3DATA = {
  user: { name: "lyfmt", host: "arch-zen", avatar: null },
  clock: { h: 16, m: 29, month: 10, day: 30, dow: "FRI", dowZh: "周五" },
  media: { title: "ロウワー", artist: "ぬゆり", playing: true, pos: 0.42, player: "Music Card" },
  notify: { count: 9, dnd: false, latest: [
    { app: "飞书", icon: "shared/icons/feishu.png", title: "设计评审", body: "下午 5 点 dms-p3 方案过一遍", t: "16:12" },
    { app: "QQ", icon: "shared/icons/qq.png", title: "群聊 · niri 吹水", body: "新版 overview 好丝滑", t: "15:58" },
    { app: "Clash Verge", icon: "shared/icons/clash-verge.png", title: "订阅已更新", body: "42 个节点", t: "15:40" },
  ] },
  battery: { pct: 78, charging: false, remain: "3:42", watts: 9.6, health: 94, limit: 85, profile: "balanced" },
  audio: { vol: 62, muted: false, sink: "Speaker · ALC287", mic: 80, micMuted: true },
  brightness: 55,
  net: { wifi: true, ssid: "lyfmt-5G", signal: 82, ip: "192.168.31.24", vpn: "Clash TUN", down: "2.4 MB/s", up: "180 KB/s" },
  bt: { on: true, devices: [ { name: "WH-1000XM4", kind: "headphones", connected: true, battery: 70 }, { name: "MX Master 3", kind: "mouse", connected: false } ] },
  wifiList: [ { ssid: "lyfmt-5G", sig: 82, sec: true, on: true }, { ssid: "lyfmt-2.4G", sig: 74, sec: true }, { ssid: "CMCC-a7Fq", sig: 41, sec: true }, { ssid: "Xiaomi_GUEST", sig: 28, sec: false } ],
  stats: { cpu: 14, cpuTemp: 52, cpuGhz: 3.1, cores: 16, ram: 29, ramUsed: 9.2, ramTotal: 31.2, swap: 3, gpuTemp: 46, disk: 61, diskUsed: "570G", diskTotal: "931G", uptime: "5h 12m", load: "0.84 0.97 1.10", procs: 412,
    cpuHist: [8,11,9,14,22,18,12,10,9,13,16,14,11,9,8,12,19,25,17,14] },
  tray: [
    { id: "magpie", name: "magpie", icon: "shared/icons/magpie.png", status: "运行中" },
    { id: "feishu", name: "飞书", icon: "shared/icons/feishu.png", status: "3 条未读", badge: 3 },
    { id: "fcitx", name: "Fcitx5 · Rime", icon: "shared/icons/fcitx.svg", status: "中文" },
    { id: "sunshine", name: "Sunshine", icon: "shared/icons/sunshine.png", status: "串流待机" },
    { id: "clash", name: "Clash Verge", icon: "shared/icons/clash-verge.png", status: "规则模式 · HK 02" },
    { id: "qq", name: "QQ", icon: "shared/icons/qq.png", status: "6 条未读", badge: 6 },
  ],
  pinned: [
    { name: "TERMINAL", zh: "kitty", icon: "shared/icons/kitty.png", key: "Mod+T" },
    { name: "BROWSER", zh: "chromium", icon: "shared/icons/chromium.png", key: "Mod+B" },
    { name: "FILES", zh: "thunar", icon: "shared/icons/files.svg", key: "Mod+E" },
  ],
  frequent: [
    { name: "magpie", icon: "shared/icons/magpie.png", n: 69 }, { name: "飞书", icon: "shared/icons/feishu.png", n: 67 },
    { name: "Buffin", icon: "shared/icons/buffin.svg", n: 64 }, { name: "Clash Verge", icon: "shared/icons/clash-verge.png", n: 63 },
    { name: "QQ", icon: "shared/icons/qq.png", n: 37 }, { name: "Termius", icon: "shared/icons/termius.png", n: 14 },
    { name: "网易云音乐", icon: "shared/icons/netease.svg", n: 4 }, { name: "Lutris", icon: "shared/icons/lutris.png", n: 4 },
  ],
  tasks: [
    { title: "dms-p3 静态稿", status: "doing" },
    { title: "背单词 30 个", status: "todo", daily: "08:00" },
    { title: "dms-p5 迁到 2.0", status: "todo" },
    { title: "整理壁纸收藏", status: "todo" },
    { title: "回复飞书评审意见", status: "todo" },
    { title: "kanban 加 watchChanges", status: "done" },
  ],
  monitors: [ { name: "HDMI-A-1", w: 2560, h: 1440, scale: 1, primary: true }, { name: "eDP-1", w: 1706, h: 1066, scale: 1.5 } ],
};
