import QtQuick
import qs.Modules.P3

// 左侧分类（原型 .sy-cat）：64px 高，P3 40px 名字 + 右侧摘要；当前分类名字为 fill，焦点时右移 6px。
//   more  底部的 MORE 入口（右侧箭头，没有摘要）
P3Focusable {
    id: root

    readonly property bool syCat: true
    property string catId: ""
    property string title: ""
    property string meta: ""
    property bool cur: false
    property bool more: false

    implicitWidth: 330
    implicitHeight: 64

    P3Text {
        id: n
        x: 18 + (root.focused ? 6 : 0)
        // 40px、行高 .86 的字框在 64px 行内居中：基线 = 14.8 + 0.76 × 40
        anchors.baseline: parent.top
        anchors.baselineOffset: 45.2
        kind: "numSm"
        text: root.title
        color: root.focused ? root.fg : root.cur ? P3.fill : P3.dim
        Behavior on x {
            NumberAnimation {
                duration: 350
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.spring
            }
        }
        Behavior on color {
            ColorAnimation {
                duration: 200
            }
        }
    }
    P3Text {
        visible: !root.more && root.meta !== ""
        anchors.right: parent.right
        anchors.rightMargin: 16
        anchors.verticalCenter: parent.verticalCenter
        width: Math.min(implicitWidth, 128)
        horizontalAlignment: Text.AlignRight
        elide: Text.ElideRight
        kind: "meta"
        text: root.meta
        color: root.cur ? root.fg : root.dimColor
        Behavior on color {
            ColorAnimation {
                duration: 200
            }
        }
    }
    P3Glyph {
        visible: root.more
        x: root.width - 16 - 18
        anchors.verticalCenter: parent.verticalCenter
        name: "chev"
        size: 18
        color: root.dimColor
    }
}
