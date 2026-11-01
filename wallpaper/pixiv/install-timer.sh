#!/usr/bin/env bash
# 安装/更新 systemd 用户定时任务
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

echo "==> 安装依赖 (requests, Pillow)"
python3 -m pip install --user -q -r "$HERE/requirements.txt" 2>/dev/null \
  || echo "   (pip 安装跳过，如已装 requests/Pillow 可忽略)"

echo "==> 复制 systemd 单元到 $UNIT_DIR"
mkdir -p "$UNIT_DIR"
cp "$HERE/systemd/pixiv-wallpaper.service" "$UNIT_DIR/"
cp "$HERE/systemd/pixiv-wallpaper.timer"   "$UNIT_DIR/"
cp "$HERE/systemd/pixiv-wallpaper-rotate.service" "$UNIT_DIR/"
cp "$HERE/systemd/pixiv-wallpaper-rotate.timer"   "$UNIT_DIR/"

chmod +x "$HERE/get-session.sh" "$HERE/run.sh" "$HERE/pixiv_wallpaper.py" 2>/dev/null || true

echo "==> 重载并启用定时器"
systemctl --user daemon-reload
systemctl --user enable --now pixiv-wallpaper.timer
systemctl --user enable --now pixiv-wallpaper-rotate.timer

# 允许用户服务在未登录时也运行（可选，桌面常驻可忽略）
if command -v loginctl >/dev/null 2>&1; then
  loginctl enable-linger "$USER" 2>/dev/null || true
fi

echo
systemctl --user --no-pager list-timers 'pixiv-wallpaper*'
echo
echo "查看日志:   journalctl --user -u pixiv-wallpaper -f"
echo "手动跑一次: systemctl --user start pixiv-wallpaper"
echo "手动换壁纸: systemctl --user start pixiv-wallpaper-rotate"
echo "立即停止:   systemctl --user disable --now pixiv-wallpaper.timer pixiv-wallpaper-rotate.timer"
