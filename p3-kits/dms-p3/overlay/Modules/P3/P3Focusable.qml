import QtQuick

// 页面里一切可聚焦元素的基类（对应原型的 [data-focus]）。框架负责：
//   ↑↓←→ / WASD 空间导航、点击聚焦并激活、焦点指示（tide 光点 / wedge 楔形）、进入时的果冻动画。
// 页面只需要：
//   P3Focusable { cursor: "tide"; onActivated: … }      Enter / Space / 单击
//   focused   只读：当前是否有焦点（用来改颜色：焦点时文字用 P3.fill）
//   wob       只读：刚获得焦点的 380ms 内为 true（cursor: "none" 的元素可以自己做动画）
//   pressed   只读：刚被激活的 260ms 内为 true
//   autofocus 进入页面时的初始焦点（没有就取第一个）
//   disabled  导航时跳过、不响应点击
//   cursor    "tide"（默认，左上角光点 + 文字变 fill）| "wedge"（白色楔形垫底 + 红色残影，文字变 ink）| "none"
//   fg / dimColor   按焦点状态算好的前景色，内部 Text 直接绑定即可
// 不做 hover 效果：鼠标只有点击才会改变焦点。
Item {
    id: root

    readonly property bool p3focusable: true
    property string cursor: "tide"
    property bool autofocus: false
    property bool disabled: false
    // 由框架写入
    property bool focused: false
    property bool wob: false
    property bool pressed: false

    readonly property color fg: !focused ? P3.tx : cursor === "wedge" ? P3.ink : P3.fill
    readonly property color dimColor: !focused ? P3.dim : cursor === "wedge" ? P3.alpha(P3.ink, 0.66) : P3.alpha(P3.fill, 0.78)
    readonly property color trackColor: focused && cursor === "wedge" ? P3.alpha(P3.ink, 0.2) : P3.line
    readonly property color onColor: focused && cursor === "wedge" ? P3.ink : P3.fill

    signal activated
    // 键盘事件先给元素自己（滑块的 ←→ 等）；返回 true 表示已处理
    property var keyHandler: null

    // 单击是否等同 Enter（滑块、按住确认自己处理按下，设为 false）
    property bool clickActivates: true

    opacity: disabled ? 0.4 : 1

    // 让框架把焦点移到自己（不激活）。自定义 MouseArea 的 onPressed 里调用。
    function requestFocus() {
        const p = _page();
        if (p)
            p._pointerFocus(root, false);
    }
    function _page() {
        let n = parent;
        while (n) {
            if (n.p3page === true)
                return n;
            n = n.parent;
        }
        return null;
    }
    // 单击：聚焦 + 激活。ReleaseWithinBounds 独占抓取，嵌套的可聚焦元素只有最上层的响应。
    TapHandler {
        enabled: !root.disabled
        acceptedButtons: Qt.LeftButton
        gesturePolicy: TapHandler.ReleaseWithinBounds
        onTapped: {
            const p = root._page();
            if (p)
                p._pointerFocus(root, root.clickActivates);
        }
    }

    // 果冻（原型 .p-wob：320ms spring，scale 1 → 1.03/.965 → .99/1.015 → 1）
    transform: Scale {
        id: jelly
        origin.x: root.width / 2
        origin.y: root.height / 2
    }
    SequentialAnimation {
        running: root.wob && root.cursor !== "none"
        NumberAnimation {
            target: jelly
            properties: "xScale"
            to: 1.03
            duration: 96
        }
        ParallelAnimation {
            NumberAnimation {
                target: jelly
                property: "xScale"
                to: 0.99
                duration: 96
            }
            NumberAnimation {
                target: jelly
                property: "yScale"
                to: 1.015
                duration: 96
            }
        }
        ParallelAnimation {
            NumberAnimation {
                target: jelly
                property: "xScale"
                to: 1
                duration: 128
                easing.type: Easing.OutBack
            }
            NumberAnimation {
                target: jelly
                property: "yScale"
                to: 1
                duration: 128
                easing.type: Easing.OutBack
            }
        }
    }
    onWobChanged: if (wob && cursor !== "none")
        jelly.yScale = 0.965
    // 按下（原型 .p-press：40% 处缩到 .97）
    SequentialAnimation {
        running: root.pressed && root.cursor !== "none"
        NumberAnimation {
            target: jelly
            properties: "xScale,yScale"
            to: 0.97
            duration: 100
        }
        NumberAnimation {
            target: jelly
            properties: "xScale,yScale"
            to: 1
            duration: 160
            easing.bezierCurve: P3.ease
        }
    }
}
