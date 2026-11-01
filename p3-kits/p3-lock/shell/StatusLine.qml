import QtQuick

// 原型 .status：18px 标签字，换字时先跳到 opacity 0 + 右移 16px，再缓回（.status.swap）
Item {
    id: root

    property string text: ""
    property bool red: false

    width: label.implicitWidth
    height: 20

    property real swapOp: 1
    property real swapX: 0
    Behavior on swapOp { id: bOp; NumberAnimation { duration: 160; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eEase } }
    Behavior on swapX { id: bX; NumberAnimation { duration: 320; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }

    property string shown: ""
    property bool shownRed: false
    function sync() {
        if (shown === text && shownRed === red)
            return;
        bOp.enabled = false;
        bX.enabled = false;
        swapOp = 0;
        swapX = 16;
        shown = text;
        shownRed = red;
        bOp.enabled = true;
        bX.enabled = true;
        swapOp = 1;
        swapX = 0;
    }
    onTextChanged: sync()
    onRedChanged: sync()
    Component.onCompleted: {
        shown = text;
        shownRed = red;
    }

    Text {
        id: label
        // 行盒 20px，Barlow 字号 18、行高 1 → 基线距顶 (20-18)/2 + 0.9*18
        y: 1 + 0.9 * 18 - baselineOffset
        x: root.swapX
        opacity: root.swapOp
        text: root.shown
        color: root.shownRed ? Theme.red : Theme.fill
        font.family: Theme.label
        font.pixelSize: 18
        font.letterSpacing: 18 * 0.14
        font.capitalization: Font.AllUppercase
    }
}
