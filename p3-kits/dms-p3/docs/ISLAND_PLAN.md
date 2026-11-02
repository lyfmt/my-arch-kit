# 灵动岛（island-b → `Modules/DIsland`）

状态：**已完成。** 两个阶段（换皮、SDF 气泡串）都已实现。对应 `prototype/INTEGRATION.md` 第 5 节。

## 做法

不另起窗口，也不逐个改 Activity。岛的窗口（`DIslandHostWindow` / `IslandFreeHostWindow`）、多屏、拖动和 `dms ipc call island …` 都沿用 DMS 2.0；换的是两处：控制器给出的目标尺寸，和岛面上画什么。

- `patches/island_IslandController.qml.patch`
  - `p3Layout`：顶栏横放的独立岛（不是竖栏、far edge、free、dot、嵌入、notch）走 P3 气泡串。
  - 气泡串状态下的目标尺寸取自 `P3IslandLayout.js`（和内容层同一份几何）；`p3Data` 汇总通知数、勿扰、媒体、电量等布局输入。
  - 悬停（`islandInteractionMode` 为 `hybrid`，顶栏岛的默认值）：home 时指针进岛 150ms 后进 `peek`（`p3Peek`，原型的状态 2：整串胀开、时间旁露出日期、音频气泡里是歌名、电量带 %）；media 时走 DMS 自己的 `hoverExpanded` 展开成 mediaOpen（原型 3b）。其它 activity 不悬停展开。
  - 指针离开 140ms（`p3HoverCloseDelay`）后收回：清掉 peek、电量详情，悬停展开的 media 收起。悬停展开时的目标区域是展开形状和紧凑形状的并集，输入遮罩不会在指针下面缩掉。
- `patches/island_DIslandSurface.qml.patch`
  - 岛面平涂 `P3.isl`，不跟调色板 / 高对比；重要 / 紧急通知的描边用 `P3.accent`。
  - `p3Layout` 时：home / media / system / notification 系列的 Activity 换成空面，内容由 `P3IslandLayer` 画；通知中心的面只负责就绪信号和键盘焦点，内容在 `P3IslandCenter`。
  - 形状由 `P3IslandShape` 画（不再用矩形面和 DMS 的阴影）。DMS 自己的面板（启动器、控制中心、剪贴板、电源菜单、壁纸、天气、DashTab）内容不换，作为 body 并进同一张 SDF 场。
- `overlay/Modules/P3/Island/`
  - `P3IslandLayout.js`：island-b 的 `row()` / `L[...]` / `placeNC()`，气泡的目标位置和尺寸。
  - `P3IslandSprings.qml`：每个气泡 x / y / w / h 四个弹簧通道（原型的 `to()` / `kick()` / `step()`），外加云浮偏移 `fx` / `fy`。
  - `P3IslandShape.qml` + `shaders/p3island.frag`：9 个胶囊 + body 的多项式平滑并集，一趟 fragment shader，沿速度方向轻微拉长，阴影是同一张场下移 2px 的软边。
  - `P3IslandLayer.qml`：气泡里的时间、音频可视化、通知计数、电量、通知卡、媒体控制和通知中心面板，以及按目标位置摆的点击区和悬停区。
  - `P3IslandCenter.qml`：通知中心，一行一条的平铺列表，头部计数 / 勿扰 / 清空。
  - `P3IslandOpen.qml`：点一条通知直接去目标（见下）。
  - `P3IslandText`、`P3IslandIcon`、`P3IslandAppIcon`、`P3IslandViz`：文字、实心小图标、通知应用图、音频柱。

## 颜色与交互

- 岛面 `P3.isl`（#14306e），二级面 `P3.isl2`（#1d3d82）。除阴影软边外不用渐变。
- 字体、字号、图标照 island-b；展示字只给时间和数字。
- 悬停：指针进入的气泡鼓一下、同排邻居往它那边靠（`lean()`）；离开时整排一胀一缩（`wobble()`）。悬停区就是控制器的目标区域（`targetDescriptor`），和输入遮罩一致。peek 胀开会让气泡在不动的指针下换位置，这时的点击算指针原来指着的气泡（`aimed()`），指针一动就按新位置。
- 云浮：任一播放器在播放、岛处于 home / peek / media 时，各气泡按 `P3IslandLayout.js` 的 `cloudX` / `cloudY` 缓慢漂移（各自相位、整数倍频率，一圈 `CLOUD_MS`），shader 里再加一点尺寸呼吸，颈子跟着拉伸。只有一个 `cloudT` 时钟（0‥1 循环），强度 `cloudA` 在 1.4s 内淡入淡出；不播放时时钟停掉，没有逐帧开销。通知卡和通知中心不漂。
- 音频柱：任一播放器 `isPlaying` 就跳，全都暂停 / 停止就停。
- 通知：点通知卡（到达时）或通知中心的一行，`P3IslandOpen.open()` 先调默认动作（`identifier` 为 `default`，没有就第一个动作），再把发通知应用的窗口聚焦（niri 窗口的 `app_id` 对 desktop entry / `StartupWMClass` / 应用名，取最近聚焦的那个）；没有动作也没有窗口时启动这个应用。然后通知清掉、岛收回。计数气泡照旧打开通知中心。
- 打开 P3 菜单（点时间气泡、`Mod+Z`、`dms ipc call p3menu toggle`）：岛先收起展开的面板，所有气泡吸进时间胶囊（0ms），缩成水滴下坠（180ms）；`P3MenuReveal` 在 300ms 时从水滴中心破开一个圆，520ms 涨满整屏，边上一圈 `P3.fill` 的表面张力，圆里先是岛的墨色、涨开后透出菜单。关闭反过来：480ms 缩回水滴、变回墨色，窗口隐藏后气泡从水滴里长回来。岛通过 `P3Menu.registerIsland()` 登记，菜单用 `P3Menu.islandOn(屏幕名)` 找同屏的岛、用岛的 `drop()` 取水滴位置；同屏没有岛（或减少动画）时菜单用自己的水位渐显。圆由 `overlay/Modules/P3/shaders/p3reveal.frag` 画，作为菜单内容层的 `layer.effect`，只在过场时打开。

## 检查

```sh
P3_CHECK_DIR=/tmp/p3check-isl P3_IPC="island status" P3_SHOT=/tmp/p3shots/island.png scripts/qmlcheck.sh /tmp/p3build 10
P3_CHECK_DIR=/tmp/p3check-nc P3_IPC="island open notificationcenter" P3_SHOT=/tmp/p3shots/island-nc.png scripts/qmlcheck.sh /tmp/p3build 10
```

启用后只要岛、不要两侧卫星胶囊时，把 `barConfigs` 里 id 为 `default` 的那一项设 `"islandSatellitesEnabled": false`（DMS 设置 → 顶栏外观）。

## 风险

- `Modules/DIsland` 的 2.0 代码改动频繁，补丁要用 `diff -u` 小块生成（`scripts/dev.sh export`），升级 DMS 时重新对一遍。
- 岛和 dms-p5 改的是同一批文件，只能启用一个包，`enable.sh` 已处理。
