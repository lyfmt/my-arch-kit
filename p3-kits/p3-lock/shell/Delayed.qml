import QtQuick

// CSS 的 transition-delay：source 变 true 后 delay 毫秒 value 才跟着变 true；变 false 立即跟随
// （原型里的延迟只写在进入状态的规则上，离开时没有延迟）
Timer {
    id: d

    property bool source: false
    property int delay: 0
    property bool value: false

    interval: Math.max(1, delay)
    Component.onCompleted: value = source
    onSourceChanged: {
        if (source) {
            if (delay <= 0)
                value = true;
            else
                restart();
        } else {
            stop();
            value = false;
        }
    }
    onTriggered: value = source
}
