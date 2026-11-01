#!/usr/bin/env python3
# 把原型的 P3 字体（Nunito Sans 12pt Condensed Black Italic，woff2 子集）合成一个 ttf：
#   scripts/mkfont.py prototype/shared/fonts/<laLQ>.woff2 prototype/shared/fonts/<daLY50>.woff2 overlay/Modules/P3/assets/fonts/P3Display.ttf
# 可变字体先固定 opsz=12，再合并拉丁 + 拉丁扩展，改名为 "P3 Display" Italic 900。需要 python-fonttools + python-brotli。
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.merge import Merger
srcs, out = sys.argv[1:-1], sys.argv[-1]
tmp = []
for i, s in enumerate(srcs):
    f = TTFont(s)
    if 'fvar' in f:
        f = instancer.instantiateVariableFont(f, {"opsz": 12})
    f.flavor = None
    p = f"/tmp/p3font-part{i}.ttf"
    f.save(p); tmp.append(p)
m = Merger().merge(tmp)
name = m['name']
for rec in list(name.names):
    if rec.nameID in (1, 4, 6, 16, 17):
        name.removeNames(nameID=rec.nameID)
name.setName("P3 Display", 1, 3, 1, 0x409); name.setName("P3 Display", 1, 1, 0, 0)
name.setName("Italic", 2, 3, 1, 0x409); name.setName("Italic", 2, 1, 0, 0)
name.setName("P3 Display Italic", 4, 3, 1, 0x409); name.setName("P3Display-Italic", 6, 3, 1, 0x409)
m['OS/2'].usWeightClass = 900
m.save(out)
t = TTFont(out); print(out, t['name'].getDebugName(1), t['name'].getDebugName(2), len(t.getBestCmap()), t['OS/2'].usWeightClass)
