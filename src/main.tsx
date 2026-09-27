import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './shared/ui/styles.css';
import './shared/ui/dialog-variants.css';
import './shared/ui/measurement-origin-refinement.css';
import './shared/ui/approved-measurement-origin-modal.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const VERSION_KEY = 'gestao-build-version';

async function ensureLatestBuild(): Promise<void> {
  if (!import.meta.env.PROD || document.visibilityState !== 'visible') return;
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache, no-store, must-revalidate' },
    });
    if (!response.ok) return;
    const payload = await response.json() as { version?: string };
    if (!payload.version) return;
    const current = localStorage.getItem(VERSION_KEY);
    if (!current) {
      localStorage.setItem(VERSION_KEY, payload.version);
      return;
    }
    if (current !== payload.version) {
      localStorage.setItem(VERSION_KEY, payload.version);
      const registration = await navigator.serviceWorker?.getRegistration();
      await registration?.update();
      window.location.reload();
    }
  } catch {
    // Sem rede, mantém a versão instalada e tenta novamente quando o app voltar a ficar ativo.
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      void registration.update();
      window.setInterval(() => { void registration.update(); }, 60_000);
    });
    void ensureLatestBuild();
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const key = 'gestao-sw-controller-reload';
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    window.location.reload();
  });

  window.addEventListener('pageshow', () => {
    sessionStorage.removeItem('gestao-sw-controller-reload');
    void ensureLatestBuild();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void ensureLatestBuild();
  });

  window.setInterval(() => { void ensureLatestBuild(); }, 60_000);
}
