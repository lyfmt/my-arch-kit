pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Shapes
import qs.Common
import qs.Services
import qs.Modules.P3
import "P3IslandLayout.js" as P3L

// 通知中心面板的内容：头（计数、勿扰、清空）+ 一行一条的平铺列表（无卡片底，细分隔线）。
// 宽 384，放在面板气泡里；面板高度由 IslandController.p3Data.rows 决定，列表超出封顶时底部 40px 渐隐。
// 删除：行先淡出 / 滑走，再收高度；后端立刻 dismiss，面板晚 170ms（hold）才跟着收。
FocusScope {
    id: root

    required property var controller
    property bool live: false
    property bool reducedMotion: false
    property color surfaceColor: P3.isl

    readonly property int count: NotificationService.notifications.length
    readonly property int listHeight: P3L.centerListHeight(root.controller.p3Data.rows)
    readonly property bool overflowing: rows.count > 0 && rows.count * P3L.NC.row > P3L.NC.max + 1
    readonly property bool empty: rows.count === 0 && root.animating === 0
    property int hold: 0
    property int animating: 0
    property int selected: -1
    property var byKey: ({})
    property int nextKey: 1

    width: P3L.NC.w
    height: P3L.NC.head + root.listHeight + P3L.NC.pad

    function plain(text) {
        return String(text || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
    }

    function timeLabel(date) {
        if (!date)
            return "";
        const now = new Date();
        if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate())
            return Qt.formatTime(date, SettingsData.use24HourClock ? "HH:mm" : "h:mm");
        return (date.getMonth() + 1) + "/" + date.getDate();
    }

    // 新的在上；同一个应用的排在一起（按它最新一条的位置）
    function ordered() {
        const list = NotificationService.notifications.slice().reverse();
        const groups = [];
        const index = {};
        for (const w of list) {
            if (!w)
                continue;
            const app = w.appName || "";
            if (index[app] === undefined) {
                index[app] = groups.length;
                groups.push([]);
            }
            groups[index[app]].push(w);
        }
        return [].concat(...groups);
    }

    function rowAt(i) {
        return i >= 0 && i < rows.count ? rowRepeater.itemAt(i) : null;
    }

    function liveRows() {
        const out = [];
        for (let i = 0; i < rows.count; i++) {
            const r = rowRepeater.itemAt(i);
            if (r && !r.gone)
                out.push(r);
        }
        return out;
    }

    function sync() {
        if (root.animating > 0)
            return;
        const want = root.ordered();
        for (let i = rows.count - 1; i >= 0; i--) {
            const key = rows.get(i).key;
            if (want.indexOf(root.byKey[key]) === -1) {
                delete root.byKey[key];
                rows.remove(i);
            }
        }
        for (let i = 0; i < want.length; i++) {
            let at = -1;
            for (let j = i; j < rows.count; j++) {
                if (root.byKey[rows.get(j).key] === want[i]) {
                    at = j;
                    break;
                }
            }
            if (at === -1) {
                const key = root.nextKey++;
                root.byKey[key] = want[i];
                rows.insert(i, {
                    "key": key
                });
            } else if (at !== i) {
                rows.move(at, i, 1);
            }
        }
        root.select(Math.min(root.selected, root.liveRows().length - 1));
    }

    function select(i) {
        const list = root.liveRows();
        root.selected = list.length ? Math.max(-1, Math.min(list.length - 1, i)) : -1;
        const r = root.selected >= 0 ? list[root.selected] : null;
        if (!r)
            return;
        if (r.y < flick.contentY)
            flick.contentY = r.y;
        else if (r.y + P3L.NC.row > flick.contentY + flick.height)
            flick.contentY = Math.min(flick.contentHeight - flick.height, r.y + P3L.NC.row - flick.height);
    }

    function dismiss(row, dir) {
        if (!row || row.gone)
            return;
        const w = row.wrapper;
        row.collapse(dir);
        root.hold++;
        holdTimer.restart();
        if (w)
            NotificationService.dismissNotification(w);
        root.select(Math.min(root.selected, root.liveRows().length - 1));
    }

    // 点一行：默认动作 / 聚焦或启动发通知的应用（P3IslandOpen），这一行清掉，岛收起
    function activate(row) {
        if (!row || row.gone)
            return;
        P3IslandOpen.open(row.wrapper);
        root.dismiss(row, 0);
        closeTimer.restart();
    }

    function clearAll() {
        const list = root.liveRows();
        if (!list.length)
            return;
        list.forEach((r, i) => r.sweep(i));
        root.selected = -1;
        NotificationService.clearAllNotifications();
    }

    function toggleDnd() {
        SessionData.setDoNotDisturb(!SessionData.doNotDisturb);
    }

    function focusFace() {
        root.forceActiveFocus(Qt.OtherFocusReason);
        return true;
    }

    onLiveChanged: {
        if (root.live)
            NotificationService.markNotificationsSeen();
        else
            root.selected = -1;
    }
    onAnimatingChanged: {
        if (root.animating === 0)
            root.sync();
    }
    Component.onCompleted: root.sync()

    Connections {
        target: NotificationService

        function onNotificationsChanged() {
            root.sync();
            if (root.live)
                NotificationService.markNotificationsSeen();
        }
    }

    Timer {
        id: holdTimer
        interval: 170
        onTriggered: root.hold = 0
    }

    Timer {
        id: closeTimer
        interval: 160
        onTriggered: root.controller.requestCollapse()
    }

    Keys.onPressed: event => {
        const n = root.liveRows().length;
        switch (event.key) {
        case Qt.Key_Down:
            if (n)
                root.select(root.selected < 0 ? 0 : (root.selected + 1) % n);
            event.accepted = true;
            return;
        case Qt.Key_Up:
            if (n)
                root.select(root.selected <= 0 ? n - 1 : root.selected - 1);
            event.accepted = true;
            return;
        case Qt.Key_Return:
        case Qt.Key_Enter:
            if (root.selected >= 0) {
                root.activate(root.liveRows()[root.selected]);
                event.accepted = true;
            }
            return;
        case Qt.Key_Delete:
        case Qt.Key_Backspace:
            if (root.selected >= 0) {
                root.dismiss(root.liveRows()[root.selected], 0);
                event.accepted = true;
            }
            return;
        case Qt.Key_Escape:
            if (root.selected >= 0)
                root.selected = -1;
            else
                root.controller.requestCollapse();
            event.accepted = true;
            return;
        }
    }

    ListModel {
        id: rows
    }

    // ---------------------------------------------------------------- 头
    Item {
        id: head

        x: 6
        width: parent.width - 12
        height: P3L.NC.head

        P3IslandText {
            id: total

            x: 16
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: 3
            width: Math.max(14, implicitWidth)
            face: "d"
            size: 30
            text: root.count ? String(root.count) : ""
        }

        P3IslandText {
            anchors.left: total.right
            anchors.leftMargin: 10
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: 6
            face: "l"
            size: 13
            color: P3.dim
            text: "Notifications"
        }

        Rectangle {
            id: clearButton

            readonly property bool enabledNow: root.count > 0

            anchors.right: parent.right
            anchors.rightMargin: 10
            anchors.verticalCenter: parent.verticalCenter
            anchors.verticalCenterOffset: 3
            width: Math.max(28, clearLabel.implicitWidth + 16)
            height: 28
            radius: 14
            color: "transparent"
            opacity: enabledNow ? 1 : 0.35

            P3IslandText {
                id: clearLabel

                anchors.centerIn: parent
                anchors.verticalCenterOffset: 1
                face: "l"
                size: 13
                color: P3.dim
                text: "Clear"
            }

            MouseArea {
                anchors.fill: parent
                enabled: clearButton.enabledNow
                cursorShape: Qt.PointingHandCursor
                onClicked: root.clearAll()
            }
        }

        Rectangle {
            id: dndButton

            readonly property bool on: SessionData.doNotDisturb

            anchors.right: clearButton.left
            anchors.rightMargin: 10
            anchors.verticalCenter: clearButton.verticalCenter
            width: 28
            height: 28
            radius: 14
            color: on ? P3.fill : "transparent"

            Behavior on color {
                ColorAnimation {
                    duration: root.reducedMotion ? 0 : 200
                }
            }

            P3IslandIcon {
                anchors.centerIn: parent
                width: 13
                height: 13
                name: "moon"
                color: dndButton.on ? P3.ink : P3.dim
            }

            MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: root.toggleDnd()
            }
        }
    }

    // ---------------------------------------------------------------- 列表
    P3IslandText {
        y: P3L.NC.head
        width: parent.width
        height: P3L.NC.empty
        visible: root.empty
        face: "zh"
        size: 12
        color: P3.dim
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        text: "没有新通知"
    }

    Flickable {
        id: flick

        x: 6
        y: P3L.NC.head
        width: parent.width - 12
        height: root.listHeight
        visible: !root.empty
        contentWidth: width
        contentHeight: column.height
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickableDirection: Flickable.VerticalFlick
        pressDelay: 0

        Column {
            id: column

            width: flick.width

            Repeater {
                id: rowRepeater

                model: rows

                delegate: Item {
                    id: row

                    required property int index
                    required property int key
                    readonly property var wrapper: root.byKey[key] ?? null
                    readonly property bool latin: /^[\x20-\x7e]+$/.test(row.appText)
                    readonly property string appText: row.wrapper?.appName ?? ""
                    readonly property int liveIndex: {
                        root.selected;
                        return root.liveRows().indexOf(row);
                    }
                    readonly property bool isSelected: !row.gone && root.selected >= 0 && row.liveIndex === root.selected
                    readonly property Item above: row.index > 0 ? rowRepeater.itemAt(row.index - 1) : null
                    property bool gone: false
                    property real dx: 0
                    property bool swiping: false

                    width: column.width
                    height: P3L.NC.row
                    z: row.isSelected ? 1 : 0

                    function collapse(dir) {
                        row.gone = true;
                        root.animating++;
                        if (root.reducedMotion) {
                            row.height = 0;
                            row.opacity = 0;
                            root.animating--;
                            return;
                        }
                        out.dir = dir;
                        out.start();
                    }

                    function sweep(i) {
                        row.gone = true;
                        root.animating++;
                        if (root.reducedMotion) {
                            row.opacity = 0;
                            root.animating--;
                            return;
                        }
                        sweepAnim.delay = i * 35;
                        sweepAnim.start();
                    }

                    Item {
                        id: body

                        width: parent.width
                        height: P3L.NC.row
                        x: row.dx
                        transformOrigin: Item.Center

                        Rectangle {
                            anchors.fill: parent
                            radius: 14
                            color: P3.alpha(P3.fill, 0.07)
                            opacity: row.isSelected ? 1 : 0

                            Behavior on opacity {
                                NumberAnimation {
                                    duration: root.reducedMotion ? 0 : 200
                                }
                            }
                        }

                        Rectangle {
                            width: parent.width
                            height: 1
                            color: P3.alpha(P3.fill, 0.10)
                            visible: row.index > 0 && !row.isSelected && !(row.above && row.above.isSelected)
                        }

                        // 选中：左上角一颗呼吸光点（与菜单同款）
                        Item {
                            id: dot

                            x: 6 + 3.5
                            y: 8 + 3.5
                            opacity: row.isSelected ? 1 : 0
                            scale: row.isSelected ? 1 : 0.3
                            property real breathe: 0

                            Behavior on opacity {
                                NumberAnimation {
                                    duration: root.reducedMotion ? 0 : 200
                                }
                            }
                            Behavior on scale {
                                NumberAnimation {
                                    duration: root.reducedMotion ? 0 : 350
                                    easing.type: Easing.BezierSpline
                                    easing.bezierCurve: P3.spring
                                }
                            }

                            SequentialAnimation on breathe {
                                running: row.isSelected && !root.reducedMotion
                                loops: Animation.Infinite
                                NumberAnimation {
                                    to: 1
                                    duration: 900
                                    easing.type: Easing.InOutSine
                                }
                                NumberAnimation {
                                    to: 0
                                    duration: 900
                                    easing.type: Easing.InOutSine
                                }
                            }

                            Rectangle {
                                readonly property real s: 7 + 2 * (8 + 6 * dot.breathe)
                                x: -s / 2
                                y: -s / 2
                                width: s
                                height: s
                                radius: s / 2
                                color: P3.alpha(P3.sky, 0.3 - 0.05 * dot.breathe)
                            }
                            Rectangle {
                                readonly property real s: 7 + 2 * (2.5 + 1 * dot.breathe)
                                x: -s / 2
                                y: -s / 2
                                width: s
                                height: s
                                radius: s / 2
                                color: P3.alpha(P3.sky, 0.85 + 0.1 * dot.breathe)
                            }
                            Rectangle {
                                x: -3.5
                                y: -3.5
                                width: 7
                                height: 7
                                radius: 3.5
                                color: P3.fill
                            }
                        }

                        P3IslandAppIcon {
                            x: 14
                            y: 15
                            size: 32
                            radius: 9
                            image: row.wrapper?.displayImage ?? ""
                            iconName: row.wrapper?.fallbackIconName ?? ""
                            label: row.appText
                        }

                        Column {
                            x: 58
                            y: 11
                            width: parent.width - 58 - 40
                            spacing: 2

                            Item {
                                width: parent.width
                                height: Math.max(app.height, time.height)

                                P3IslandText {
                                    id: app

                                    width: parent.width - time.implicitWidth - 8
                                    anchors.baseline: time.baseline
                                    face: row.latin ? "l" : "zh"
                                    spacing: row.latin ? 0.14 : 0.04
                                    size: 12
                                    color: P3.dim
                                    elide: Text.ElideRight
                                    text: row.appText
                                }

                                P3IslandText {
                                    id: time

                                    anchors.right: parent.right
                                    face: "d"
                                    size: 13
                                    color: P3.dim
                                    text: root.timeLabel(row.wrapper?.time ?? null)
                                }
                            }

                            P3IslandText {
                                width: parent.width
                                face: "zh"
                                size: 14
                                elide: Text.ElideRight
                                text: root.plain(row.wrapper?.summary)
                            }

                            P3IslandText {
                                width: parent.width
                                face: "zh"
                                size: 12.5
                                color: P3.dim
                                elide: Text.ElideRight
                                text: root.plain(row.wrapper?.body)
                            }
                        }

                        MouseArea {
                            id: press

                            property real x0: 0
                            property real y0: 0
                            property bool moved: false

                            anchors.fill: parent
                            enabled: !row.gone
                            cursorShape: Qt.PointingHandCursor
                            preventStealing: row.swiping
                            onPressed: mouse => {
                                const p = mapToItem(root, mouse.x, mouse.y);
                                x0 = p.x;
                                y0 = p.y;
                                moved = false;
                                back.stop();
                            }
                            onPositionChanged: mouse => {
                                const p = mapToItem(root, mouse.x, mouse.y);
                                const dx = p.x - x0;
                                if (!row.swiping && Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(p.y - y0))
                                    row.swiping = true;
                                if (!row.swiping)
                                    return;
                                moved = true;
                                row.dx = dx;
                                body.opacity = 1 - Math.min(0.6, Math.abs(dx) / 300);
                            }
                            onReleased: {
                                const dx = row.dx;
                                row.swiping = false;
                                if (Math.abs(dx) > 90) {
                                    root.dismiss(row, dx > 0 ? 1 : -1);
                                    return;
                                }
                                if (moved) {
                                    back.start();
                                    return;
                                }
                                root.activate(row);
                            }
                            onCanceled: {
                                row.swiping = false;
                                back.start();
                            }
                        }

                        // ×：右侧居中，平时半透明，选中时全亮
                        Item {
                            anchors.right: parent.right
                            anchors.rightMargin: 10
                            anchors.verticalCenter: parent.verticalCenter
                            width: 24
                            height: 24
                            opacity: row.isSelected || closeArea.containsMouse ? 1 : 0.45

                            Behavior on opacity {
                                NumberAnimation {
                                    duration: root.reducedMotion ? 0 : 150
                                }
                            }

                            Shape {
                                anchors.centerIn: parent
                                width: 10
                                height: 10
                                preferredRendererType: Shape.CurveRenderer

                                ShapePath {
                                    strokeColor: P3.tx
                                    strokeWidth: 2.2
                                    capStyle: ShapePath.RoundCap
                                    fillColor: "transparent"
                                    startX: 2
                                    startY: 2
                                    PathLine {
                                        x: 8
                                        y: 8
                                    }
                                    PathMove {
                                        x: 8
                                        y: 2
                                    }
                                    PathLine {
                                        x: 2
                                        y: 8
                                    }
                                }
                            }

                            MouseArea {
                                id: closeArea

                                anchors.fill: parent
                                hoverEnabled: false
                                enabled: !row.gone
                                cursorShape: Qt.PointingHandCursor
                                onClicked: root.dismiss(row, 0)
                            }
                        }
                    }

                    // 横滑没过线：弹回
                    ParallelAnimation {
                        id: back

                        NumberAnimation {
                            target: row
                            property: "dx"
                            to: 0
                            duration: root.reducedMotion ? 0 : 460
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: P3.spring
                        }
                        NumberAnimation {
                            target: body
                            property: "opacity"
                            to: 1
                            duration: root.reducedMotion ? 0 : 460
                        }
                    }

                    // 删除：先淡出（甩向一侧 / 原地缩小），再收高度
                    SequentialAnimation {
                        id: out

                        property int dir: 0

                        ParallelAnimation {
                            NumberAnimation {
                                target: body
                                property: "opacity"
                                to: 0
                                duration: out.dir ? 176 : 160
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: [0.45, 0, 0.2, 1, 1, 1]
                            }
                            NumberAnimation {
                                target: row
                                property: "dx"
                                to: out.dir * 400
                                duration: out.dir ? 176 : 0
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: [0.45, 0, 0.2, 1, 1, 1]
                            }
                            NumberAnimation {
                                target: body
                                property: "scale"
                                to: out.dir ? 1 : 0.94
                                duration: out.dir ? 0 : 160
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: [0.45, 0, 0.2, 1, 1, 1]
                            }
                        }
                        NumberAnimation {
                            target: row
                            property: "height"
                            to: 0
                            duration: out.dir ? 264 : 240
                            easing.type: Easing.BezierSpline
                            easing.bezierCurve: [0.45, 0, 0.2, 1, 1, 1]
                        }
                        ScriptAction {
                            script: root.animating--
                        }
                    }

                    // 清空：依次向右滑走
                    SequentialAnimation {
                        id: sweepAnim

                        property int delay: 0

                        PauseAnimation {
                            duration: sweepAnim.delay
                        }
                        ParallelAnimation {
                            NumberAnimation {
                                target: row
                                property: "dx"
                                to: 60
                                duration: 240
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: [0.4, 0, 0.6, 1, 1, 1]
                            }
                            NumberAnimation {
                                target: body
                                property: "opacity"
                                to: 0
                                duration: 240
                                easing.type: Easing.BezierSpline
                                easing.bezierCurve: [0.4, 0, 0.6, 1, 1, 1]
                            }
                        }
                        ScriptAction {
                            script: root.animating--
                        }
                    }
                }
            }
        }
    }

    // 超出封顶：底部 40px 渐隐进岛面
    Rectangle {
        x: flick.x
        y: flick.y + flick.height - 40
        width: flick.width
        height: 40
        visible: root.overflowing && !root.empty
        gradient: Gradient {
            GradientStop {
                position: 0
                color: P3.alpha(root.surfaceColor, 0)
            }
            GradientStop {
                position: 1
                color: root.surfaceColor
            }
        }
    }
}
