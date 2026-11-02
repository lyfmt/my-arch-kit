import QtQuick
import qs.Modules.P3
import "P3IslandLayout.js" as P3L

// 岛的形状层：P3IslandLayer 的 9 个气泡 + DMS 面板（body）做 SDF 平滑并集，一趟 fragment shader 画完（shaders/p3island.frag）。
// 只铺在气泡外框（加阴影余量）上；沿速度方向轻微拉长，和原型的 draw() 是同一段数学。
ShaderEffect {
    id: root

    required property Item field
    property real bodyX: 0
    property real bodyY: 0
    property real bodyWidth: 0
    property real bodyHeight: 0
    property vector4d bodyRadii: Qt.vector4d(0, 0, 0, 0)
    property color fill: P3.isl
    property color border: "transparent"
    property real dpr: 1
    property bool reducedMotion: false

    readonly property var springs: field.springs
    readonly property real originX: field.centerX

    // DMS 自己的面板（launcher、控制中心……）打开时 body 并进来，气泡串收起时退出
    property real weight: root.field.mode === "" ? 1 : 0

    Behavior on weight {
        NumberAnimation {
            duration: root.reducedMotion ? 0 : 220
            easing.type: Easing.OutCubic
        }
    }

    function vec(b) {
        const w = Math.max(0, b.w);
        const h = Math.max(0, b.h);
        if (w < 0.5 || h < 0.5)
            return Qt.vector4d(0, 0, 0, 0);
        let sx = 1;
        let sy = 1;
        if (!root.reducedMotion) {
            const sp = Math.min(0.12, Math.hypot(b.vx, b.vy) / 3200);
            if (Math.abs(b.vx) > Math.abs(b.vy)) {
                sx = 1 + sp;
                sy = 1 - sp * 0.6;
            } else {
                sy = 1 + sp;
                sx = 1 - sp * 0.6;
            }
        }
        return Qt.vector4d(root.originX + b.x, b.y + h / 2, w * sx / 2, h * sy / 2);
    }

    // ---------------------------------------------------------------- uniforms（名字和 p3island.frag 一致）
    readonly property real smoothK: P3L.K
    readonly property real borderWidth: 1.5
    readonly property real bodyWeight: root.weight
    readonly property real cloudT: root.springs.cloudT
    readonly property real cloudA: root.springs.cloudA
    readonly property vector4d frame: Qt.vector4d(root.x, root.y, root.width, root.height)
    readonly property vector4d fillColor: Qt.vector4d(root.fill.r, root.fill.g, root.fill.b, root.fill.a)
    readonly property vector4d shadowColor: Qt.vector4d(0, 4 / 255, 40 / 255, 0.30 * root.fill.a)
    readonly property vector4d borderColor: Qt.vector4d(root.border.r, root.border.g, root.border.b, root.border.a)
    readonly property vector4d b0: vec(root.springs.time)
    readonly property vector4d b1: vec(root.springs.audio)
    readonly property vector4d b2: vec(root.springs.notif)
    readonly property vector4d b3: vec(root.springs.batt)
    readonly property vector4d b4: vec(root.springs.card)
    readonly property vector4d b5: vec(root.springs.prev)
    readonly property vector4d b6: vec(root.springs.play)
    readonly property vector4d b7: vec(root.springs.next)
    readonly property vector4d b8: vec(root.springs.panel)
    readonly property vector4d caps0: Qt.vector4d(root.springs.time.r, root.springs.audio.r, root.springs.notif.r, root.springs.batt.r)
    readonly property vector4d caps1: Qt.vector4d(root.springs.card.r, root.springs.prev.r, root.springs.play.r, root.springs.next.r)
    readonly property vector4d caps2: Qt.vector4d(root.springs.panel.r, 0, 0, 0)
    readonly property vector4d body: Qt.vector4d(root.bodyX, root.bodyY, root.bodyWidth, root.bodyHeight)

    // 外框：所有可见气泡 + body，留出平滑并集的外扩和阴影
    readonly property rect area: {
        let x0 = 1e9;
        let y0 = 1e9;
        let x1 = -1e9;
        let y1 = -1e9;
        for (const v of [root.b0, root.b1, root.b2, root.b3, root.b4, root.b5, root.b6, root.b7, root.b8]) {
            if (v.z <= 0)
                continue;
            x0 = Math.min(x0, v.x - v.z);
            x1 = Math.max(x1, v.x + v.z);
            y0 = Math.min(y0, v.y - v.w);
            y1 = Math.max(y1, v.y + v.w);
        }
        if (root.weight > 0.001 && root.bodyWidth > 0.5 && root.bodyHeight > 0.5) {
            x0 = Math.min(x0, root.bodyX);
            x1 = Math.max(x1, root.bodyX + root.bodyWidth);
            y0 = Math.min(y0, root.bodyY);
            y1 = Math.max(y1, root.bodyY + root.bodyHeight);
        }
        if (x0 > x1)
            return Qt.rect(0, 0, 0, 0);
        const m = P3L.K + 8;
        const left = Math.floor(x0 - m);
        const top = Math.floor(y0 - m);
        return Qt.rect(left, top, Math.ceil(x1 + m) - left, Math.ceil(y1 + m) - top);
    }

    x: root.area.x
    y: root.area.y
    width: root.area.width
    height: root.area.height
    blending: true
    fragmentShader: Qt.resolvedUrl("shaders/p3island.frag.qsb")
}
