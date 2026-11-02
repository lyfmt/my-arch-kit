import QtQuick

// 原型 #deep：背景图 + 光束 + 焦散 + 气泡 + 视差，以及解锁时的下沉和水面亮线。
// 1920×1080 舞台坐标。锁屏表面（LockScene，UI 作为默认子项放进 deep）和解锁 overlay 共用；
// 所有动画都由同一个墙钟（session.epoch / session.upStart）算出，两边同一时刻画面一致。
Item {
    id: root

    required property var session
    default property alias content: uiHost.data

    width: 1920
    height: 1080

    // 每帧刷新的时间（ms）
    property real now: Date.now()
    FrameAnimation {
        running: root.visible
        onTriggered: root.now = Date.now()
    }

    readonly property real t: (now - session.epoch) / 1000
    readonly property real up: session.unlocking && session.upStart > 0 ? Math.max(0, now - session.upStart) : -1
    // 0–450ms：光束变亮、焦散加强、视差归零；450ms 起 1.25s：deep 下沉 1080 + 放大 1.12，水面亮线从上方降下
    readonly property real sinkP: up < 0 ? 0 : Theme.bez(Theme.eIo, (up - 450) / 1250)
    readonly property real glowP: up < 0 ? 0 : Theme.bez(Theme.eOut, up / 800)
    readonly property real causP: up < 0 ? 0 : Theme.bez(Theme.eEase, up / 800)
    readonly property real parBack: up < 0 ? 1 : 1 - Theme.bez(Theme.eOut, up / 900)
    readonly property bool finished: up >= 1700

    // 同一进程里各块屏幕的随机数一致：种子取自 epoch
    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let x = Math.imul(a ^ (a >>> 15), 1 | a);
            x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
            return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
        };
    }
    readonly property var ambient: {
        const r = rng(session.epoch % 100000 + 7);
        const a = [];
        for (let i = 0; i < 16; i++) {
            const s = 6 + r() * 16;
            a.push({ x: 760 + r() * 1140, y: 1100 + r() * 40, s: s, dur: 9 + r() * 10, delay: -r() * 19 });
        }
        return a;
    }
    readonly property var burst: {
        const r = rng(session.epoch % 100000 + 131);
        const a = [];
        for (let i = 0; i < 46; i++) {
            const s = 6 + r() * 26;
            a.push({ x: 200 + r() * 1700, y: 1060 + r() * 120, s: s, dur: 1 + r() * 0.9, delay: r() * 0.5, dx: (r() - 0.5) * 140 });
        }
        return a;
    }

    // 原型里桌面（z 更高）从上方降下盖住 deep 的上缘；这里桌面是真实桌面，改为在水面处裁掉 deep
    Item {
        id: surfaceClip
        y: 1080 * root.sinkP
        width: 1920
        height: 1080 - y
        clip: root.sinkP > 0

    Item {
        id: deep
        y: -surfaceClip.y
        width: 1920
        height: 1080
        transform: [
            Scale {
                origin.x: 1920 * 0.7
                origin.y: 1080 * 0.3
                xScale: 1 + 0.12 * root.sinkP
                yScale: 1 + 0.12 * root.sinkP
            },
            Translate {
                y: 1080 * root.sinkP
            }
        ]

        // .bg：inset -30，随鼠标反向平移
        Item {
            id: bg
            x: -30 + root.session.parX * (root.up < 0 ? 1 : 0) + root.session.parUpX * (root.up < 0 ? 0 : root.parBack)
            y: -30 + root.session.parY * (root.up < 0 ? 1 : 0) + root.session.parUpY * (root.up < 0 ? 0 : root.parBack)
            width: 1980
            height: 1140

            Rectangle {
                anchors.fill: parent
                color: Theme.ink
            }
            Image {
                anchors.fill: parent
                source: Theme.bg
                fillMode: Image.PreserveAspectCrop
                asynchronous: false
                cache: true
                smooth: true
            }

            ShaderEffect {
                anchors.fill: parent
                fragmentShader: "shaders/water.frag.qsb"
                property size size: Qt.size(width, height)
                // .caustic：drift 24s ease-in-out alternate → translate(-90px, 26px)
                readonly property real dp: Theme.alt(Theme.eInOut, root.t, 24)
                property point drift: Qt.point(-90 * dp, 26 * dp)
                property real causticOp: 0.2 + 0.35 * root.causP
                property real rayGain: 1 + 0.6 * root.glowP
                // .rays i：sway ease-in-out alternate，skewX -5→6deg，opacity .55→1；周期 14 12 9 16 11s
                function sk(d) {
                    return (-5 + 11 * Theme.alt(Theme.eInOut, root.t, d)) * Math.PI / 180;
                }
                function op(d) {
                    return 0.55 + 0.45 * Theme.alt(Theme.eInOut, root.t, d);
                }
                property vector4d skewA: Qt.vector4d(sk(14), sk(12), sk(9), sk(16))
                property vector4d opA: Qt.vector4d(op(14), op(12), op(9), op(16))
                property real skew5: sk(11)
                property real op5: op(11)
            }

            // 常驻气泡：rise 线性，0% (0,0) 透明 → 12% .7 → 50% (14,-480) → 85% .4 → 100% (-6,-960) 透明
            Repeater {
                model: root.ambient
                delegate: Rectangle {
                    required property var modelData
                    readonly property real k: {
                        const d = modelData.dur;
                        const v = ((root.t - modelData.delay) % d + d) % d;
                        return v / d;
                    }
                    x: modelData.x + (k < 0.5 ? 14 * k / 0.5 : 14 - 20 * (k - 0.5) / 0.5)
                    y: modelData.y + (k < 0.5 ? -480 * k / 0.5 : -480 - 480 * (k - 0.5) / 0.5)
                    width: modelData.s
                    height: modelData.s
                    radius: width / 2
                    color: "transparent"
                    border.width: 2
                    border.color: Theme.bubble
                    opacity: k < 0.12 ? 0.7 * k / 0.12 : k < 0.85 ? 0.7 - 0.3 * (k - 0.12) / 0.73 : 0.4 * (1 - (k - 0.85) / 0.15)
                }
            }

            // 解锁时一次性涌出的气泡：burst cubic-bezier(.4,0,.7,.4)，上升 1250px 并放大到 1.15
            Repeater {
                model: root.up < 0 ? [] : root.burst
                delegate: Rectangle {
                    required property var modelData
                    readonly property real raw: (root.up / 1000 - modelData.delay) / modelData.dur
                    readonly property real e: Theme.bez([0.4, 0, 0.7, 0.4], raw)
                    readonly property real sc: 0.6 + 0.55 * e
                    visible: raw > 0 && raw < 1
                    x: modelData.x + modelData.dx * e
                    y: modelData.y - 1250 * e
                    width: modelData.s
                    height: modelData.s
                    radius: width / 2
                    scale: sc
                    color: "transparent"
                    border.width: 2
                    border.color: Theme.bubble
                    opacity: raw < 0.1 ? 0.9 * Theme.bez([0.4, 0, 0.7, 0.4], raw / 0.1) : 0.9 * (1 - Theme.bez([0.4, 0, 0.7, 0.4], (raw - 0.1) / 0.9))
                }
            }
        }

        Item {
            id: uiHost
            anchors.fill: parent
        }
    }
    }

    // 水面：原型 #desk 下沿的 4px 亮线，随桌面从上方降下（桌面本身在 QML 里就是真实桌面）
    Rectangle {
        visible: root.sinkP > 0 && root.sinkP < 1
        x: 0
        width: 1920
        height: 4
        y: 1080 * root.sinkP - 4
        color: Theme.fill
    }
}
