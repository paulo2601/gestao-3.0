import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/gestao-secondary-icon.svg', import.meta.url));
for (const size of [192, 512]) {
  await sharp(source, { density: 192 })
    .resize(size, size)
    .png()
    .toFile(new URL(`../public/gestao-secondary-icon-${size}.png`, import.meta.url).pathname);
}
