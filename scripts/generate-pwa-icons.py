"""Generate installable PNG icons using only the Python standard library."""
from pathlib import Path
import math
import struct
import zlib

OUT = Path(__file__).resolve().parents[1] / "public"

def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

def icon(size):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            px, py = (x + .5) * 512 / size, (y + .5) * 512 / size
            color = (6, 27, 58)
            # White G: thick circular arc with an open right side.
            r = math.hypot(px - 250, py - 254)
            angle = math.atan2(py - 254, px - 250)
            if 112 < r < 159 and not (-.83 < angle < .37):
                color = (255, 255, 255)
            if 255 < px < 395 and 256 < py < 303:
                color = (255, 255, 255)
            # Cyan upward arrow: shaft and arrow head.
            if (px > 279 and py > 338 and py < 440 and px < 331 and py < 440 - (px - 279) * .65) or (px > 305 and px < 462 and abs(py - (394 - (px - 305) * .82)) < 24):
                color = (0, 207, 239)
            row.extend(color)
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)
    data = b"\\x89PNG\\r\\n\\x1a\\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")
    (OUT / f"gestao-icon-{size}.png").write_bytes(data)

for dimension in (192, 512):
    icon(dimension)
