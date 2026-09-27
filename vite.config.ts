import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'gestao-build-version',
      generateBundle() {
        const version = process.env.GITHUB_SHA ?? new Date().toISOString();
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
      },
    },
  ],
  server: {
    port: 5173,
  },
});
