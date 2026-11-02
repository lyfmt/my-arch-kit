#!/usr/bin/env bash
# 构建 dms-p3 版 DMS UI：上游 UI + patches/ + overlay/ + 本地图片 → $DEST
#
#   ./build.sh                      离线构建并安装到 ~/.local/share/dms-p3/shell
#   ./build.sh --upstream <dir>     指定上游 UI 目录（含 shell.qml 与 VERSION）
#   ./build.sh --dest <dir>         指定安装目录（测试用，如 /tmp/p3build）
#   ./build.sh --check              只检查补丁能否干净应用，不安装
#   ./build.sh --extract            从 /usr/bin/dms 解出内置 UI 重建缓存（升级 dms 后用）
#
# 上游 UI 的来源（按顺序）：
#   1. --upstream 参数
#   2. ~/.local/share/dms-p3/upstream/<BASE_VERSION>/（缓存，离线可用）
#   3. 从 /usr/bin/dms 的内置 UI 解出（scripts/extract-embedded.py，VERSION 必须等于 BASE_VERSION）
# 内置 UI 与 v2.0.0 tag 的 quickshell/ 一致（另带 DCommon 子模块、少了 tests 等开发文件），见 AGENTS.md。
set -euo pipefail

PKG="$(cd "$(dirname "$0")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/dms-p3"
DEST="$DATA/shell"
UPSTREAM=""
CHECK_ONLY=0
EXTRACT=0
PROTO="$PKG/prototype/shared"

while [ $# -gt 0 ]; do
    case "$1" in
    --upstream) UPSTREAM="$2"; shift 2 ;;
    --dest) DEST="$2"; shift 2 ;;
    --check) CHECK_ONLY=1; shift ;;
    --extract) EXTRACT=1; shift ;;
    -h | --help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "未知参数：$1" >&2; exit 2 ;;
    esac
done

die() { echo "build: $*" >&2; exit 1; }

BASE="$(cat "$PKG/patches/BASE_VERSION")"
CACHE="$DATA/upstream/$BASE"

extract_cache() {
    local tmp="$DATA/upstream/.extract.$$"
    rm -rf "$tmp"
    mkdir -p "$tmp"
    python3 -I "$PKG/scripts/extract-embedded.py" "${DMS_BIN:-/usr/bin/dms}" "$tmp" >/dev/null ||
        { rm -rf "$tmp"; die "无法从 ${DMS_BIN:-/usr/bin/dms} 解出内置 UI"; }
    local v
    v="$(cat "$tmp/VERSION" 2>/dev/null || echo unknown)"
    if [ "$v" != "$BASE" ]; then
        rm -rf "$tmp"
        die "/usr/bin/dms 内置 UI 是 $v，补丁基于 $BASE。先按新版本重新适配 patches/，再改 BASE_VERSION。"
    fi
    rm -rf "$CACHE"
    mv "$tmp" "$CACHE"
    echo "build: 已从 /usr/bin/dms 缓存上游 $v → $CACHE"
}

if [ -z "$UPSTREAM" ]; then
    if [ "$EXTRACT" = 1 ] || [ ! -f "$CACHE/shell.qml" ]; then
        mkdir -p "$DATA/upstream"
        extract_cache
    fi
    UPSTREAM="$CACHE"
fi
[ -f "$UPSTREAM/shell.qml" ] || die "上游目录 $UPSTREAM 里没有 shell.qml"

UPVER="$(cat "$UPSTREAM/VERSION" 2>/dev/null || echo unknown)"
[ "$UPVER" = "$BASE" ] || echo "build: 警告：补丁基于 $BASE，上游是 $UPVER；补丁失败时需要重新适配。" >&2

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
OUT="$TMP/shell"
cp -a "$UPSTREAM" "$OUT"
chmod -R u+w "$OUT"
rm -rf "$OUT/.git"

failed=0
while IFS= read -r p; do
    if ! patch -d "$OUT" -p1 --forward --batch --no-backup-if-mismatch -r - <"$p" >"$TMP/patch.log" 2>&1; then
        echo "build: 补丁失败：${p#"$PKG"/}" >&2
        sed 's/^/    /' "$TMP/patch.log" >&2
        failed=1
    fi
done < <(find "$PKG/patches" -name '*.patch' | sort)
[ "$failed" = 0 ] || die "有补丁未能应用，已中止（未改动 $DEST）。"

cp -a "$PKG/overlay/." "$OUT/"

# 图片不进仓库：从原型目录拷进来；缺了也能跑（背景退回纯色，图标退回主题图标）
ASSETS="$OUT/Modules/P3/assets"
mkdir -p "$ASSETS/icons"
if [ -f "$PROTO/miku-bg.png" ]; then
    cp "$PROTO/miku-bg.png" "$ASSETS/miku-bg.png"
else
    echo "build: 提示：没有 $PROTO/miku-bg.png，菜单背景只用纯色水下层" >&2
fi
for f in "$PROTO"/icons/*; do
    [ -f "$f" ] && cp "$f" "$ASSETS/icons/"
done

echo "dms-p3 on $UPVER ($(date +%F\ %T))" >"$OUT/P3_BUILD"

if [ "$CHECK_ONLY" = 1 ]; then
    echo "build: 检查通过（$UPVER）。"
    exit 0
fi

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST.prev"
[ -d "$DEST" ] && mv "$DEST" "$DEST.prev"
cp -a "$OUT" "$DEST"
echo "build: 已安装到 $DEST"
