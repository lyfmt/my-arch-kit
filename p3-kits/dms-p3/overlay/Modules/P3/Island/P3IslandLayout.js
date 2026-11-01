.pragma library
// 灵动岛 island-b（BUBBLES 气泡串）的几何，对应 prototype/island-b.html 的 row() / L[...] / placeNC()。
// 坐标是岛的逻辑像素：x = 气泡中心相对时间胶囊中心，y = 气泡顶边相对屏幕顶边（CY = 24 是一行的中线）。
// IslandController（目标尺寸）和 P3IslandLayer（弹簧目标、内容）都从这里取同一份数字。

var OV = 12;            // 相邻气泡互相压进去的宽度
var CY = 24;            // 一行的中线
var K = 12;             // 平滑并集半径
var PANEL_RADIUS = 22;  // 通知中心面板的圆角上限
var NAMES = ["time", "audio", "notif", "batt", "card", "prev", "play", "next", "panel"];

// 通知中心：从计数气泡垂下来的面板
var NC = {
    "w": 384,
    "y": 38,
    "head": 58,
    "row": 72,
    "max": 444,
    "empty": 56,
    "pad": 8
};

// 面板按 rows 排（刚删掉、行高还没收完的也算），计数气泡按 count
function rows(d) {
    return d.rows !== undefined ? d.rows : d.count;
}

// 0 条：缩成一颗小珠（勿扰时留出月亮）；两位数加宽
function notifWidth(d) {
    return !d.count ? (d.dnd ? 24 : 18) : d.count > 9 ? 36 : 30;
}

// 列表高度：超过上限时封顶在某一行的中线，露出半行
function centerListHeight(n) {
    if (!n)
        return NC.empty;
    var total = n * NC.row;
    if (total <= NC.max + 1)
        return total;
    var l = 0;
    for (var k = 0; k < n; k++) {
        var y = k * NC.row + NC.row / 2;
        if (y <= NC.max)
            l = y;
    }
    return l;
}

function centerHeight(n) {
    return NC.head + centerListHeight(n) + NC.pad;
}

function rect(x, y, w, h, o) {
    var r = {
        "x": x,
        "y": y,
        "w": w,
        "h": h
    };
    if (o)
        for (var key in o)
            r[key] = o[key];
    return r;
}

function hidden(x, y, o) {
    return rect(x, y, 0, 0, o);
}

// 时间胶囊居中，左右两侧的气泡依次压进去 OV px
function row(L, d, time, left, right) {
    L.time = rect(0, CY - time.h / 2, time.w, time.h, Object.assign({
        "face": "t",
        "k": 320,
        "c": 22
    }, time.o || {}));
    var e = -time.w / 2, i = 0, b;
    for (var a = 0; a < left.length; a++) {
        b = left[a];
        if (b.n === "audio" && !d.player) {
            L.audio = hidden(e + 6, CY, {
                "k": 420,
                "c": 28
            });
            continue;
        }
        L[b.n] = rect(e - b.w / 2 + OV, CY - b.h / 2, b.w, b.h, Object.assign({
            "d": 40 + 40 * i++
        }, b.o || {}));
        e += -b.w + OV;
    }
    e = time.w / 2;
    i = 0;
    for (var c = 0; c < right.length; c++) {
        b = right[c];
        if (b.n === "batt" && !d.battery) {
            L.batt = hidden(e - 6, CY, {
                "k": 420,
                "c": 28
            });
            continue;
        }
        L[b.n] = rect(e + b.w / 2 - OV, CY - b.h / 2, b.w, b.h, Object.assign({
            "d": 40 + 40 * i++
        }, b.o || {}));
        e += b.w - OV;
    }
}

function battBubble(d, o) {
    if (d.low)
        return {
            "n": "batt",
            "w": 50,
            "h": 28,
            "o": Object.assign({
                "face": "pct",
                "k": 260,
                "c": 18
            }, o || {})
        };
    return {
        "n": "batt",
        "w": 42,
        "h": 26,
        "o": Object.assign({
            "face": "num"
        }, o || {})
    };
}

function notifBubble(d, o) {
    return {
        "n": "notif",
        "w": notifWidth(d),
        "h": 30,
        "o": Object.assign({
            "face": "n"
        }, o || {})
    };
}

function base(L, d) {
    row(L, d, {
        "w": 100,
        "h": 34
    }, [{
            "n": "audio",
            "w": 30,
            "h": 30,
            "o": {
                "face": "viz"
            }
        }], [notifBubble(d), battBubble(d)]);
}

function mediaRow(L, d) {
    row(L, d, {
        "w": 100,
        "h": 34,
        "o": {
            "k": 300,
            "c": 20,
            "d": 30
        }
    }, [{
            "n": "audio",
            "w": 214,
            "h": 34,
            "o": {
                "face": "media",
                "k": 230,
                "c": 17,
                "d": 0
            }
        }], [notifBubble(d), battBubble(d)]);
}

// mode：home pw media mediaOpen osd state charging notify center level menu，空串 = 不画气泡串（DMS 自己的面板）
function layout(mode, d) {
    var L = {};
    switch (mode) {
    case "home":
        base(L, d);
        break;
    case "pw":
        row(L, d, {
            "w": 100,
            "h": 34
        }, [{
                "n": "audio",
                "w": 30,
                "h": 30,
                "o": {
                    "face": "viz"
                }
            }], [notifBubble(d), {
                "n": "batt",
                "w": 278,
                "h": 32,
                "o": {
                    "face": "info",
                    "k": 230,
                    "c": 18
                }
            }]);
        break;
    case "media":
        mediaRow(L, Object.assign({}, d, {
            "player": true
        }));
        break;
    case "mediaOpen":
        row(L, d, {
            "w": 92,
            "h": 32
        }, [], [{
                "n": "notif",
                "w": d.count ? 28 : notifWidth(d),
                "h": 28,
                "o": {
                    "face": "n",
                    "d": 30
                }
            }, {
                "n": "batt",
                "w": 40,
                "h": 24,
                "o": {
                    "face": "num",
                    "d": 60
                }
            }]);
        L.audio = rect(0, 41, 300, 56, {
            "face": "media2",
            "k": 210,
            "c": 18
        });
        L.prev = rect(-42, 96, 28, 28, {
            "face": "k",
            "d": 180,
            "k": 260,
            "c": 20
        });
        L.play = rect(0, 94, 36, 36, {
            "face": "k",
            "d": 120,
            "k": 260,
            "c": 19
        });
        L.next = rect(42, 96, 28, 28, {
            "face": "k",
            "d": 240,
            "k": 260,
            "c": 20
        });
        break;
    case "osd":
        // 音量 / 亮度借音频气泡；没有播放器时它从时间胶囊里长出来
        row(L, Object.assign({}, d, {
            "player": true
        }), {
            "w": 96,
            "h": 34,
            "o": {
                "k": 300,
                "c": 20
            }
        }, [{
                "n": "audio",
                "w": 226,
                "h": 34,
                "o": {
                    "face": "osd",
                    "k": 280,
                    "c": 18,
                    "d": 0
                }
            }], [notifBubble(d), battBubble(d, {
                "d": 0
            })]);
        break;
    case "state":
        row(L, Object.assign({}, d, {
            "player": true
        }), {
            "w": 100,
            "h": 34
        }, [{
                "n": "audio",
                "w": Math.max(96, Math.min(300, Math.ceil(d.stateLength || 0))),
                "h": 34,
                "o": {
                    "face": "state",
                    "k": 280,
                    "c": 18,
                    "d": 0
                }
            }], [notifBubble(d), battBubble(d)]);
        break;
    case "charging":
        row(L, d, {
            "w": 100,
            "h": 34
        }, [{
                "n": "audio",
                "w": 30,
                "h": 30,
                "o": {
                    "face": "viz"
                }
            }], [notifBubble(d, {
                "k": 380,
                "c": 18
            }), {
                "n": "batt",
                "w": d.plugged ? 70 : 50,
                "h": d.plugged ? 30 : 28,
                "o": {
                    "face": d.plugged ? "chg" : "pct",
                    "k": 200,
                    "c": 15
                }
            }]);
        break;
    case "notify":
        base(L, d);
        L.card = rect(0, 44, 344, 64, {
            "face": "card",
            "k": 200,
            "c": 16
        });
        break;
    case "level":
        base(L, d);
        L.card = rect(0, 44, 344, 64, {
            "face": "level",
            "k": 200,
            "c": 16
        });
        break;
    case "center":
        if (d.mediaRow)
            mediaRow(L, d);
        else
            base(L, d);
        L.panel = rect(L.notif.x, NC.y, NC.w, centerHeight(rows(d)), {
            "face": "nc",
            "k": 230,
            "c": 21,
            "r": PANEL_RADIUS
        });
        break;
    case "menu":
        // P3 菜单打开：全部吸进时间胶囊，缩成一颗水滴
        L.time = rect(0, 4, 44, 44, {
            "face": "",
            "k": 360,
            "c": 20,
            "d": 60
        });
        L.audio = rect(-18, 12, 20, 20, {
            "face": "",
            "k": 420,
            "c": 26,
            "d": 30
        });
        L.notif = rect(18, 12, 20, 20, {
            "face": "",
            "k": 420,
            "c": 26,
            "d": 30
        });
        L.batt = rect(20, 12, 18, 18, {
            "face": "",
            "k": 420,
            "c": 26
        });
        break;
    default:
        // 气泡全部吸回时间胶囊的位置，形状交给 DMS 的面板
        L.time = hidden(0, CY, {
            "k": 420,
            "c": 26
        });
        L.audio = hidden(-18, CY, {
            "k": 420,
            "c": 26
        });
        L.notif = hidden(18, CY, {
            "k": 420,
            "c": 26
        });
        L.batt = hidden(20, CY, {
            "k": 420,
            "c": 26
        });
        break;
    }
    if (!L.card)
        L.card = hidden(0, CY, {
            "k": 380,
            "c": 26
        });
    var ctl = ["prev", "play", "next"];
    for (var j = 0; j < ctl.length; j++)
        if (!L[ctl[j]])
            L[ctl[j]] = hidden(0, 30, {
                "k": 380,
                "c": 26
            });
    if (!L.panel)
        L.panel = hidden(L.notif.x, CY + 6, {
            "k": 380,
            "c": 30,
            "r": PANEL_RADIUS
        });
    return L;
}

// 可见气泡的外框
function bounds(L) {
    var b = {
        "x0": 1e9,
        "x1": -1e9,
        "y0": 1e9,
        "y1": -1e9,
        "empty": true
    };
    for (var i = 0; i < NAMES.length; i++) {
        var r = L[NAMES[i]];
        if (!r || r.w < 1 || r.h < 1)
            continue;
        b.empty = false;
        b.x0 = Math.min(b.x0, r.x - r.w / 2);
        b.x1 = Math.max(b.x1, r.x + r.w / 2);
        b.y0 = Math.min(b.y0, r.y);
        b.y1 = Math.max(b.y1, r.y + r.h);
    }
    if (b.empty) {
        b.x0 = -20;
        b.x1 = 20;
        b.y0 = CY - 17;
        b.y1 = CY + 17;
    }
    return b;
}
