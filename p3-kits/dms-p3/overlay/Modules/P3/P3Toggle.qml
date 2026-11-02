import QtQuick

// 开关行（原型 .p-row.p-toggle）：Enter / 单击翻转 checked 并发 toggled(value)。
// 页面在 onToggled 里调 P3Sys 动作；失败时把 checked 改回去（原型的 revert）。
//   P3Toggle { label: "BLUETOOTH"; checked: Bt.state.on; onToggled: v => P3Page.run(Bt.setPower(v), { revert: () => checked = !v }) }
P3Row {
    id: root

    property bool checked: false
    signal toggled(bool value)

    onActivated: {
        checked = !checked;
        toggled(checked);
    }

    P3Switch {
        on: root.checked
        host: root
    }
}
