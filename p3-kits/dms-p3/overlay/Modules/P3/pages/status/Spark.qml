import QtQuick
import QtQuick.Shapes
import qs.Modules.P3

// CPU 历史曲线（原型 .st-spark）：固定 slots 个采样位，纵轴 0..50%，最新一个采样在右边缘外一格（滚动缓冲），
// 圆点停在右边缘的上一个采样上。新采样到达时整条曲线先右移一格再匀速滑回（连续滚动）。
// drawn 由 false 变 true 时线条从左向右画出、面积淡入。
Item {
    id: root

    property var hist: []
    property int slots: 20
    property bool drawn: true
    property bool still: false

    readonly property real step: width / (slots - 2)
    readonly property var pts: {
        const h = hist || [], n = Math.min(h.length, slots), out = [];
        for (let i = 0; i < n; i++) {
            const v = +h[h.length - n + i] || 0;
            out.push([(slots - n + i) * step, height - 3 - Math.min(100, v) / 50 * (height - 8)]);
        }
        return out;
    }
    readonly property string linePath: pts.length < 2 ? "" : "M" + pts.map(p => p[0].toFixed(1) + " " + Math.max(2, p[1]).toFixed(1)).join("L")
    readonly property string areaPath: linePath === "" ? "" : linePath + "L" + pts[pts.length - 1][0].toFixed(1) + " " + height + "L" + pts[0][0].toFixed(1) + " " + height + "Z"

    // 新采样：内容变了就滚一格
    property string _key: ""
    onHistChanged: {
        const k = (hist || []).join(",");
        if (k === _key)
            return;
        const scroll = _key !== "" && drawn && !still;
        _key = k;
        if (scroll) {
            scrollAnim.stop();
            group.x = step;
            scrollAnim.start();
        }
    }

    Rectangle {
        x: 0
        y: root.height - 1
        width: root.width
        height: 1
        color: P3.line
    }

    Item {
        anchors.fill: parent
        clip: true

        Item {
            id: group
            width: root.width
            height: root.height

            Shape {
                anchors.fill: parent
                visible: root.areaPath !== ""
                preferredRendererType: Shape.CurveRenderer
                opacity: areaOp.v
                ShapePath {
                    fillColor: P3.alpha(P3.fill, 0.1)
                    strokeColor: "transparent"
                    strokeWidth: 0
                    PathSvg {
                        path: root.areaPath || "M0 0"
                    }
                }
            }
            Item {
                id: reveal
                width: root.drawn ? root.width + root.step + 4 : 0
                height: root.height
                clip: true
                Behavior on width {
                    enabled: !root.still
                    NumberAnimation {
                        duration: 1100
                        easing.type: Easing.BezierSpline
                        easing.bezierCurve: P3.ease
                    }
                }
                Shape {
                    width: root.width + root.step
                    height: root.height
                    visible: root.linePath !== ""
                    preferredRendererType: Shape.CurveRenderer
                    ShapePath {
                        fillColor: "transparent"
                        strokeColor: P3.fill
                        strokeWidth: 2
                        joinStyle: ShapePath.RoundJoin
                        capStyle: ShapePath.FlatCap
                        PathSvg {
                            path: root.linePath || "M0 0"
                        }
                    }
                }
            }
        }
        // 圆点不随曲线滚动；在右边缘时被裁掉一半（同原型 svg overflow: hidden）
        Rectangle {
            visible: root.pts.length >= 2
            readonly property var p: root.pts.length >= 2 ? root.pts[root.pts.length - 2] : [0, 0]
            x: p[0] - 4
            y: Math.max(2, p[1]) - 4
            width: 8
            height: 8
            radius: 4
            color: P3.fill
        }
    }

    QtObject {
        id: areaOp
        property real v: root.drawn ? 1 : 0
        Behavior on v {
            enabled: !root.still
            SequentialAnimation {
                PauseAnimation {
                    duration: 300
                }
                NumberAnimation {
                    duration: 800
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.ease
                }
            }
        }
    }

    NumberAnimation {
        id: scrollAnim
        target: group
        property: "x"
        to: 0
        duration: 1300
    }
}
