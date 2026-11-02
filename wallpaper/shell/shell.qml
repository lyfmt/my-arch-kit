import QtQuick
import QtQuick.Effects
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "Engine.js" as E

// 壁纸切换覆盖层：常驻后台，Mod+Y 在当前聚焦的显示器上弹出一排卡片。
// 透明全屏、没有自己的背景，直接叠在桌面上；动效全部在 Engine.js 里。
ShellRoot {
    id: root

    property bool shown: false        // 窗口是否映射（关闭动画结束后才取消）
    property bool open: false         // 交互状态
    property bool running: false      // 引擎帧循环
    property bool loading: false
    property bool kbReady: false
    property bool empty: false
    property string output: ""
    property var targetScreen: Quickshell.screens[0]
    // 覆盖层铺满整块屏幕，布局直接取屏幕的逻辑尺寸：窗口映射前就已确定，
    // 不经过映射时 0×0 的过渡尺寸，卡片第一帧就按最终尺寸布局、解码
    property real vw: targetScreen ? targetScreen.width : win.width
    property real vh: targetScreen ? targetScreen.height : win.height
    property real dpr: targetScreen ? targetScreen.devicePixelRatio : 1
    property real u: 1
    property real cardW: 800
    onVwChanged: E.resize()
    onVhChanged: E.resize()

    readonly property color ink: "#04103c"
    readonly property color tx: "#ecfcff"
    readonly property color fill: "#a3f0ff"
    readonly property color red: "#e3121b"
    readonly property string backend: Quickshell.shellPath("scripts/wallpaper-backend")

    function show() {
        if (root.loading) return;
        if (root.shown) { E.setOpen(true); return; }  // 正在收起时再按：直接重新展开
        root.loading = true;
        outputProc.running = true;
    }
    function hide() {
        E.setOpen(false);
    }
    function toggle() {
        root.open ? root.hide() : root.show();
    }

    // ---------- 后端调用 ----------
    function call(args, cb) {
        const p = jobComp.createObject(root, { command: [root.backend].concat(args), cb: cb });
        p.running = true;
    }
    function setWallpaper(path, cb) { call(["set", root.output, path], cb); }
    function trash(path, cb) { call(["trash", path], cb); }
    function restore(key, cb) { call(["restore", key], cb); }

    Component {
        id: jobComp
        Process {
            id: job
            property var cb: null
            stdout: StdioCollector {
                onStreamFinished: {
                    let d;
                    try { d = JSON.parse(text.trim().split("\n").pop()); } catch (e) { d = { ok: false, error: text.trim() || "后端无输出" }; }
                    if (job.cb) job.cb(d);
                    job.destroy();
                }
            }
        }
    }

    // 打开：先问 niri 当前聚焦的显示器，再一次性拿到列表和该屏当前壁纸
    Process {
        id: outputProc
        command: ["niri", "msg", "-j", "focused-output"]
        stdout: StdioCollector {
            onStreamFinished: {
                let name = "";
                try { name = JSON.parse(text).name; } catch (e) {}
                const s = Quickshell.screens.find(x => x.name === name);
                if (s) root.targetScreen = s;
                root.output = name || (root.targetScreen ? root.targetScreen.name : "");
                stateProc.command = [root.backend, "state", root.output];
                stateProc.running = true;
            }
        }
    }
    Process {
        id: stateProc
        stdout: StdioCollector {
            onStreamFinished: {
                root.loading = false;
                let d;
                try { d = JSON.parse(text); } catch (e) { d = { ok: false, error: "无法读取壁纸列表" }; }
                if (!d.ok) { console.warn("wallpaper:", d.error); return; }
                E.load(d.items, d.current);
                root.shown = true;
                Qt.callLater(() => E.setOpen(true));
            }
        }
    }

    IpcHandler {
        target: "wallpaper"
        function toggle(): void { root.toggle(); }
        function open(): void { root.show(); }
        function close(): void { root.hide(); }
    }

    onOpenChanged: {
        // 和 DMS 一致：窗口映射后再申请独占键盘焦点
        kbReady = false;
        if (open) kbTimer.restart();
    }
    Timer {
        id: kbTimer
        interval: 40
        onTriggered: {
            root.kbReady = root.open;
            keys.forceActiveFocus();
        }
    }

    FrameAnimation {
        running: root.running
        onTriggered: E.tick()
    }

    // ---------- 提示 ----------
    property string toastText: ""
    property bool toastBad: false
    function toast(msg, bad) {
        root.toastText = msg;
        root.toastBad = !!bad;
        toastAnim.restart();
    }

    PanelWindow {
        id: win

        screen: root.targetScreen
        // 收起后若还有提示（例如设置失败）在显示，窗口留到提示结束；此时没有输入区域、不占键盘
        visible: root.shown || toastAnim.running
        color: "transparent"
        anchors {
            top: true
            bottom: true
            left: true
            right: true
        }
        exclusionMode: ExclusionMode.Ignore
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.namespace: "wallpaper"
        WlrLayershell.keyboardFocus: root.open && root.kbReady ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None
        // 收起过程中鼠标穿透到桌面
        mask: Region { item: root.open ? keys : null }

        Item {
            id: keys
            anchors.fill: parent
            focus: true

            Keys.onPressed: e => {
                const k = e.key;
                if (k === Qt.Key_Right || k === Qt.Key_L) E.go(1);
                else if (k === Qt.Key_Left || k === Qt.Key_H) E.go(-1);
                else if (k === Qt.Key_Home) E.first();
                else if (k === Qt.Key_End) E.lastIdx();
                else if (k === Qt.Key_Return || k === Qt.Key_Enter || k === Qt.Key_Space) { if (!e.isAutoRepeat) E.applyCur(); }
                else if (k === Qt.Key_D || k === Qt.Key_Delete) { if (!e.isAutoRepeat) E.del(); }
                else if (k === Qt.Key_U) { if (!e.isAutoRepeat) E.restore(); }
                else if (k === Qt.Key_Escape || k === Qt.Key_Q) root.hide();
                else return;
                e.accepted = true;
            }

            // 点空白处关闭；滚轮切换
            MouseArea {
                anchors.fill: parent
                property real wAcc: 0
                property real wT: 0
                onClicked: root.hide()
                onWheel: w => {
                    const d = Math.abs(w.angleDelta.x) > Math.abs(w.angleDelta.y) ? -w.angleDelta.x : -w.angleDelta.y;
                    const t = Date.now();
                    if (t - wT > 220 || Math.sign(d) !== Math.sign(wAcc)) wAcc = 0;
                    wT = t;
                    wAcc += d;
                    if (Math.abs(wAcc) >= 100) { E.go(Math.sign(wAcc)); wAcc = 0; }
                }
            }

            Item {
                id: stage
                anchors.fill: parent
                // 卡片池：目标 ±6 张预取 + 移动途中屏上的 ±5 张 + 正在落下的删除卡片，长距离跳转时最多同时占用 24 张左右
                Repeater {
                    model: 32
                    onItemAdded: (index, item) => E.addCard(item)
                    Card {
                        id: cardD
                        onHoverChanged2: on => E.hover(cardD, on)
                        onClicked2: E.clickCard(cardD)
                    }
                }
            }

            // 标题：主卡下方，随轴线倾斜；没有底板
            Item {
                id: titleBox
                z: 1200
                opacity: 0
                visible: opacity > 0.002
                transform: Rotation { angle: -6.5 }
                Item {
                    id: titleInner
                    width: titleText.width
                    height: titleText.height
                    Text {
                        id: titleText
                        width: Math.min(implicitWidth, root.cardW * 0.78)
                        elide: Text.ElideRight
                        color: root.tx
                        font.family: Fonts.display
                        font.weight: Font.Black
                        font.italic: true
                        font.pixelSize: 46 * root.u
                        rightPadding: font.pixelSize * 0.25
                        layer.enabled: true
                        layer.effect: MultiEffect {
                            shadowEnabled: true
                            shadowColor: Qt.rgba(0, 6 / 255, 40 / 255, 0.85)
                            shadowBlur: 0.45
                            shadowVerticalOffset: 2 * root.u
                            shadowHorizontalOffset: 0
                            blurMax: 24
                        }
                    }
                }
            }

            // 空列表
            CutRect {
                z: 1200
                visible: root.empty && root.open
                anchors.centerIn: parent
                width: emptyCol.implicitWidth + 80 * root.u
                height: emptyCol.implicitHeight + 44 * root.u
                color: Qt.rgba(2 / 255, 10 / 255, 60 / 255, 0.55)
                cut: 12
                Column {
                    id: emptyCol
                    anchors.centerIn: parent
                    spacing: 12 * root.u
                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: "EMPTY"
                        color: Qt.rgba(163 / 255, 240 / 255, 1, 0.62)
                        font.family: Fonts.barlow
                        font.weight: Font.Bold
                        font.pixelSize: 20 * root.u
                        font.letterSpacing: 20 * root.u * 0.16
                    }
                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: "没有壁纸了"
                        color: root.tx
                        font.family: Fonts.body
                        font.weight: Font.Bold
                        font.pixelSize: 24 * root.u
                    }
                }
            }
        }

        // 提示条：顶栏下方居中，P3 切角
        CutRect {
            id: toastBox
            z: 1600
            anchors.horizontalCenter: parent.horizontalCenter
            y: root.vw * 42 / 1706 + 34 * root.u + toastY
            property real toastY: -14 * root.u
            opacity: 0
            visible: opacity > 0.002
            width: toastTx.implicitWidth + (root.toastBad ? 62 : 52) * root.u
            height: toastTx.implicitHeight + 24 * root.u
            color: root.fill
            cut: 12
            Rectangle {
                visible: root.toastBad
                width: 8 * root.u
                height: parent.height
                color: root.red
            }
            Text {
                id: toastTx
                x: (root.toastBad ? 34 : 24) * root.u
                anchors.verticalCenter: parent.verticalCenter
                text: root.toastText
                color: root.ink
                font.family: Fonts.body
                font.weight: Font.Bold
                font.pixelSize: 19 * root.u
            }
            SequentialAnimation {
                id: toastAnim
                ParallelAnimation {
                    NumberAnimation { target: toastBox; property: "opacity"; from: 0; to: 1; duration: 380; easing.type: Easing.OutExpo }
                    NumberAnimation { target: toastBox; property: "toastY"; from: -14 * root.u; to: 0; duration: 380; easing.type: Easing.OutExpo }
                }
                PauseAnimation { duration: 1920 }
                ParallelAnimation {
                    NumberAnimation { target: toastBox; property: "opacity"; to: 0; duration: 300 }
                    NumberAnimation { target: toastBox; property: "toastY"; to: -8 * root.u; duration: 300 }
                }
            }
        }
    }
}
