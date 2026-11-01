#!/usr/bin/env bash
# 手动跑一轮（带文件锁，防止与定时任务/多个实例重叠）
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec flock -n "$HERE/.run.lock" \
  python3 "$HERE/pixiv_wallpaper.py" --once "$@"
