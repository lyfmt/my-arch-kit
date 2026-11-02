import QtQuick

// 一行的「水面」（原型的 .msk）：裁切盒的下沿就是水面，字从这里浮出、沉回。
// inner = 原型的 .in；tx / ty 是整行位移（翻译行开关时整行浮上 / 沉下）
Item {
    id: m

    property alias inner: inner
    property real tx: 0
    property real ty: 0

    clip: true

    Item {
        id: inner
        transform: Translate { x: m.tx; y: m.ty }
    }
}
