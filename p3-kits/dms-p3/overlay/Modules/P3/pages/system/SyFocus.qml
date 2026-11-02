import QtQuick
import qs.Modules.P3

// SYSTEM 页可聚焦元素的基类：syKey 是元素在页面里的键（原型 data-key，用来恢复焦点），
// line = 底部 1px 细线（.p-row），不可用时透明度 .32（原型 .sy-na）。
P3Focusable {
    id: root

    property string syKey: ""
    property bool line: true

    implicitWidth: 400
    implicitHeight: P3.rowH
    opacity: disabled ? 0.32 : 1

    // 经框架统一处理动作结果（成功提示 / 失败红字 + revert）；页面已离开时原样返回
    function run(p, opts) {
        const pg = _page();
        return pg && pg.ctx ? pg.ctx.run(p, opts) : p;
    }
    function sys() {
        return _page();
    }

    Rectangle {
        visible: root.line
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: 1
        color: P3.line
    }
}
