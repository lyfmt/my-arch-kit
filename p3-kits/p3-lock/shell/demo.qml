import QtQuick
import Quickshell

// 预览：qs -p shell/demo.qml（安装后 qs -p ~/.config/quickshell/p3lock/demo.qml）
// 普通窗口，不真的锁屏，不碰 PAM / systemctl。输入 "fail" 回车 = 密码错误，其他任意值 = 解锁；
// 解锁后按 L 重新锁定。电源菜单只打日志。
// 环境变量（开发用）：
//   P3LOCK_SIZE=1920x1080        窗口尺寸（默认 1600x900）
//   P3LOCK_STATE=idle|typing|verify|error|power|caps|unlock   冻结在某状态（同原型 ?state=）
//   P3LOCK_CAPS=1                强制 Caps Lock
//   P3LOCK_FAIL=maxtries|autherror  注入失败
//   P3LOCK_SHOT=<dir>            按下面的脚本自动操作并截图到 <dir>，播完退出
//   P3LOCK_SCRIPT=<name>         脚本：all（默认）| power | unlock | minute
ShellRoot {
    id: root

    readonly property var size: (Quickshell.env("P3LOCK_SIZE") || "1600x900").split("x").map(Number)
    readonly property string state0: Quickshell.env("P3LOCK_STATE") || ""
    readonly property string shotDir: Quickshell.env("P3LOCK_SHOT") || ""

    Session {
        id: sess
        demo: true
        demoFail: Quickshell.env("P3LOCK_FAIL") || ""
        frozen: root.state0 !== "" || root.shotDir !== ""
        caps: Quickshell.env("P3LOCK_CAPS") === "1" || root.state0 === "caps"
        // 解锁转场播完后（450 + 1250ms）停在“桌面”，按 L 重新锁定
    }

    function preset(t) {
        for (const c of t)
            sess.type(c);
    }

    Component.onCompleted: {
        const st = state0;
        if (!st || st === "idle")
            return;
        sess.awake = true;
        if (st === "typing")
            preset("hunter2!");
        else if (st === "caps")
            preset("pass");
        else if (st === "verify") {
            preset("password");
            sess.busy = true;
            sess.busySince = Date.now();
        } else if (st === "error") {
            preset("fail");
            sess.fail("WRONG PASSWORD");
        } else if (st === "power") {
            sess.openPower();
            sess.powerSelect(2);
            sess.powerFire();
        } else if (st === "unlock")
            sess.unlock();
    }

    FloatingWindow {
        id: win
        implicitWidth: root.size[0]
        implicitHeight: root.size[1]
        title: "p3lock demo"
        color: "black"

        Item {
            id: stage
            anchors.fill: parent

            // “桌面”占位：真锁屏里这里是实时桌面
            Rectangle {
                anchors.fill: parent
                color: "#0b1022"
                Text {
                    anchors.centerIn: parent
                    text: "UNLOCKED · 按 L 重新锁定"
                    color: "#c8d3ea"
                    font.family: Theme.label
                    font.pixelSize: 18
                    font.letterSpacing: 2
                }
            }

            LockScene {
                id: scene
                anchors.fill: parent
                focus: true
                session: sess
                Component.onCompleted: forceActiveFocus()
                Keys.onReleased: event => {
                    if (sess.unlocking && event.key === Qt.Key_L) {
                        sess.relock();
                        event.accepted = true;
                    }
                }
            }
        }

        // 截图 / 自动化脚本：[延时ms, 动作]
        Timer {
            id: script
            property int step: 0
            readonly property string which: Quickshell.env("P3LOCK_SCRIPT") || "all"
            readonly property var sets: ({
                    all: [
                        [900, "shot:00-idle"], [0, "type:h"], [60, "shot:01-wake-a"], [140, "type:u"], [120, "type:n"], [120, "type:t"],
                        [120, "type:e"], [120, "type:r"], [120, "type:2"], [700, "shot:02-typing"], [0, "back"], [200, "shot:03-delete"],
                        [400, "caps:1"], [400, "shot:04-caps"], [0, "caps:0"], [0, "clear"], [600, "type:f"], [80, "type:a"], [80, "type:i"], [80, "type:l"],
                        [400, "submit"], [300, "shot:05-verify"], [500, "shot:05b-verify"], [180, "shot:06-error-shake"], [500, "shot:07-error"],
                        [500, "shot:08-error-sink"], [900, "type:x"], [400, "shot:09-retype"], [0, "clear"], [600, "power:open"], [600, "shot:10-power"],
                        [0, "power:move:1"], [400, "shot:11-power-reboot"], [0, "power:fire"], [400, "shot:12-power-confirm"], [0, "power:fire"], [300, "shot:13-power-ran"],
                        [0, "power:select:0"], [0, "power:fire"], [300, "shot:14-power-suspend"], [0, "power:close"], [700, "shot:15-back"],
                        [0, "idle"], [1200, "shot:16-idle-again"], [0, "type:o"], [80, "type:k"], [500, "submit"], [740, "shot:17-up-a"],
                        [200, "shot:18-up-b"], [300, "shot:19-up-c"], [400, "shot:20-up-d"], [900, "shot:21-desktop"], [500, "quit"]
                    ],
                    minute: [[300, "shot:m0"], [0, "tick"], [150, "shot:m1"], [300, "shot:m2"], [600, "shot:m3"], [100, "quit"]]
                })
            readonly property var steps: sets[which] || sets.all
            running: root.shotDir !== ""
            interval: steps[0][0]
            onTriggered: {
                const a = steps[step][1];
                if (a.startsWith("shot:")) {
                    const name = a.slice(5);
                    stage.grabToImage(r => r.saveToFile(root.shotDir + "/" + name + ".png"));
                } else if (a.startsWith("type:"))
                    root.hook("type", a.slice(5));
                else
                    root.hook(a, "");
                step++;
                if (step < steps.length) {
                    interval = Math.max(1, steps[step][0]);
                    restart();
                }
            }
        }
    }

    // 调试钩子：模拟真实按键路径（唤醒 + 输入），脚本和手动调试都用
    function hook(a, arg) {
        if (a === "type") {
            sess.pointer = false;
            sess.wake();
            sess.type(arg);
        } else if (a === "back")
            sess.back();
        else if (a === "clear")
            sess.clear();
        else if (a === "submit")
            sess.submit();
        else if (a === "caps:1")
            sess.caps = true;
        else if (a === "caps:0")
            sess.caps = false;
        else if (a === "power:open") {
            sess.wake();
            sess.openPower();
        } else if (a.startsWith("power:move:"))
            sess.powerMove(Number(a.slice(11)));
        else if (a.startsWith("power:select:"))
            sess.powerSelect(Number(a.slice(13)));
        else if (a === "power:fire")
            sess.powerFire();
        else if (a === "power:close")
            sess.closePower();
        else if (a === "idle")
            sess.goIdle();
        else if (a === "tick")
            scene.debugTick();
        else if (a === "quit")
            Qt.quit();
    }
}
