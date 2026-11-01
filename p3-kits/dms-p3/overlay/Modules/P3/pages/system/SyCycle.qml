import QtQuick
import qs.Modules.P3

// 循环选择行（原型 .sy-cyc）：右侧 ◀ 值 ▶。←→ 前后切换，Enter / 单击 = 下一个，单击 ◀ = 上一个。
// 箭头只在焦点时出现，切换时向外顶 5px；新值从下方 8px 弹入。index 绑定后端（opts 的下标），
// 切换后先显示新值（乐观），action(i) 失败时退回后端值，成功后等后端跟上（最多 1.5s）。
//   locked  只读（需要 root 的设置）：显示当前值和锁形图标，不可聚焦
//   text    直接给出要显示的值（不在 opts 里时用，例如只读的 logind 值）
SyFocus {
    id: root

    property string icon: ""
    property string img: ""
    property string label: ""
    property bool name: false
    property var opts: []
    property int index: 0
    property string text: ""
    property bool locked: false
    // 依赖条件（原型 data-need）：不满足时变暗、跳过
    property bool need: true
    property var action: null

    readonly property bool syLR: true
    readonly property int shownIndex: _hold ? _want : index
    readonly property string shownText: text !== "" ? text : (opts[shownIndex] !== undefined ? String(opts[shownIndex]) : "—")
    property bool _hold: false
    property int _want: 0

    disabled: locked || !need || opts.length === 0
    onActivated: step(1)
    onIndexChanged: if (_hold && settle.running && index === _want) {
        settle.stop();
        _hold = false;
    }

    keyHandler: e => {
        if (e.key === Qt.Key_Left || e.key === Qt.Key_A) {
            step(-1);
            return true;
        }
        if (e.key === Qt.Key_Right || e.key === Qt.Key_D) {
            step(1);
            return true;
        }
        return false;
    }

    function step(d) {
        const n = opts.length;
        if (!n || disabled)
            return;
        const cur = shownIndex >= 0 && shownIndex < n ? shownIndex : (d > 0 ? -1 : 0);
        const i = (cur + d + n) % n;
        _want = i;
        _hold = true;
        valIn.restart();
        (d < 0 ? bumpL : bumpR).restart();
        if (!action) {
            settle.restart();
            return;
        }
        run(action(i), {
            "done": ok => {
                if (!ok || index === i) {
                    settle.stop();
                    _hold = false;
                } else {
                    settle.restart();
                }
            }
        });
    }
    Timer {
        id: settle
        interval: 1500
        onTriggered: root._hold = false
    }

    SyLead {
        id: lead
        x: 18
        anchors.verticalCenter: parent.verticalCenter
        icon: root.icon
        img: root.img
        color: root.fg
    }
    P3Text {
        x: 18 + (lead.implicitWidth > 0 ? lead.implicitWidth + 16 : 0)
        width: cv.x - 16 - x
        anchors.verticalCenter: parent.verticalCenter
        kind: root.name ? "value" : "label"
        text: root.label
        color: root.fg
        elide: Text.ElideRight
    }
    Row {
        id: cv
        x: root.width - 18 - width
        anchors.verticalCenter: parent.verticalCenter
        spacing: 12
        Item {
            width: 18
            height: 18
            anchors.verticalCenter: parent.verticalCenter
            opacity: root.focused && !root.locked ? 1 : 0
            Behavior on opacity {
                NumberAnimation {
                    duration: 150
                }
            }
            P3Glyph {
                id: arL
                name: "chev"
                size: 18
                color: root.dimColor
                transform: [
                    Scale {
                        origin.x: 9
                        xScale: -1
                    },
                    Translate {
                        id: bumpLT
                    }
                ]
            }
            MouseArea {
                anchors.fill: parent
                anchors.margins: -8
                enabled: !root.disabled
                onPressed: root.requestFocus()
                onClicked: root.step(-1)
            }
        }
        Item {
            width: Math.max(160, val.implicitWidth)
            height: 26
            anchors.verticalCenter: parent.verticalCenter
            Row {
                anchors.centerIn: parent
                spacing: 10
                P3Glyph {
                    visible: root.locked
                    anchors.verticalCenter: parent.verticalCenter
                    name: "lock"
                    size: 16
                    color: root.dimColor
                }
                P3Text {
                    id: val
                    kind: "value"
                    text: root.shownText
                    color: root.fg
                    anchors.verticalCenter: parent.verticalCenter
                    transform: Translate {
                        id: valT
                    }
                }
            }
        }
        P3Glyph {
            anchors.verticalCenter: parent.verticalCenter
            opacity: root.focused && !root.locked ? 1 : 0
            name: "chev"
            size: 18
            color: root.dimColor
            transform: Translate {
                id: bumpRT
            }
            Behavior on opacity {
                NumberAnimation {
                    duration: 150
                }
            }
        }
    }

    ParallelAnimation {
        id: valIn
        NumberAnimation {
            target: val
            property: "opacity"
            from: 0
            to: 1
            duration: 300
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.spring
        }
        NumberAnimation {
            target: valT
            property: "y"
            from: 8
            to: 0
            duration: 300
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.spring
        }
    }
    SequentialAnimation {
        id: bumpL
        NumberAnimation {
            target: bumpLT
            property: "x"
            to: -5
            duration: 110
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
        NumberAnimation {
            target: bumpLT
            property: "x"
            to: 0
            duration: 250
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.spring
        }
    }
    SequentialAnimation {
        id: bumpR
        NumberAnimation {
            target: bumpRT
            property: "x"
            to: 5
            duration: 110
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
        NumberAnimation {
            target: bumpRT
            property: "x"
            to: 0
            duration: 250
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.spring
        }
    }
}
