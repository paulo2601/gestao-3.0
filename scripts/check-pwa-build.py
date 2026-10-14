"""Validate PWA assets from a production build without deploying."""
from pathlib import Path
import json
import struct

root = Path(__file__).resolve().parents[1] / "dist"
html = (root / "index.html").read_text()
assert '/manifest.webmanifest?v=4' in html
manifest = json.loads((root / "manifest.webmanifest").read_text())
assert manifest["display"] == "standalone"
assert manifest["start_url"] == "/" and manifest["scope"] == "/"
for size in (192, 512):
    data = (root / f"gestao-icon-{size}.png").read_bytes()
    assert data[:8] == bytes.fromhex("89504e470d0a1a0a")
    assert struct.unpack(">II", data[16:24]) == (size, size)
    assert any(i["src"] == f"/gestao-icon-{size}.png" for i in manifest["icons"])
assert (root / "sw.js").exists()
print("PWA build assets OK; Android installation still requires browser testing.")
