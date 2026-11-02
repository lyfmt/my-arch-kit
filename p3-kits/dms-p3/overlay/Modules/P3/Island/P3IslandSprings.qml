import QtQuick
import "P3IslandLayout.js" as P3L

// 气泡的弹簧（原型 to() / kick() / step()）。每个气泡 4 个通道：x（中心）、y（顶边）、w、h，岛的逻辑像素。
// 位置用 c 阻尼，宽高用 cs = max(c, 1.7√k)（ζ≈.85，只轻微过冲）；d 毫秒后才开始动。全部静止就停帧。
// fx / fy：云朵浮动的偏移（P3L.cloudX / cloudY，cloudA = 0 时为 0），叠在弹簧位置上，不参与弹簧。
Item {
    id: root

    property bool reducedMotion: false
    property real clock: 0
    property bool awake: false
    property real cloudT: 0
    property real cloudA: 0

    function cx(i) {
        return root.cloudA > 0 ? P3L.cloudX(i, root.cloudT, root.cloudA) : 0;
    }

    function cy(i) {
        return root.cloudA > 0 ? P3L.cloudY(i, root.cloudT, root.cloudA) : 0;
    }

    component Bubble: QtObject {
        property string name
        property real x: 0
        property real y: 24
        property real w: 0
        property real h: 0
        property real vx: 0
        property real vy: 0
        property real vw: 0
        property real vh: 0
        property real tx: 0
        property real ty: 24
        property real tw: 0
        property real th: 0
        property real k: 300
        property real c: 21
        property real cs: 26
        property real at: 0
        property string face: ""
        property int fd: 60
        property real r: 1e5
        property real fx: 0
        property real fy: 0
    }

    readonly property Bubble time: Bubble {
        name: "time"
        fx: root.cx(0)
        fy: root.cy(0)
    }
    readonly property Bubble audio: Bubble {
        name: "audio"
        fx: root.cx(1)
        fy: root.cy(1)
    }
    readonly property Bubble notif: Bubble {
        name: "notif"
        fx: root.cx(2)
        fy: root.cy(2)
    }
    readonly property Bubble batt: Bubble {
        name: "batt"
        fx: root.cx(3)
        fy: root.cy(3)
    }
    readonly property Bubble card: Bubble {
        name: "card"
    }
    readonly property Bubble prev: Bubble {
        name: "prev"
        fx: root.cx(5)
        fy: root.cy(5)
    }
    readonly property Bubble play: Bubble {
        name: "play"
        fx: root.cx(6)
        fy: root.cy(6)
    }
    readonly property Bubble next: Bubble {
        name: "next"
        fx: root.cx(7)
        fy: root.cy(7)
    }
    readonly property Bubble panel: Bubble {
        name: "panel"
        r: 22
    }
    readonly property var all: [time, audio, notif, batt, card, prev, play, next, panel]

    function bubble(name) {
        return root[name];
    }

    function wake() {
        if (!root.awake)
            root.awake = true;
    }

    // o：k c cs d（毫秒）face fd（内容比形状晚的毫秒数）r（圆角上限）snap
    function to(b, x, y, w, h, o) {
        o = o || {};
        b.tx = x;
        b.ty = y;
        b.tw = w;
        b.th = h;
        b.k = o.k ?? 300;
        b.c = o.c ?? 21;
        b.cs = o.cs ?? Math.max(b.c, 1.7 * Math.sqrt(b.k));
        if (root.reducedMotion)
            b.c = b.cs = 2 * Math.sqrt(b.k);
        const delay = root.reducedMotion ? 0 : (o.d ?? 0);
        b.at = root.clock + delay / 1000;
        if (o.r !== undefined)
            b.r = o.r;
        if (o.face !== undefined) {
            b.fd = delay + (o.fd ?? 60);
            b.face = o.face;
        }
        if (o.snap || root.reducedMotion) {
            b.x = x;
            b.y = y;
            b.w = w;
            b.h = h;
            b.vx = b.vy = b.vw = b.vh = 0;
        }
        root.wake();
    }

    function kick(b, dw, dh) {
        if (root.reducedMotion)
            return;
        b.vw += dw;
        b.vh += dh || 0;
        root.wake();
    }

    function nudge(b, dx, dy) {
        if (root.reducedMotion)
            return;
        b.vx += dx;
        b.vy += dy || 0;
        root.wake();
    }

    function settled(b) {
        return Math.abs(b.x - b.tx) <= 0.05 && Math.abs(b.y - b.ty) <= 0.05 && Math.abs(b.w - b.tw) <= 0.05 && Math.abs(b.h - b.th) <= 0.05 && Math.abs(b.vx) <= 0.05 && Math.abs(b.vy) <= 0.05 && Math.abs(b.vw) <= 0.05 && Math.abs(b.vh) <= 0.05;
    }

    function step(frameTime) {
        const dt = Math.min(0.1, Math.max(0, frameTime));
        root.clock += dt;
        const n = Math.max(1, Math.ceil(dt / 0.008));
        const hs = dt / n;
        let busy = false;
        for (const b of root.all) {
            if (root.clock < b.at) {
                busy = true;
                continue;
            }
            if (root.settled(b))
                continue;
            let x = b.x, y = b.y, w = b.w, h = b.h;
            let vx = b.vx, vy = b.vy, vw = b.vw, vh = b.vh;
            const k = b.k, c = b.c, cs = b.cs;
            for (let i = 0; i < n; i++) {
                vx += (-k * (x - b.tx) - c * vx) * hs;
                x += vx * hs;
                vy += (-k * (y - b.ty) - c * vy) * hs;
                y += vy * hs;
                vw += (-k * (w - b.tw) - cs * vw) * hs;
                w += vw * hs;
                vh += (-k * (h - b.th) - cs * vh) * hs;
                h += vh * hs;
            }
            b.vx = vx;
            b.vy = vy;
            b.vw = vw;
            b.vh = vh;
            b.x = x;
            b.y = y;
            b.w = w;
            b.h = h;
            if (!root.settled(b))
                busy = true;
        }
        if (busy)
            return;
        for (const b of root.all) {
            b.x = b.tx;
            b.y = b.ty;
            b.w = b.tw;
            b.h = b.th;
            b.vx = b.vy = b.vw = b.vh = 0;
        }
        root.awake = false;
    }

    FrameAnimation {
        running: root.awake
        onTriggered: root.step(frameTime)
    }
}
