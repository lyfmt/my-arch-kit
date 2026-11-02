import QtQuick
import qs.Modules.P3

// 换入动画的一个块（原型 [data-s]）：页面换分类 / 换层级时按文档顺序给每块一个序号 i，
// 块从右侧 46px、透明处滑入（.46s ease），延迟 i × 34ms。子元素竖排。
Column {
    id: root

    readonly property bool syIn: true
    property real dx: 0

    transform: Translate {
        x: root.dx
    }

    function play(i) {
        anim.stop();
        // 0.01 而不是 0：框架会跳过 opacity <= 0 的子树，动画中的元素也要能导航
        opacity = 0.01;
        dx = 46;
        pause.duration = i * 34;
        anim.start();
    }

    SequentialAnimation {
        id: anim
        PauseAnimation {
            id: pause
        }
        ParallelAnimation {
            NumberAnimation {
                target: root
                property: "opacity"
                to: 1
                duration: 460
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: root
                property: "dx"
                to: 0
                duration: 460
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
    }
}
