import QtQuick
import Quickshell
import Quickshell.Wayland

// P3 风格锁屏：qs -n -c p3lock（由 DMS 的 customPowerActionLock 拉起，见 p3lock.sh）
// 一次性进程：启动即上锁，解锁动画播完即退出。骨架照 p5lock/shell.qml
//   1. PAM 成功 → Session.unlock()：锁屏表面上 UI 上浮、光束变亮、气泡涌出（0–450ms）
//   2. 同时建好 overlay 图层（上锁期间被锁屏表面盖住），画同一帧画面（共用 Session 的墙钟）
//   3. 450ms 解除 session lock → overlay 上水下层下沉 + 放大，露出实时桌面 → 1.7s 退出
//   4. 兜底：PAM 成功后 1.5s 还没解除就强制解除
ShellRoot {
    id: root

    property bool released: false
    readonly property string marker: (Quickshell.env("XDG_RUNTIME_DIR") || "/tmp") + "/p3lock.secure"

    Session {
        id: sess
        onHandoff: root.release()
    }

    function release() {
        if (released)
            return;
        released = true;
        lock.locked = false;
        Quickshell.execDetached(["rm", "-f", root.marker]);
        quitTimer.start();
    }

    // 450ms 处解锁 + 1250ms 下沉，再留一点余量
    Timer {
        id: quitTimer
        interval: 1250 + 120
        onTriggered: Qt.quit()
    }

    Timer {
        running: sess.unlocking && !root.released
        interval: 1500
        onTriggered: root.release()
    }

    WlSessionLock {
        id: lock
        locked: true

        onSecureChanged: {
            if (secure)
                Quickshell.execDetached(["touch", root.marker]);
        }
        // 被合成器拒绝（例如已有别的锁屏）时直接退出
        onLockedChanged: {
            if (!locked && !root.released)
                Qt.quit();
        }

        WlSessionLockSurface {
            id: surface
            color: Theme.base

            LockScene {
                anchors.fill: parent
                focus: true
                session: sess
                Component.onCompleted: forceActiveFocus()
            }
        }
    }

    Variants {
        model: sess.unlocking ? Quickshell.screens : []

        PanelWindow {
            required property var modelData
            screen: modelData
            color: "transparent"
            exclusionMode: ExclusionMode.Ignore
            WlrLayershell.layer: WlrLayer.Overlay
            WlrLayershell.namespace: "p3lock-reveal"
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
            mask: Region {}
            anchors {
                top: true
                bottom: true
                left: true
                right: true
            }

            LockScene {
                anchors.fill: parent
                session: sess
                interactive: false
            }
        }
    }
}
