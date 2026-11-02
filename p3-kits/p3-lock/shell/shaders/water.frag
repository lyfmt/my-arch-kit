#version 440
// 光束 + 焦散，对应 lock.css 的 .rays（5 根斜光 + 200deg 线性遮罩）和 .caustic（feTurbulence 阈值化的亮斑）
// 坐标单位：.bg 盒子（1980×1140，含 inset -30）内的 CSS 像素
// 改完用 /usr/lib/qt6/bin/qsb --qt6 -o water.frag.qsb water.frag 重新编译
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 size;        // 项目像素尺寸（= .bg 盒子）
    vec2 drift;       // 焦散漂移 translate
    float causticOp;  // .caustic opacity（.2 / 解锁 .55）
    float rayGain;    // 解锁时光束增亮（1 → 1.6）
    vec4 skewA;       // 光束 1–4 的 skewX（弧度）
    vec4 opA;         // 光束 1–4 的 opacity
    float skew5;
    float op5;
};

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
vec2 grad(vec2 p) {
    float a = hash(p) * 6.2831853;
    return vec2(cos(a), sin(a));
}
float gnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = dot(grad(i), f);
    float b = dot(grad(i + vec2(1, 0)), f - vec2(1, 0));
    float c = dot(grad(i + vec2(0, 1)), f - vec2(0, 1));
    float d = dot(grad(i + vec2(1, 1)), f - vec2(1, 1));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 一根光束：left、width（CSS px，相对 .rays 盒子），旋转 24deg，绕顶边中点；先旋转再 skewX
float ray(vec2 p, float left, float w, float sk, float op) {
    vec2 o = vec2(left + w * 0.5, 0.0);
    vec2 d = p - o;
    const float c = 0.9135455, s = 0.4067366; // cos/sin 24deg
    vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y); // 逆旋转
    q.x -= tan(sk) * q.y;                                  // 逆 skewX
    if (q.y < 0.0 || q.y > 1000.0)
        return 0.0;
    float edge = 0.75; // 1px 抗锯齿
    float inside = clamp(w * 0.5 - abs(q.x) + edge, 0.0, 1.0);
    float g = 0.22 * max(0.0, 1.0 - q.y / 850.0);
    return inside * g * op;
}

void main() {
    vec2 p = qt_TexCoord0 * size;

    // ---------- 焦散：盒子 left 820 top -60，1300×520 ----------
    float ca = 0.0;
    vec2 cp = p - vec2(820.0, -60.0) - drift;
    if (cp.x >= 0.0 && cp.x <= 1300.0 && cp.y >= 0.0 && cp.y <= 520.0) {
        vec2 f = vec2(0.008, 0.02);
        float n = gnoise(cp * f + vec2(7.3, 1.9)) + 0.5 * gnoise(cp * f * 2.0 + vec2(3.1, 8.7));
        float A = (n * 1.35 + 1.0) * 0.5;
        float a = clamp(5.2 - 9.0 * A, 0.0, 1.0);
        float t = cp.y / 520.0; // mask: #000 20% → transparent 90%
        float m = 1.0 - clamp((t - 0.2) / 0.7, 0.0, 1.0);
        ca = a * m * causticOp;
    }

    // ---------- 光束：盒子 left 900 top -80，1100×900 ----------
    float ra = 0.0;
    vec2 rp = p - vec2(900.0, -80.0);
    if (rp.x >= 0.0 && rp.x <= 1100.0 && rp.y >= 0.0 && rp.y <= 900.0) {
        float r = 0.0;
        r = 1.0 - (1.0 - r) * (1.0 - ray(rp, 260.0, 40.0, skewA.x, opA.x));
        r = 1.0 - (1.0 - r) * (1.0 - ray(rp, 420.0, 90.0, skewA.y, opA.y));
        r = 1.0 - (1.0 - r) * (1.0 - ray(rp, 610.0, 26.0, skewA.z, opA.z));
        r = 1.0 - (1.0 - r) * (1.0 - ray(rp, 720.0, 70.0, skewA.w, opA.w));
        r = 1.0 - (1.0 - r) * (1.0 - ray(rp, 900.0, 34.0, skew5, op5));
        // linear-gradient(200deg, #000 15%, transparent 70%)
        vec2 dir = vec2(-0.3420201, 0.9396926);
        float len = 1100.0 * 0.3420201 + 900.0 * 0.9396926;
        float t = dot(rp - vec2(550.0, 450.0), dir) / len + 0.5;
        float m = 1.0 - clamp((t - 0.15) / 0.55, 0.0, 1.0);
        ra = clamp(r * m * rayGain, 0.0, 1.0);
    }

    // 两层都是白色：screen 混合与普通 alpha 叠加结果相同
    float a = 1.0 - (1.0 - ca) * (1.0 - ra);
    fragColor = vec4(a) * qt_Opacity;
}
