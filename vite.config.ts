import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildVersion = process.env.GITHUB_SHA ?? new Date().toISOString();

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    {
      name: 'gestao-build-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: buildVersion }) });
      },
    },
  ],
  server: {
    port: 5173,
  },
});
