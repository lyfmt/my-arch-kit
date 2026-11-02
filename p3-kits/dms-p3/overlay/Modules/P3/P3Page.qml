import QtQuick

// 页面基类（对应原型的 P3Menu.register(id, def)）。每个页面一个文件：pages/<Name>Page.qml，根元素是 P3Page。
// 页面区域 1410×680（舞台像素，超出部分裁掉），标题由框架画在上方，页面里不要重复。
//
//   P3Page {
//       title: "STATUS"
//       function handleKey(e) { return false }   // 每个按键先给页面；返回 true 表示吞掉（例如 Esc 关闭内层）
//       function handleRightClick(e) { return false }   // 右键 e = { x, y, item }（页面坐标、指针下的可聚焦元素或 null）；
//                                                       // 返回 false 时按返回处理（先以合成 Esc 交给 handleKey）
//       keyCapture: capturing                    // true 时所有按键（含 Ctrl / Alt / Super 组合）原样交给 handleKey，
//                                                // 框架不导航，合成器快捷键被抑制（录键用）
//       textEntry: typing                        // true 时字母是输入：h j k l g G 原样交给 handleKey（APPS 搜索的输入状态）；
//                                                // 输入框元素的 textEntry 要先进入输入（i / 单击 / ctx.edit）才算，见 P3Focusable
//       onEntered: …                            // 页面构建完成并成为当前页之后
//       onLeaving: …                            // 返回 / 切页、页面销毁之前
//       onFocusMoved: item => …                 // 焦点移到 item 之后（键盘、点击或 ctx.focus）
//   }
//
// vim 键由框架翻译：h j k l 到达 handleKey 时已是 Qt.Key_Left / Down / Up / Right（对象带 vim: true、text 为空），
// Ctrl+h/j/k/l、Ctrl+n/p 同样翻成方向键。g g / G / Ctrl+d / Ctrl+u 先以 { key: Qt.Key_unknown, motion } 交给 handleKey，
// motion = "first" | "last" | "halfDown" | "halfUp"；返回 false 时框架沿焦点所在的列走（到头，或走过半个视口）。
//
// ctx（进入后由框架写入；页面离开后所有调用都变成空操作，focused() 返回 null）：
//   ctx.back()                 离开页面（等同顶层 Esc）
//   ctx.focus(item)            把焦点移到 item（播放进入果冻）
//   ctx.focused()              当前焦点元素或 null
//   ctx.refocus()              布局变化后重新测量焦点指示
//   ctx.edit(item)             把焦点移到输入框 item 并进入输入
//   ctx.close()                关闭整个菜单（启动应用、打开窗口之后）
//   ctx.run(promise, opts)     统一处理 P3Sys 动作结果：成功不提示（结果看控件本身）；失败弹红色提示并调用 opts.revert()；
//                              opts.done(ok) 无论成败都会调用。返回原 promise。
//   ctx.toast(text, bad)       直接弹一条提示
//   ctx.overlay                全舞台层（1920×1080 舞台坐标，盖住主列表、页面和日期，在提示条之下）；
//                              页面把自己声明的元素挂上去：el.parent = ctx.overlay
//   ctx.still                  截图模式（P3_STILL=1）：不做循环动画、直接显示终态
//   ctx.live                   页面是否仍是当前页
Item {
    id: page

    readonly property bool p3page: true
    property string title: ""
    property var ctx: null
    property bool keyCapture: false
    property bool textEntry: false

    signal entered
    signal leaving
    signal focusMoved(var item)

    width: P3.pageW
    height: P3.pageH

    // 页面可以覆盖；返回 true 吞掉按键
    function handleKey(e) {
        return false;
    }
    // 页面可以覆盖；返回 true 表示右键已处理
    function handleRightClick(e) {
        return false;
    }

    // ---- 框架内部（P3Focusable 点击时调用）
    property var _host: null
    function _pointerFocus(item, activate) {
        if (_host)
            _host.pointerFocus(page, item, activate);
    }
}
