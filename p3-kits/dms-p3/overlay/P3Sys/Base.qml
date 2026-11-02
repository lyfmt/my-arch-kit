import QtQuick
import Quickshell
import Quickshell.Io

// 所有 P3Sys 单例的公共基类（不是单例本身）。对应原型 backend.js 的 act()/P3Error。
//
// 结果约定（与原型一致，页面照搬 JS 结构）：
//   action(...) 返回 Promise：成功 resolve({ ok: true, msg })，msg 是一句中文或 null（控件自己会显示变化时为 null）；
//                           失败 reject({ code, message })，message 是中文。
//   同时每个结果都发一次 done(ok, msg, action)，action 形如 "net.connect"，方便不用 Promise 的 QML 绑定。
//   state 属性是只读快照；变化时发 changed()（等同原型的 P3Sys.on(ns, fn)）。
Singleton {
    id: base

    // 命名空间名，例如 "net"。子类必须设置。
    property string ns: ""
    // 一次结果：ok, msg（中文或空串）, action（"ns.name"）
    signal done(bool ok, string msg, string action)
    // 状态变化（对应原型的 P3Sys.on(ns, fn)）。子类在 state 变化时调用 base.notify()。
    signal changed

    function notify() {
        changed();
    }

    // ok(action, msg) → 已 resolve 的 Promise，并发 done
    function ok(action, msg) {
        done(true, msg || "", ns + "." + action);
        return Promise.resolve({
            "ok": true,
            "msg": msg || null
        });
    }
    // fail(action, code, message) → 已 reject 的 Promise，并发 done
    function fail(action, code, message) {
        done(false, message || "", ns + "." + action);
        return Promise.reject({
            "code": code || "error",
            "message": message || "失败"
        });
    }
    // later(action, executor)：executor(resolve(msg), reject(code, message))，用于要等服务回调或属性变化的动作
    function later(action, executor) {
        return new Promise((res, rej) => {
            let settled = false;
            const resolve = msg => {
                if (settled)
                    return;
                settled = true;
                done(true, msg || "", ns + "." + action);
                res({
                    "ok": true,
                    "msg": msg || null
                });
            };
            const reject = (code, message) => {
                if (settled)
                    return;
                settled = true;
                done(false, message || "", ns + "." + action);
                rej({
                    "code": code || "error",
                    "message": message || "失败"
                });
            };
            try {
                executor(resolve, reject);
            } catch (e) {
                reject("exception", String(e));
            }
        });
    }

    // 等某个条件成立（每 100ms 检查一次），超时 reject。用于“调用服务后看属性变化”的动作。
    //   waitFor(action, () => NetworkService.currentWifiSSID === ssid, 15000, okMsg, () => errMsgOrEmpty)
    function waitFor(action, test, timeoutMs, okMsg, errTest) {
        return later(action, (resolve, reject) => {
            const t0 = Date.now();
            const timer = pollComp.createObject(base);
            timer.triggered.connect(() => {
                let err = "";
                try {
                    if (test()) {
                        timer.destroy();
                        resolve(typeof okMsg === "function" ? okMsg() : okMsg);
                        return;
                    }
                    err = errTest ? errTest() : "";
                } catch (e) {
                    err = String(e);
                }
                if (err || Date.now() - t0 > timeoutMs) {
                    timer.destroy();
                    reject(err ? "failed" : "timeout", err || "操作超时");
                }
            });
            timer.start();
        });
    }

    // run(argv, cb(exitCode, stdout, stderr))：跑一个外部命令（不经过 shell）
    function run(argv, cb) {
        const p = procComp.createObject(base, {
            "command": argv
        });
        p.finished.connect((code, out, err) => {
            try {
                if (cb)
                    cb(code, out, err);
            } finally {
                p.destroy();
            }
        });
        p.running = true;
    }
    // exec(action, argv, okMsg, failMsg)：跑命令，退出码 0 = 成功
    function exec(action, argv, okMsg, failMsg) {
        return later(action, (resolve, reject) => run(argv, (code, out, err) => {
                if (code === 0)
                    resolve(typeof okMsg === "function" ? okMsg(out) : okMsg);
                else
                    reject("exit" + code, (failMsg || "命令失败") + (err ? "：" + err.trim().split("\n").pop() : ""));
            }));
    }

    // 读写小文本文件（~/.cache/p3、~/.config/autostart 等）。path 为绝对路径。
    function readFile(path, cb) {
        const f = fileComp.createObject(base, {
            "path": path
        });
        const finish = text => {
            f.destroy();
            cb(text);
        };
        f.done.connect(ok => finish(ok ? f.text() : null));
        f.reload();
    }
    function writeFile(path, text, cb) {
        const dir = path.slice(0, path.lastIndexOf("/"));
        run(["mkdir", "-p", dir], () => _writeFile(path, text, cb));
    }
    function _writeFile(path, text, cb) {
        const f = fileComp.createObject(base, {
            "path": path,
            "blockLoading": true
        });
        f.done.connect(ok => {
            f.destroy();
            if (cb)
                cb(ok);
        });
        f.setText(text);
    }

    readonly property string home: Quickshell.env("HOME")
    readonly property string cacheDir: (Quickshell.env("XDG_CACHE_HOME") || home + "/.cache") + "/p3"
    readonly property string configHome: Quickshell.env("XDG_CONFIG_HOME") || home + "/.config"

    Component {
        id: pollComp
        Timer {
            interval: 100
            repeat: true
        }
    }

    Component {
        id: procComp
        Process {
            id: proc
            signal finished(int code, string out, string err)
            stdout: StdioCollector {
                id: so
            }
            stderr: StdioCollector {
                id: se
            }
            // exited 先于 StdioCollector 收齐，等下一轮事件循环再取
            onExited: code => Qt.callLater(() => proc.finished(code, so.text, se.text))
        }
    }

    Component {
        id: fileComp
        FileView {
            // loaded 是 FileView 的布尔属性，不是信号；结果走这里的 done
            signal done(bool ok)
            blockLoading: false
            printErrors: false
            atomicWrites: true
            onLoaded: done(true)
            onLoadFailed: done(false)
            onSaved: done(true)
            onSaveFailed: done(false)
        }
    }
}
