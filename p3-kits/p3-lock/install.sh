#!/bin/sh
# 把 p3-lock 装到 ~/.config/quickshell/p3lock/（已存在则先备份为 p3lock.bak-<时间>）。
# 不需要 sudo：PAM 配置由 PamContext.configDirectory 从安装目录的 pam/ 读取，不用写 /etc/pam.d。
# 不改 DMS 设置；接入 DMS 见 INTEGRATION.md 第 6 节（customPowerActionLock 指向 p3lock.sh）。
#   ./install.sh            安装到 ~/.config/quickshell/p3lock
#   DEST=/tmp/x ./install.sh  安装到别处（测试用）
set -eu

here=$(cd "$(dirname "$0")" && pwd)
dest=${DEST:-${XDG_CONFIG_HOME:-$HOME/.config}/quickshell/p3lock}

[ -f "$here/assets/bg.png" ] || echo "注意：缺少 assets/bg.png（不进 git），锁屏会落在纯色底上。见 AGENTS.md。" >&2
[ -f "$here/assets/fonts/NunitoSans-BlackItalic.ttf" ] || { echo "缺少 assets/fonts/NunitoSans-BlackItalic.ttf" >&2; exit 1; }

if [ -e "$dest" ]; then
    bak="$dest.bak-$(date +%Y%m%d-%H%M%S)"
    mv "$dest" "$bak"
    echo "已备份旧版本 → $bak"
fi

mkdir -p "$dest/assets/fonts" "$dest/pam" "$dest/shaders"
cp "$here"/shell/*.qml "$dest/"
cp "$here/shell/p3lock.sh" "$dest/"
chmod 755 "$dest/p3lock.sh"
cp "$here/shell/pam/p3lock" "$dest/pam/"
cp "$here/shell/shaders/water.frag" "$here/shell/shaders/water.frag.qsb" "$dest/shaders/"
cp "$here"/assets/fonts/*.ttf "$here"/assets/fonts/*.txt "$here/assets/fonts/README.md" "$dest/assets/fonts/"
[ -f "$here/assets/bg.png" ] && cp "$here/assets/bg.png" "$dest/assets/"

echo "已安装到 $dest"
echo "预览（不锁屏）：qs -p $dest/demo.qml"
echo "启动锁屏：      $dest/p3lock.sh"
