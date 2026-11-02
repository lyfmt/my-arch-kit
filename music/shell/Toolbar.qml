import QtQuick
import Quickshell.Widgets

// 底部工具栏：上一曲/播放/下一曲 · 进度 · 时间 · 音量 · 播放方式 · 桌面歌词 · 喜欢 · 收藏
Item {
    id: bar

    property bool menuOpen: false
    implicitHeight: 48

    function openCollect() {
        if (Backend.song) menuOpen = true;
    }

    Row {
        id: controls
        x: 8
        anchors.verticalCenter: parent.verticalCenter
        spacing: 2
        IconButton {
            icon: "skip_previous"
            filled: true
            onClicked: Backend.prev()
        }
        IconButton {
            icon: Backend.playing ? "pause" : "play_arrow"
            filled: true
            size: 34
            iconSize: 26
            tint: Theme.primary
            onClicked: Backend.toggle()
        }
        IconButton {
            icon: "skip_next"
            filled: true
            onClicked: Backend.next()
        }
    }

    // 进度条
    Item {
        id: progress
        anchors.left: controls.right
        anchors.leftMargin: 12
        anchors.right: timeText.left
        anchors.rightMargin: 12
        anchors.verticalCenter: parent.verticalCenter
        height: 20

        property real dragRatio: -1
        readonly property real ratio: dragRatio >= 0 ? dragRatio
            : Backend.duration > 0 ? Math.min(1, Backend.pos / Backend.duration) : 0
        readonly property bool hot: pma.containsMouse || pma.pressed

        Rectangle {
            id: track
            anchors.verticalCenter: parent.verticalCenter
            width: parent.width
            height: progress.hot ? 6 : 4
            radius: height / 2
            color: Theme.alpha(Theme.text, 0.12)
            Behavior on height { NumberAnimation { duration: 120 } }
            Rectangle {
                width: parent.width * progress.ratio
                height: parent.height
                radius: parent.radius
                color: Theme.primary
            }
        }
        Rectangle {
            visible: progress.hot
            width: 12
            height: 12
            radius: 6
            x: progress.width * progress.ratio - 6
            anchors.verticalCenter: parent.verticalCenter
            color: Theme.primary
        }
        MouseArea {
            id: pma
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            function r(mx) { return Math.max(0, Math.min(1, mx / width)); }
            onPressed: m => progress.dragRatio = r(m.x)
            onPositionChanged: m => { if (pressed) progress.dragRatio = r(m.x); }
            onReleased: m => {
                Backend.seek(r(m.x) * Backend.duration);
                progress.dragRatio = -1;
            }
        }
    }

    Text {
        id: timeText
        anchors.right: actions.left
        anchors.rightMargin: 8
        anchors.verticalCenter: parent.verticalCenter
        text: Theme.time(progress.dragRatio >= 0 ? progress.dragRatio * Backend.duration : Backend.pos) + " / " + Theme.time(Backend.duration)
        color: Theme.textDim
        font.family: Theme.font
        font.pixelSize: 12
        font.features: { "tnum": 1 }
    }

    Row {
        id: actions
        anchors.right: parent.right
        anchors.rightMargin: 8
        anchors.verticalCenter: parent.verticalCenter
        spacing: 2
        // 音量（网易云后端相对音量）
        Item {
            width: 84
            height: 30
            Icon {
                id: volIcon
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                name: Backend.volume <= 0 ? "volume_off" : Backend.volume < 50 ? "volume_down" : "volume_up"
                size: 18
                color: Theme.textDim
            }
            Item {
                id: volBar
                anchors.left: volIcon.right
                anchors.leftMargin: 2
                anchors.verticalCenter: parent.verticalCenter
                width: 54
                height: 16
                readonly property real ratio: Backend.volume / 100
                readonly property bool hot: vma.containsMouse || vma.pressed
                Rectangle {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width
                    height: volBar.hot ? 6 : 4
                    radius: height / 2
                    color: Theme.alpha(Theme.text, 0.12)
                    Behavior on height { NumberAnimation { duration: 120 } }
                    Rectangle {
                        width: parent.width * volBar.ratio
                        height: parent.height
                        radius: parent.radius
                        color: Theme.primary
                    }
                }
                Rectangle {
                    visible: volBar.hot
                    width: 10
                    height: 10
                    radius: 5
                    x: volBar.width * volBar.ratio - 5
                    anchors.verticalCenter: parent.verticalCenter
                    color: Theme.primary
                }
                MouseArea {
                    id: vma
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    function r(mx) { return Math.max(0, Math.min(1, mx / width)); }
                    onPressed: m => Backend.setVolume(r(m.x) * 100)
                    onPositionChanged: m => { if (pressed) Backend.setVolume(r(m.x) * 100); }
                }
            }
        }
        // 播放方式：随机 / 单曲循环 / 顺序播放
        IconButton {
            icon: Backend.mode === "one" ? "repeat_one" : Backend.mode === "shuffle" ? "shuffle" : "repeat"
            tint: Backend.mode === "list" ? Theme.textDim : Theme.primary
            onClicked: {
                const order = ["shuffle", "one", "list"];
                const next = order[(order.indexOf(Backend.mode) + 1) % order.length];
                Backend.setMode(next);
            }
        }
        LyricsButton {}
        IconButton {
            icon: "favorite"
            filled: Backend.isLiked
            tint: Backend.isLiked ? Theme.error : Theme.textDim
            onClicked: if (Backend.song) Backend.like(Backend.song.id, !Backend.isLiked)
        }
        IconButton {
            id: star
            icon: "star"
            filled: Backend.isCollected || bar.menuOpen
            tint: (Backend.isCollected || bar.menuOpen) ? Theme.primary : Theme.textDim
            onClicked: bar.menuOpen ? bar.menuOpen = false : bar.openCollect()
        }
    }

    // 收藏到歌单
    Rectangle {
        id: menu
        visible: bar.menuOpen
        width: 150
        height: menuCol.implicitHeight + 12
        x: bar.width - width - 6
        y: -height - 6
        radius: Theme.radius
        color: Theme.alpha(Theme.cardHigh, 0.82)
        border.width: 1
        border.color: Theme.alpha(Theme.text, 0.1)

        Column {
            id: menuCol
            x: 6
            y: 6
            width: parent.width - 12
            Text {
                x: 6
                height: 22
                verticalAlignment: Text.AlignVCenter
                text: "收藏到"
                color: Theme.alpha(Theme.textDim, 0.7)
                font.family: Theme.font
                font.pixelSize: 11
            }
            Repeater {
                model: Backend.playlists.filter(p => p.key !== "daily")
                delegate: Rectangle {
                    id: mrow
                    required property var modelData
                    required property int index
                    width: menuCol.width
                    height: 32
                    radius: 6
                    color: mma.containsMouse ? Theme.alpha(Theme.text, 0.08) : "transparent"
                    Text {
                        x: 8
                        anchors.verticalCenter: parent.verticalCenter
                        text: parent.modelData.name
                        color: Theme.text
                        font.family: Theme.font
                        font.pixelSize: 13
                    }
                    ClippingRectangle {
                        anchors.right: parent.right
                        anchors.rightMargin: 8
                        anchors.verticalCenter: parent.verticalCenter
                        width: 22
                        height: 22
                        radius: 4
                        color: Theme.alpha(Theme.primary, 0.18)
                        Image {
                            anchors.fill: parent
                            visible: mrow.modelData.cover !== ""
                            source: mrow.modelData.cover
                            fillMode: Image.PreserveAspectCrop
                            asynchronous: true
                        }
                    }
                    MouseArea {
                        id: mma
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: bar.collectTo(parent.index)
                    }
                }
            }
        }
    }

    function collectTo(i) {
        const pls = Backend.playlists.filter(p => p.key !== "daily");
        if (Backend.song && i >= 0 && i < pls.length) Backend.collect(Backend.song, pls[i].key);
        menuOpen = false;
    }
}
