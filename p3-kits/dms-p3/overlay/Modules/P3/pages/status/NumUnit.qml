import QtQuick
import qs.Modules.P3

// 展示字数字 + 右侧小单位（原型 .p-num 里的 <small>），单位与数字按基线对齐。
// 放置时按基线定位：y: <基线> - baseY
Item {
    id: root

    property string text: ""
    property string unit: ""
    property real size: 64
    property real spacing: -0.01          // em
    property real unitSize: 20
    property real unitSpacing: 0.08       // em
    property real unitGap: 3
    property color color: P3.tx
    property color unitColor: P3.dim
    readonly property real baseY: num.baselineOffset
    // 没有数据（—）时不带单位
    readonly property bool hasUnit: unit !== "" && text !== "—"

    implicitWidth: num.implicitWidth + (hasUnit ? unitGap + u.implicitWidth : 0)
    implicitHeight: num.implicitHeight
    width: implicitWidth
    height: implicitHeight

    P3Text {
        id: num
        kind: "num"
        text: root.text
        color: root.color
        font.pixelSize: root.size
        font.letterSpacing: root.size * root.spacing
    }
    P3Text {
        id: u
        visible: root.hasUnit
        kind: "meta"
        upper: false
        text: root.unit
        color: root.unitColor
        font.pixelSize: root.unitSize
        font.letterSpacing: root.unitSize * root.unitSpacing
        x: num.implicitWidth + root.unitGap
        y: num.baselineOffset - baselineOffset
    }
}
