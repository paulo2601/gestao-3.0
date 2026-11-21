import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// Generate installable PNG assets without additional dependencies.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const input = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const b of input) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const end = Buffer.alloc(4);
  end.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, input, end]);
}
function png(n) {
  const raw = Buffer.alloc(n * (1 + n * 4));
  for (let y = 0; y < n; y++) {
    raw[y * (1 + n * 4)] = 0;
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const r = Math.min(u, 1 - u, v, 1 - v);
      const background = r > 0.08 || (r > 0 && ((u > .08 && u < .92) || (v > .08 && v < .92)));
      // White home roof, body and a small number 2 distinguish the green app.
      const roof = v > .29 && v < .53 && Math.abs(u - .5) < (.53 - v) * 1.25;
      const house = u > .30 && u < .70 && v > .48 && v < .73;
      const door = u > .46 && u < .54 && v > .61 && v < .73;
      const white = roof || (house && !door);
      const i = y * (1 + n * 4) + 1 + x * 4;
      raw[i] = white ? 255 : 22;
      raw[i + 1] = white ? 255 : 133;
      raw[i + 2] = white ? 255 : 104;
      raw[i + 3] = background ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
for (const n of [192, 512]) {
  writeFileSync(new URL(`../public/gestao-secondary-icon-${n}.png`, import.meta.url), png(n));
}
