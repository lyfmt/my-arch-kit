#!/usr/bin/env python3
"""假的 musicd：在指定 socket 上按 musicd.py 的协议推送 snapshot / track / status / pos / lyric，
用来在没有真音乐（或不想动真播放器）时测试 p3lyrics。只用标准库。

    test/fake-musicd.py /tmp/p3lyr-fake.sock [脚本]
    P3LYRICS_SOCK=/tmp/p3lyr-fake.sock qs -p shell

脚本是逗号分隔的「秒:动作」，按墙钟时间执行（默认 demo）：
    pause / play / next / seek=<秒> / nolyric（下一首不带歌词）
例：'6:pause,9:play,14:seek=11,20:next'
歌词是 index.html 的三首假歌（第二首日文 + 翻译）。
"""
import json
import os
import socket
import sys
import threading
import time

SONGS = [
    {"name": "铁皮屋顶的夏天", "artist": "灯塔与猫", "end": 38, "lines": [
        (2.0, "蝉声把午后拉得很长", ""), (5.6, "我数着铁轨上的光", ""), (9.0, "跑", ""),
        (10.0, "再快一点", ""), (12.0, "直到风也追不上我们那年骑着单车穿过整条没有尽头的河堤", ""),
        (18.0, "夏天不说再见", ""), (30.0, "屋顶又落雨", ""), (33.4, "我还在等你", "")]},
    {"name": "硝子の月", "artist": "宵町ユラ", "end": 35, "lines": [
        (2.0, "硝子の月が割れる夜に", "在玻璃月亮碎裂的夜里"), (5.4, "名前を呼んで", "呼唤我的名字"),
        (8.2, "ねえ", "呐"), (9.2, "聞こえる？", "听得见吗"),
        (11.0, "遠く離れても消えない光を 胸の奥にずっと抱いて走るから", "就算相隔遥远 我也会把不灭的光抱在心底一直奔跑"),
        (16.4, "もう一度だけ", "再一次就好"), (27.0, "朝が来る前に", "在清晨到来之前"), (30.4, "また会おう", "再相见吧")]},
    {"name": "Paper Satellites", "artist": "Low Orbit", "end": 34, "lines": [
        (2.0, "Paper satellites over the bay", "海湾上空的纸卫星"), (5.0, "Fold the night and throw it away", "折起夜色 把它扔远"),
        (8.0, "Spin", "旋转"), (8.6, "Fall", "坠落"), (9.2, "Light it all", "点亮一切"),
        (11.0, "We could burn like neon in the rain until the morning finds our names", "我们像雨里的霓虹一样燃烧 直到清晨找到我们的名字"),
        (16.6, "Stay loud", "别安静下来"), (26.0, "Signal fades but I'm still here", "信号渐弱 但我还在"), (30.0, "Still here", "还在")]},
]


class Fake:
    def __init__(self, path):
        self.path = path
        self.clients = []
        self.lock = threading.Lock()
        self.idx = 0
        self.playing = True
        self.base = 0.0
        self.t0 = time.time()
        self.lyric_ok = True

    def pos(self):
        return self.base + (time.time() - self.t0 if self.playing else 0)

    def song(self):
        s = SONGS[self.idx % len(SONGS)]
        return {"id": 1000 + self.idx, "name": s["name"], "artist": s["artist"], "artists": [{"id": 1, "name": s["artist"]}],
                "album": "", "cover": "", "duration": s["end"] * 1000}

    def lyric(self):
        if not self.lyric_ok:
            return {"id": self.song()["id"], "lines": []}
        s = SONGS[self.idx % len(SONGS)]
        return {"id": self.song()["id"], "lines": [{"t": t, "text": x, "trans": tr} for t, x, tr in s["lines"]]}

    def send(self, c, m):
        try:
            c.sendall(json.dumps(m, ensure_ascii=False).encode() + b"\n")
        except OSError:
            with self.lock:
                if c in self.clients:
                    self.clients.remove(c)

    def bcast(self, m):
        with self.lock:
            cs = list(self.clients)
        for c in cs:
            self.send(c, m)

    def snapshot(self):
        return {"ev": "snapshot", "song": self.song(), "index": self.idx, "total": len(SONGS), "source": "fake",
                "mode": "list", "playing": self.playing, "pos": self.pos(), "lyric": self.lyric(), "nickname": "",
                "playlists": [], "liked": [], "volume": 100, "collected": []}

    def serve(self):
        try:
            os.unlink(self.path)
        except FileNotFoundError:
            pass
        srv = socket.socket(socket.AF_UNIX)
        srv.bind(self.path)
        srv.listen(8)
        while True:
            c, _ = srv.accept()
            with self.lock:
                self.clients.append(c)
            self.send(c, self.snapshot())
            threading.Thread(target=self.drain, args=(c,), daemon=True).start()

    def drain(self, c):
        try:
            while c.recv(4096):
                pass
        except OSError:
            pass

    def set_play(self, p):
        self.base = self.pos()
        self.t0 = time.time()
        self.playing = p
        self.bcast({"ev": "status", "playing": self.playing, "pos": self.pos()})

    def seek(self, t):
        self.base = t
        self.t0 = time.time()
        self.bcast({"ev": "status", "playing": self.playing, "pos": t})

    def next(self, lyric_ok=True):
        self.idx += 1
        self.base = 0.0
        self.t0 = time.time()
        self.lyric_ok = lyric_ok
        self.bcast({"ev": "track", "song": self.song(), "index": self.idx, "total": len(SONGS), "source": "fake", "mode": "list"})
        self.bcast({"ev": "lyric", "id": self.song()["id"], "lines": []})
        self.bcast({"ev": "status", "playing": self.playing, "pos": 0.0})
        time.sleep(0.3)   # 真后端是异步拉歌词
        self.bcast({"ev": "lyric", **self.lyric()})

    def run(self, script):
        threading.Thread(target=self.serve, daemon=True).start()
        plan = []
        for part in filter(None, (script or "").split(",")):
            at, act = part.split(":", 1)
            plan.append((float(at), act))
        start = time.time()
        last = -10.0
        nolyric = False
        while True:
            now = time.time() - start
            while plan and plan[0][0] <= now:
                _, act = plan.pop(0)
                print(f"[fake] {now:6.2f}s {act}", flush=True)
                if act == "pause":
                    self.set_play(False)
                elif act == "play":
                    self.set_play(True)
                elif act == "next":
                    self.next(not nolyric)
                    nolyric = False
                elif act == "nolyric":
                    nolyric = True
                elif act.startswith("seek="):
                    self.seek(float(act[5:]))
            p = self.pos()
            if self.playing and abs(p - last) >= 0.5:
                last = p
                self.bcast({"ev": "pos", "pos": p})
            if self.playing and p >= SONGS[self.idx % len(SONGS)]["end"]:
                self.next()
            time.sleep(0.05)


if __name__ == "__main__":
    Fake(sys.argv[1] if len(sys.argv) > 1 else "/tmp/p3lyr-fake.sock").run(sys.argv[2] if len(sys.argv) > 2 else "")
