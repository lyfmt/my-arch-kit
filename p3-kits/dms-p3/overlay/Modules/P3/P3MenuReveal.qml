import QtQuick

// P3 菜单的出场 / 收场（prototype/island-b.html 的 openSeq）：灵动岛吸成水滴、下坠后，从水滴中心破开一个圆盖满整屏，
// 边上一圈 P3.fill 的表面张力；刚破开时圆里是岛的墨色，涨开后透出菜单。收场反过来缩回水滴，重新变成墨色接上岛。
// 窗口把 effect 设为内容层的 layer.effect，active 时才打开 layer；菜单底色（base × baseA）也在这里画，圆外完全透明。
Item {
    id: root

    // 菜单底色的不透明度（水位）
    property real baseA: 1
    property color inkColor: P3.isl
    property color baseColor: P3.stageBg
    property color rimColor: P3.fill

    // 岛那边：吸进时间胶囊 0ms、下坠 180ms（P3IslandLayer.menuSeq），这里 300ms 时破开
    readonly property int wait: 300
    readonly property int openMs: 520
    readonly property int closeMs: 480

    property bool active: false
    property bool closing: false
    property var island: null
    property real cx: 0
    property real cy: 0
    property real r0: 0
    property real r1: 0
    property real inkFrom: 1
    // 动画进度 0‥1（已经过缓动）
    property real p: 0

    readonly property real radius: root.r0 + (root.r1 - root.r0) * root.p
    readonly property real ink: root.closing ? root.inkFrom + (1 - root.inkFrom) * Math.min(1, root.p / 0.8) : root.p < 0.15 ? root.inkFrom : root.inkFrom * (1 - (root.p - 0.15) / 0.85)
    readonly property real rimA: 0.9 * (root.closing ? 1 - Math.max(0, (root.p - 0.8) / 0.2) : 1)
    readonly property real wob: root.closing ? 0 : 2.5 * Math.sin(Math.PI * root.p)

    // 盖住整个窗口的半径
    function far() {
        const dx = Math.max(root.cx, root.width - root.cx);
        const dy = Math.max(root.cy, root.height - root.cy);
        return Math.hypot(dx, dy) + 4;
    }

    // 出场：island = P3Menu.islandOn(...)；没有岛（也不在收场途中）时返回 false，窗口自己渐显
    function open(island) {
        closeAnim.stop();
        if (root.active && root.closing && root.radius > 0.5) {
            const ink = root.ink;
            const r = root.radius;
            root.closing = false;
            root.inkFrom = ink;
            root.r0 = r;
            root.r1 = root.far();
            root.p = 0;
            openAnim.restart();
            return true;
        }
        if (!island) {
            root.finish();
            return false;
        }
        root.island = island;
        root.closing = false;
        root.inkFrom = 1;
        root.r0 = 0;
        root.r1 = 0;
        root.p = 0;
        root.active = true;
        waitTimer.restart();
        return true;
    }

    function start() {
        const d = root.island ? root.island.drop() : null;
        if (d) {
            root.cx = d.x;
            root.cy = d.y;
            root.r0 = d.r;
        } else {
            root.cx = root.width / 2;
            root.cy = 35;
            root.r0 = 22;
        }
        root.r1 = root.far();
        root.p = 0;
        openAnim.restart();
    }

    // 收场：缩回 island（P3Menu.islandOn(...)）的水滴，返回动画毫秒数；
    // 还没破开、或屏幕上没有水滴可回时返回 0，窗口按自己的渐隐收
    function close(island) {
        if (waitTimer.running) {
            root.finish();
            return 0;
        }
        const target = island || root.island;
        const d = target ? target.drop() : null;
        if (!d && !root.active) {
            root.finish();
            return 0;
        }
        openAnim.stop();
        if (root.active) {
            root.inkFrom = root.ink;
            root.r0 = root.radius;
        } else {
            root.cx = d.x;
            root.cy = d.y;
            root.inkFrom = 0;
            root.r0 = root.far();
        }
        root.island = target;
        root.closing = true;
        root.r1 = d ? d.r : 22;
        root.p = 0;
        root.active = true;
        closeAnim.restart();
        return root.closeMs;
    }

    function finish() {
        waitTimer.stop();
        openAnim.stop();
        closeAnim.stop();
        root.active = false;
        root.closing = false;
        root.island = null;
    }

    Timer {
        id: waitTimer
        interval: root.wait
        onTriggered: root.start()
    }

    NumberAnimation {
        id: openAnim
        target: root
        property: "p"
        from: 0
        to: 1
        duration: root.openMs
        easing.type: Easing.BezierSpline
        easing.bezierCurve: [0.7, 0, 0.2, 1, 1, 1]
        onFinished: {
            if (!root.closing)
                root.finish();
        }
    }

    NumberAnimation {
        id: closeAnim
        target: root
        property: "p"
        from: 0
        to: 1
        duration: root.closeMs
        easing.type: Easing.BezierSpline
        easing.bezierCurve: [0.6, 0, 0.3, 1, 1, 1]
    }

    readonly property Component effect: Component {
        ShaderEffect {
            property var source: null
            readonly property vector2d size: Qt.vector2d(width, height)
            readonly property vector2d center: Qt.vector2d(root.cx, root.cy)
            readonly property real radius: root.radius
            readonly property real ink: root.ink
            readonly property real rimA: root.rimA
            readonly property real rimW: 2
            readonly property real wob: root.wob
            readonly property real phase: root.p * 5
            readonly property vector4d inkColor: Qt.vector4d(root.inkColor.r, root.inkColor.g, root.inkColor.b, 1)
            readonly property vector4d baseColor: Qt.vector4d(root.baseColor.r, root.baseColor.g, root.baseColor.b, root.baseA)
            readonly property vector4d rimColor: Qt.vector4d(root.rimColor.r, root.rimColor.g, root.rimColor.b, 1)

            fragmentShader: Qt.resolvedUrl("shaders/p3reveal.frag.qsb")
        }
    }
}
