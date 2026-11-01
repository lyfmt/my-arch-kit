#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""给 DMS 的 DankDash 壁纸页打补丁：选中壁纸按 d 移入壁纸回收站。

DMS 的 QML UI 是内嵌在 dms 二进制里的，运行时解包到
  $XDG_RUNTIME_DIR/danklinux-shell/<hash>/
本脚本对解包出来（或已同步到持久目录）的 WallpaperTab.qml 做幂等修改：
  * 增加 Quickshell.Io / qs.Services 导入
  * 增加 d 键处理与调用 wallpaper-trash 的 Process
  * 底部工具条增加一个回收站按钮

用法:
  dms_shell_patch.py <WallpaperTab.qml 路径>
"""

from __future__ import annotations

import sys
from pathlib import Path

MARK = "// >>> wallpaper-trash patch"

# --------------------------------------------------------------------- #
# 片段
# --------------------------------------------------------------------- #
IMPORT_OLD = "import Quickshell\nimport Quickshell.Widgets\n"
IMPORT_NEW = "import Quickshell\nimport Quickshell.Io\nimport Quickshell.Widgets\n"

SERVICES_OLD = "import qs.Modals.FileBrowser\nimport qs.Widgets\n"
SERVICES_NEW = "import qs.Modals.FileBrowser\nimport qs.Services\nimport qs.Widgets\n"

FUNCS_ANCHOR = "    function handleKeyEvent(event) {\n"
FUNCS_NEW = """    // >>> wallpaper-trash patch
    readonly property string wallpaperTrashBin: (Quickshell.env("HOME") || "") + "/.local/bin/wallpaper-trash"
    // 删除期间保持网格位置（让下一张顶上来），而不是跳回当前壁纸
    property bool keepGridSelection: false

    function selectedWallpaperPath() {
        if (wallpaperCount === 0)
            return "";
        const absoluteIndex = currentPage * itemsPerPage + gridIndex;
        if (absoluteIndex < 0 || absoluteIndex >= wallpaperCount)
            return "";
        return wallpaperPathAt(absoluteIndex);
    }

    function trashSelectedWallpaper() {
        const filePath = selectedWallpaperPath();
        if (!filePath)
            return false;
        if (wallpaperTrashProcess.running)
            return true;
        keepGridSelection = true;
        wallpaperTrashProcess.pendingName = filePath.substring(filePath.lastIndexOf('/') + 1);
        wallpaperTrashProcess.command = [wallpaperTrashBin, "put", filePath, "--json"];
        wallpaperTrashProcess.running = true;
        return true;
    }
    // <<< wallpaper-trash patch

""" + FUNCS_ANCHOR

KEY_ANCHOR = """        if (event.key === Qt.Key_F && (event.modifiers & Qt.ControlModifier)) {
            closeOverlays();
            focusSearch();
            return true;
        }
"""
KEY_NEW = KEY_ANCHOR + """
        if (event.key === Qt.Key_D && !(event.modifiers & (Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier))) {
            return trashSelectedWallpaper();
        }
"""

TIMER_ANCHOR = """    Timer {
        id: searchDebounce

        interval: 60
        repeat: false
        onTriggered: root.rebuildWallpaperList(false)
    }
"""
TIMER_NEW = TIMER_ANCHOR + """
    // >>> wallpaper-trash patch
    Process {
        id: wallpaperTrashProcess

        property string pendingName: ""
        running: false
        command: []

        stdout: StdioCollector {
            id: wallpaperTrashStdout
        }

        stderr: StdioCollector {
            id: wallpaperTrashStderr
        }

        onExited: exitCode => {
            const name = pendingName;
            pendingName = "";
            if (exitCode === 0) {
                ToastService.showInfo(I18n.tr("已移入壁纸回收站：%1").arg(name), I18n.tr("3 天后自动清除，期间可用 wallpaper-trash 还原"));
                trashRefreshTimer.restart();
            } else {
                root.keepGridSelection = false;
                let detail = "";
                try {
                    detail = (wallpaperTrashStderr.text || "").trim();
                } catch (e) {
                    detail = "";
                }
                ToastService.showError(I18n.tr("移入回收站失败"), detail || name);
            }
        }
    }

    Timer {
        id: trashRefreshTimer

        interval: 250
        repeat: false
        onTriggered: {
            if (wallpaperFolderModel.status === FolderListModel.Ready) {
                root.rebuildWallpaperList(false);
                root.keepGridSelection = false;
            } else {
                // 模型还在刷新（FolderListModel 删除文件时会短暂回到 Loading），
                // 保持当前位置，等它 Ready 再收尾
                restart();
            }
        }
    }
    // <<< wallpaper-trash patch
"""

BUTTON_ANCHOR = """                    Item {
                        id: searchControl
"""
BUTTON_NEW = """                    // >>> wallpaper-trash patch
                    DankActionButton {
                        id: trashButton

                        anchors.verticalCenter: parent.verticalCenter
                        iconName: "delete"
                        iconSize: 20
                        buttonSize: 32
                        opacity: enabled ? 0.7 : 0.3
                        enabled: root.wallpaperCount > 0
                        tooltipText: I18n.tr("移入壁纸回收站 (d)")
                        tooltipSide: "top"
                        onClicked: root.trashSelectedWallpaper()
                    }
                    // <<< wallpaper-trash patch

""" + BUTTON_ANCHOR

CONNECTIONS_ANCHOR = """    Connections {
        target: wallpaperFolderModel
        function onCountChanged() {
            if (wallpaperFolderModel.status === FolderListModel.Ready)
                rebuildWallpaperList(true);
        }
        function onStatusChanged() {
            rebuildWallpaperList(wallpaperFolderModel.status === FolderListModel.Ready);
        }
    }
"""
CONNECTIONS_NEW = """    Connections {
        target: wallpaperFolderModel
        function onCountChanged() {
            if (wallpaperFolderModel.status === FolderListModel.Ready)
                rebuildWallpaperList(!root.keepGridSelection);
        }
        function onStatusChanged() {
            // 删除壁纸时 FolderListModel 会短暂进入 Loading；此期间不要重建，
            // 否则会因为读到空列表而把选中项重置到第 0 页。
            if (root.keepGridSelection) {
                if (wallpaperFolderModel.status === FolderListModel.Ready)
                    rebuildWallpaperList(false);
                return;
            }
            rebuildWallpaperList(wallpaperFolderModel.status === FolderListModel.Ready);
        }
    }
"""

PATCHES = [
    (IMPORT_OLD, IMPORT_NEW, "Quickshell.Io import"),
    (SERVICES_OLD, SERVICES_NEW, "qs.Services import"),
    (FUNCS_ANCHOR, FUNCS_NEW, "trash helper functions"),
    (KEY_ANCHOR, KEY_NEW, "d key handler"),
    (TIMER_ANCHOR, TIMER_NEW, "trash Process/Timer"),
    (BUTTON_ANCHOR, BUTTON_NEW, "trash toolbar button"),
    (CONNECTIONS_ANCHOR, CONNECTIONS_NEW, "keep grid position on model change"),
]


def patch_text(text: str) -> tuple[str, list[str]]:
    if MARK in text:
        return text, ["已经打过补丁，跳过"]

    applied: list[str] = []
    for old, new, label in PATCHES:
        count = text.count(old)
        if count != 1:
            raise SystemExit(
                f"补丁失败：锚点「{label}」出现 {count} 次（应为 1）。"
                "DMS 版本可能已变化，请更新 dms_shell_patch.py。"
            )
        text = text.replace(old, new, 1)
        applied.append(label)
    return text, applied


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    path = Path(argv[1])
    if not path.is_file():
        print(f"找不到文件: {path}", file=sys.stderr)
        return 1

    original = path.read_text("utf-8")
    patched, applied = patch_text(original)
    if patched != original:
        path.write_text(patched, "utf-8")
    print(f"补丁完成: {path}")
    for label in applied:
        print(f"  - {label}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
