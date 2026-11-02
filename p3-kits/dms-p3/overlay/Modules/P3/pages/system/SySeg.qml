import QtQuick
import qs.Modules.P3

// 性能模式分段（原型 .sy-seg）：84px panel 上一块实色滑块（换选时回弹并压扁一下），三格各自可聚焦。
// items: [{ id, t, g }]；current = 后端当前 id。点选后先移过去（乐观），action(id) 失败或后端不跟时退回。
Item {
    id: root

    property var items: []
    property string current: ""
    property var avail: []
    property bool usable: true
    property var action: null
    property bool still: false

    property string _want: ""
    readonly property string shown: _want !== "" ? _want : current
    readonly property int pi: items.findIndex(x => x.id === shown)
    readonly property real cellW: width / Math.max(1, items.length)

    implicitHeight: 84

    onCurrentChanged: if (_want === current) {
        settle.stop();
        _want = "";
    }
    onPiChanged: if (!still)
        squash.restart()
    Timer {
        id: settle
        interval: 1500
        onTriggered: root._want = ""
    }

    function pick(id, cell) {
        if (id === shown)
            return;
        _want = id;
        if (!action) {
            settle.restart();
            return;
        }
        cell.run(action(id), {
            "done": ok => {
                if (!ok || root.current === id) {
                    settle.stop();
                    root._want = "";
                } else {
                    settle.restart();
                }
            }
        });
    }

    Rectangle {
        anchors.fill: parent
        color: P3.panel
    }
    Rectangle {
        id: puck
        visible: root.pi >= 0
        width: root.cellW
        height: parent.height
        x: Math.max(0, root.pi) * root.cellW
        color: P3.fill
        transform: Scale {
            id: sq
            origin.x: puck.width / 2
            origin.y: puck.height / 2
        }
        Behavior on x {
            enabled: !root.still
            NumberAnimation {
                duration: 500
                easing.type: Easing.BezierSpline
                easing.bezierCurve: [0.3, 1.3, 0.5, 1, 1, 1]
            }
        }
    }
    SequentialAnimation {
        id: squash
        ParallelAnimation {
            NumberAnimation {
                target: sq
                property: "xScale"
                to: 1.12
                duration: 150
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: sq
                property: "yScale"
                to: 0.92
                duration: 150
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
        ParallelAnimation {
            NumberAnimation {
                target: sq
                property: "xScale"
                to: 1
                duration: 350
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: sq
                property: "yScale"
                to: 1
                duration: 350
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
    }

    Row {
        Repeater {
            model: root.items
            delegate: SyFocus {
                id: cell
                required property var modelData
                required property int index
                readonly property bool sel: root.pi === index
                readonly property color tone: sel ? P3.ink : P3.tx
                width: root.cellW
                height: root.height
                line: false
                syKey: "prof:" + modelData.id
                disabled: !root.usable || (root.avail.length > 0 && root.avail.indexOf(modelData.id) < 0)
                onActivated: root.pick(modelData.id, cell)
                Row {
                    x: 22
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 14
                    P3Glyph {
                        anchors.verticalCenter: parent.verticalCenter
                        name: cell.modelData.g
                        size: 26
                        color: cell.tone
                        Behavior on color {
                            enabled: !root.still
                            SequentialAnimation {
                                PauseAnimation {
                                    duration: 80
                                }
                                ColorAnimation {
                                    duration: 250
                                }
                            }
                        }
                    }
                    P3Text {
                        anchors.verticalCenter: parent.verticalCenter
                        kind: "numSm"
                        font.pixelSize: 30
                        font.letterSpacing: -0.3
                        text: cell.modelData.t
                        color: cell.tone
                        Behavior on color {
                            enabled: !root.still
                            SequentialAnimation {
                                PauseAnimation {
                                    duration: 80
                                }
                                ColorAnimation {
                                    duration: 250
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
