#!/bin/sh
# 把 p3-lyrics 装到 ~/.config/quickshell/p3lyrics/（已存在则先备份为 p3lyrics.bak-<时间>）。
# 不需要 sudo，不改 music、niri、DMS；接入 niri 见 AGENTS.md。
#   ./install.sh              安装到 ~/.config/quickshell/p3lyrics
#   DEST=/tmp/x ./install.sh  安装到别处（测试用）
set -eu

here=$(cd "$(dirname "$0")" && pwd)
dest=${DEST:-${XDG_CONFIG_HOME:-$HOME/.config}/quickshell/p3lyrics}

for f in NunitoSans-BlackItalic.ttf BarlowCondensed-Bold.ttf; do
    [ -f "$here/assets/fonts/$f" ] || { echo "缺少 assets/fonts/$f" >&2; exit 1; }
done
[ -f "$here/shell/shaders/wave.frag.qsb" ] || { echo "缺少 shell/shaders/wave.frag.qsb" >&2; exit 1; }

if [ -e "$dest" ]; then
    bak="$dest.bak-$(date +%Y%m%d-%H%M%S)"
    mv "$dest" "$bak"
    echo "已备份旧版本 → $bak"
fi

mkdir -p "$dest/assets/fonts" "$dest/shaders"
# capture.qml 只用来截帧调试，不装
for f in "$here"/shell/*.qml "$here"/shell/*.js; do
    [ "$(basename "$f")" = capture.qml ] || cp "$f" "$dest/"
done
cp "$here/shell/shaders/wave.frag" "$here/shell/shaders/wave.frag.qsb" "$dest/shaders/"
cp "$here"/assets/fonts/*.ttf "$here"/assets/fonts/*.txt "$here/assets/fonts/README.md" "$dest/assets/fonts/"

echo "已安装到 $dest"
echo "启动：qs -c p3lyrics -d"
echo "状态：qs ipc -c p3lyrics call p3lyrics status"
