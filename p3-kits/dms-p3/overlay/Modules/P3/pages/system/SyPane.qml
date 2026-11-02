import QtQuick
import qs.Modules.P3

// 一个分类的详情：竖排内容，超出 670px 时可以滚动（框架会把焦点元素滚进可视区）。
// sys = SystemPage（界面状态和页面级动作）。
Flickable {
    id: root

    property var sys: null
    default property alias content: body.data
    readonly property bool still: !!(sys && sys.still)

    contentWidth: width
    contentHeight: body.implicitHeight
    interactive: contentHeight > height + 0.5
    clip: interactive
    boundsBehavior: Flickable.StopAtBounds

    Column {
        id: body
        width: root.width
    }
}
