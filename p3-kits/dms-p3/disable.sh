#!/usr/bin/env bash
# 还原：niri 的 DMS 启动行改回启用 dms-p3 之前的那一行（存在 ~/.local/share/dms-p3/prev-spawn，
# 例如 dms-p5），去掉 include "dms-p3.kdl"，恢复 enable.sh 注释掉的原 Mod+Z 绑定，然后按那一行重启 DMS。
# 不删除 ~/.local/share/dms-p3（可随时 ./enable.sh --no-build 再切回来）。
#
#   ./disable.sh               还原并立即重启
#   ./disable.sh --no-restart  只改配置
set -euo pipefail

DATA="${XDG_DATA_HOME:-$HOME/.local/share}/dms-p3"
NIRI_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/niri"
NIRI_CFG="$NIRI_DIR/config.kdl"
PREV="$DATA/prev-spawn"
RESTART=1

for a in "$@"; do
    case "$a" in
    --no-restart) RESTART=0 ;;
    -h | --help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "未知参数：$a" >&2; exit 2 ;;
    esac
done

# 没有记录时退回原版 `dms run`
prev_line='spawn-at-startup "dms" "run"'
[ -f "$PREV" ] && prev_line="$(cat "$PREV")"

if [ -f "$NIRI_CFG" ]; then
    SNAP="$(mktemp -d)"
    python3 -I - "$NIRI_CFG" "$prev_line" "$NIRI_DIR" "$SNAP" <<'EOF'
import os, re, shutil, sys
path, prev, niri_dir, snap = sys.argv[1:5]

def save(p):
    dst = os.path.join(snap, os.path.relpath(p, niri_dir))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst):
        shutil.copy2(p, dst)

save(path)
s = open(path).read()
pat = re.compile(r'^([ \t]*)spawn-at-startup\s+"dms"\s+"run"\s+"-c"\s+"[^"]*/dms-p3/shell"[ \t]*\n?', re.M)
if prev.strip():
    s = pat.sub(lambda m: m.group(1) + prev.strip() + "\n", s, count=1)
else:
    s = pat.sub("", s, count=1)
s = re.sub(r'\n*// dms-p3 系统菜单(（[^）\n]*）)?\n', "\n", s)
s = re.sub(r'^[ \t]*include\s+"dms-p3\.kdl"[ \t]*\n?', "", s, flags=re.M)
open(path, "w").write(s)

mark = re.compile(r'^([ \t]*)// dms-p3: \S+ 让给 P3 菜单（disable\.sh 还原）\n[ \t]*/-', re.M)
for d, _, files in os.walk(niri_dir):
    for fn in sorted(files):
        p = os.path.join(d, fn)
        if not fn.endswith(".kdl"):
            continue
        t = open(p).read()
        u = mark.sub(r"\1", t)
        if u != t:
            save(p)
            open(p, "w").write(u)
            print(f"disable: 已恢复 {os.path.relpath(p, niri_dir)} 里原来的绑定")
EOF
    if ! niri validate -c "$NIRI_CFG" >/dev/null 2>&1; then
        cp -a "$SNAP/." "$NIRI_DIR/"
        rm -rf "$SNAP"
        echo "disable: niri validate 失败，已还原改过的 niri 文件" >&2
        exit 1
    fi
    rm -rf "$SNAP" "$NIRI_DIR/dms-p3.kdl"
    echo "disable: niri → $(grep -n 'spawn-at-startup "dms"' "$NIRI_CFG" || echo '（无 DMS 自启）')"
fi
rm -f "$PREV"

# 写回启用前的 DMS 设置（enable.sh 存的，2.0 迁移前的格式）。必须在 DMS 停下之后写：
# 在跑的 2.0 UI 监视着这个文件，会立刻再迁移一次。dms-p3 期间的设置另存为 settings.json.dms-p3-<时间>。
DMS_SETTINGS="${XDG_CONFIG_HOME:-$HOME/.config}/DankMaterialShell/settings.json"
restore_settings() {
    [ -f "$DATA/prev-settings.json" ] || return 0
    [ -f "$DMS_SETTINGS" ] && cp "$DMS_SETTINGS" "$DMS_SETTINGS.dms-p3-$(date +%Y%m%d%H%M%S)"
    cp "$DATA/prev-settings.json" "$DMS_SETTINGS"
    rm -f "$DATA/prev-settings.json"
    echo "disable: DMS 设置已还原为启用 dms-p3 之前的版本"
}

if [ "$RESTART" = 1 ]; then
    # 从启动行里取出 `dms run` 之后的参数（例如 -c ~/.local/share/dms-p5/shell）
    mapfile -t args < <(python3 -I -c 'import re,sys; print("\n".join(re.findall(r"\"([^\"]*)\"", sys.argv[1])[2:]))' "$prev_line" | sed '/^$/d')
    pkill -x dms 2>/dev/null || true
    for _ in $(seq 50); do pgrep -x dms >/dev/null || break; sleep 0.1; done
    restore_settings
    if [ -n "${prev_line// /}" ]; then
        DMS_GREETER_AUTH_TIME=4102444800 setsid -f dms run "${args[@]}" >/dev/null 2>&1 </dev/null
        echo "disable: 已按原来的启动行重启 DMS（dms run ${args[*]}）"
    else
        echo "disable: 原来没有 DMS 自启，未启动 DMS"
    fi
elif [ -f "$DATA/prev-settings.json" ]; then
    echo "disable: --no-restart：DMS 设置没有还原（在跑的 dms-p3 会再次迁移它）。停掉 DMS 后执行：" >&2
    echo "    cp $DATA/prev-settings.json $DMS_SETTINGS" >&2
fi
