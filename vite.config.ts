import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildVersion = process.env.GITHUB_SHA ?? new Date().toISOString();
const appVariant = process.env.GESTAO_APP_VARIANT === 'secondary' ? 'secondary' : 'primary';
const secondary = appVariant === 'secondary';
const appName = secondary ? 'Gestão 3.0 — 2' : 'Gestão 3.0';
const shortName = secondary ? 'Gestão 2' : 'Gestão';
const appId = secondary ? '/gestao-3-0-secondary' : '/gestao-3-0-cr';
const themeColor = secondary ? '#168568' : '#061b3a';
const icon = secondary ? '/gestao-secondary-icon-192.png' : '/gestao-icon-192.png';
const icon512 = secondary ? '/gestao-secondary-icon-512.png' : '/gestao-icon-512.png';

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
    __GESTAO_APP_VARIANT__: JSON.stringify(appVariant),
  },
  plugins: [
    react(),
    {
      name: 'gestao-app-variant',
      transformIndexHtml(html) {
        if (!secondary) return html;
        return html
          .replace('/manifest.webmanifest?v=4', '/manifest-secondary.webmanifest')
          .replace('/gestao-app-icon.svg?v=4', '/gestao-secondary-icon.svg')
          .replace('/gestao-icon-192.png?v=4', '/gestao-secondary-icon.svg')
          .replace('<title>Gestão 3.0</title>', '<title>Gestão 3.0 — 2</title>')
          .replace('content="#071426"', 'content="#168568"')
          .replace('content="Gestão"', 'content="Gestão 2"');
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: buildVersion }) });
        // Emit the selected manifest under the standard URL for the deployed variant.
        this.emitFile({ type: 'asset', fileName: 'manifest-secondary.webmanifest', source: JSON.stringify({
          name: appName, short_name: shortName, description: 'Gestão financeira, RH e engenharia.',
          lang: 'pt-BR', id: appId, start_url: '/?source=pwa', scope: '/',
          display: 'standalone', background_color: themeColor, theme_color: themeColor,
          icons: [
            { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        }) });
      },
    },
  ],
  server: { port: 5173 },
});
