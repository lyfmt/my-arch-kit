#!/usr/bin/env python3
# 从 prototype/shared/menu.js 的 GLYPHS 生成 overlay/Modules/P3/P3Glyphs.js（QML PathSvg 只吃 path 数据：
# circle / rect 转成 path；class="f" 的是填充部分，其余是描边部分）。
import json, re, sys
src = open(sys.argv[1]).read()
block = src[src.index("const GLYPHS = {"):]
block = block[:block.index("};")]
out = {}
def circ(cx, cy, r):
    return f"M{cx-r:g} {cy:g}A{r:g} {r:g} 0 1 0 {cx+r:g} {cy:g}A{r:g} {r:g} 0 1 0 {cx-r:g} {cy:g}Z"
def rect(x, y, w, h, rx):
    if not rx:
        return f"M{x:g} {y:g}h{w:g}v{h:g}h{-w:g}z"
    rx = min(rx, w / 2, h / 2)
    return (f"M{x+rx:g} {y:g}H{x+w-rx:g}A{rx:g} {rx:g} 0 0 1 {x+w:g} {y+rx:g}V{y+h-rx:g}"
            f"A{rx:g} {rx:g} 0 0 1 {x+w-rx:g} {y+h:g}H{x+rx:g}A{rx:g} {rx:g} 0 0 1 {x:g} {y+h-rx:g}"
            f"V{y+rx:g}A{rx:g} {rx:g} 0 0 1 {x+rx:g} {y:g}Z")
for name, body in re.findall(r"^\s*(\w+):\s*'(.*)',\s*$", block, re.M):
    s, f = [], []
    for tag in re.findall(r"<(path|circle|rect)\b([^>]*)/>", body):
        kind, attrs = tag
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', attrs))
        fill = a.get("class") == "f"
        if kind == "path":
            d = a["d"]
        elif kind == "circle":
            d = circ(float(a["cx"]), float(a["cy"]), float(a["r"]))
        else:
            d = rect(float(a["x"]), float(a["y"]), float(a["width"]), float(a["height"]), float(a.get("rx", 0)))
        (f if fill else s).append(d)
    out[name] = {"s": " ".join(s), "f": " ".join(f)}
with open(sys.argv[2], "w") as fh:
    fh.write(".pragma library\n// 生成文件：scripts/mkglyphs.py prototype/shared/menu.js overlay/Modules/P3/P3Glyphs.js\n")
    fh.write("// 24 网格线性图标。s = 描边路径（stroke 2，square cap，miter join），f = 填充路径。\n")
    fh.write("var GLYPHS = {\n")
    for k, v in out.items():
        fh.write(f"    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},\n")
    fh.write("};\n")
print(len(out), "glyphs")
