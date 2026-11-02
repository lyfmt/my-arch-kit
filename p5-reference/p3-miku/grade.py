"""把 miku_p3.png 的平涂角色重新上色成渐变，输出 bg.png（2x）。

用法: python grade.py [src] [dst]
思路:
  1. 水是纯竖直渐变 → 每行取右侧中位数得到水色 W(y)，和 W(y) 很接近的像素当作水，不动。
  2. 白底/皮肤（低饱和高亮）也不动，只在靠近头发处给一点冷色渐变。
  3. 剩下的就是头发/衣领：
     - 掩膜内归一化模糊，把碎色块揉开（线稿和领带排除在外）
     - 按亮度做渐变映射，映射表随位置在“近水面(亮青)”和“近头部(深靛)”之间插值
     - 与白底相接的边缘加一圈亮边
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else "../p3-menu/miku_p3.png"
DST = sys.argv[2] if len(sys.argv) > 2 else "bg.png"
S = 2  # 输出倍率

src = Image.open(SRC).convert("RGB")
W0, H0 = src.size
img = src.resize((W0 * S, H0 * S), Image.LANCZOS)
A = np.asarray(img).astype(np.float32) / 255
H, W = A.shape[:2]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def _box(a, r, axis):
    """沿 axis 做半径 r 的盒式模糊（边缘复制）"""
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def blur(a, sigma):
    """三次盒式模糊近似高斯，sigma 单位为像素"""
    r = max(1, int(round(sigma * 0.95)))
    for _ in range(3):
        a = _box(_box(a, r, 0), r, 1)
    return a


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def poly_mask(pts, feather):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon([(x * S, y * S) for x, y in pts], fill=255)
    return blur(np.asarray(m).astype(np.float32) / 255, feather * S)


mx, mn = A.max(2), A.min(2)
sat = (mx - mn) / np.maximum(mx, 1e-4)

# ---- 水 ----
water_row = np.median(A[:, int(W * 0.86):], axis=1)           # (H,3)
dist = np.linalg.norm(A - water_row[:, None, :], axis=2)
zone = poly_mask([(0, 0), (670, 0), (575, 110), (510, 260), (488, 420), (482, 560),
                  (470, 720), (0, 720)], 12)                       # 角色所在区域
waterish = np.maximum(1 - zone, np.exp(-(dist / 0.07) ** 2))

# ---- 白 ----
white = smooth(0.22, 0.08, sat) * smooth(0.78, 0.93, mx)
line = smooth(0.38, 0.22, mx)                                       # 线稿/领带暗部
tie = poly_mask([(352, 478), (392, 470), (432, 598), (398, 606)], 3)
eye = poly_mask([(232, 548), (310, 548), (312, 592), (232, 592)], 6)  # 眼睛保持原样

hair = np.clip((1 - white) * (1 - waterish) * zone * (1 - eye), 0, 1)
soft = hair * (1 - line) * (1 - tie)

# ---- 1. 掩膜内归一化模糊：把碎色块揉成过渡 ----
r = 4 * S
B = blur(A * soft[..., None], r) / np.maximum(blur(soft, r), 1e-3)[..., None]
A1 = A + (B - A) * (0.3 * soft)[..., None]

# ---- 2. 位置相关的渐变映射 ----
# 光场：上方（水面）与右侧（水体反光）更亮，越往下、越靠头部越深
L = np.clip(1.15 - yy / H * 1.25 + (xx / W - 0.25) * 0.55, 0, 1)
L = smooth(0, 1, L)
v = np.clip(A1[..., 0] * 0.30 + A1[..., 1] * 0.60 + A1[..., 2] * 0.10, 0, 1)

stops = np.array([0.04, 0.24, 0.52, 0.66, 0.88])
lit = np.array([[18, 84, 232], [6, 156, 252], [0, 218, 255], [44, 238, 255], [172, 250, 255]]) / 255
deep = np.array([[16, 6, 96], [16, 34, 178], [0, 132, 230], [0, 194, 246], [108, 224, 252]]) / 255


def ramp(table):
    return np.dstack([np.interp(v, stops, table[:, c]) for c in range(3)])


G = ramp(deep) + (ramp(lit) - ramp(deep)) * L[..., None]
# 再叠一层大尺度的明暗起伏，让同一色块内部也有深浅
wave = blur(v, 26 * S) - blur(v, 70 * S)
G = np.clip(G + wave[..., None] * 0.55, 0, 1)
A2 = A1 + (G - A1) * (0.85 * hair * (1 - line * 0.7) * (1 - tie))[..., None]

# ---- 3. 与白底相接处的亮边 ----
rim = np.clip(blur(white * zone, 2 * S) * 2 - 0.2, 0, 1) * hair
A2 = A2 + (np.array([0.80, 1.0, 1.0]) - A2) * (rim * 0.35)[..., None]

# ---- 4. 白底靠近头发/水的地方带一点冷色 ----
near = blur(1 - white, 40 * S)
tint = np.array([214, 238, 255]) / 255
A2 = A2 + (tint - A2) * (white * smooth(0.1, 0.7, near) * 0.14)[..., None]

out = Image.fromarray((np.clip(A2, 0, 1) * 255 + 0.5).astype(np.uint8))
out.save(DST, optimize=True)
print("wrote", DST, out.size)
