import QtQuick
import qs.Modules.P3

// 开关行（.p-row.p-toggle）：Enter / 单击翻转。checked 绑定后端状态；翻转后先显示新值（乐观），
// action(v) 的 Promise 失败时退回后端值（框架弹红字），成功后等后端跟上（最多 1.5s）。
//   SyToggle { icon: "wifi"; label: "WI-FI"; meta: "…"; tall: true; checked: Net.state.wifi; action: v => Net.setWifi(v) }
//   name: true  标签用值字体（应用名，不转大写）
//   two: true   标签 + 说明两行（.p-two：标签 17、间距 7、说明 14.3，整列竖直居中）；说明为空时仍按两行排，标签上移 3.5。
//               默认 meta 非空时为两行
SyFocus {
    id: root

    property string icon: ""
    property string img: ""
    property string label: ""
    property bool name: false
    property string meta: ""
    property bool two: meta !== ""
    property bool tall: false
    property bool checked: false
    property var action: null
    // 行首留出一个图标位（自定义图标作为子元素放在 x 18 时用）
    property real leadW: lead.implicitWidth

    readonly property bool on: _hold ? _want : checked
    property bool _hold: false
    property bool _want: false

    implicitHeight: tall ? P3.rowTallH : P3.rowH

    onActivated: flip()
    onCheckedChanged: if (_hold && settle.running && checked === _want) {
        settle.stop();
        _hold = false;
    }

    function flip() {
        const v = !on;
        _want = v;
        _hold = true;
        if (!action) {
            settle.restart();
            return;
        }
        run(action(v), {
            "done": ok => {
                if (!ok || checked === v) {
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
    Item {
        id: txt
        x: 18 + (root.leadW > 0 ? root.leadW + 16 : 0)
        width: sw.x - 16 - x
        height: parent.height
        P3Text {
            width: parent.width
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: !root.two ? 0 : root.meta !== "" ? -10.65 : -3.5
            kind: root.name ? "value" : "label"
            text: root.label
            color: root.fg
            elide: Text.ElideRight
        }
        P3Text {
            visible: root.meta !== ""
            width: parent.width
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: 12
            kind: "meta"
            text: root.meta
            color: root.dimColor
            elide: Text.ElideRight
        }
    }
    SySwitch {
        id: sw
        x: root.width - 18 - width
        anchors.verticalCenter: parent.verticalCenter
        on: root.on
        host: root
    }
}
