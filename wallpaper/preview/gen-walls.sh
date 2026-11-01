#!/usr/bin/env bash
# 生成 preview/ 用的样例数据：从壁纸库随机取 N 张（默认 18），缩到 1600px 宽写入 walls/，并写 data.js。
# walls/ 与 data.js 都是本机生成物（Pixiv 作品），已被 .gitignore 忽略，不要提交。
# 用法: ./gen-walls.sh [N]
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
backend="$here/../shell/scripts/wallpaper-backend"
n=${1:-18}
command -v magick >/dev/null || { echo "需要 imagemagick (magick)" >&2; exit 1; }
rm -rf "$here/walls"; mkdir -p "$here/walls"
"$backend" list | python3 -c '
import json, random, subprocess, sys
here, n = sys.argv[1], int(sys.argv[2])
items = json.load(sys.stdin)["items"]
random.shuffle(items)
out = []
for it in items[:n]:
    f = "w%02d.jpg" % (len(out) + 1)
    r = subprocess.run(["magick", it["path"] + "[0]", "-resize", "1600x>", "-quality", "86", here + "/walls/" + f])
    if r.returncode:
        continue
    out.append({"f": f, "pid": it["pid"], "page": it["page"], "title": it["title"], "ext": it["ext"]})
with open(here + "/data.js", "w", encoding="utf-8") as fh:
    fh.write("const WALLS=" + json.dumps(out, ensure_ascii=False) + ";\n")
print("wrote %d walls" % len(out))
' "$here" "$n"
