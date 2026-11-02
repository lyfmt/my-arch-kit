#!/usr/bin/env bash
# 把 dms 二进制里解包出来的 QML UI 同步到持久目录，并打上「壁纸回收站」补丁。
#
# DMS 的 UI 内嵌在二进制里，每次启动会解包到
#   $XDG_RUNTIME_DIR/danklinux-shell/<hash>/
# 这里把它复制到 ~/.local/share/dms-shell 并打补丁，再让 DMS 通过
# DMS_SHELL_DIR 使用这份 UI（由 dms-shell-run / 本脚本的 --if-stale 设置）。
#
# 用法:
#   dms-shell-sync                # 立即同步 + 打补丁 + 重启 DMS
#   dms-shell-sync --if-stale     # 仅在 dms 版本变化时同步并重启
#   dms-shell-sync --no-restart   # 只同步/打补丁，不动正在运行的 DMS
set -euo pipefail

IF_STALE=0
DO_RESTART=1
for arg in "$@"; do
    case "$arg" in
        --if-stale) IF_STALE=1 ;;
        --no-restart) DO_RESTART=0 ;;
        *)
            echo "未知参数: $arg" >&2
            exit 2
            ;;
    esac
done

DEST="${DMS_SHELL_DIR:-$HOME/.local/share/dms-shell}"
PROJECT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PATCHER="$PROJECT/dms_shell_patch.py"
RUNTIME_ROOT="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/danklinux-shell"
STAMP="$DEST/.dms-shell-source"

SRC="$(ls -1dt "$RUNTIME_ROOT"/*/ 2>/dev/null | head -n1 || true)"
if [ -z "${SRC:-}" ] || [ ! -f "${SRC}shell.qml" ]; then
    echo "错误：找不到已解包的 DMS UI（$RUNTIME_ROOT）。" >&2
    echo "请先确保 DMS 正在运行（dms run / dms restart）后再执行本脚本。" >&2
    exit 1
fi
NEW_HASH="$(basename "${SRC%/}")"

if [ "$IF_STALE" = "1" ]; then
    if [ -f "$STAMP" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$NEW_HASH" ]; then
        exit 0
    fi
    echo "==> 检测到 DMS 版本变化（$NEW_HASH），重新同步"
fi

echo "==> 从 ${SRC} 同步到 ${DEST}"
TMP="${DEST}.new.$$"
rm -rf "$TMP"
mkdir -p "$TMP"
cp -a "${SRC}." "$TMP/"
if [ -d "$DEST" ]; then
    # 解包出来的文件/目录是只读的，先恢复写权限再删除
    chmod -R u+w "$DEST" 2>/dev/null || true
    rm -rf "$DEST"
fi
mv "$TMP" "$DEST"
# 解包出来的文件是只读的，改成可写以便打补丁
chmod -R u+w "$DEST"

echo "==> 应用壁纸回收站补丁"
python3 "$PATCHER" "$DEST/Modules/DankDash/WallpaperTab.qml"

printf '%s' "$NEW_HASH" > "$STAMP"

echo "==> 完成"
echo "    DMS_SHELL_DIR=$DEST"

if [ "$DO_RESTART" = "1" ]; then
    echo "==> 重启 DMS 以加载新 UI"
    dms kill >/dev/null 2>&1 || true
    sleep 1
    DMS_SHELL_DIR="$DEST" dms run -d >/dev/null 2>&1 || true
else
    echo "    重启 DMS 生效:  DMS_SHELL_DIR=$DEST dms restart"
fi
