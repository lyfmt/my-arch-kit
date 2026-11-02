#!/usr/bin/env python3
# 从 dms 二进制（Go embed.FS，amd64 ELF）里解出内置 UI（dist/...）。
#   scripts/extract-embedded.py /usr/bin/dms <输出目录>
# build.sh 在没有缓存或 --extract 时调用；结果与 `make sync-shell` 生成的 dist 相同（含 .dankrev）。
import struct, sys, os
binp, out = sys.argv[1:3]
b = open(binp, 'rb').read()
assert b[:4] == b'\x7fELF'
phoff = struct.unpack_from('<Q', b, 0x20)[0]; phentsize, phnum = struct.unpack_from('<HH', b, 0x36)
segs = []
for i in range(phnum):
    o = phoff + i*phentsize
    ptype, flags, off, va, pa, fsz, msz, al = struct.unpack_from('<IIQQQQQQ', b, o)
    if ptype == 1: segs.append((va, off, fsz))
def va2off(va):
    for sva, off, fsz in segs:
        if sva <= va < sva+fsz: return off + va - sva
    return None
def off2va(o):
    for sva, off, fsz in segs:
        if off <= o < off+fsz: return sva + o - off
    return None
name = b'dist/shell.qml'
pos = 0; entry = None
while True:
    pos = b.find(name, pos)
    if pos < 0: break
    va = off2va(pos)
    if va:
        pat = struct.pack('<QQ', va, len(name))
        e = b.find(pat)
        if e >= 0: entry = e; break
    pos += 1
assert entry is not None, "entry not found"
ES = 48
def read(e):
    np_, nl, dp, dl = struct.unpack_from('<QQQQ', b, e)
    no = va2off(np_)
    if no is None or nl == 0 or nl > 4096: return None
    n = b[no:no+nl]
    if not n.startswith(b'dist'): return None
    d = b''
    if dl:
        do = va2off(dp)
        if do is None: return None
        d = b[do:do+dl]
    return n.decode(), d
start = entry
while read(start-ES): start -= ES
cnt = 0; e = start
while True:
    r = read(e)
    if not r: break
    n, d = r
    if not n.endswith('/'):
        p = os.path.join(out, n[len('dist/'):])
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(d); cnt += 1
    e += ES
print("extracted", cnt, "files to", out)
