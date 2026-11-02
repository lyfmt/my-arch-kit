pragma Singleton
import QtQuick
import Quickshell

// P3 蓝，写死色值（不跟 matugen），对应 lock.css 的 :root
Singleton {
    id: theme

    // 资源目录：仓库里 shell/assets 是指向 ../assets 的符号链接，install.sh 复制时展开
    readonly property string assetDir: Quickshell.env("P3LOCK_ASSETS") || (Quickshell.shellDir + "/assets")

    FontLoader {
        id: nunito
        source: "file://" + theme.assetDir + "/fonts/NunitoSans-BlackItalic.ttf"
    }
    FontLoader {
        id: barlow
        source: "file://" + theme.assetDir + "/fonts/BarlowCondensed-Bold.ttf"
    }

    // .d 展示字（数字、名词）/ .l 直立窄体标签 / 中文
    readonly property string display: nunito.status === FontLoader.Ready ? nunito.name : "Nunito Sans"
    readonly property string label: barlow.status === FontLoader.Ready ? barlow.name : "Barlow Condensed"
    readonly property string cjk: "Noto Sans CJK SC"
    readonly property url bg: "file://" + assetDir + "/bg.png"

    readonly property color base: "#000510"
    readonly property color ink: "#04103c"
    readonly property color tx: "#ecfcff"
    readonly property color fill: "#a3f0ff"
    readonly property color c3: "#7ccdf4"
    readonly property color dim: Qt.rgba(163 / 255, 240 / 255, 1, 0.62)
    readonly property color faint: Qt.rgba(163 / 255, 240 / 255, 1, 0.32)
    readonly property color line: Qt.rgba(163 / 255, 240 / 255, 1, 0.34)
    readonly property color red: "#e3121b"
    readonly property color shard: "#ffffff"
    readonly property color bubble: Qt.rgba(190 / 255, 245 / 255, 1, 0.75)

    // CSS 缓动 → Easing.BezierSpline 的 bezierCurve
    readonly property var eOut: [0.16, 1, 0.3, 1, 1, 1]
    readonly property var eSnap: [0.3, 1.35, 0.4, 1, 1, 1]
    readonly property var eIo: [0.65, 0, 0.35, 1, 1, 1]
    readonly property var eEase: [0.25, 0.1, 0.25, 1, 1, 1]
    readonly property var eInOut: [0.42, 0, 0.58, 1, 1, 1]

    // 按时间驱动的动画（锁屏表面和 overlay 共用同一时钟，保证画面逐帧一致）用的三次贝塞尔求值
    function bez(c, x) {
        if (x <= 0)
            return 0;
        if (x >= 1)
            return 1;
        const x1 = c[0], y1 = c[1], x2 = c[2], y2 = c[3];
        let t = x;
        for (let i = 0; i < 8; i++) {
            const it = 1 - t;
            const fx = 3 * it * it * t * x1 + 3 * it * t * t * x2 + t * t * t - x;
            const dx = 3 * it * it * x1 + 6 * it * t * (x2 - x1) + 3 * t * t * (1 - x2);
            if (Math.abs(fx) < 1e-5)
                break;
            if (Math.abs(dx) < 1e-6)
                break;
            t = Math.min(1, Math.max(0, t - fx / dx));
        }
        const it = 1 - t;
        return 3 * it * it * t * y1 + 3 * it * t * t * y2 + t * t * t;
    }
    // CSS alternate 往返动画的相位（0→1→0），已套缓动
    function alt(c, t, dur) {
        const k = (t / dur) % 2;
        return bez(c, k <= 1 ? k : 2 - k);
    }
}
