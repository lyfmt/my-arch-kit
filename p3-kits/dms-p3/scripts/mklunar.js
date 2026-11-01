#!/usr/bin/env node
// 生成 overlay/P3Sys/lunar.js：QML 的 JS 引擎没有 Intl，农历用预计算表。
//   node scripts/mklunar.js > overlay/P3Sys/lunar.js
// 每个农历月一条：[公历起始日（距 1970-01-01 的天数）, 月名, 是否闰月]；范围 Y0–Y1。
const Y0 = 1900, Y1 = 2100;
const f = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { year: 'numeric', month: 'long', day: 'numeric' });
const parts = d => { const o = {}; f.formatToParts(d).forEach(x => { o[x.type] = x.value; }); return o; };
const DAY = 86400000;
const months = [];
for (let t = Date.UTC(Y0, 0, 1); t <= Date.UTC(Y1, 11, 31); t += DAY) {
  const d = new Date(t);
  const p = parts(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
  if (+p.day === 1 || !months.length) {
    const leap = p.month.startsWith('闰');
    months.push([Math.round(t / DAY), p.month.replace(/^闰/, '').replace(/十一月$/, '冬月'), leap ? 1 : 0, p.yearName, +p.day]);
  }
}
const names = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
// 紧凑编码：起始日差值 + 月序号 + 闰月标记 + 干支年（只在正月记）
const first = months[0];
const rows = months.map(([d, m, leap, y], i) => [i ? d - months[i - 1][0] : d, names.indexOf(m), leap, m === '正月' && !leap ? y : '']);
console.log(`.pragma library
// 生成文件：node scripts/mklunar.js > overlay/P3Sys/lunar.js（数据来自 ICU 的 chinese 历法）；文件末尾的节气函数是 mklunar.js 附带写出的
// ${Y0}-01-01 … ${Y1}-12-31。lunar(date) → { year 干支, month 月名（含“闰”）, day, dayZh, leap, label, fest } 或 null
var FIRST_DAY_OFFSET = ${first[4] - 1};   // ${Y0}-01-01 当天是所在农历月的第几天 - 1
var START = ${first[0]};
var NAMES = ${JSON.stringify(names)};
var YEAR0 = ${JSON.stringify(first[3])};
// [距上一月的天数（第一条为 1970 起的天数）, 月序号, 闰, 正月时的干支年]
var M = ${JSON.stringify(rows)};
var LD = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
var LFEST = { '正月1': '春节', '正月15': '元宵节', '五月5': '端午节', '七月7': '七夕', '七月15': '中元节', '八月15': '中秋节', '九月9': '重阳节', '十月1': '寒衣节', '腊月8': '腊八节' };
var _starts = null, _years = null;
function _build() {
    _starts = []; _years = [];
    var d = 0, y = YEAR0;
    for (var i = 0; i < M.length; i++) {
        d = i ? d + M[i][0] : M[i][0];
        if (M[i][3]) y = M[i][3];
        _starts.push(d); _years.push(y);
    }
}
function lunar(date) {
    if (!_starts) _build();
    var n = Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    if (n < START || n > ${Math.round(Date.UTC(Y1, 11, 31) / DAY)}) return null;
    var lo = 0, hi = _starts.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (_starts[mid] <= n) lo = mid; else hi = mid - 1; }
    var day = n - _starts[lo] + 1 + (lo === 0 ? FIRST_DAY_OFFSET : 0);
    // 除夕：腊月最后一天
    var m = M[lo], month = (m[2] ? '闰' : '') + NAMES[m[1]];
    var last = lo + 1 < _starts.length && n === _starts[lo + 1] - 1;
    var fest = LFEST[month + day] || (last && m[1] === 11 && !m[2] ? '除夕' : null);
    return { year: _years[lo], month: month, day: day, dayZh: LD[day - 1] || String(day), leap: !!m[2],
             label: day === 1 ? month : LD[day - 1], fest: fest };
}`);
console.log("\n// 节气：太阳视黄经（Meeus 第 25 章低精度公式，误差远小于一天），按北京时间取日期。\nvar TERM_NAMES = ['春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒','立春','雨水','惊蛰'];\nvar _termCache = {};\nfunction _sunLon(t) {\n    var J = t / 86400000 + 2440587.5, T = (J - 2451545) / 36525;\n    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;\n    var M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * Math.PI / 180;\n    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);\n    var om = (125.04 - 1934.136 * T) * Math.PI / 180;\n    var l = L0 + C - 0.00569 - 0.00478 * Math.sin(om);\n    return ((l % 360) + 360) % 360;\n}\nfunction _pad(n) { return (n < 10 ? '0' : '') + n; }\n// termsOfYear(y) → { 'YYYY-MM-DD': '霜降', … }\nfunction termsOfYear(y) {\n    if (_termCache[y]) return _termCache[y];\n    var out = {};\n    for (var k = 0; k < 24; k++) {\n        var t = k >= 19 ? Date.UTC(y, 0, 5) + (k - 19) * 15.2 * 86400000 : Date.UTC(y, 2, 20) + k * 15.2 * 86400000;\n        for (var i = 0; i < 50; i++) {\n            var d = k * 15 - _sunLon(t);\n            d = ((d + 540) % 360) - 180;\n            if (Math.abs(d) < 1e-6) break;\n            t += d / 360 * 365.2422 * 86400000;\n        }\n        var c = new Date(t + 8 * 3600000);\n        out[c.getUTCFullYear() + '-' + _pad(c.getUTCMonth() + 1) + '-' + _pad(c.getUTCDate())] = TERM_NAMES[k];\n    }\n    _termCache[y] = out;\n    return out;\n}\n");
