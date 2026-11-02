.pragma library

// 多边形裁剪（Sutherland–Hodgman）：给 POWER 项的红色淹没层用，代替原型的 clip-path。
// 点都是 Qt.point；clipPoly 必须是凸多边形（方向不限）。

function rect(x, y, w, h) {
    return [Qt.point(x, y), Qt.point(x + w, y), Qt.point(x + w, y + h), Qt.point(x, y + h)];
}

function convex(subject, clipPoly) {
    let area = 0;
    for (let i = 0; i < clipPoly.length; i++) {
        const a = clipPoly[i], b = clipPoly[(i + 1) % clipPoly.length];
        area += a.x * b.y - b.x * a.y;
    }
    const sign = area >= 0 ? 1 : -1;
    let out = subject.slice();
    for (let i = 0; i < clipPoly.length && out.length; i++) {
        const a = clipPoly[i], b = clipPoly[(i + 1) % clipPoly.length];
        const side = q => sign * ((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x));
        const input = out;
        out = [];
        for (let j = 0; j < input.length; j++) {
            const cur = input[j], prev = input[(j + input.length - 1) % input.length];
            const sc = side(cur), sp = side(prev);
            if (sc >= 0) {
                if (sp < 0)
                    out.push(cross(prev, cur, sp, sc));
                out.push(cur);
            } else if (sp >= 0) {
                out.push(cross(prev, cur, sp, sc));
            }
        }
    }
    return out.length > 2 ? out.concat([out[0]]) : [];
}

function cross(p, q, sp, sq) {
    const t = sp / (sp - sq);
    return Qt.point(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
}
