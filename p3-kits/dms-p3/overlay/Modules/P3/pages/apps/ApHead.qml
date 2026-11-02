import QtQuick
import qs.Modules.P3

// 详情列的头部（原型 .ap-dh）：76px 图标 + 名字 + 一行状态，垂直居中对齐。
// 名字是 P3 展示字，按长度缩字号（≤7 字 54 / ≤11 字 44 / ≤15 字 34 / 更长 28）；含中文时用黑体 900、字号 × .82。
// 文字按原型的行盒排：行高 = 字号 × .9（中文 1.05），基线放在行盒里字形上下居中的位置。
Item {
    id: root

    property string iconSource: ""
    property string name: ""
    property string glyph: ""
    property string sub: ""
    property int badge: 0

    readonly property bool cjk: /[　-鿿]/.test(name)
    readonly property int fs: cjk ? 48 : name.length <= 7 ? 54 : name.length <= 11 ? 44 : name.length <= 15 ? 34 : 28
    readonly property int zhPx: Math.round(fs * 0.82)
    // P3 Display 上 1.011 / 下 .353；Noto Sans CJK 上 1.16 / 下 .288
    readonly property real nameH: cjk ? zhPx * 1.05 : fs * 0.9
    readonly property real nameBase: cjk ? zhPx * (1.05 / 2 - 0.724 + 1.16) : fs * (0.9 / 2 - 0.682 + 1.011)
    readonly property bool hasSub: sub !== "" || badge > 0
    readonly property real subH: Math.round(19 * 1.16) + Math.round(19 * 0.288)
    readonly property real colH: nameH + (hasSub ? 12 + subH : 0)
    readonly property real rowH: Math.max(76, colH)

    width: 400
    height: 10 + rowH + 26

    ApIcon {
        y: 10 + (root.rowH - height) / 2
        s: 76
        source: root.iconSource
        name: root.name
        glyph: root.glyph
    }

    Item {
        id: textCol
        x: 76 + 22
        y: 10 + (root.rowH - root.colH) / 2
        width: root.width - x
        height: root.colH

        P3Text {
            anchors.baseline: parent.top
            anchors.baselineOffset: root.nameBase
            kind: "h2"
            font.family: root.cjk ? P3.fontZh : P3.fontDisplay
            font.italic: !root.cjk
            font.weight: Font.Black
            font.pixelSize: root.cjk ? root.zhPx : root.fs
            font.letterSpacing: root.cjk ? root.zhPx * 0.04 : -root.fs * 0.01
            rightPadding: root.cjk ? 0 : Math.round(root.fs * 0.08)
            width: Math.min(implicitWidth, textCol.width)
            elide: Text.ElideRight
            text: root.name
            color: P3.tx
        }
        Row {
            visible: root.hasSub
            y: root.nameH + 12
            height: root.subH
            spacing: 12
            P3Text {
                visible: root.sub !== ""
                anchors.verticalCenter: parent.verticalCenter
                kind: "zh"
                font.pixelSize: 19
                width: Math.min(implicitWidth, textCol.width - (chip.visible ? chip.width + 12 : 0))
                elide: Text.ElideRight
                text: root.sub
                color: P3.dim
            }
            P3Chip {
                id: chip
                visible: root.badge > 0
                anchors.verticalCenter: parent.verticalCenter
                hot: true
                text: root.badge + " 未读"
            }
        }
    }
}
