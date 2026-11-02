#version 440
// 水线 + 浪刃，对应 index.html 的 .wvc（overflow hidden + 横向 mask-image）里的 .base 和 .blade SVG。
// 坐标单位：.wvc 盒子内的舞台像素（宽 W = run + w + over，高 WH = 24）。
// 改完用 /usr/lib/qt6/bin/qsb --qt6 -o wave.frag.qsb wave.frag 重新编译
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;   // .wvc 的 opacity（退场时淡掉）
    vec2 size;          // (W, 24)
    vec2 maskP;         // 遮罩：0 → p0 淡入，p0 → p1 不透明，p1 → W 淡出（px）
    float baseOp;       // .base 的 opacity（.18 / 浅背景 .3）
    vec4 cMain;         // --main
    vec4 cSub;          // --sub（水线颜色）
    vec4 cRed;          // --red
    vec4 b0;            // 浪刃：x = 浪峰位置（px），y = 浪峰高出水线 h，z = opacity，w = 色调 0 main / 1 sub / 2 red，z<0 表示未用
    vec4 b1;
    vec4 b2;
    vec4 b3;
};

const float WY = 18.0;      // 水线在容器内的 y
const float LW = 1.2;       // 水线粗细
const float L = 380.0;      // 浪刃长度
const float CREST = 0.82;   // 浪峰在 .82L 处
const float CUT = 18.0;     // 前缘斜切

// 一段 [a, b] 区间在像素 p 上的覆盖率（按屏幕导数做 1px 抗锯齿）
float span(float p, float a, float b, float fw) {
    return clamp((p - a) / fw + 0.5, 0.0, 1.0) * clamp((b - p) / fw + 0.5, 0.0, 1.0);
}

// SVG 路径上沿：M0 y C(.55c, y)(.8c, y-h)(c, y-h) L(c+10, y-h) L(c+10+cut, y+1.2) L0 y+1.2 Z
float bladeTop(float x, float h) {
    float c = CREST * L;
    if (x <= c) {
        // 三次贝塞尔的 x(t) 单调，二分求 t
        float lo = 0.0, hi = 1.0;
        for (int i = 0; i < 14; i++) {
            float t = 0.5 * (lo + hi);
            float u = 1.0 - t;
            float bx = 3.0 * u * u * t * 0.55 * c + 3.0 * u * t * t * 0.8 * c + t * t * t * c;
            if (bx < x) lo = t; else hi = t;
        }
        float t = 0.5 * (lo + hi);
        float u = 1.0 - t;
        return WY - h * (3.0 * u * t * t + t * t * t);
    }
    if (x <= c + 10.0) return WY - h;
    return WY - h + (x - c - 10.0) / CUT * (h + LW);
}

// 浪刃的横向渐变（userSpaceOnUse，0 → L）：0:0，.451:.3，.82:1，1:.8
float bladeAlpha(float x) {
    float o = x / L;
    float s1 = CREST * 0.55;
    if (o <= s1) return 0.3 * o / s1;
    if (o <= CREST) return 0.3 + 0.7 * (o - s1) / (CREST - s1);
    return 1.0 - 0.2 * (o - CREST) / (1.0 - CREST);
}

vec4 blade(vec4 b, vec2 p, vec2 fw) {
    if (b.z <= 0.0) return vec4(0.0);
    float lx = p.x - (b.x - CREST * L);
    float c = CREST * L;
    if (lx < 0.0 || lx > c + 10.0 + CUT) return vec4(0.0);
    float top = bladeTop(lx, b.y);
    float cov = span(p.y, top, WY + LW, fw.y);
    vec3 col = b.w < 0.5 ? cMain.rgb : (b.w < 1.5 ? cSub.rgb : cRed.rgb);
    float a = cov * bladeAlpha(lx) * b.z;
    return vec4(col * a, a);
}

void main() {
    vec2 p = qt_TexCoord0 * size;
    vec2 fw = max(fwidth(p), vec2(1e-3));

    float baseA = span(p.y, WY, WY + LW, fw.y) * baseOp;
    vec4 o = vec4(cSub.rgb * baseA, baseA);

    vec4 s;
    s = blade(b0, p, fw); o = s + o * (1.0 - s.a);
    s = blade(b1, p, fw); o = s + o * (1.0 - s.a);
    s = blade(b2, p, fw); o = s + o * (1.0 - s.a);
    s = blade(b3, p, fw); o = s + o * (1.0 - s.a);

    float m = p.x < maskP.x ? p.x / max(maskP.x, 1e-3)
            : p.x <= maskP.y ? 1.0
            : (size.x - p.x) / max(size.x - maskP.y, 1e-3);
    fragColor = o * clamp(m, 0.0, 1.0) * qt_Opacity;
}
