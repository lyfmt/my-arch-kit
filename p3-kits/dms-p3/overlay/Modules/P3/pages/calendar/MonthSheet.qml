import QtQuick
import qs.Modules.P3

// 一个月（原型 .cl-sheet）：月名 + 年份 + 6×7 格（周一开头），翻月时整页一起滑动。
// host 是 CalendarPage：提供 keyOf、eventsOf、evRev、todayKey、select、still。
Item {
    id: ms

    property var host: null
    property int year: 2026
    property int month: 0
    // false：正在滑走的旧页，格子不再参与焦点
    property bool live: true

    readonly property int lead: (new Date(year, month, 1).getDay() + 6) % 7
    readonly property real cellW: 860 / 7
    readonly property var monthNames: ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]

    property real dy: 0

    width: 860
    height: 680
    transform: Translate {
        y: ms.dy
    }

    function cellAt(key) {
        for (let i = 0; i < rep.count; i++) {
            const c = rep.itemAt(i);
            if (c && c.key === key)
                return c;
        }
        return null;
    }
    // dir > 0：从下方进入；dir < 0：从上方进入
    function enter(dir) {
        leaveAnim.stop();
        inDy.from = dir * 90;
        enterAnim.restart();
    }
    function leave(dir) {
        live = false;
        enterAnim.stop();
        outDy.to = -dir * 60;
        leaveAnim.restart();
    }

    // 月名 76px、年份 40px dim，底对齐（.cl-mon 高 76，gap 18，padding-right .06em）
    InkText {
        id: monT
        x: 0
        y: 76 - 0.101 * 76 - baselineOffset
        px: 76
        text: ms.monthNames[ms.month] || ""
    }
    InkText {
        x: monT.implicitWidth + 76 * 0.06 + 18
        y: 74 - 0.101 * 40 - baselineOffset
        px: 40
        color: P3.dim
        text: String(ms.year)
    }

    Rectangle {
        y: 140
        width: 860
        height: 1
        color: P3.line
    }

    Repeater {
        id: rep
        model: 42
        delegate: DayCell {
            sheet: ms
        }
    }

    ParallelAnimation {
        id: enterAnim
        NumberAnimation {
            id: inDy
            target: ms
            property: "dy"
            to: 0
            duration: 380
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
        NumberAnimation {
            target: ms
            property: "opacity"
            from: 0
            to: 1
            duration: 380
            easing.type: Easing.BezierSpline
            easing.bezierCurve: P3.ease
        }
    }
    SequentialAnimation {
        id: leaveAnim
        ParallelAnimation {
            NumberAnimation {
                id: outDy
                target: ms
                property: "dy"
                duration: 300
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
            NumberAnimation {
                target: ms
                property: "opacity"
                to: 0
                duration: 300
                easing.type: Easing.BezierSpline
                easing.bezierCurve: P3.ease
            }
        }
        ScriptAction {
            script: ms.destroy()
        }
    }
}
