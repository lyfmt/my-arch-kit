#version 440
// P3 菜单出场 / 收场的圆形开口（P3MenuReveal.qml）。source = 菜单内容层；圆外透明，圆里 = 内容叠在底色上，
// 再按 ink 盖上岛的墨色；贴着边缘 rimW px 一圈 rimColor（表面张力），wob 让边缘有一点水波。坐标是窗口逻辑像素。

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 size;
    vec2 center;
    float radius;
    float ink;
    float rimA;
    float rimW;
    float wob;
    float phase;
    vec4 inkColor;
    vec4 baseColor;
    vec4 rimColor;
};

layout(binding = 1) uniform sampler2D source;

void main() {
    vec2 q = qt_TexCoord0 * size - center;
    float d = length(q) - radius;
    if (wob > 0.0 && dot(q, q) > 1.0)
        d -= wob * sin(atan(q.y, q.x) * 7.0 + phase);
    float aa = max(fwidth(d), 0.001);
    float inside = clamp(0.5 - d / aa, 0.0, 1.0);

    vec4 src = texture(source, qt_TexCoord0);
    vec4 c = src + vec4(baseColor.rgb, 1.0) * baseColor.a * (1.0 - src.a);
    c = mix(c, vec4(inkColor.rgb, 1.0), ink);
    float band = clamp(0.5 - (abs(d + rimW * 0.5) - rimW * 0.5) / aa, 0.0, 1.0) * rimA;
    c = mix(c, vec4(rimColor.rgb, 1.0), band);

    fragColor = c * inside * qt_Opacity;
}
