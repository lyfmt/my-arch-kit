#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pixiv 壁纸同步 (数据源: https://pixiv.pictures/ 登录态 + api.cocomi.eu.org 代理)

同步两类内容:
  * 我的收藏      (Pixiv 公开收藏)          -> 收藏/
  * 我关注的画师  (每位画师的近期作品预览)  -> 关注/<画师>/

自动化(增量):
  * 新增的收藏            -> 下载
  * 新关注的画师及其作品  -> 下载
  (已关注画师后来发布的新作不会重复抓, 避免一次拉爆图库)

尺寸校验:
  只保留 横版(宽>高) 且 分辨率达标 且 宽高比接近任一屏幕 的图像;
  尺寸差得多的(竖图/方图/超宽全景)直接跳过, 不下载。

用法:
  ./run.sh                      # 手动跑一轮(增量)
  ./run.sh --dry-run            # 只统计不写文件
  ./run.sh --only bookmarks     # 只同步收藏
  ./run.sh --only following     # 只同步关注画师
  ./run.sh --limit 20           # 本轮最多下载 20 张(0 = 不限制)
  python3 pixiv_wallpaper.py --probe          # 测试登录态/查看账号
  python3 pixiv_wallpaper.py --refresh-auth   # 从浏览器刷新登录态
  python3 pixiv_wallpaper.py --rotate         # 每块屏立即换一张
  python3 pixiv_wallpaper.py --sync-rotation  # 重建每屏轮换目录
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import os
import random
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests
from PIL import Image, UnidentifiedImageError

try:
    import tomllib  # py>=3.11
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib  # type: ignore

# 同目录下的壁纸回收站模块
sys.path.insert(0, str(Path(__file__).resolve().parent))
from wallpaper_trash import DEFAULT_RETENTION_DAYS, WallpaperTrash  # noqa: E402

LOG = logging.getLogger("pixiv-wallpaper")

IMG_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
DEFAULT_API_BASE = "https://api.cocomi.eu.org/api/pixiv-now"
DEFAULT_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
)


# --------------------------------------------------------------------------- #
# 工具
# --------------------------------------------------------------------------- #
def expand(p: str) -> Path:
    return Path(os.path.expanduser(os.path.expandvars(p))).resolve()


_slug_re = re.compile(r'[\\/:*?"<>|\x00-\x1f]+')


def slugify(text: str, max_len: int = 40) -> str:
    text = _slug_re.sub("_", text or "").strip(" ._")
    text = re.sub(r"\s+", " ", text)
    if len(text) > max_len:
        text = text[:max_len].rstrip()
    return text


def human(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n}B"


def niri_outputs() -> dict[str, dict]:
    """当前连接的显示器信息（name/model/current_mode/modes/logical...）。"""
    try:
        r = subprocess.run(
            ["niri", "msg", "--json", "outputs"],
            capture_output=True, text=True, timeout=5,
        )
        return json.loads(r.stdout) if r.stdout.strip() else {}
    except Exception:  # noqa: BLE001
        return {}


def connected_screens(preferred: list[str] | None = None) -> list[str]:
    """当前连接的输出名列表。

    preferred 里的每一项可用「输出名」(eDP-1) 或「显示器型号」(MNG007DA5-1)
    匹配；匹配上的按 preferred 顺序排在前面，未列出的已连接屏幕再按 niri
    顺序追加。这样即使输出名在 eDP-1/eDP-2 之间漂移，或用型号写在配置里，
    都能正确命中，不会再把壁纸设到一个不存在的屏幕名上。
    """
    outs = niri_outputs()
    if not outs:
        # 拿不到 niri（例如不在会话里）时退回配置，交给 DMS 自己解析
        return [s for s in (preferred or []) if s]
    ordered: list[str] = []
    for token in (preferred or []):
        for name, info in outs.items():
            if name not in ordered and token in (name, (info or {}).get("model")):
                ordered.append(name)
    for name in outs:
        if name not in ordered:
            ordered.append(name)
    return ordered


def detect_screen_aspects(screens: list[str] | None = None) -> list[float]:
    """用 niri 探测各屏当前模式的宽高比（screens 可用输出名或显示器型号）。"""
    outs = niri_outputs()
    aspects: list[float] = []
    for name in connected_screens(screens):
        info = outs.get(name) or {}
        modes = info.get("modes") or []
        idx = info.get("current_mode")
        w = h = 0
        if isinstance(idx, int) and 0 <= idx < len(modes):
            w = int(modes[idx].get("width") or 0)
            h = int(modes[idx].get("height") or 0)
        if not w or not h:
            logical = info.get("logical") or {}
            w, h = int(logical.get("width") or 0), int(logical.get("height") or 0)
        if h:
            aspects.append(round(w / h, 4))
    return aspects


def collect_images(root: Path) -> list[Path]:
    out: list[Path] = []
    for p in sorted(root.rglob("*")):
        if any(part in (".state", ".tmp", ".trash") for part in p.parts):
            continue
        if p.suffix.lower() in IMG_EXT and p.is_file():
            out.append(p)
    return out


def build_trash(cfg: "Config") -> WallpaperTrash:
    """根据配置构造壁纸回收站对象。"""
    sec = cfg.sec("trash")
    rot = cfg.sec("rotation")
    return WallpaperTrash(
        cfg.root,
        expand(sec["dir"]) if sec.get("dir") else None,
        int(sec.get("retention_days", DEFAULT_RETENTION_DAYS) or DEFAULT_RETENTION_DAYS),
        expand(rot["dir"]) if rot.get("dir") else None,
    )


def purge_trash(cfg: "Config") -> int:
    """删除回收站里超过保留期的壁纸；永久屏蔽记录保留。"""
    trash = build_trash(cfg)
    purged = trash.purge()
    if purged:
        LOG.info("壁纸回收站：已清理 %d 项超过 %d 天的壁纸", len(purged), trash.retention_days)
    return len(purged)


# --------------------------------------------------------------------------- #
# 登录态
# --------------------------------------------------------------------------- #
class AuthError(RuntimeError):
    pass


class Auth:
    """PHPSESSID 的来源：优先读缓存文件，必要时从 agent-chrome 浏览器提取。"""

    def __init__(self, cache: Path, script: Path | None):
        self.cache = cache
        self.script = script
        self._session: str | None = None

    @property
    def session(self) -> str:
        if self._session:
            return self._session
        if self.cache.exists():
            try:
                data = json.loads(self.cache.read_text("utf-8"))
                s = str(data.get("session") or "")
                if s.startswith("PHPSESSID="):
                    self._session = s
                    return s
            except Exception:  # noqa: BLE001
                pass
        return self.refresh()

    def refresh(self) -> str:
        s = self._from_browser()
        if not s:
            raise AuthError(
                "无法获取 pixiv.pictures 登录态。请打开 “Agent Chrome” 登录一次后重试。"
            )
        self._session = s
        self.cache.parent.mkdir(parents=True, exist_ok=True)
        self.cache.write_text(
            json.dumps({"session": s, "saved_at": time.time()}, ensure_ascii=False, indent=1),
            "utf-8",
        )
        try:
            os.chmod(self.cache, 0o600)
        except OSError:
            pass
        return s

    def _from_browser(self) -> str | None:
        if not self.script or not self.script.exists():
            return None
        try:
            r = subprocess.run(
                ["bash", str(self.script)], capture_output=True, text=True, timeout=180
            )
        except Exception as exc:  # noqa: BLE001
            LOG.debug("调用 %s 失败: %s", self.script, exc)
            return None
        for line in reversed((r.stdout or "").strip().splitlines()):
            line = line.strip()
            if line.startswith("PHPSESSID="):
                return line
        if r.stderr:
            LOG.debug("get-session: %s", r.stderr.strip())
        return None


# --------------------------------------------------------------------------- #
# 配置
# --------------------------------------------------------------------------- #
@dataclass
class Config:
    raw: dict[str, Any]
    path: Path
    root: Path
    screens: list[str]
    aspects: list[float]
    aspect_tol: float
    max_aspect: float
    min_w: int
    min_h: int

    def sec(self, name: str) -> dict[str, Any]:
        return self.raw.get(name, {}) or {}

    def auth(self, key: str, default=None):
        return self.sec("auth").get(key, default)

    def dl(self, key: str, default=None):
        return self.sec("download").get(key, default)

    def images(self, key: str, default=None):
        return self.sec("images").get(key, default)

    def folder(self, name: str, default: str) -> str:
        return self.sec(name).get("folder", default)


def load_config(path: Path) -> Config:
    with path.open("rb") as fh:
        raw = tomllib.load(fh)
    dl = raw.get("download", {}) or {}
    root = expand(dl.get("root", "~/Pictures/Wallpapers/Pixiv"))
    screens = list(dl.get("screens") or [])
    aspects = [float(a) for a in (dl.get("screen_aspects") or [])]
    if not aspects:
        aspects = detect_screen_aspects(screens) or [16 / 9]
    return Config(
        raw=raw,
        path=path,
        root=root,
        screens=screens,
        aspects=aspects,
        aspect_tol=float(dl.get("aspect_tolerance", 0.2)),
        max_aspect=float(dl.get("max_aspect", 3.5)),
        min_w=int(dl.get("min_width", 0) or 0),
        min_h=int(dl.get("min_height", 0) or 0),
    )


# --------------------------------------------------------------------------- #
# 状态 (去重 / 断点)
# --------------------------------------------------------------------------- #
class State:
    def __init__(self, path: Path):
        self.path = path
        self.data: dict[str, Any] = {}
        if path.exists():
            try:
                self.data = json.loads(path.read_text("utf-8"))
            except Exception as exc:  # noqa: BLE001
                LOG.warning("状态文件损坏，已备份重建: %s", exc)
                path.rename(path.with_suffix(".bak"))
        for k in ("done", "skipped", "bookmarks", "follows"):
            self.data.setdefault(k, {})
        self.dirty = False

    # 下载去重: 作品:页
    def done(self, key: str) -> bool:
        return key in self.data["done"]

    def skipped(self, key: str) -> bool:
        return key in self.data["skipped"]

    def mark_done(self, key: str, relpath: str) -> None:
        self.data["done"][key] = relpath
        self.dirty = True

    def mark_skipped(self, key: str, reason: str) -> None:
        self.data["skipped"][key] = reason
        self.dirty = True

    # 收藏 / 关注 的增量标记
    def seen_bookmark(self, iid: str) -> bool:
        return iid in self.data["bookmarks"]

    def mark_bookmark(self, iid: str) -> None:
        self.data["bookmarks"][iid] = 1
        self.dirty = True

    def seen_follow(self, uid: str) -> bool:
        return uid in self.data["follows"]

    def mark_follow(self, uid: str) -> None:
        self.data["follows"][uid] = 1
        self.dirty = True

    def save(self, force: bool = False) -> None:
        if not (self.dirty or force):
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=1), "utf-8")
        tmp.replace(self.path)
        self.dirty = False


# --------------------------------------------------------------------------- #
# Pixiv 代理 API
# --------------------------------------------------------------------------- #
class ApiError(RuntimeError):
    pass


class PixivApi:
    def __init__(self, cfg: Config, auth: Auth):
        self.cfg = cfg
        self.auth = auth
        self.base = str(cfg.auth("api_base", DEFAULT_API_BASE)).rstrip("/")
        self.timeout = int(cfg.dl("timeout", 30))
        self.retries = int(cfg.dl("retries", 3))
        self.ua = str(cfg.auth("user_agent", DEFAULT_UA))
        self.session = requests.Session()

    def _headers(self) -> dict[str, str]:
        return {
            "x-auth": self.auth.session,
            "Referer": str(self.cfg.auth("referer", "https://pixiv.pictures/")),
            "Origin": str(self.cfg.auth("origin", "https://pixiv.pictures")),
            "User-Agent": self.ua,
            "Accept": "*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "sec-ch-ua": '"Chromium";v="153", "Not_A Brand";v="8"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Linux"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
        }

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        last = "unknown"
        for attempt in range(1, self.retries + 1):
            try:
                r = self.session.get(
                    f"{self.base}{path}", params=params, headers=self._headers(),
                    timeout=self.timeout,
                )
                if r.status_code in (401, 403):
                    raise AuthError(f"HTTP {r.status_code}")
                if r.status_code == 200:
                    try:
                        data = r.json()
                    except ValueError:
                        last = f"非 JSON 响应 ({len(r.content)}B)"
                    else:
                        if isinstance(data, dict) and data.get("error"):
                            err = str(data["error"])
                            if err.lower() in ("not accepted", "unauthorized", "forbidden"):
                                raise AuthError(err)
                            last = err
                        else:
                            return data
                else:
                    last = f"HTTP {r.status_code}"
            except requests.RequestException as exc:
                last = f"{type(exc).__name__}: {exc}"
            if attempt < self.retries:
                time.sleep(min(2 ** attempt, 10))
        raise ApiError(f"GET {path} {params} 失败: {last}")

    # ---- 端点 ----
    def user(self) -> dict:
        return self.get("/user")

    def bookmarks(self, uid: str, offset: int, limit: int = 48) -> tuple[list[dict], int]:
        d = self.get(
            f"/http/ajax/user/{uid}/illusts/bookmarks",
            {"tag": "", "offset": offset, "limit": limit, "rest": "show", "lang": "zh"},
        )
        return d.get("works") or [], int(d.get("total") or 0)

    def following(self, uid: str, offset: int, limit: int = 24) -> tuple[list[dict], int]:
        d = self.get(
            f"/http/ajax/user/{uid}/following",
            {"offset": offset, "limit": limit, "rest": "show", "tag": "",
             "acceptingRequests": 0, "lang": "zh"},
        )
        return d.get("users") or [], int(d.get("total") or 0)

    def illust(self, iid: str) -> dict:
        try:
            d = self.get(f"/http/ajax/illust/{iid}")
            return d if isinstance(d, dict) else {}
        except (ApiError, AuthError):
            return {}


# --------------------------------------------------------------------------- #
# 原图下载
# --------------------------------------------------------------------------- #
class Downloader:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.hosts = list(cfg.images("hosts") or ["i.pximg.net"])
        self.timeout = int(cfg.dl("timeout", 30))
        self.max_bytes = float(cfg.dl("max_file_mb", 0) or 0) * 1024 * 1024
        self.session = requests.Session()
        self.headers = {
            "User-Agent": str(cfg.images("user_agent", DEFAULT_UA)),
            "Referer": str(cfg.images("referer", "https://www.pixiv.net/")),
        }

    def fetch(self, rel: str) -> bytes | None:
        rel = rel.lstrip("/")
        # (连接超时, 读取超时)：连接不通的镜像快速跳过，不再干等 30s
        timeout = (8, max(10, self.timeout))
        for host in self.hosts:
            url = f"https://{host}/{rel}"
            try:
                r = self.session.get(url, headers=self.headers, timeout=timeout)
                if r.status_code == 200 and r.content:
                    ctype = r.headers.get("content-type", "")
                    if ctype and not ctype.startswith(
                        ("image/", "application/octet-stream")
                    ):
                        continue
                    if self.max_bytes and len(r.content) > self.max_bytes:
                        LOG.info("  跳过(超过 max_file_mb): %s (%s)", url, human(len(r.content)))
                        return None
                    return r.content
            except requests.RequestException:
                continue
        return None


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
class Scraper:
    def __init__(self, cfg: Config, auth: Auth, dry_run: bool = False, limit: int | None = None):
        self.cfg = cfg
        self.dry_run = dry_run
        self.limit = limit  # None = 不限制
        self.api = PixivApi(cfg, auth)
        self.downloader = Downloader(cfg)
        self.root = cfg.root
        self.tmpdir = cfg.root / ".tmp"
        self.state = State(cfg.root / ".state" / "state.json")
        self.trash = build_trash(cfg)
        self._detail_cache: dict[str, dict] = {}
        self.uid = ""
        self.limit_hit = False
        self.stats = {"follow_new": 0, "bm_new": 0, "downloaded": 0,
                      "skipped": 0, "failed": 0, "bytes": 0}

    # ---------- 尺寸校验 ----------
    def size_ok(self, w: int, h: int) -> bool:
        if not w or not h or w <= h:
            return False
        if w < self.cfg.min_w or h < self.cfg.min_h:
            return False
        a = w / h
        # 下限：太方/太竖（比最窄的屏幕还要窄太多）；上限：极端超宽全景
        lo = min(self.cfg.aspects) * (1 - self.cfg.aspect_tol)
        return lo <= a <= self.cfg.max_aspect

    # ---------- 原作 URL ----------
    def _detail(self, iid: str) -> dict:
        if iid not in self._detail_cache:
            self._detail_cache[iid] = self.api.illust(iid)
        return self._detail_cache[iid]

    def _original_rel(self, iid: str, item: dict) -> str:
        detail = self._detail(iid)
        u = str((detail.get("urls") or {}).get("original") or "")
        if u.startswith("/-/"):
            u = u[3:]
        if u:
            return u
        # 兜底: 从缩略图路径推导（同日期路径 -> img-original）
        thumb = str(item.get("url") or "")
        m = re.search(
            r"(?:img-master|custom-thumb)/img/(\d{4}/\d{2}/\d{2}/\d{2}/\d{2}/\d{2})/",
            thumb,
        )
        if m:
            return f"img-original/img/{m.group(1)}/{iid}_p0.jpg"
        return ""

    def _page_rels(self, iid: str, item: dict, page_count: int) -> list[str]:
        orig = self._original_rel(iid, item)
        if not orig:
            return []
        rels = [orig]
        for p in range(1, page_count):
            rels.append(re.sub(r"_p0(\.[A-Za-z0-9]+)$", rf"_p{p}\1", orig))
        return rels

    # ---------- 单页下载 ----------
    def _handle_page(self, item: dict, rel: str, page: int, folder: str, source: str) -> None:
        iid = str(item["id"])
        key = f"{iid}:{page}"
        if self.state.done(key) or self.state.skipped(key) or self.trash.is_blocked(key):
            return
        if self.limit is not None and self.stats["downloaded"] >= self.limit:
            self.limit_hit = True
            return

        data = self.downloader.fetch(rel)
        if data is None and rel.lower().endswith(".jpg"):
            rel = rel[:-4] + ".png"
            data = self.downloader.fetch(rel)
        if data is None:
            # 网络/临时失败: 不写 skipped, 下次重试
            self.stats["failed"] += 1
            LOG.warning("  ✗ 下载失败: %s", rel)
            return

        try:
            im = Image.open(io.BytesIO(data))
            w, h = im.size
            fmt = (im.format or "").lower()
            animated = bool(getattr(im, "is_animated", False))
        except (UnidentifiedImageError, OSError) as exc:
            LOG.warning("  无法解析图片 %s: %s", rel, exc)
            self.state.mark_skipped(key, "bad_image")
            self.stats["failed"] += 1
            return

        if animated:
            self.state.mark_skipped(key, "animated")
            self.stats["skipped"] += 1
            return
        if not self.size_ok(w, h):
            self.state.mark_skipped(key, f"size({w}x{h})")
            self.stats["skipped"] += 1
            return

        ext = Path(rel.split("?")[0]).suffix.lower()
        if ext not in IMG_EXT:
            ext = {"jpeg": ".jpg", "png": ".png", "webp": ".webp", "gif": ".gif"}.get(fmt, ".jpg")

        title = ""
        if self.cfg.dl("include_title", True):
            title = slugify(item.get("title", ""), int(self.cfg.dl("title_max_len", 40)))
        stem = f"{iid}_p{page}" + (f"_{title}" if title else "")
        outdir = self.root / folder
        outfile = outdir / f"{stem}{ext}"
        sidecar = outdir / f"{stem}.json"

        user = {"id": str(item.get("userId") or ""), "name": item.get("userName") or ""}
        meta = {
            "id": item.get("id"),
            "page": page,
            "title": item.get("title"),
            "author": user,
            "tags": item.get("tags") or [],
            "width": w,
            "height": h,
            "aspect": round(w / h, 3),
            "page_count": item.get("pageCount"),
            "create_date": item.get("createDate"),
            "x_restrict": item.get("xRestrict"),
            "source": source,
            "category": folder,
            "url": f"https://www.pixiv.net/artworks/{iid}",
            "original_url": f"https://i.pximg.net/{rel.lstrip('/')}",
            "downloaded_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        if self.dry_run:
            print(f"  [dry-run] {folder}/{outfile.name}  {w}x{h}  {human(len(data))}")
        else:
            outdir.mkdir(parents=True, exist_ok=True)
            self.tmpdir.mkdir(parents=True, exist_ok=True)
            tmp = self.tmpdir / f"{iid}_p{page}.part"
            tmp.write_bytes(data)
            tmp.replace(outfile)
            sidecar.write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")

        self.state.mark_done(key, f"{folder}/{outfile.name}")
        self.stats["downloaded"] += 1
        self.stats["bytes"] += len(data)
        LOG.info("  ✔ %s/%s  %dx%d  %s", folder, outfile.name, w, h, human(len(data)))

        delay = float(self.cfg.dl("download_delay", 1.0) or 0)
        if delay > 0 and not self.dry_run:
            time.sleep(delay)

    # ---------- 单个作品 ----------
    # 返回 True 表示已完整处理(可标记为已见)，False 表示触发本轮上限需下次继续。
    def _handle_work(self, item: dict, folder: str, source: str) -> bool:
        iid = item.get("id")
        if not iid:
            return True
        iid = str(iid)
        page_count = int(item.get("pageCount") or 1)

        # 已全部处理过（或在回收站里）-> 直接跳过, 省一次 API 调用
        if all(self.state.done(f"{iid}:{p}") or self.state.skipped(f"{iid}:{p}")
               or self.trash.is_blocked(f"{iid}:{p}")
               for p in range(page_count)):
            return True

        # 内容筛选
        if not self.cfg.dl("allow_r18", False) and item.get("xRestrict"):
            return True
        if self.cfg.dl("skip_ai", False) and item.get("aiType") == 2:
            return True
        if item.get("illustType") == 2:  # ugoira 动图
            return True
        excl = {t.lower() for t in (self.cfg.dl("exclude_tags", []) or [])}
        if excl and {str(t).lower() for t in (item.get("tags") or [])} & excl:
            return True

        # 用 p0 尺寸做快速预筛
        w0, h0 = int(item.get("width") or 0), int(item.get("height") or 0)
        if w0 and h0 and not self.size_ok(w0, h0):
            self.stats["skipped"] += 1
            for p in range(page_count):
                self.state.mark_skipped(f"{iid}:{p}", f"size({w0}x{h0})")
            return True

        rels = self._page_rels(iid, item, page_count)
        if not rels:
            for p in range(page_count):
                self.state.mark_skipped(f"{iid}:{p}", "no_url")
            self.stats["failed"] += 1
            return True

        LOG.info("· [%s] #%s %s (%d页) -> %s",
                 source, iid, str(item.get("title") or "")[:40], len(rels), folder)
        for page, rel in enumerate(rels):
            self._handle_page(item, rel, page, folder, source)
            if self.limit_hit:
                break
        return not self.limit_hit

    # ---------- 我关注的画师 ----------
    def sync_following(self) -> None:
        sec = self.cfg.sec("following")
        base_folder = self.cfg.folder("following", "关注")
        offset, limit = 0, 24
        while True:
            users, total = self.api.following(self.uid, offset, limit)
            if not users:
                break
            for u in users:
                u_uid = str(u.get("userId") or "")
                if not u_uid:
                    continue
                is_new = not self.state.seen_follow(u_uid)
                if not is_new:
                    continue
                self.stats["follow_new"] += 1
                name = slugify(str(u.get("userName") or ""), 40) or "unknown"
                folder = f"{base_folder}/{u_uid}_{name}"
                works = (u.get("illusts") or [])[: int(sec.get("recent_per_artist", 4) or 4)]
                LOG.info("★ 新关注画师: %s (%s), 近期作品 %d 个", u.get("userName"), u_uid, len(works))
                done_all = True
                for it in works:
                    if not self._handle_work(it, folder, "following"):
                        done_all = False
                        break
                if done_all:
                    self.state.mark_follow(u_uid)
                if not self.dry_run:
                    self.state.save()
                if self.limit_hit:
                    break
            offset += limit
            if self.limit_hit or offset >= total:
                break
            time.sleep(0.4)

    # ---------- 我的收藏 ----------
    def sync_bookmarks(self) -> None:
        base_folder = self.cfg.folder("bookmarks", "收藏")
        # 高水位线: 上次已处理过的最新收藏 id。新收藏总在列表最前,
        # 所以翻到它就可以停, 既避免漏掉又能少翻页。
        last_newest = str(self.state.data.get("last_newest") or "")
        offset, limit = 0, 48
        newest_id = ""
        while True:
            works, total = self.api.bookmarks(self.uid, offset, limit)
            if not works:
                break
            stop = False
            for it in works:
                iid = str(it.get("id") or "")
                if not iid:
                    continue
                if offset == 0 and not newest_id:
                    newest_id = iid
                if last_newest and iid == last_newest and self.state.seen_bookmark(iid):
                    stop = True  # 已经追平上次的位置
                    break
                if self.state.seen_bookmark(iid):
                    continue
                self.stats["bm_new"] += 1
                if self._handle_work(it, base_folder, "bookmark"):
                    self.state.mark_bookmark(iid)
                if self.limit_hit:
                    break
            if not self.dry_run:
                self.state.save()
            if self.limit_hit or stop:
                break
            offset += limit
            if offset >= total:
                break
            time.sleep(0.4)
        # 只有完整跑完才推进高水位线，避免 --limit 中途截断后漏抓
        if newest_id and not self.limit_hit and not self.dry_run:
            self.state.data["last_newest"] = newest_id
            self.state.dirty = True
            self.state.save()

    # ---------- 整轮 ----------
    def run(self, only: str | None = None) -> dict:
        self.tmpdir.mkdir(parents=True, exist_ok=True)
        self.root.mkdir(parents=True, exist_ok=True)
        if not self.dry_run:
            self.trash.purge()
        user = self.api.user()
        self.uid = str((user.get("userData") or {}).get("id") or "")
        if not self.uid:
            raise AuthError("无法解析当前账号，登录态可能失效")
        LOG.info("当前账号: %s (uid=%s)", (user.get("userData") or {}).get("name"), self.uid)

        if only in (None, "following") and self.cfg.sec("following").get("enabled", True):
            LOG.info("==== 同步「我关注的画师」 ====")
            self.sync_following()
        if only in (None, "bookmarks") and self.cfg.sec("bookmarks").get("enabled", True):
            LOG.info("==== 同步「我的收藏」 ====")
            self.sync_bookmarks()

        if not self.dry_run:
            self.state.save(force=True)
            if self.cfg.sec("rotation").get("enabled", False):
                try:
                    n = sync_rotation(self.cfg)
                    LOG.info("轮换目录已同步: %d 张", n)
                except Exception as exc:  # noqa: BLE001
                    LOG.warning("同步轮换目录失败: %s", exc)
        return self.stats


# --------------------------------------------------------------------------- #
# 分屏轮换
# --------------------------------------------------------------------------- #
def sync_rotation(cfg: Config) -> int:
    rot = cfg.sec("rotation")
    if not rot.get("enabled", False):
        return 0
    rot_dir = expand(rot.get("dir") or str(cfg.root.parent / f"{cfg.root.name}-rotation"))
    screens = connected_screens(rot.get("screens") or cfg.screens or [])
    if not screens:
        return 0

    images = collect_images(cfg.root)
    buckets: dict[str, list[Path]] = {s: [] for s in screens}
    for i, img in enumerate(images):
        buckets[screens[i % len(screens)]].append(img)

    rot_dir.mkdir(parents=True, exist_ok=True)
    # 清理已断开/已改名屏幕遗留的旧桶目录（输出名会在 eDP-1/eDP-2 间漂移）
    for old in list(rot_dir.iterdir()):
        if old.is_dir() and not old.name.startswith(".") and old.name not in screens:
            shutil.rmtree(old, ignore_errors=True)
    for scr in screens:
        tmp = rot_dir / f".{scr}.tmp"
        if tmp.exists():
            shutil.rmtree(tmp)
        tmp.mkdir(parents=True)
        for img in buckets[scr]:
            try:
                os.symlink(img, tmp / img.name)
            except FileExistsError:
                pass
        final = rot_dir / scr
        final.mkdir(parents=True, exist_ok=True)
        for old in list(final.iterdir()):
            try:
                old.unlink()
            except OSError:
                pass
        for link in list(tmp.iterdir()):
            link.rename(final / link.name)
        tmp.rmdir()
    return len(images)


def rotate_wallpapers(cfg: Config) -> int:
    rot = cfg.sec("rotation")
    if not rot.get("enabled", False):
        return 0
    purge_trash(cfg)
    rot_dir = expand(rot.get("dir") or str(cfg.root.parent / f"{cfg.root.name}-rotation"))
    screens = connected_screens(rot.get("screens") or cfg.screens or [])
    # 输出名漂移 / 首次运行时轮换目录可能不存在：先重建一次再换
    if screens and any(not (rot_dir / scr).is_dir() for scr in screens):
        sync_rotation(cfg)
    count = 0
    for scr in screens:
        d = rot_dir / scr
        if not d.is_dir():
            LOG.warning("轮换目录缺失，跳过 %s: %s", scr, d)
            continue
        files = sorted(p for p in d.iterdir() if p.exists())
        if not files:
            continue
        current = ""
        try:
            r = subprocess.run(
                ["dms", "ipc", "call", "wallpaper", "getFor", scr],
                capture_output=True, text=True, timeout=15,
            )
            current = (r.stdout or "").strip()
        except Exception:  # noqa: BLE001
            pass
        candidates = [f for f in files if str(f) != current] or files
        pick = random.choice(candidates)
        try:
            subprocess.run(
                ["dms", "ipc", "call", "wallpaper", "setFor", scr, str(pick)],
                capture_output=True, text=True, timeout=25, check=False,
            )
            LOG.info("轮换 %s -> %s", scr, pick.name)
            count += 1
        except Exception as exc:  # noqa: BLE001
            LOG.warning("轮换 %s 失败: %s", scr, exc)
    return count


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def setup_logging(verbose: bool, logfile: Path | None) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if logfile:
        logfile.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(logfile, encoding="utf-8"))
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-5s %(message)s",
        datefmt="%H:%M:%S",
        handlers=handlers,
    )


def build_auth(cfg: Config) -> Auth:
    cache = expand(cfg.auth("cache", "~/.config/pixiv-wallpaper/auth.json"))
    script = expand(cfg.auth("fetch_script", "")) if cfg.auth("fetch_script") else None
    return Auth(cache, script)


def reset_for_rescan(cfg: Config) -> None:
    """让下一次运行重新评估所有作品：
    清空 收藏/关注 的已见集合与“尺寸/URL”跳过记录，但保留已下载文件(done)，
    所以已经下好的不会重下，只会把之前因尺寸被跳过的重新校验一遍。"""
    p = cfg.root / ".state" / "state.json"
    if not p.exists():
        return
    try:
        d = json.loads(p.read_text("utf-8"))
    except Exception:  # noqa: BLE001
        return
    d["bookmarks"] = {}
    d["follows"] = {}
    d.pop("last_newest", None)
    d["skipped"] = {
        k: v for k, v in (d.get("skipped") or {}).items()
        if not str(v).startswith(("size(", "no_url"))
    }
    p.write_text(json.dumps(d, ensure_ascii=False, indent=1), "utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Pixiv 壁纸同步 (收藏 + 关注画师)")
    ap.add_argument("--config", default=str(Path(__file__).with_name("config.toml")))
    ap.add_argument("--once", action="store_true", help="跑一轮(默认行为)")
    ap.add_argument("--dry-run", action="store_true", help="不写文件，仅统计")
    ap.add_argument("--limit", type=int, default=None, help="本轮最多下载张数 (0=不限制)")
    ap.add_argument("--only", choices=["bookmarks", "following"], help="只同步某一类")
    ap.add_argument("--probe", action="store_true", help="测试登录态并打印账号信息")
    ap.add_argument("--refresh-auth", action="store_true", help="从浏览器刷新登录态")
    ap.add_argument("--rescan", action="store_true",
                    help="重新评估所有作品(忽略已见记录与尺寸跳过，改了筛选规则后用)")
    ap.add_argument("--rotate", action="store_true", help="给每个屏幕随机换一张壁纸")
    ap.add_argument("--sync-rotation", action="store_true", help="重建每屏轮换符号链接目录")
    ap.add_argument("--verbose", "-v", action="store_true")
    args = ap.parse_args(argv)

    cfg = load_config(expand(args.config))
    auth = build_auth(cfg)

    if args.refresh_auth:
        setup_logging(args.verbose, None)
        LOG.info("登录态已刷新: %s...", auth.refresh()[:24])
        return 0

    if args.probe:
        setup_logging(args.verbose, None)
        api = PixivApi(cfg, auth)
        u = api.user().get("userData") or {}
        works, total = api.bookmarks(str(u.get("id")), 0, 1)
        users, ftotal = api.following(str(u.get("id")), 0, 1)
        LOG.info("账号: %s (uid=%s)", u.get("name"), u.get("id"))
        LOG.info("收藏总数: %s | 关注画师: %s", total, ftotal)
        LOG.info("允许的宽高比: %s (容差 %.0f%%)",
                 [round(a, 3) for a in cfg.aspects], cfg.aspect_tol * 100)
        return 0

    if args.sync_rotation:
        setup_logging(args.verbose, None)
        n = sync_rotation(cfg)
        LOG.info("已同步轮换目录，共 %d 张", n)
        return 0

    if args.rotate:
        setup_logging(args.verbose, None)
        n = rotate_wallpapers(cfg)
        LOG.info("已轮换 %d 个屏幕", n)
        return 0

    logfile = cfg.root / ".state" / "scraper.log"
    setup_logging(args.verbose, logfile if not args.dry_run else None)

    if args.rescan:
        reset_for_rescan(cfg)
        LOG.info("已重置增量状态，本轮将重新评估全部作品（已下载的不会重下）")

    if args.limit is not None:
        limit = args.limit if args.limit > 0 else None
    else:
        cfg_limit = int(cfg.dl("max_new_per_run", 0) or 0)
        limit = cfg_limit if cfg_limit > 0 else None

    def run_once() -> dict:
        scraper = Scraper(cfg, auth, dry_run=args.dry_run, limit=limit)
        return scraper.run(only=args.only)

    try:
        stats = run_once()
    except AuthError as exc:
        LOG.warning("登录态失效(%s)，尝试从浏览器刷新…", exc)
        auth.refresh()
        stats = run_once()

    LOG.info(
        "本轮完成 | 新收藏 %d | 新关注 %d | 下载 %d | 跳过 %d | 失败 %d | 共 %s",
        stats["bm_new"], stats["follow_new"], stats["downloaded"],
        stats["skipped"], stats["failed"], human(stats["bytes"]),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
