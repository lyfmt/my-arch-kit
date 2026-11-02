#!/usr/bin/env bash
# 启动 DMS。仅当补丁 UI 与当前 dms 二进制版本一致时才使用它，
# 否则回退到内嵌 UI（避免 DMS 升级后旧 QML 加载失败导致顶栏消失）。
#
# 用法（niri 的 spawn-at-startup 调用）:
#   dms-shell-run
# 之后运行 dms-shell-sync 会重建补丁 UI 并重启 DMS。
set -euo pipefail

DEST="${DMS_SHELL_DIR:-$HOME/.local/share/dms-shell}"

if [ -f "$DEST/shell.qml" ] && [ -f "$DEST/VERSION" ]; then
    BIN_VER="$(dms version 2>/dev/null | awk '{print $NF}' || true)"
    PERSIST_VER="$(cat "$DEST/VERSION" 2>/dev/null || true)"
    if [ -n "$BIN_VER" ] && [ "$BIN_VER" = "$PERSIST_VER" ]; then
        export DMS_SHELL_DIR="$DEST"
    else
        echo "dms-shell-run: 补丁 UI 版本($PERSIST_VER) 与 dms($BIN_VER) 不一致，本次使用内嵌 UI；运行 dms-shell-sync 可重建" >&2
    fi
fi

exec dms run "$@"
