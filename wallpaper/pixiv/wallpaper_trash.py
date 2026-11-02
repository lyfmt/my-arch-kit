#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""壁纸回收站（软删除 + 3 天自动清理 + 阻止重新下载）。

设计:
  * 回收站目录默认 <download.root>/.trash
  * 删除时把图片和同名 .json 元数据一起移入 files/，并写入 index.json
  * 记录被删除的「作品:页」(iid:page) 到永久屏蔽列表 blocked，
    同步脚本遇到这些键就直接跳过，不会重新下载
  * 超过 retention_days（默认 3 天）的条目在定时任务里自动清除文件，
    但永久屏蔽记录保留，避免以后又被拉回来

用法:
  wallpaper-trash put <path> [--json]        # 移入回收站
  wallpaper-trash list [--json]              # 列出回收站内容
  wallpaper-trash restore <key> [--json]     # 还原
  wallpaper-trash purge [--days N] [--json]  # 清理过期项（默认 3 天）
  wallpaper-trash count [--json]             # 回收站条目数
  wallpaper-trash blocked [--json]           # 打印永久屏蔽键
  wallpaper-trash is-blocked <iid:page>      # 退出码 0 = 已删除过，不应再下载
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

try:
    import tomllib  # py>=3.11
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib  # type: ignore

DEFAULT_RETENTION_DAYS = 3
_KEY_RE = re.compile(r"^(\d+)_p(\d+)")


def expand(p: str | os.PathLike) -> Path:
    return Path(os.path.expanduser(os.path.expandvars(str(p)))).resolve()


def default_config_path() -> Path:
    return Path(__file__).resolve().with_name("config.toml")


def artwork_key(name: str) -> str:
    """从文件名推导同步去重键；Pixiv 图返回 iid:page，其它返回 file:<name>。"""
    m = _KEY_RE.match(name or "")
    if m:
        return f"{m.group(1)}:{m.group(2)}"
    return f"file:{name}"


class WallpaperTrash:
    """壁纸回收站。可被 pixiv_wallpaper.py 直接导入使用。"""

    def __init__(
        self,
        root: str | os.PathLike,
        trash_dir: str | os.PathLike | None = None,
        retention_days: int = DEFAULT_RETENTION_DAYS,
        rotation_dir: str | os.PathLike | None = None,
    ) -> None:
        self.root = Path(root)
        self.trash_dir = Path(trash_dir) if trash_dir else self.root / ".trash"
        self.files_dir = self.trash_dir / "files"
        self.index_path = self.trash_dir / "index.json"
        self.retention_days = max(0, int(retention_days))
        self.rotation_dir = Path(rotation_dir) if rotation_dir else None
        self._index: dict | None = None

    # ------------------------------------------------------------------ #
    # 索引
    # ------------------------------------------------------------------ #
    @property
    def index(self) -> dict:
        if self._index is None:
            self._index = self._load()
        return self._index

    def _load(self) -> dict:
        data = {"version": 1, "entries": {}, "blocked": {}}
        if self.index_path.exists():
            try:
                raw = json.loads(self.index_path.read_text("utf-8"))
                if isinstance(raw, dict):
                    data["version"] = raw.get("version", 1)
                    data["entries"] = raw.get("entries") or {}
                    data["blocked"] = raw.get("blocked") or {}
            except Exception:  # noqa: BLE001
                pass
        return data

    def save(self) -> None:
        self.trash_dir.mkdir(parents=True, exist_ok=True)
        tmp = self.index_path.with_name(self.index_path.name + ".tmp")
        tmp.write_text(json.dumps(self.index, ensure_ascii=False, indent=1), "utf-8")
        tmp.replace(self.index_path)

    # ------------------------------------------------------------------ #
    # 查询
    # ------------------------------------------------------------------ #
    def is_blocked(self, key: str) -> bool:
        return key in self.index["blocked"] or key in self.index["entries"]

    def blocked_keys(self) -> list[str]:
        return sorted(set(self.index["blocked"]) | set(self.index["entries"]))

    def count(self) -> int:
        return len(self.index["entries"])

    def list_entries(self, now: float | None = None) -> list[dict]:
        now = time.time() if now is None else now
        out: list[dict] = []
        for key, e in self.index["entries"].items():
            age = now - float(e.get("trashed_at", now))
            out.append({
                **e,
                "key": key,
                "age_seconds": age,
                "remaining_seconds": max(0.0, self.retention_days * 86400 - age),
            })
        out.sort(key=lambda x: x.get("trashed_at", 0), reverse=True)
        return out

    # ------------------------------------------------------------------ #
    # 动作
    # ------------------------------------------------------------------ #
    def put(self, path: str | os.PathLike, now: float | None = None) -> dict:
        """把壁纸（及同名 .json）移入回收站。支持传入轮换目录里的符号链接。"""
        now = time.time() if now is None else now
        p = Path(path)
        if not p.exists() and not p.is_symlink():
            raise FileNotFoundError(f"文件不存在: {p}")

        is_link = p.is_symlink()
        real = p.resolve()
        if not real.exists():
            # 悬空链接：直接把链接删掉即可
            if is_link:
                p.unlink(missing_ok=True)
                return {"ok": True, "key": None, "note": "dangling_symlink_removed"}
            raise FileNotFoundError(f"目标不存在: {real}")

        name = real.name
        key = artwork_key(name)
        sidecar_real = real.with_suffix(".json")

        if key in self.index["entries"]:
            self._remove_links(real)
            return {"ok": True, "key": key, "note": "already_trashed"}

        self.files_dir.mkdir(parents=True, exist_ok=True)
        dest = self.files_dir / name
        if dest.exists():
            dest = self.files_dir / f"{int(now)}_{name}"
        shutil.move(str(real), str(dest))

        sidecar_dest: Path | None = None
        if sidecar_real.exists():
            sidecar_dest = self.files_dir / sidecar_real.name
            if sidecar_dest.exists():
                sidecar_dest = self.files_dir / f"{int(now)}_{sidecar_real.name}"
            shutil.move(str(sidecar_real), str(sidecar_dest))

        # 轮换目录里指向这张图的符号链接一并清掉（避免悬空）
        self._remove_links(real)

        entry = {
            "key": key,
            "file": dest.name,
            "sidecar": sidecar_dest.name if sidecar_dest else None,
            "orig_path": str(real),
            "orig_name": name,
            "trashed_at": now,
            "expires_at": now + self.retention_days * 86400,
        }
        self.index["entries"][key] = entry
        self.index["blocked"].setdefault(key, now)
        self.save()
        return {"ok": True, "key": key, "file": name, "expires_at": entry["expires_at"]}

    def restore(self, key: str) -> dict:
        entry = self.index["entries"].get(key)
        if not entry:
            return {"ok": False, "error": f"未找到回收站条目: {key}"}

        src = self.files_dir / entry["file"]
        dst = Path(entry["orig_path"])
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.exists():
            if dst.exists():
                dst = dst.with_name(f"{dst.stem}.restored{dst.suffix}")
            shutil.move(str(src), str(dst))

        sidecar = entry.get("sidecar")
        if sidecar:
            ssrc = self.files_dir / sidecar
            if ssrc.exists():
                sdst = dst.with_suffix(".json")
                if sdst.exists():
                    sdst = sdst.with_name(f"{sdst.stem}.restored{sdst.suffix}")
                shutil.move(str(ssrc), str(sdst))

        del self.index["entries"][key]
        self.index["blocked"].pop(key, None)
        self.save()
        return {"ok": True, "key": key, "restored_to": str(dst)}

    def purge(self, days: int | None = None, now: float | None = None) -> list[str]:
        """删除超过保留期的条目文件。永久屏蔽记录保留，避免重新下载。"""
        days = self.retention_days if days is None else max(0, int(days))
        now = time.time() if now is None else now
        cutoff = now - days * 86400
        purged: list[str] = []
        for key, entry in list(self.index["entries"].items()):
            if float(entry.get("trashed_at", 0)) > cutoff:
                continue
            for field in ("file", "sidecar"):
                fn = entry.get(field)
                if not fn:
                    continue
                f = self.files_dir / fn
                try:
                    f.unlink(missing_ok=True)
                except OSError:
                    pass
            del self.index["entries"][key]
            purged.append(key)
        if purged:
            self.save()
        return purged

    # ------------------------------------------------------------------ #
    # 内部
    # ------------------------------------------------------------------ #
    def _remove_links(self, real: Path) -> None:
        target = str(real)
        candidates: list[Path] = []
        # 轮换目录里可能有多层 <screen>/ 子目录，需要递归
        if self.rotation_dir and self.rotation_dir.is_dir():
            candidates.extend(self.rotation_dir.rglob("*"))
        # 图片同目录下只扫一层，避免大图库递归变慢
        if real.parent.is_dir():
            candidates.extend(real.parent.glob("*"))
        for link in candidates:
            if not link.is_symlink():
                continue
            try:
                if os.path.realpath(link) == target:
                    link.unlink(missing_ok=True)
            except OSError:
                pass


# ---------------------------------------------------------------------- #
# 配置
# ---------------------------------------------------------------------- #
def load_from_config(
    config_path: str | os.PathLike | None = None,
    root_override: str | os.PathLike | None = None,
    trash_dir_override: str | os.PathLike | None = None,
) -> tuple[WallpaperTrash, dict]:
    cfg_path = Path(config_path) if config_path else default_config_path()
    raw: dict = {}
    if cfg_path.exists():
        try:
            raw = tomllib.loads(cfg_path.read_text("utf-8"))
        except Exception:  # noqa: BLE001
            raw = {}

    dl = raw.get("download", {}) or {}
    sec = raw.get("trash", {}) or {}
    rot = raw.get("rotation", {}) or {}

    root = expand(root_override) if root_override else expand(
        dl.get("root", "~/Pictures/Wallpapers/Pixiv")
    )
    if trash_dir_override:
        tdir = expand(trash_dir_override)
    elif sec.get("dir"):
        tdir = expand(sec["dir"])
    else:
        tdir = root / ".trash"

    retention = int(sec.get("retention_days", DEFAULT_RETENTION_DAYS) or DEFAULT_RETENTION_DAYS)
    rotation_dir = expand(rot["dir"]) if rot.get("dir") else None
    return WallpaperTrash(root, tdir, retention, rotation_dir), sec


def _fmt_duration(seconds: float) -> str:
    seconds = int(max(0, seconds))
    d, rem = divmod(seconds, 86400)
    h, rem = divmod(rem, 3600)
    m, _ = divmod(rem, 60)
    if d:
        return f"{d}天{h}小时"
    if h:
        return f"{h}小时{m}分"
    return f"{m}分"


# ---------------------------------------------------------------------- #
# CLI
# ---------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="壁纸回收站")
    ap.add_argument("--config", default=None, help="config.toml 路径")
    ap.add_argument("--root", default=None, help="覆盖壁纸根目录")
    ap.add_argument("--trash-dir", default=None, help="覆盖回收站目录")
    ap.add_argument("--json", action="store_true", help="输出 JSON")

    # 允许 --json 也写在子命令后面（QML 调用时更直观）
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--json", action="store_true", default=argparse.SUPPRESS)

    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("put", help="移入回收站", parents=[common])
    p.add_argument("path")

    sub.add_parser("list", help="列出回收站内容", parents=[common])

    p = sub.add_parser("restore", help="还原", parents=[common])
    p.add_argument("key")

    p = sub.add_parser("purge", help="清理过期项", parents=[common])
    p.add_argument("--days", type=int, default=None)

    sub.add_parser("count", help="条目数", parents=[common])
    sub.add_parser("blocked", help="打印永久屏蔽键", parents=[common])

    p = sub.add_parser("is-blocked", help="检查某键是否已被删除过", parents=[common])
    p.add_argument("key")

    return ap


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    trash, _sec = load_from_config(args.config, args.root, args.trash_dir)

    if args.cmd == "put":
        try:
            result = trash.put(args.path)
        except Exception as exc:  # noqa: BLE001
            if args.json:
                print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
            else:
                print(f"失败: {exc}", file=sys.stderr)
            return 1
        if args.json:
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(f"已移入壁纸回收站: {result.get('file') or args.path} (key={result.get('key')})")
        return 0

    if args.cmd == "list":
        entries = trash.list_entries()
        if args.json:
            print(json.dumps(entries, ensure_ascii=False, indent=1))
        else:
            if not entries:
                print("回收站是空的")
            for e in entries:
                print(
                    f"[{e['key']}] {e['orig_name']}  "
                    f"剩余 {_fmt_duration(e['remaining_seconds'])}"
                )
        return 0

    if args.cmd == "restore":
        result = trash.restore(args.key)
        if args.json:
            print(json.dumps(result, ensure_ascii=False))
        elif result.get("ok"):
            print(f"已还原到: {result['restored_to']}")
        else:
            print(f"失败: {result.get('error')}", file=sys.stderr)
        return 0 if result.get("ok") else 1

    if args.cmd == "purge":
        purged = trash.purge(args.days)
        if args.json:
            print(json.dumps({"purged": purged, "count": len(purged)}, ensure_ascii=False))
        else:
            print(f"已清除 {len(purged)} 项过期壁纸")
        return 0

    if args.cmd == "count":
        n = trash.count()
        if args.json:
            print(json.dumps({"count": n}))
        else:
            print(n)
        return 0

    if args.cmd == "blocked":
        keys = trash.blocked_keys()
        if args.json:
            print(json.dumps(keys, ensure_ascii=False))
        else:
            print("\n".join(keys))
        return 0

    if args.cmd == "is-blocked":
        return 0 if trash.is_blocked(args.key) else 1

    return 2


if __name__ == "__main__":
    sys.exit(main())
