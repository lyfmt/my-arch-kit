import QtQuick
import "Engine.js" as E

// 一块屏幕上的歌词层（原型的 #stage + #lyr）。舞台按 1920×1080 设计，等比缩放到屏幕（同原型 fit()），
// 歌词层原点 = 舞台 (1800, 844)：主句右缘、底边贴着这里。
// 动效全部在 Engine.js；这里只提供 QML 组件、字体、颜色和帧驱动。
Item {
    id: lay

    // 由 shell.qml 传入
    property var music: null
    property bool wanted: true        // IPC show / hide
    property bool idleHidden: false   // 暂停太久 / 没在播
    property bool transDefault: true
    property real stageW: width
    property real stageH: height
    property real stageY0: 0          // 窗口顶边在屏幕里的 y（窗口只盖住屏幕下半部分）

    // 引擎写回
    property bool frozen: false
    property bool busy: false
    property bool hasContent: false

    readonly property real s: Math.min(stageW / 1920, stageH / 1080)
    readonly property string fontP3: Theme.p3Font
    readonly property string fontSC: Theme.sc
    readonly property string fontJP: Theme.jp
    readonly property string fontBarlow: Theme.barlow
    readonly property real baseOp: Theme.baseOp

    function toggleTrans() { E.toggleTrans(); }

    Item {
        id: lyr
        x: lay.stageW / 2 + (1800 - 960) * lay.s
        y: lay.stageH / 2 + (844 - 540) * lay.s - lay.stageY0
        width: 0
        height: 0
        scale: lay.s
        transformOrigin: Item.TopLeft
        // 暂停：整层变暗（#lyr.paused）
        opacity: lay.frozen ? 0.42 : 1
        Behavior on opacity {
            NumberAnimation { duration: 320; easing.type: Easing.BezierSpline; easing.bezierCurve: [0.22, 0.9, 0.24, 1, 1, 1] }
        }
    }

    Component { id: glyphComp; Glyph {} }
    Component { id: mskComp; Msk {} }
    Component { id: blockComp; Item {} }
    Component { id: trComp; Item {} }
    Component { id: waveComp; Wave {} }

    // 有动画时逐帧推进；静止时（停留、暂停、空屏）低频轮询，等下一句的时间戳 / 播放状态变化
    property real lastT: 0
    function step() {
        const t = Date.now();
        const dt = lay.lastT > 0 ? (t - lay.lastT) / 1000 : 0;
        lay.lastT = t;
        E.frame(dt);
    }
    FrameAnimation {
        running: lay.busy && Theme.ready
        onTriggered: lay.step()
    }
    Timer {
        interval: lay.hasContent || lay.music.active ? 50 : 250
        repeat: true
        running: !lay.busy && Theme.ready
        onTriggered: lay.step()
    }
    Component.onCompleted: E.setTrans(lay.transDefault)
}
