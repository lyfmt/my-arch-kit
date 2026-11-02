#!/bin/sh
# 启动 P3 锁屏。DMS 的 customPowerActionLock 指向本脚本（DMS 用 `sh -c` 执行，不检查返回值）。
#   p3lock.sh          立即返回
#   p3lock.sh --wait   等到合成器确认上锁（适合 `p3lock.sh --wait && systemctl suspend`）
# 锁屏进程（shell.qml）在 WlSessionLock.secure 变 true 时 touch 标记文件，解锁时删除。
marker="${XDG_RUNTIME_DIR:-/tmp}/p3lock.secure"

if ! pgrep -f 'qs -n -c p3lock' >/dev/null 2>&1; then
    rm -f "$marker"
    setsid -f qs -n -c p3lock >/dev/null 2>&1
fi

[ "$1" = "--wait" ] || exit 0

i=0
while [ ! -e "$marker" ]; do
    i=$((i + 1))
    [ "$i" -gt 50 ] && exit 1
    sleep 0.1
done
