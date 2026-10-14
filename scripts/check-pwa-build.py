"""Check installability-related build assets without deploying."""
import json
from pathlib import Path
import struct

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
html = (dist / "index.html").read_text()
assert 'rel="manifest"' in html and '/manifest.webmanifest?v=4' in html
manifest = json.loads((dist / "manifest.webmanifest").read_text())
assert manifest["display"] == "standalone"
assert manifest["start_url"] == "/" and manifest["scope"] == "/"
assert manifest["name"] and manifest["id"] == "/"
for size in (192, 512):
    path = dist / f"gestao-icon-{size}.png"
    data = path.read_bytes()
    assert data[:8] == bytes.fromhex("89504e470d0a1a0a"), f"Invalid PNG: {path}"
    assert struct.unpack(">II", data[16:24]) == (size, size), f"Wrong size: {path}"
    assert any(icon["src"] == f"/gestao-icon-{size}.png" for icon in manifest["icons"])
assert (dist / "sw.js").is_file()
print("PWA static assets validated. Browser installability still requires Android Chrome verification.")
