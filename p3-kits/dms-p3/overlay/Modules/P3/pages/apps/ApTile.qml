import QtQuick
import qs.Modules.P3

// 应用格（原型 .ap-it）：图标在上、名字在下，左对齐，焦点光点在格子左上角。
//   焦点    图标上浮 5px 并放大 1.12（spring），名字变 fill
//   rise    页面入场：图标从下方 40px、.6 倍弹起，按 q × 30ms 错开
//   compact 搜索网格：116×104，名字单行省略；hitIn 时整格自下 14px 淡入，按 q × 12ms 错开
//   rank    名字前的 P3 数字（FREQUENT 的名次）
//   lit     托盘菜单打开时的来源格：名字保持 fill；dimmed：其余格退到 .22
P3Focusable {
    id: root

    property string ref: ""
    property string iconSource: ""
    property string name: ""
    property string label: ""
    property string glyph: ""
    property string rank: ""
    property int badge: 0
    property int s: 60
    property bool compact: false
    property bool lit: false
    property bool dimmed: false
    property int q: 0
    property int col: 0
    property bool rise: false
    property bool hitIn: false
    property bool still: false
    readonly property alias iconItem: icon
    readonly property bool cjk: /[　-鿿]/.test(label)

    width: compact ? 116 : 132
    height: compact ? 104 : nameRow.y + nameRow.height + 12
    opacity: dimmed ? 0.22 : disabled ? 0.4 : 1
    Behavior on opacity {
        enabled: !root.still
        NumberAnimation {
            duration: 250
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
    }

    Item {
        id: body
        property real inT: 1
        width: root.width
        height: root.height
        opacity: inT
        transform: Translate {
            y: 14 * (1 - body.inT)
        }

        Item {
            id: iconWrap
            property real riseT: 1
            property real lift: root.focused ? 1 : 0
            Behavior on lift {
                enabled: !root.still
                NumberAnimation {
                    duration: 340
                    easing.type: Easing.BezierSpline
                    easing.bezierCurve: P3.spring
                }
            }
            y: root.compact ? 6 : 8
            width: root.s
            height: root.s
            opacity: Math.min(1, riseT)
            transform: [
                Scale {
                    origin.x: root.s * 0.3
                    origin.y: root.s * 0.7
                    xScale: (0.6 + 0.4 * iconWrap.riseT) * (1 + 0.12 * iconWrap.lift)
                    yScale: xScale
                },
                Translate {
                    y: 40 * (1 - iconWrap.riseT) - 5 * iconWrap.lift
                }
            ]

            ApIcon {
                id: icon
                s: root.s
                source: root.iconSource
                name: root.name || root.label
                glyph: root.glyph
                badge: root.badge
                fg: root.fg
                trackColor: root.trackColor
            }
        }

        // 名字行按原型的行盒排：行高 = 字号 × 1.15，基线放在字形上下居中的位置；名次数字比名字低 2px
        Item {
            id: nameRow
            y: iconWrap.y + root.s + (root.compact ? 10 : 14)
            width: root.width
            height: Math.max(1, nameText.lineCount) * nameText.lh + (rankText.visible ? 1 : 0)

            P3Text {
                id: rankText
                visible: root.rank !== ""
                anchors.baseline: parent.top
                anchors.baselineOffset: nameText.base + 2
                kind: "h2"
                font.pixelSize: 24
                font.letterSpacing: -0.24
                rightPadding: 1.5
                text: root.rank
                color: root.fg
            }
            P3Text {
                id: nameText
                readonly property int px: root.compact ? (root.cjk ? 15 : 14) : 16
                readonly property real lh: px * 1.15
                // Barlow Condensed 上 1.0 / 下 .2；Noto Sans CJK 上 1.16 / 下 .288
                readonly property real base: root.cjk ? (lh - px * 1.448) / 2 + px * 1.16 : (lh - px * 1.2) / 2 + px
                x: rankText.visible ? rankText.width + 8 : 0
                anchors.baseline: parent.top
                anchors.baselineOffset: base
                kind: "label"
                upper: !root.cjk
                font.family: root.cjk ? P3.fontZh : P3.fontLabel
                font.pixelSize: px
                font.letterSpacing: px * (root.cjk ? 0.08 : 0.12)
                lineHeightMode: Text.FixedHeight
                lineHeight: lh
                width: Math.min(implicitWidth, root.width - x)
                wrapMode: root.compact ? Text.NoWrap : Text.Wrap
                maximumLineCount: root.compact ? 1 : 2
                elide: Text.ElideRight
                text: root.label
                color: root.focused || root.lit ? P3.fill : P3.dim
                Behavior on color {
                    enabled: !root.still
                    ColorAnimation {
                        duration: 120
                    }
                }
            }
        }
    }

    SequentialAnimation {
        id: riseAnim
        PauseAnimation {
            duration: root.q * 30 + 300
        }
        NumberAnimation {
            target: iconWrap
            property: "riseT"
            to: 1
            duration: 620
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.spring
        }
    }
    SequentialAnimation {
        id: hitAnim
        PauseAnimation {
            duration: root.q * 12
        }
        NumberAnimation {
            target: body
            property: "inT"
            to: 1
            duration: 300
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
    }

    // still 可能在格子建好之后才变成 true（页面的 ctx 晚于格子写入）：直接跳到入场结束
    onStillChanged: {
        if (!still)
            return;
        riseAnim.stop();
        hitAnim.stop();
        iconWrap.riseT = 1;
        body.inT = 1;
    }
    Component.onCompleted: {
        if (still)
            return;
        if (rise) {
            iconWrap.riseT = 0;
            riseAnim.start();
        }
        if (hitIn) {
            body.inT = 0;
            hitAnim.start();
        }
    }
}
