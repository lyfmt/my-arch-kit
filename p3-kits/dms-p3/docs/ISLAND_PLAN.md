# 灵动岛（island-b → `Modules/DIsland`）

状态：**已完成。** 两个阶段（换皮、SDF 气泡串）都已实现。对应 `prototype/INTEGRATION.md` 第 5 节。

## 做法

不另起窗口，也不逐个改 Activity。岛的窗口（`DIslandHostWindow` / `IslandFreeHostWindow`）、多屏、拖动和 `dms ipc call island …` 都沿用 DMS 2.0；换的是两处：控制器给出的目标尺寸，和岛面上画什么。

- `patches/island_IslandController.qml.patch`
  - `p3Layout`：顶栏横放的独立岛（不是竖栏、far edge、free、dot、嵌入、notch）走 P3 气泡串。
  - 气泡串状态下的目标尺寸取自 `P3IslandLayout.js`（和内容层同一份几何）；`p3Data` 汇总通知数、勿扰、媒体、电量等布局输入。
  - 只点击、不悬停展开（`hoverExpandEnabled` 在 `p3Layout` 时关掉）。
- `patches/island_DIslandSurface.qml.patch`
  - 岛面平涂 `P3.isl`，不跟调色板 / 高对比；重要 / 紧急通知的描边用 `P3.accent`。
  - `p3Layout` 时：home / media / system / notification 系列的 Activity 换成空面，内容由 `P3IslandLayer` 画；通知中心的面只负责就绪信号和键盘焦点，内容在 `P3IslandCenter`。
  - 形状由 `P3IslandShape` 画（不再用矩形面和 DMS 的阴影）。DMS 自己的面板（启动器、控制中心、剪贴板、电源菜单、壁纸、天气、DashTab）内容不换，作为 body 并进同一张 SDF 场。
- `overlay/Modules/P3/Island/`
  - `P3IslandLayout.js`：island-b 的 `row()` / `L[...]` / `placeNC()`，气泡的目标位置和尺寸。
  - `P3IslandSprings.qml`：每个气泡 x / y / w / h 四个弹簧通道（原型的 `to()` / `kick()` / `step()`）。
  - `P3IslandShape.qml` + `shaders/p3island.frag`：9 个胶囊 + body 的多项式平滑并集，一趟 fragment shader，沿速度方向轻微拉长，阴影是同一张场下移 2px 的软边。
  - `P3IslandLayer.qml`：气泡里的时间、音频可视化、通知计数、电量、通知卡、媒体控制和通知中心面板，以及按目标位置摆的点击区。菜单（`P3Menu`）开在同一块屏上时岛收成菜单态。
  - `P3IslandCenter.qml`：通知中心，一行一条的平铺列表，头部计数 / 勿扰 / 清空。
  - `P3IslandText`、`P3IslandIcon`、`P3IslandAppIcon`、`P3IslandViz`：文字、实心小图标、通知应用图、音频柱。

## 颜色与交互

- 岛面 `P3.isl`（#14306e），二级面 `P3.isl2`（#1d3d82）。除阴影软边外不用渐变，不做 hover。
- 字体、字号、图标照 island-b；展示字只给时间和数字。

## 检查

```sh
P3_CHECK_DIR=/tmp/p3check-isl P3_IPC="island status" P3_SHOT=/tmp/p3shots/island.png scripts/qmlcheck.sh /tmp/p3build 10
P3_CHECK_DIR=/tmp/p3check-nc P3_IPC="island open notificationcenter" P3_SHOT=/tmp/p3shots/island-nc.png scripts/qmlcheck.sh /tmp/p3build 10
```

启用后只要岛、不要两侧卫星胶囊时，把 `barConfigs` 里 id 为 `default` 的那一项设 `"islandSatellitesEnabled": false`（DMS 设置 → 顶栏外观）。

## 风险

- `Modules/DIsland` 的 2.0 代码改动频繁，补丁要用 `diff -u` 小块生成（`scripts/dev.sh export`），升级 DMS 时重新对一遍。
- 岛和 dms-p5 改的是同一批文件，只能启用一个包，`enable.sh` 已处理。
