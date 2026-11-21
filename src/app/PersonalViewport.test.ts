import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Gestão Pessoal Android viewport contract', () => {
  it('uses browser-managed system bars for the personal Android standalone app', () => {
    const html = read('../../index.html');
    const vite = read('../../vite.config.ts');
    expect(html).toContain('viewport-fit=cover');
    expect(vite).toContain(".replace('width=device-width, initial-scale=1.0, viewport-fit=cover', 'width=device-width, initial-scale=1.0, viewport-fit=auto')");
  });
  it('uses safe-area padding in normal-flow header instead of phone-specific dimensions', () => {
    const shell = read('./shell.css');
    expect(shell).toMatch(/\.app-shell--personal \.app-header\{position:relative;top:auto;z-index:50;padding-block-start:env\(safe-area-inset-top,0px\)/);
    expect(shell).not.toMatch(/S21 Ultra|S24 Ultra|@media\s*\(max-width:380px\).*app-shell--personal/s);
  });
  it('applies quick entry styling to both dialog variants', () => {
    const variants = read('../shared/ui/dialog-variants.css');
    expect(variants).toContain('.ui-dialog[data-variant="quick-entry-personal"] .ui-dialog__header');
    expect(variants).toContain('.ui-dialog[data-variant="quick-entry-personal"] .ui-dialog__content');
  });
});
