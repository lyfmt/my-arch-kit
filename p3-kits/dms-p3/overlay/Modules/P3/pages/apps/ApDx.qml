import QtQuick
import qs.Modules.P3

// 详情列的入场（原型 .ap-dx）：目标（默认是父元素）从左 22px、透明处滑入，400ms，按 j × 35ms 错开。
// 只动目标的 x 和 opacity，所以目标放在 Column 里也不影响排版。
Item {
    id: root

    property Item target: parent
    property int j: 0
    property bool still: false

    width: 0
    height: 0

    SequentialAnimation {
        id: anim
        PauseAnimation {
            duration: root.j * 35
        }
        ParallelAnimation {
            NumberAnimation {
                target: root.target
                property: "opacity"
                to: 1
                duration: 400
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: root.target
                property: "x"
                to: 0
                duration: 400
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
    }

    // still 晚于入场开始变成 true 时直接停在终点
    onStillChanged: {
        if (!still || !anim.running || !target)
            return;
        anim.stop();
        target.opacity = 1;
        target.x = 0;
    }
    Component.onCompleted: {
        if (still || !target)
            return;
        target.opacity = 0;
        target.x = -22;
        anim.start();
    }
}
