import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Services.Pam

// 锁屏状态与系统接口，对应原型 backend.js（window.P3Lock）+ lock.js 里与画面无关的部分。
// shell.qml（真锁屏）和 demo.qml（预览）共用；demo: true 时不碰 PAM / systemctl
Scope {
    id: s

    property bool demo: false
    property string demoFail: "" // demo 注入失败：maxtries | autherror

    readonly property string user: Quickshell.env("USER") || "user"
    readonly property string host: hostFile.text().trim() || "localhost"

    property string password: ""
    property bool busy: false
    property real busySince: 0
    property bool denied: false
    property string deniedMsg: "WRONG PASSWORD"
    property real failAt: 0
    property real sinkAt: 0
    property bool caps: false
    property bool awake: false
    property bool frozen: false // 调试状态冻结时不回待机
    property bool unlocking: false
    property real upStart: 0

    // 视差：背景随鼠标反向平移，0.9s 缓出跟随；解锁时记下当前值，由 Underwater 按时间归零
    property real parX: 0
    property real parY: 0
    property real parUpX: 0
    property real parUpY: 0
    Behavior on parX { enabled: !s.unlocking; NumberAnimation { duration: 900; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }
    Behavior on parY { enabled: !s.unlocking; NumberAnimation { duration: 900; easing.type: Easing.BezierSpline; easing.bezierCurve: Theme.eOut } }

    // 动画墙钟起点：各屏幕的气泡随机数与之对应，保证锁屏表面和 overlay 画面一致
    readonly property real epoch: Date.now()
    // 用鼠标时才显示电源图标；按任意键隐藏
    property bool pointer: false

    // 电源菜单（替换密码块的位置）
    readonly property var actions: ["suspend", "reboot", "poweroff"]
    property bool pmode: false
    property int psel: 0
    property int pask: -1
    property string pmsg: ""
    property bool pred: false
    property real pselAt: 0
    property real phitAt: 0

    readonly property string statusText: busy ? "VERIFYING" : denied ? deniedMsg : ""
    readonly property bool statusRed: !busy && denied

    // 画面同步用：所有屏幕的 LockScene 按这些信号增删密码颗粒
    signal typed(int n)
    signal backspaced
    signal cleared(bool animated)
    // 解锁转场到 450ms：真锁屏在这时解除 session lock，overlay 接着播
    signal handoff
    signal powerResult(string msg, bool red)

    function point(nx, ny) {
        if (unlocking)
            return;
        parX = nx * -18;
        parY = ny * -12;
    }

    function wake() {
        if (unlocking)
            return;
        awake = true;
        arm();
    }
    function arm() {
        if (frozen)
            return;
        idleTimer.restart();
    }
    function goIdle() {
        if (unlocking || busy)
            return;
        closePower();
        password = "";
        denied = false;
        sinkAt = 0;
        cleared(false);
        awake = false;
        idleTimer.stop();
    }

    function type(c) {
        if (busy || unlocking)
            return;
        if (denied) {
            denied = false;
            sinkAt = 0;
            password = "";
            cleared(false);
        }
        password += c;
        typed(Array.from(password).length);
    }
    function back() {
        if (busy || unlocking || !password.length)
            return;
        const a = Array.from(password);
        a.pop();
        password = a.join("");
        backspaced();
    }
    function clear() {
        if (busy || unlocking)
            return;
        password = "";
        denied = false;
        sinkAt = 0;
        cleared(true);
    }

    property real t0: 0
    property var pending: null
    function submit() {
        if (busy || unlocking || !password.length)
            return;
        busy = true;
        busySince = Date.now();
        t0 = busySince;
        if (demo)
            fakeAuth.restart();
        else if (!pam.start())
            // PamContext 起不来（pam/ 目录或配置文件缺失、查不到用户）时不发 completed/error，
            // 不处理的话 busy 永远是 true、无法重试
            settle(() => fail("AUTH ERROR"));
    }
    // VERIFYING 至少显示 700ms：PAM 很快返回时亮段也能走完一个来回
    function settle(fn) {
        pending = fn;
        settleTimer.interval = Math.max(1, 700 - (Date.now() - t0));
        settleTimer.restart();
    }
    function fail(msg) {
        denied = true;
        deniedMsg = msg || "WRONG PASSWORD";
        sinkAt = 0;
        failAt = Date.now();
        sinkTimer.restart();
        dropTimer.restart();
    }
    function unlock() {
        if (unlocking)
            return;
        idleTimer.stop();
        parUpX = parX;
        parUpY = parY;
        upStart = Date.now();
        unlocking = true;
        handoffTimer.restart();
    }
    // demo 专用：回到上锁状态（真实实现里重新上锁 = DMS 再次拉起进程）
    function relock() {
        handoffTimer.stop();
        unlocking = false;
        upStart = 0;
        closePower();
        password = "";
        denied = false;
        sinkAt = 0;
        cleared(false);
        parX = 0;
        parY = 0;
        awake = false;
    }

    function openPower() {
        if (unlocking)
            return;
        pmode = true;
        pask = -1;
        pmsg = "";
        pred = false;
        psel = 0;
        pselAt = Date.now();
    }
    function closePower() {
        pmode = false;
        pask = -1;
    }
    function powerSelect(i) {
        if (!pmode || i === psel)
            return;
        psel = i;
        pask = -1;
        pmsg = "";
        pred = false;
        pselAt = Date.now();
    }
    function powerMove(d) {
        powerSelect((psel + d + actions.length) % actions.length);
    }
    // 挂起立即执行；重启 / 关机要再按一次（项目文字变成 REBOOT?，提示行变红）
    function powerFire() {
        if (!pmode)
            return;
        phitAt = Date.now();
        const a = actions[psel];
        if (a !== "suspend" && pask !== psel) {
            pask = psel;
            pmsg = "AGAIN TO CONFIRM";
            pred = true;
            return;
        }
        pask = -1;
        power(a);
    }
    onPowerResult: (msg, red) => {
        pmsg = msg;
        pred = red;
    }

    function power(action) {
        const names = { suspend: "SUSPEND", reboot: "REBOOT", poweroff: "POWER OFF" };
        const zh = { suspend: "挂起", reboot: "重启", poweroff: "关机" };
        if (!names[action])
            return;
        if (demo) {
            console.log("[demo] systemctl " + action);
            powerResult("DEMO · " + names[action] + " · 已模拟" + zh[action], false);
            return;
        }
        // 不经 DMS SessionService：DMS 此时可能没在跑，它的确认弹窗也不能出现在锁屏之上
        Quickshell.execDetached(["systemctl", action]);
        powerResult("", false);
    }

    Timer {
        id: idleTimer
        interval: 20000
        onTriggered: s.goIdle()
    }
    Timer {
        id: settleTimer
        onTriggered: {
            s.busy = false;
            const fn = s.pending;
            s.pending = null;
            if (fn)
                fn();
        }
    }
    Timer {
        id: sinkTimer
        interval: 900
        onTriggered: if (s.denied) s.sinkAt = Date.now()
    }
    Timer {
        id: dropTimer
        interval: 1600
        onTriggered: {
            if (!s.denied)
                return;
            s.password = "";
            s.cleared(false);
        }
    }
    Timer {
        id: handoffTimer
        interval: 450
        onTriggered: s.handoff()
    }

    Timer {
        id: fakeAuth
        interval: 120
        onTriggered: {
            if (s.demoFail === "maxtries")
                s.settle(() => s.fail("TOO MANY TRIES"));
            else if (s.demoFail === "autherror")
                s.settle(() => s.fail("AUTH ERROR"));
            else if (s.password === "fail")
                s.settle(() => s.fail("WRONG PASSWORD"));
            else
                s.settle(() => s.unlock());
        }
    }

    PamContext {
        id: pam
        configDirectory: Quickshell.shellDir + "/pam"
        config: "p3lock"

        onResponseRequiredChanged: {
            if (responseRequired)
                respond(s.password);
        }
        // PAM 的提示语（如“密码：”）不显示，只按结果给固定文案
        onCompleted: result => {
            if (result === PamResult.Success)
                s.settle(() => s.unlock());
            else
                s.settle(() => s.fail(result === PamResult.MaxTries ? "TOO MANY TRIES" : result === PamResult.Error ? "AUTH ERROR" : "WRONG PASSWORD"));
        }
    }

    FileView {
        id: hostFile
        path: "/etc/hostname"
        blockLoading: true
        printErrors: false
    }

    // Caps Lock：轮询 /sys/class/leds 下各键盘的指示灯（demo 里由调试钩子直接设 caps）
    Process {
        running: !s.demo
        command: ["sh", "-c", "ls -d /sys/class/leds/*::capslock 2>/dev/null"]
        stdout: StdioCollector {
            onStreamFinished: capsFiles.model = text.split("\n").filter(l => l.length > 0)
        }
    }
    Instantiator {
        id: capsFiles
        model: []
        FileView {
            required property string modelData
            path: modelData + "/brightness"
            blockLoading: true
            printErrors: false
        }
    }
    Timer {
        running: !s.demo && capsFiles.count > 0 && !s.unlocking
        interval: 300
        repeat: true
        onTriggered: {
            let on = false;
            for (let i = 0; i < capsFiles.count; i++) {
                const f = capsFiles.objectAt(i);
                f.reload();
                if (f.text().trim() !== "0")
                    on = true;
            }
            s.caps = on;
        }
    }
}
