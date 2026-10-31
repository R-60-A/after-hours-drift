"""Optional local QA runner. Python standard library only; no game dependency."""

import html
import base64
import json
import os
import pathlib
import re
import socket
import struct
import subprocess
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BROWSERS = {
    "chrome": pathlib.Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    "edge": pathlib.Path(
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    ),
}


class DevTools:
    """Minimal loopback WebSocket client for Chrome/Edge's debugging protocol."""

    def __init__(self, url):
        from urllib.parse import urlsplit

        address = urlsplit(url)
        self.sock = socket.create_connection(
            (address.hostname, address.port), timeout=60
        )
        token = base64.b64encode(os.urandom(16)).decode()
        request = (
            f"GET {address.path} HTTP/1.1\r\nHost: {address.netloc}\r\n"
            f"Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {token}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(request.encode())
        response = b""
        while not response.endswith(b"\r\n\r\n"):
            response += self.sock.recv(1)
        if b" 101 " not in response:
            raise RuntimeError(response.decode())
        self.sequence = 0

    def read(self, size):
        result = b""
        while len(result) < size:
            chunk = self.sock.recv(size - len(result))
            if not chunk:
                raise EOFError("Browser debugging socket closed")
            result += chunk
        return result

    def call(self, method, params=None):
        self.sequence += 1
        payload = json.dumps(
            {"id": self.sequence, "method": method, "params": params or {}}
        ).encode()
        length = len(payload)
        header = (
            bytes([0x81, 0x80 | length])
            if length < 126
            else bytes([0x81, 0xFE]) + struct.pack("!H", length)
        )
        mask = os.urandom(4)
        self.sock.sendall(
            header + mask + bytes(c ^ mask[i % 4] for i, c in enumerate(payload))
        )
        while True:
            first, second = self.read(2)
            size = second & 0x7F
            if size == 126:
                size = struct.unpack("!H", self.read(2))[0]
            elif size == 127:
                size = struct.unpack("!Q", self.read(8))[0]
            data = self.read(size)
            if first & 0x0F == 8:
                raise EOFError("Browser closed WebSocket")
            message = json.loads(data)
            if message.get("id") == self.sequence:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    def evaluate(self, expression):
        response = self.call(
            "Runtime.evaluate", {"expression": expression, "returnByValue": True}
        )
        if "exceptionDetails" in response:
            raise RuntimeError(response["exceptionDetails"])
        return response.get("result", {}).get("value")


def run(browser, page):
    output = ROOT / ".qa"
    output.mkdir(exist_ok=True)
    args = [
        str(BROWSERS[browser]),
        "--headless",
        "--disable-gpu",
        "--no-first-run",
        "--disable-background-networking",
        "--no-default-browser-check",
        "--disable-renderer-backgrounding",
        "--disable-background-timer-throttling",
        "--window-size=1440,1000",
        "--user-data-dir="
        + str(output / (browser + "-" + page + "-" + str(time.time_ns()))),
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0",
        (
            ROOT
            / {
                "tests": "tests/index.html",
                "browser-tests": "tests/browser.html",
                "index": "index.html",
            }[page]
        ).as_uri(),
    ]
    if page != "index":
        # Only the integration harness needs to inspect a local-file iframe.
        # The actual game is tested with normal file security and audio policy.
        args.insert(1, "--allow-file-access-from-files")
    profile = pathlib.Path(
        next(a.split("=", 1)[1] for a in args if a.startswith("--user-data-dir="))
    )
    with (output / (browser + "-" + page + ".log")).open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            args, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW
        )
        client = None
        try:
            for _ in range(100):
                try:
                    port = int(
                        (profile / "DevToolsActivePort").read_text().splitlines()[0]
                    )
                    break
                except (OSError, ValueError, IndexError):
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Browser did not open its local debugging port")
            targets = json.load(
                urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=10)
            )
            target = next(t for t in targets if t["type"] == "page")
            client = DevTools(target["webSocketDebuggerUrl"])
            for _ in range(120):
                ready = client.evaluate(
                    "document.documentElement?.dataset.result || document.documentElement?.dataset.ready || ''"
                )
                if ready in ("pass", "fail", "true"):
                    break
                time.sleep(0.25)
            markup = client.evaluate("document.documentElement.outerHTML")
            if page == "index":
                time.sleep(0.5)
            shot = client.call("Page.captureScreenshot", {"format": "png"})["data"]
            (output / (browser + "-" + page + ".png")).write_bytes(
                base64.b64decode(shot)
            )
            if page == "index":
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyDown",
                        "key": "Enter",
                        "code": "Enter",
                        "windowsVirtualKeyCode": 13,
                    },
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyUp",
                        "key": "Enter",
                        "code": "Enter",
                        "windowsVirtualKeyCode": 13,
                    },
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyDown",
                        "key": "n",
                        "code": "KeyN",
                        "windowsVirtualKeyCode": 78,
                    },
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyUp",
                        "key": "n",
                        "code": "KeyN",
                        "windowsVirtualKeyCode": 78,
                    },
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyDown",
                        "key": "w",
                        "code": "KeyW",
                        "windowsVirtualKeyCode": 87,
                    },
                )
                time.sleep(0.8)
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyDown",
                        "key": "a",
                        "code": "KeyA",
                        "windowsVirtualKeyCode": 65,
                    },
                )
                # Headless software rendering can advance fewer game frames
                # than a desktop GPU. Wait for the actual circle, not a timer.
                for _ in range(60):
                    time.sleep(0.25)
                    snapshot = client.evaluate("DriftGame.snapshot()")
                    if (
                        snapshot["state"] != "playing"
                        or snapshot["score"]["circles"] >= 1
                    ):
                        break
                print(
                    "Real keyboard drift:",
                    json.dumps({k: snapshot[k] for k in ["state", "score", "marks"]}),
                )
                if (
                    snapshot["state"] != "playing"
                    or snapshot["score"]["circles"] < 1
                    or snapshot["marks"] < 10
                ):
                    raise RuntimeError(
                        "Real keyboard drift did not remain playable and score a circle"
                    )
                shot = client.call("Page.captureScreenshot", {"format": "png"})["data"]
                (output / (browser + "-driving.png")).write_bytes(
                    base64.b64decode(shot)
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyUp",
                        "key": "w",
                        "code": "KeyW",
                        "windowsVirtualKeyCode": 87,
                    },
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyUp",
                        "key": "a",
                        "code": "KeyA",
                        "windowsVirtualKeyCode": 65,
                    },
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyDown",
                        "key": "Escape",
                        "code": "Escape",
                        "windowsVirtualKeyCode": 27,
                    },
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyUp",
                        "key": "Escape",
                        "code": "Escape",
                        "windowsVirtualKeyCode": 27,
                    },
                )
                client.evaluate(
                    "document.getElementById('overlay').hidden=true;document.body.classList.remove('menu')"
                )
                time.sleep(0.3)
                location = client.evaluate(
                    "(()=>{const c=DriftGame.snapshot().car,m=document.getElementById('world').getContext('2d').getTransform(),p=new DOMPoint(c.x,c.y).matrixTransform(m);return {x:p.x/devicePixelRatio,y:p.y/devicePixelRatio};})()"
                )
                closeup = client.call(
                    "Page.captureScreenshot",
                    {
                        "format": "png",
                        "clip": {
                            "x": max(0, location["x"] - 65),
                            "y": max(0, location["y"] - 65),
                            "width": 130,
                            "height": 130,
                            "scale": 4,
                        },
                    },
                )["data"]
                (output / (browser + "-lamps.png")).write_bytes(
                    base64.b64decode(closeup)
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyDown",
                        "key": "Escape",
                        "code": "Escape",
                        "windowsVirtualKeyCode": 27,
                    },
                )
                client.call(
                    "Input.dispatchKeyEvent",
                    {
                        "type": "keyUp",
                        "key": "Escape",
                        "code": "Escape",
                        "windowsVirtualKeyCode": 27,
                    },
                )
                client.evaluate(
                    "(()=>{const original=DriftCore.simulate;DriftCore.simulate=(car,input,score,cars,dt)=>{DriftCore.simulate=original;Object.assign(car,{x:290,y:1303.5,angle:Math.PI/2,vx:0,vy:120,speed:120,forward:120,yaw:0});return original(car,input,score,cars,dt);};})()"
                )
                for _ in range(30):
                    if client.evaluate("DriftGame.snapshot().state") == "winner":
                        break
                    time.sleep(0.1)
                if client.evaluate("DriftGame.snapshot().state") != "winner":
                    raise RuntimeError("Secret fence failed to open the winner screen")
                time.sleep(0.4)
                shot = client.call("Page.captureScreenshot", {"format": "png"})["data"]
                (output / (browser + "-winner.png")).write_bytes(base64.b64decode(shot))
                print("Secret fence celebration and fireworks screen verified")
        finally:
            if client:
                try:
                    client.call("Browser.close")
                except (EOFError, OSError):
                    pass
                client.sock.close()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.terminate()
                process.wait(timeout=5)
    (output / (browser + "-" + page + ".html")).write_text(markup, encoding="utf-8")
    match = re.search(r"<pre[^>]*>(.*?)</pre>", markup, re.S)
    title = re.search(r"<title>(.*?)</title>", markup)
    print(browser, page)
    print(
        html.unescape(match.group(1))
        if match
        else (title.group(1) if title else "No page output")
    )
    if page != "index" and 'data-result="pass"' not in markup:
        return False
    if page == "index" and 'data-ready="true"' not in markup:
        print("Game assets did not load")
        return False
    return True


if __name__ == "__main__":
    browser = sys.argv[1] if len(sys.argv) > 1 else "chrome"
    pages = sys.argv[2:] or ["tests", "browser-tests", "index"]
    results = [run(browser, page) for page in pages]
    raise SystemExit(0 if all(results) else 1)
