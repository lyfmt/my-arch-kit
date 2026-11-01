import QtQuick

// 水下气泡（原型 .bubbles i）：16 个 2px 描边空心圆，从屏幕底部上浮 960px，9–19s 一轮。
// 位置和节奏用固定种子生成，每次打开都一样；still 时停在中途。
Item {
    id: root

    property bool running: true
    property bool still: false

    // 原型 rng('bubbles') 的 FNV + LCG
    readonly property var specs: {
        let s = 2166136261;
        const seed = "bubbles";
        for (let i = 0; i < seed.length; i++)
            s = Math.imul(s ^ seed.charCodeAt(i), 16777619) >>> 0;
        const r = () => {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 4294967296;
        };
        const out = [];
        for (let k = 0; k < 16; k++) {
            const size = 6 + r() * 16;
            out.push({
                "x": 760 + r() * 1140,
                "y": 1100 + r() * 40,
                "s": size,
                "dur": (9 + r() * 10) * 1000,
                "phase": r(),
                "sx": r() * 14,
                "sy": -120 - r() * 820
            });
        }
        return out;
    }

    Repeater {
        model: root.specs
        delegate: Rectangle {
            id: b
            required property var modelData
            property real base: 0
            // 从随机相位开始（原型的负 animation-delay）
            readonly property real t: (base + modelData.phase) % 1
            // 关键帧：0 → 50% (14,-480) → 100% (-6,-960)；不透明度 0 → 12% .7 → 85% .4 → 0
            readonly property real tx: t < 0.5 ? 28 * t : 14 - 40 * (t - 0.5)
            readonly property real ty: -960 * t
            x: modelData.x + (root.still ? modelData.sx : tx)
            y: modelData.y + (root.still ? modelData.sy : ty)
            width: modelData.s
            height: modelData.s
            radius: width / 2
            color: "transparent"
            border.width: 2
            border.color: Qt.rgba(190 / 255, 245 / 255, 1, 0.7)
            opacity: root.still ? 0.45 : t < 0.12 ? t / 0.12 * 0.7 : t < 0.85 ? 0.7 - (t - 0.12) / 0.73 * 0.3 : 0.4 * (1 - (t - 0.85) / 0.15)
            NumberAnimation on base {
                running: root.running && !root.still
                loops: Animation.Infinite
                from: 0
                to: 1
                duration: b.modelData.dur
            }
        }
    }
}
