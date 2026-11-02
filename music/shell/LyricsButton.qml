import QtQuick
import Quickshell
import Quickshell.Io

// 「词」：桌面歌词（qs -c p3lyrics）的开关。左键开 / 关；右键或长按进入歌词的位置 / 大小调整。
// 亮不亮以 p3lyrics 的状态为准：监视它写的 state.json；工具栏出现、鼠标移上来、每次操作后，以及工具栏显示期间每 5s，
// 再用 IPC status 确认实例还在。
// 实例没在跑时按「关」显示；打开或调整时会先把它拉起来（qs -n -c p3lyrics -d）。
Rectangle {
    id: b

    property bool fileOn: false     // state.json 里的 enabled
    property bool alive: true       // 上次 status 查询时实例在跑
    property bool pending: false    // 命令发出、还没确认
    property bool want: false
    readonly property bool on: pending ? want : fileOn && alive

    width: 30
    height: 30
    radius: 15
    color: on ? Theme.alpha(Theme.primary, ma.containsMouse ? 0.26 : 0.16)
       : ma.containsMouse ? Theme.alpha(Theme.text, 0.1) : "transparent"
    Behavior on color { ColorAnimation { duration: 120 } }

    Text {
        anchors.centerIn: parent
        text: "词"
        color: b.on ? Theme.primary : ma.containsMouse ? Qt.lighter(Theme.textDim, 1.15) : Theme.textDim
        font.family: Theme.font
        font.pixelSize: 15
        font.weight: Font.Bold
        Behavior on color { ColorAnimation { duration: 120 } }
    }

    MouseArea {
        id: ma
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        property bool held: false
        onContainsMouseChanged: if (containsMouse) b.refresh()
        onPressed: held = false
        onPressAndHold: {
            held = true;
            b.run("adjust");
        }
        onClicked: m => {
            if (held) return;
            if (m.button === Qt.RightButton) {
                b.run("adjust");
                return;
            }
            if (cmd.running) return;
            b.want = !b.on;
            b.pending = true;
            b.run(b.want ? "show" : "hide");
        }
    }

    function refresh() {
        if (!probe.running) probe.running = true;
    }
    onVisibleChanged: if (visible) refresh()
    Component.onCompleted: refresh()
    Timer {
        interval: 5000
        repeat: true
        running: b.visible && b.Window.visibility !== Window.Hidden
        onTriggered: b.refresh()
    }

    // 卡片自己的启动环境（配置路径、缩放）不传给 p3lyrics
    readonly property var env: ({ QS_CONFIG_PATH: null, QS_CONFIG_NAME: null, QT_SCALE_FACTOR: null })

    function run(verb) {
        if (cmd.running) return;
        cmd.command = ["sh", "-c", cmd.script, "sh", verb];
        cmd.running = true;
    }
    Process {
        id: cmd
        // 实例在：直接调用；不在：hide 什么也不做，其余先 -d 拉起，等 IPC 就绪（最多 6s）再调用
        readonly property string script: 'q() { qs ipc -c p3lyrics call p3lyrics -- "$1" >/dev/null 2>&1; }; '
            + 'q "$1" && exit 0; [ "$1" = hide ] && exit 0; '
            + 'qs -n -c p3lyrics -d >/dev/null 2>&1; '
            + 'i=0; while [ $i -lt 40 ]; do sleep 0.15; q "$1" && exit 0; i=$((i + 1)); done; exit 1'
        environment: b.env
        onExited: probe.running = true
    }
    Process {
        id: probe
        command: ["qs", "ipc", "-c", "p3lyrics", "call", "p3lyrics", "status"]
        environment: b.env
        stdout: StdioCollector {
            onStreamFinished: {
                let s = null;
                try {
                    s = JSON.parse(text);
                } catch (e) {}
                b.alive = !!s;
                if (s) b.fileOn = !!s.shown;
                if (!cmd.running) b.pending = false;
            }
        }
        stderr: StdioCollector {}
    }
    FileView {
        path: (Quickshell.env("XDG_STATE_HOME") || (Quickshell.env("HOME") + "/.local/state")) + "/p3lyrics/state.json"
        watchChanges: true
        printErrors: false
        onFileChanged: reload()
        onLoaded: {
            try {
                b.fileOn = JSON.parse(text()).enabled === true;
            } catch (e) {}
        }
    }
}
