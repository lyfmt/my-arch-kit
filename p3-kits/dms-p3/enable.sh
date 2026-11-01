#!/usr/bin/env bash
# 启用 dms-p3：构建并安装 UI、让 niri 以 `dms run -c <dms-p3>` 启动、加 Mod+Z、立即重启 DMS
#
#   ./enable.sh               完整启用
#   ./enable.sh --no-build    跳过构建（已经 ./build.sh 过）
#   ./enable.sh --no-restart  只改配置，不立即重启 DMS（下次登录生效）
#
# 可以从任何状态切过来（原版 dms、dms-p5 或已启用的 dms-p3）：
#   - 第一次启用时把当前的 spawn-at-startup "dms" … 整行存到 ~/.local/share/dms-p3/prev-spawn，
#     disable.sh 原样写回（例如回到 dms-p5，而不是原版）
#   - 改前备份 ~/.config/niri/config.kdl → config.kdl.bak-dms-p3（已有备份就不覆盖）
#   - 其它 .kdl 里原来绑在 Mod+Z 上的节点（例如启动器）用 /- 注释掉并加标记，disable.sh 还原
#   - niri validate 不过就还原改过的 niri 文件并退出
# 不改 DMS 的 settings.json。还原见 ./disable.sh。
set -euo pipefail

PKG="$(cd "$(dirname "$0")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/dms-p3"
SHELL_DIR="$DATA/shell"
NIRI_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/niri"
NIRI_CFG="$NIRI_DIR/config.kdl"
BUILD=1
RESTART=1

for a in "$@"; do
    case "$a" in
    --no-build) BUILD=0 ;;
    --no-restart) RESTART=0 ;;
    -h | --help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "未知参数：$a" >&2; exit 2 ;;
    esac
done

[ "$BUILD" = 1 ] && "$PKG/build.sh"
[ -f "$SHELL_DIR/shell.qml" ] || { echo "enable: $SHELL_DIR 不存在，先运行 ./build.sh" >&2; exit 1; }

# DMS 2.0 的 UI 启动时会把 settings.json 迁移到新版格式（configVersion 18 → 42，改写 barConfigs、删旧键），
# 迁移后 1.6.3 的 UI（dms-p5）读不对。第一次启用时存一份原样，disable.sh 停掉 DMS 后写回。
DMS_SETTINGS="${XDG_CONFIG_HOME:-$HOME/.config}/DankMaterialShell/settings.json"
mkdir -p "$DATA"
if [ ! -f "$DATA/prev-spawn" ] && [ ! -f "$DATA/prev-settings.json" ] && [ -f "$DMS_SETTINGS" ]; then
    cp "$DMS_SETTINGS" "$DATA/prev-settings.json"
    echo "enable: DMS 设置已存到 $DATA/prev-settings.json"
fi

if [ -f "$NIRI_CFG" ]; then
    [ -f "$NIRI_CFG.bak-dms-p3" ] || cp "$NIRI_CFG" "$NIRI_CFG.bak-dms-p3"
    SNAP="$(mktemp -d)"
    cp "$PKG/niri/dms-p3.kdl" "$NIRI_DIR/dms-p3.kdl"
    mkdir -p "$DATA"
    python3 -I - "$NIRI_CFG" "$SHELL_DIR" "$DATA/prev-spawn" "$NIRI_DIR" "$SNAP" <<'EOF'
import os, re, shutil, sys
path, shell, prev, niri_dir, snap = sys.argv[1:6]

def save(p):
    dst = os.path.join(snap, os.path.relpath(p, niri_dir))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst):
        shutil.copy2(p, dst)

save(path)
s = open(path).read()
ours = f'spawn-at-startup "dms" "run" "-c" "{shell}"'
pat = re.compile(r'^([ \t]*)(spawn-at-startup\s+"dms"\s+"run"[^\n]*)$', re.M)
m = pat.search(s)
if m:
    old = m.group(2).rstrip()
    # 只在第一次（当前还不是 dms-p3）时记下原来的行；重复 enable 不会把 dms-p3 自己记成“原来的”
    if old != ours and not os.path.exists(prev):
        open(prev, "w").write(old + "\n")
    s = s[:m.start()] + m.group(1) + ours + s[m.end():]
else:
    if not os.path.exists(prev):
        open(prev, "w").write("\n")   # 空行 = 原来没有 DMS 自启，disable 时删掉我们这行
    s += "\n" + ours + "\n"
inc = 'include "dms-p3.kdl"'
if not re.search(r'^\s*include\s+"dms-p3\.kdl"', s, re.M):
    s = s.rstrip("\n") + "\n\n// dms-p3 系统菜单\n" + inc + "\n"
open(path, "w").write(s)

# 菜单键取自 dms-p3.kdl；其它 .kdl 里绑同一个键的节点整个用 KDL 的 /- 注释掉（含多行的 { … }）
ours = os.path.join(niri_dir, "dms-p3.kdl")
key = re.search(r'^[ \t]*(\S+)[ \t].*"p3menu"', open(ours).read(), re.M).group(1)
bind = re.compile(r'^([ \t]*)(' + re.escape(key) + r'(?=[\s{]))', re.M | re.I)
mark = f"// dms-p3: {key} 让给 P3 菜单（disable.sh 还原）"
for d, _, files in os.walk(niri_dir):
    for fn in sorted(files):
        p = os.path.join(d, fn)
        if not fn.endswith(".kdl") or os.path.samefile(p, ours):
            continue
        t = open(p).read()
        u = bind.sub(lambda m: f"{m.group(1)}{mark}\n{m.group(1)}/-{m.group(2)}", t)
        if u != t:
            save(p)
            open(p, "w").write(u)
            print(f"enable: {os.path.relpath(p, niri_dir)} 里原来的 {key} 已注释掉")
EOF
    if ! niri validate -c "$NIRI_CFG" >/dev/null 2>&1; then
        cp -a "$SNAP/." "$NIRI_DIR/"
        rm -rf "$SNAP"
        echo "enable: niri validate 失败，已还原改过的 niri 文件" >&2
        exit 1
    fi
    rm -rf "$SNAP"
    echo "enable: niri → $(grep -n 'spawn-at-startup "dms"' "$NIRI_CFG")"
    echo "enable: 原来的启动行已存到 $DATA/prev-spawn：$(cat "$DATA/prev-spawn")"
fi

# 立即切换。DMS_GREETER_AUTH_TIME 设为未来时间，让这次重启（及之后的热重载）不触发“启动时锁屏”。
# 只停 dms 进程本身（它会带走自己的 qs）；看板、音乐卡片等独立 qs 实例不受影响。
if [ "$RESTART" = 1 ]; then
    pkill -x dms 2>/dev/null || true
    for _ in $(seq 50); do pgrep -x dms >/dev/null || break; sleep 0.1; done
    DMS_GREETER_AUTH_TIME=4102444800 setsid -f dms run -c "$SHELL_DIR" >/dev/null 2>&1 </dev/null
    echo "enable: DMS 已以 dms-p3 重启（Mod+Z 打开菜单）"
fi
