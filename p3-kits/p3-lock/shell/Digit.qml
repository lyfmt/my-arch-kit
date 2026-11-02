import QtQuick

// 时钟的一位数字（原型 .clock .tick）：值变化时新数字从上方 .22em 落入并淡入，0.7s ease-out。
// 用墙钟计算，锁屏表面和 overlay 同帧
Item {
    id: root

    property string ch: ""
    property color color: Theme.tx
    property real baseY: 0
    property real now: Date.now()

    property real changedAt: 0
    property string last: ""
    onChChanged: {
        if (last !== "" && ch !== last)
            changedAt = Date.now();
        last = ch;
    }
    Component.onCompleted: last = ch

    readonly property real e: changedAt > 0 ? Theme.bez(Theme.eOut, (now - changedAt) / 700) : 1

    width: t.advanceWidth
    height: 1

    Text {
        id: t
        // 等宽数字（font-variant-numeric: tabular-nums）
        readonly property real advanceWidth: implicitWidth
        y: root.baseY - baselineOffset - 312 * 0.22 * (1 - root.e)
        opacity: root.e
        text: root.ch
        color: root.color
        font.family: Theme.display
        font.pixelSize: 312
        font.weight: Font.Black
        font.italic: true
        font.letterSpacing: -312 * 0.035
        font.features: { "tnum": 1 }
    }
}
