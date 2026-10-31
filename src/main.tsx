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

declare const __BUILD_VERSION__: string;

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
    localStorage.setItem(VERSION_KEY, payload.version);
    if (payload.version !== __BUILD_VERSION__) {
      // Update automatically when the page is not being edited. Avoid losing unsaved forms.
      const active = document.activeElement;
      const editing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || (active instanceof HTMLElement && active.isContentEditable);
      if (!editing) {
        window.location.reload();
      } else {
        window.dispatchEvent(new CustomEvent('gestao-update-available', { detail: { version: payload.version } }));
      }
    }
  } catch {
    // Sem rede, mantém a versão aberta e tenta novamente quando o app voltar a ficar ativo.
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      void registration.update().catch((error) => console.warn('PWA: atualização do service worker falhou', error));
      window.setInterval(() => { void registration.update().catch(() => undefined); }, 15 * 60_000);
    }).catch((error) => {
      console.error('PWA: registro do service worker falhou', error);
    });
    void ensureLatestBuild();
  });


  window.addEventListener('pageshow', () => {
    sessionStorage.removeItem('gestao-sw-controller-reload');
    void ensureLatestBuild();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void ensureLatestBuild();
  });

  window.setInterval(() => { void ensureLatestBuild(); }, 5 * 60_000);
}
