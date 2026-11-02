#!/usr/bin/env bash
# 从 agent-chrome 专用浏览器的登录态中提取 pixiv.pictures 的 PHPSESSID。
# 登录态保存在 ~/.config/chromium-agent/ 的 localStorage["PXV_NOW_COOKIE"] 里，
# 只要之前在该浏览器登录过 pixiv.pictures，这里就能直接复用（与浏览器是否开着无关）。
#
# 输出: 一行 `PHPSESSID=xxxxxxxx_yyyy`
set -euo pipefail

PORT="${PIXIV_CDP_PORT:-9222}"
URL="https://pixiv.pictures/following"

# 1) 确保专用浏览器在运行（按需自愈）
if ! curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  systemctl --user start agent-chrome >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

# 2) 打开（或复用）pixiv.pictures 页面，确保 localStorage 可读
if ! curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "agent-chrome (CDP:${PORT}) 未就绪" >&2
  exit 1
fi
agent-browser --cdp "${PORT}" open "${URL}" >/dev/null 2>&1 || true
sleep 1

# 3) 读取 localStorage 并解析
RAW="$(agent-browser --cdp "${PORT}" eval "localStorage.getItem('PXV_NOW_COOKIE')" 2>/dev/null || true)"

python3 - "${RAW}" <<'PY'
import json, sys

raw = sys.argv[1] if len(sys.argv) > 1 else ""
try:
    inner = json.loads(raw)               # agent-browser 把返回值序列化成 JSON 字符串
    data = json.loads(inner)["data"]      # {"data": "PHPSESSID=...", "expires": ...}
    if not data.startswith("PHPSESSID="):
        raise ValueError(data)
    print(data)
except Exception as exc:  # noqa: BLE001
    sys.stderr.write(
        "无法从浏览器读取 pixiv.pictures 登录态。\n"
        "请从应用菜单打开 “Agent Chrome”，登录一次 pixiv.pictures 后重试。\n"
        f"原因: {exc}\n"
    )
    sys.exit(1)
PY
