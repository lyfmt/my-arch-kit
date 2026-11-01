#!/usr/bin/env bash
# 截取某个输出到 PNG（ScreencopyView，不碰剪贴板、不切焦点）。开发用。
#   scripts/grab.sh [名字] [输出名，默认 eDP-1]   → /tmp/p3shots/<名字>.png
#   P3_CROP=WxH+X+Y   按逻辑像素裁剪（需要 ImageMagick）
set -euo pipefail
PKG="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p /tmp/p3shots
OUT="/tmp/p3shots/${1:-grab}.png"
P3_SCREEN="${2:-eDP-1}" P3_OUT="$OUT" timeout 10 qs -p "$PKG/preview/grab" >/tmp/p3grab.log 2>&1 || { tail -5 /tmp/p3grab.log; exit 1; }
if command -v magick >/dev/null; then
    LW="$(niri msg -j outputs | python3 -I -c 'import json,sys; o=json.load(sys.stdin)[sys.argv[1]]; print(o["logical"]["width"])' "${2:-eDP-1}")"
    magick "$OUT" -resize "${LW}x" ${P3_CROP:+-crop "$P3_CROP" +repage} "$OUT"
fi
echo "$OUT"
