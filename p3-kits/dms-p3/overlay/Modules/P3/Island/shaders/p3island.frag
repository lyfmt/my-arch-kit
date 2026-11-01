#version 440
// 灵动岛气泡串的形状：9 个胶囊（圆角封顶 cap）的 SDF 多项式平滑并集，平涂 fillColor；
// body = DMS 自己的面板（launcher、控制中心……），bodyWeight 0 → 1 时从里面长出来、并进同一张场。
// 坐标是岛窗口的逻辑像素；frame = 本 ShaderEffect 在窗口里的位置和大小。阴影 = 同一张场下移 2px 的软边。

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float dpr;
    float smoothK;
    float borderWidth;
    float bodyWeight;
    vec4 frame;
    vec4 fillColor;
    vec4 shadowColor;
    vec4 borderColor;
    vec4 b0;
    vec4 b1;
    vec4 b2;
    vec4 b3;
    vec4 b4;
    vec4 b5;
    vec4 b6;
    vec4 b7;
    vec4 b8;
    vec4 caps0;
    vec4 caps1;
    vec4 caps2;
    vec4 body;
    vec4 bodyRadii;
};

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// (cx, cy, hw, hh)，圆角 = min(hw, hh, cap)
float capsule(vec2 p, vec4 b, float cap) {
    float r = min(min(b.z, b.w), cap);
    vec2 q = abs(p - b.xy) - b.zw + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float addBubble(float d, vec2 p, vec4 b, float cap) {
    if (b.z < 0.25 || b.w < 0.25)
        return d;
    return smin(d, capsule(p, b, cap), smoothK);
}

// body：(x, y, w, h) 左上角 + 宽高；bodyRadii = (tl, tr, bl, br)
float bodyField(vec2 p) {
    vec2 hs = body.zw * 0.5;
    vec2 c = body.xy + hs;
    vec2 q0 = p - c;
    float r = q0.x > 0.0 ? (q0.y > 0.0 ? bodyRadii.w : bodyRadii.y) : (q0.y > 0.0 ? bodyRadii.z : bodyRadii.x);
    r = min(r, min(hs.x, hs.y));
    vec2 q = abs(q0) - hs + r;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    return d + (1.0 - bodyWeight) * (min(hs.x, hs.y) + smoothK);
}

float field(vec2 p) {
    float d = 1e5;
    d = addBubble(d, p, b0, caps0.x);
    d = addBubble(d, p, b1, caps0.y);
    d = addBubble(d, p, b2, caps0.z);
    d = addBubble(d, p, b3, caps0.w);
    d = addBubble(d, p, b4, caps1.x);
    d = addBubble(d, p, b5, caps1.y);
    d = addBubble(d, p, b6, caps1.z);
    d = addBubble(d, p, b7, caps1.w);
    d = addBubble(d, p, b8, caps2.x);
    if (bodyWeight > 0.001 && body.z > 0.5 && body.w > 0.5)
        d = smin(d, bodyField(p), smoothK);
    return d;
}

void main() {
    vec2 p = frame.xy + qt_TexCoord0 * frame.zw;
    float d = field(p);
    float a = clamp(0.5 - d * dpr, 0.0, 1.0);

    vec3 col = fillColor.rgb;
    if (borderColor.a > 0.0 && borderWidth > 0.0) {
        float ring = clamp(0.5 + (d + borderWidth) * dpr, 0.0, 1.0) * borderColor.a;
        col = mix(col, borderColor.rgb, ring);
    }
    float fa = a * fillColor.a;
    vec4 shape = vec4(col * fa, fa);

    float ds = field(p - vec2(0.0, 2.0));
    float sa = shadowColor.a * (1.0 - smoothstep(-4.0, 4.0, ds)) * (1.0 - fa);
    vec4 shadow = vec4(shadowColor.rgb * sa, sa);

    fragColor = (shape + shadow) * qt_Opacity;
}
