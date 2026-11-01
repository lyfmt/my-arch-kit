import QtQuick
import QtQuick.Effects
import QtQuick.Shapes
import Quickshell.Widgets

// 一张卡片。没有缩放变换：Engine.js 每帧直接给出屏幕上的宽高，所以圆角和阴影都是屏幕像素。
// 层次（后→前）：接触阴影 gl、地面阴影 sh、投影 ds、卡面 fc（图 + 模糊图 + 染色/压暗/删除红）、NOW 标签
Item {
    id: card

    signal hoverChanged2(bool on)
    signal clicked2()

    property var item: null          // Engine.js 的条目对象，空闲时为 null
    property url src: ""
    property int srcW: 1024           // 解码宽度（设备像素）

    // 每帧由 Engine.js 写入
    property real cx: 0               // 底边中点（屏幕坐标）
    property real cy: 0
    property real cw: 1
    property real ch: 1
    property real sk: 0               // skewX（度），绕底边中点
    property real rot: 0              // 旋转（度），绕底边中点
    property real imgW: 1             // 图片框尺寸（≥ 卡片，留出视差余量）
    property real imgH: 1
    property real imgDx: 0
    property real blurOp: 0
    property real tintOp: 0
    property real dimOp: 0
    property real killOp: 0
    property real glowOp: 0
    property real shOp: 0
    property real shY: 0
    property real dsOp: 0
    property real dsY: 0
    property real dsBlur: 26
    property real flShadowBlur: 34
    property real nowOp: 0
    property real radius: 14
    property real u: 1

    readonly property color ink: "#04103c"

    x: cx - cw / 2
    y: cy - ch
    width: cw
    height: ch
    visible: false

    transform: Matrix4x4 {
        matrix: {
            const t = Math.tan(card.sk * Math.PI / 180), r = card.rot * Math.PI / 180;
            const c = Math.cos(r), s = Math.sin(r);
            const a = c, b = c * t - s, cc = s, d = s * t + c;
            const ox = card.cw / 2, oy = card.ch;
            return Qt.matrix4x4(a, b, 0, ox - (a * ox + b * oy),
                                cc, d, 0, oy - (cc * ox + d * oy),
                                0, 0, 1, 0,
                                0, 0, 0, 1);
        }
    }

    // 接触阴影：椭圆径向渐变
    Item {
        x: -0.10 * card.cw
        y: -0.14 * card.ch
        width: card.cw * 1.20
        height: card.ch * 1.36
        opacity: card.glowOp
        visible: opacity > 0.002
        Shape {
            width: 100
            height: 100
            transform: Scale { xScale: card.cw * 1.20 / 100; yScale: card.ch * 1.36 / 100 }
            ShapePath {
                strokeWidth: -1
                strokeColor: "transparent"
                fillGradient: RadialGradient {
                    centerX: 50; centerY: 50; centerRadius: 50
                    focalX: 50; focalY: 50
                    GradientStop { position: 0; color: Qt.rgba(0, 8 / 255, 40 / 255, 0.75) }
                    GradientStop { position: 1; color: "transparent" }
                }
                PathRectangle { width: 100; height: 100 }
            }
        }
    }

    // 地面阴影：卡片底下一条模糊的黑条
    RectangularShadow {
        x: card.cw * 0.05
        width: card.cw * 0.90
        height: card.ch * 0.22
        y: card.ch * 1.05 - height + card.shY
        blur: card.flShadowBlur
        color: "black"
        opacity: card.shOp
        visible: opacity > 0.002
    }

    // 投影：与卡片同形状，选中时更深、更低
    RectangularShadow {
        x: card.cw * 0.02
        y: card.ch * 0.02 + card.dsY
        width: card.cw * 0.96
        height: card.ch * 0.96
        radius: card.radius
        blur: card.dsBlur
        color: Qt.rgba(0, 4 / 255, 28 / 255, 0.62)
        opacity: card.dsOp
        visible: opacity > 0.002
    }

    ClippingRectangle {
        anchors.fill: parent
        radius: card.radius
        color: card.ink

        Image {
            id: img
            width: card.imgW
            height: card.imgH
            x: (card.cw - width) / 2 + card.imgDx
            y: (card.ch - height) / 2
            source: card.src
            sourceSize.width: card.srcW
            fillMode: Image.PreserveAspectCrop
            asynchronous: true
            smooth: true
            mipmap: true
        }
        // 远处卡片的“模糊”：同一张图的极小解码版本放大显示，开销几乎为零
        Image {
            width: card.imgW
            height: card.imgH
            x: img.x
            y: img.y
            source: card.blurOp > 0.002 ? card.src : ""
            sourceSize.width: 64
            fillMode: Image.PreserveAspectCrop
            asynchronous: true
            smooth: true
            opacity: card.blurOp
            visible: opacity > 0.002
        }
        Rectangle { anchors.fill: parent; color: card.ink; opacity: card.tintOp; visible: opacity > 0.002 }
        Rectangle { anchors.fill: parent; color: "black"; opacity: card.dimOp; visible: opacity > 0.002 }
        Rectangle { anchors.fill: parent; color: "#e3121b"; opacity: card.killOp * 0.7; visible: opacity > 0.002 }
    }

    CutRect {
        x: 14 * card.u
        y: 14 * card.u
        width: nowTx.implicitWidth + 20 * card.u
        height: nowTx.implicitHeight + 5 * card.u
        cut: 6 * card.u
        color: "#a3f0ff"
        opacity: card.nowOp
        visible: opacity > 0.002
        Text {
            id: nowTx
            anchors.centerIn: parent
            anchors.verticalCenterOffset: 0.5 * card.u
            text: "NOW"
            color: card.ink
            font.family: Fonts.barlow
            font.weight: Font.Bold
            font.pixelSize: 15 * card.u
            font.letterSpacing: 15 * card.u * 0.12
        }
    }

    MouseArea {
        anchors.fill: parent
        hoverEnabled: true
        enabled: card.item !== null
        onEntered: card.hoverChanged2(true)
        onExited: card.hoverChanged2(false)
        onClicked: card.clicked2()
    }
}
