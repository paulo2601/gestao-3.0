import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../dist/', import.meta.url);
const read = (name) => readFileSync(new URL(name, root));
const manifest = JSON.parse(read('manifest-secondary.webmanifest').toString('utf8'));
const html = read('index.html').toString('utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(manifest.id === '/gestao-3-0-secondary', 'Secondary app ID is incorrect');
assert(manifest.name === 'Gestão Pessoal' && manifest.short_name === 'Gestão Pessoal', 'Secondary app name is incorrect');
assert(html.includes('<title>Gestão Pessoal</title>'), 'Secondary page title is incorrect');
assert(manifest.display === 'standalone', 'Secondary PWA must open standalone');
assert(manifest.start_url.startsWith('/'), 'Secondary start URL must be same-origin');
assert(html.includes('/manifest-secondary.webmanifest'), 'HTML is not linked to secondary manifest');
assert(html.includes('/gestao-secondary-icon-192.png'), 'Apple touch icon is not the secondary PNG');
assert(!html.includes('href="/manifest.webmanifest?v=4"'), 'Primary manifest still active');

for (const size of [192, 512]) {
  const name = `gestao-secondary-icon-${size}.png`;
  const png = read(name);
  assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${name}: invalid PNG signature`);
  assert(png.readUInt32BE(16) === size && png.readUInt32BE(20) === size, `${name}: invalid dimensions`);
  assert(manifest.icons.some((icon) => icon.src === '/' + name && icon.sizes === `${size}x${size}`), `${name}: missing from manifest`);
}

console.log('Secondary PWA: manifest, installable icons and HTML identity validated.');
