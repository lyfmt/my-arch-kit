#!/usr/bin/env bash
# 诊断：在一个无头 sway（wlroots headless 后端，虚拟 1920x1080 输出）里用 `qs -p` 跑一遍构建好的 UI，收集 QML 警告。
# 不在用户的 niri 里开任何窗口，不停、不碰正在运行的 DMS：
#   - 无头 sway 不连接用户的 Wayland，自带 WAYLAND_DISPLAY / SWAYSOCK；去掉 NIRI_SOCKET，DMS 不会连到真 niri
#   - 依赖：sway、grim（截图）
#   - 独立的 dbus 会话（dbus-run-session）：不抢真 DMS 的通知服务、托盘、MPRIS 名字
#   - XDG_CONFIG/STATE/CACHE 指向临时目录，先复制一份 settings.json / session.json 进去，真配置不会被写
#   - 不设 DMS_SOCKET（DMS 后端相关服务保持未连接）；DMS_GREETER_AUTH_TIME 跳过启动锁屏
#
#   scripts/qmlcheck.sh [UI 目录，默认 ~/.local/share/dms-p3/shell] [秒数，默认 20]
#   P3_IPC="p3menu open status" scripts/qmlcheck.sh …   目标注册后在嵌套实例里调用 IPC（多条用 ; 分隔），之后再跑 [秒数]
#   P3_SHOT=/tmp/p3shots/x.png …                        IPC 之后再等 3 秒截取虚拟输出的画面
#   P3_CHECK_DIR=/tmp/p3check-x …                        换工作目录（几个检查并行跑时各用一个）
# 日志全文：$P3_CHECK_DIR/qs.log（默认 /tmp/p3check）；输出只列 WARN/ERROR 中与 qml 相关的行（去重）。
set -euo pipefail
PKG="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:-${XDG_DATA_HOME:-$HOME/.local/share}/dms-p3/shell}"
SECS="${2:-20}"
DIR="$(cd "$DIR" && pwd)"
[ -f "$DIR/shell.qml" ] || { echo "qmlcheck: $DIR 里没有 shell.qml" >&2; exit 1; }

W="${P3_CHECK_DIR:-/tmp/p3check}"
rm -rf "$W"
mkdir -p "$W"/{config,state,cache,data,run}
chmod 700 "$W/run"
REAL_CFG="${XDG_CONFIG_HOME:-$HOME/.config}"
REAL_STATE="${XDG_STATE_HOME:-$HOME/.local/state}"
mkdir -p "$W/config/dms" "$W/state/dms"
cp "$REAL_CFG/DankMaterialShell/settings.json" "$W/config/dms/" 2>/dev/null || true
cp "$REAL_STATE/DankMaterialShell/session.json" "$W/state/dms/" 2>/dev/null || true
ln -s dms "$W/config/DankMaterialShell"
ln -s dms "$W/state/DankMaterialShell"
cp "$REAL_CFG/fcitx5" -r "$W/config/" 2>/dev/null || true
# 无头 sway 的配置：一块 1920x1080 的虚拟输出，启动后跑 inner.sh
printf 'output HEADLESS-1 resolution 1920x1080 position 0 0 scale 1\ndefault_border none\nexec %s/inner.sh\n' "$W" >"$W/sway.conf"

# 嵌套会话里跑的脚本：等 qs 起来、按需调 IPC / 截图，到时间就结束（sway 随之退出）
cat >"$W/inner.sh" <<'EOF'
#!/usr/bin/env bash
cd /tmp
qs -p "$P3_DIR" >"$P3_W/qs.log" 2>&1 </dev/null &
QS=$!
echo "$QS" >"$P3_W/qs.pid"
if [ -n "${P3_IPC:-}" ]; then
    # 等目标注册（DMSShell 异步加载，冷启动要 10 秒以上），最多 40 秒
    tgt="${P3_IPC%% *}"
    for _ in $(seq 80); do
        qs -p "$P3_DIR" ipc show 2>/dev/null | grep -q "^target $tgt\$" && break
        sleep 0.5
    done
    sleep 2
    # 多条命令用 ; 分隔，例如 P3_IPC="p3menu open status;p3menu status"
    IFS=';' read -ra CALLS <<<"$P3_IPC"
    for c in "${CALLS[@]}"; do
        # shellcheck disable=SC2086
        { echo "> $c"; qs -p "$P3_DIR" ipc call $c; } >>"$P3_W/ipc.log" 2>&1 || true
        sleep 1
    done
    if [ -n "${P3_SHOT:-}" ]; then
        sleep 3
        mkdir -p "$(dirname "$P3_SHOT")"
        grim -o HEADLESS-1 "$P3_SHOT" >/dev/null 2>&1 || true
        sleep 1.5
    fi
fi
END=$((SECONDS + P3_SECS))
[ -n "${P3_IPC:-}" ] || END=$P3_SECS
while kill -0 "$QS" 2>/dev/null && [ "$SECONDS" -lt "$END" ]; do sleep 0.5; done
kill "$QS" 2>/dev/null || true
sleep 0.5
kill -9 "$QS" 2>/dev/null || true
swaymsg exit >/dev/null 2>&1 || true
EOF
chmod +x "$W/inner.sh"

env -u DMS_SOCKET -u QS_CONFIG_PATH -u NIRI_SOCKET -u WAYLAND_DISPLAY -u DISPLAY -u SWAYSOCK -u HYPRLAND_INSTANCE_SIGNATURE \
    WLR_BACKENDS=headless WLR_HEADLESS_OUTPUTS=1 WLR_LIBINPUT_NO_DEVICES=1 XDG_CURRENT_DESKTOP=sway \
    XDG_CONFIG_HOME="$W/config" XDG_STATE_HOME="$W/state" XDG_CACHE_HOME="$W/cache" \
    DMS_DISABLE_POLKIT=1 DMS_DISABLE_MATUGEN=1 DMS_GREETER_AUTH_TIME=4102444800 \
    P3_DIR="$DIR" P3_W="$W" P3_SECS="$SECS" P3_IPC="${P3_IPC:-}" P3_SHOT="${P3_SHOT:-}" \
    timeout $((SECS + 60)) dbus-run-session -- sway -c "$W/sway.conf" >"$W/sway.log" 2>&1 || true

# 兜底：只结束我们自己启动的那个 qs（按记录的 pid 且命令行指向本次目录）
if [ -f "$W/qs.pid" ]; then
    p="$(cat "$W/qs.pid")"
    if [ -r "/proc/$p/cmdline" ] && tr '\0' ' ' <"/proc/$p/cmdline" | grep -q -- "-p $DIR"; then
        kill "$p" 2>/dev/null || true
    fi
fi

[ -s "$W/ipc.log" ] && { echo "--- ipc: ${P3_IPC:-}"; cat "$W/ipc.log"; }
[ -n "${P3_SHOT:-}" ] && { [ -f "$P3_SHOT" ] && echo "--- 截图：$P3_SHOT" || echo "--- 截图失败（见 $W/sway.log）"; }
echo "--- QML 警告（全文 $W/qs.log）"
sed 's/\x1b\[[0-9;]*m//g' "$W/qs.log" | grep -E '(WARN|ERROR|CRIT).*(qml|scene|file://|Error|TypeError|ReferenceError)|TypeError|ReferenceError|is not defined|Cannot (read|assign)|Unable to|failed to load|module .* not installed|is not a type' |
    sed -E 's/^ *[0-9:.]+ *//' | sort | uniq -c | sort -rn | head -80 || true
