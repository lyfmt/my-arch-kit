import QtQuick

// 水线 + 浪刃（原型的 .wvc / .base / .blade），一个 ShaderEffect 画完。
// 最多同时 4 片浪刃（入场浪 + 停留浪，切句时上一句的浪也还在淡出）。
// lvl = .base 的亮度（引擎写）；lift = 调整位置时水线提亮到的下限（LyricsLayer 给）。
ShaderEffect {
    property size size: Qt.size(width, height)
    property point maskP: Qt.point(0, width)
    property real lvl: Theme.baseOp
    property real lift: 0
    property real baseOp: Math.max(lvl, lift)
    property color cMain: Theme.main
    property color cSub: Theme.sub
    property color cRed: Theme.red
    property vector4d b0: Qt.vector4d(0, 0, -1, 0)
    property vector4d b1: Qt.vector4d(0, 0, -1, 0)
    property vector4d b2: Qt.vector4d(0, 0, -1, 0)
    property vector4d b3: Qt.vector4d(0, 0, -1, 0)

    fragmentShader: Qt.resolvedUrl("shaders/wave.frag.qsb")
}
