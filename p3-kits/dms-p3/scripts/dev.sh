#!/usr/bin/env bash
# 开发辅助（不参与安装）。work/shell 是上游 UI 的 git 工作副本，改上游文件时在里面改：
#
#   scripts/dev.sh init                建立 work/shell（上游原版提交为基线，再打上 patches/ 并复制 overlay/）
#   scripts/dev.sh export              work/shell 里对上游文件的改动 → patches/（每个文件一个补丁）
#                                      新增文件不自动导出：overlay/ 是源头，直接改 overlay/
#   scripts/dev.sh check [秒数]         构建到 /tmp/p3build 并在无头 sway 里跑 qmlcheck（不碰在跑的 DMS）
#   scripts/dev.sh restart             以已安装的 ~/.local/share/dms-p3/shell 重启 DMS（只在已 enable 后、由用户手动运行）
#
# 不会自动重启 DMS；restart 要显式调用。
set -euo pipefail

PKG="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$PKG/work/shell"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/dms-p3"
DEST="$DATA/shell"

case "${1:-}" in
init)
    src="$DATA/upstream/$(cat "$PKG/patches/BASE_VERSION")"
    [ -f "$src/shell.qml" ] || { echo "dev: 没有上游缓存 $src，先跑 ./build.sh --extract" >&2; exit 1; }
    rm -rf "$WORK"
    mkdir -p "$(dirname "$WORK")"
    cp -a "$src" "$WORK"
    chmod -R u+w "$WORK"
    git -C "$WORK" init -q
    git -C "$WORK" add -A
    git -C "$WORK" -c user.name=upstream -c user.email=upstream@local commit -qm "upstream $(cat "$WORK/VERSION")"
    find "$PKG/patches" -name '*.patch' | sort | while read -r p; do patch -d "$WORK" -p1 --batch -s <"$p"; done
    cp -a "$PKG/overlay/." "$WORK/"
    echo "work/shell 已就绪（work/ 不进仓库）"
    ;;
export)
    [ -d "$WORK/.git" ] || { echo "dev: 先 init" >&2; exit 1; }
    cd "$WORK"
    find "$PKG/patches" -name '*.patch' -delete
    git diff --name-only | while read -r f; do
        git diff --no-color -- "$f" >"$PKG/patches/$(echo "$f" | tr '/' '_').patch"
    done
    echo "patches: $(find "$PKG/patches" -name '*.patch' | wc -l)"
    ;;
check)
    "$PKG/build.sh" --dest /tmp/p3build
    "$PKG/scripts/qmlcheck.sh" /tmp/p3build "${2:-15}"
    ;;
restart)
    [ -f "$DEST/shell.qml" ] || { echo "dev: $DEST 不存在，先 ./build.sh" >&2; exit 1; }
    pkill -x dms 2>/dev/null || true
    for _ in $(seq 50); do pgrep -x dms >/dev/null || break; sleep 0.1; done
    # DMS_GREETER_AUTH_TIME 设为未来时间：重启不触发 lockAtStartup
    DMS_GREETER_AUTH_TIME=4102444800 setsid -f dms run -c "$DEST" >/tmp/dms-p3.log 2>&1 </dev/null
    echo "DMS 以 $DEST 重启，日志 /tmp/dms-p3.log"
    ;;
*)
    sed -n '2,11p' "$0"
    exit 2
    ;;
esac
