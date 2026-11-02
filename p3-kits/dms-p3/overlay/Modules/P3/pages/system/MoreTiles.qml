import QtQuick
import qs.Modules.P3

// MORE（TOP 层）：MORE 各分类的入口块，3 列。Enter / 单击进 MORE 层的对应分类。
SyPane {
    id: d

    readonly property real tileW: (width - 32) / 3

    SyGap {
        height: 8
    }
    SySec {
        width: d.width
        text: "MORE"
        below: 24
    }
    SyIn {
        width: d.width
        Grid {
            columns: 3
            spacing: 16
            Repeater {
                model: d.sys ? d.sys.mcats : []
                delegate: SyFocus {
                    id: t
                    required property var modelData
                    width: d.tileW
                    height: 168
                    line: false
                    syKey: "mt:" + modelData.id
                    onActivated: d.sys.goLevel("more", modelData.id)
                    Rectangle {
                        anchors.fill: parent
                        color: t.focused ? Qt.rgba(147 / 255, 225 / 255, 1, 0.19) : P3.panel
                    }
                    P3Glyph {
                        x: 22
                        y: 22
                        name: t.modelData.g
                        size: 26
                        color: t.dimColor
                    }
                    P3Text {
                        x: 22
                        width: parent.width - 44
                        anchors.baseline: parent.bottom
                        anchors.baselineOffset: -27
                        kind: "numSm"
                        font.pixelSize: 36
                        font.letterSpacing: -0.36
                        text: t.modelData.t
                        color: t.fg
                        elide: Text.ElideRight
                    }
                }
            }
        }
    }
}
