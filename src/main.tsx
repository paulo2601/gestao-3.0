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
const UPDATE_ATTEMPT_KEY = 'gestao-update-attempt';
const UPDATE_ATTEMPT_AT_KEY = 'gestao-update-attempt-at';
const UPDATE_RETRY_MS = 30_000;
const UPDATE_CHECK_MS = 60_000;
let pendingBuild: string | null = null;
let updateInProgress = false;
let updateApproved = false;
function editingInProgress(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || (active instanceof HTMLElement && active.isContentEditable)) return true;
  return Array.from(document.querySelectorAll('form')).some(form => Array.from(form.elements).some(element => element instanceof HTMLInputElement && element.value !== element.defaultValue || element instanceof HTMLTextAreaElement && element.value !== element.defaultValue));
}
function applyPendingBuild(): void {
  if (!pendingBuild || !updateApproved || updateInProgress) return;
  const lastAttempt = sessionStorage.getItem(UPDATE_ATTEMPT_KEY);
  const lastAttemptAt = Number(sessionStorage.getItem(UPDATE_ATTEMPT_AT_KEY) || 0);
  if (lastAttempt === pendingBuild && Date.now() - lastAttemptAt < UPDATE_RETRY_MS) return; // Retry after a cooldown if the CDN served an older build.
  updateInProgress = true;
  sessionStorage.setItem(UPDATE_ATTEMPT_KEY, pendingBuild);
  sessionStorage.setItem(UPDATE_ATTEMPT_AT_KEY, String(Date.now()));
  window.location.reload();
}
window.addEventListener('gestao-update-confirmed', () => { updateApproved = true; applyPendingBuild(); });
window.addEventListener('focus', () => { void ensureLatestBuild(); });
window.addEventListener('online', () => { void ensureLatestBuild(); });

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
    if (payload.version === __BUILD_VERSION__) { sessionStorage.removeItem(UPDATE_ATTEMPT_KEY); sessionStorage.removeItem(UPDATE_ATTEMPT_AT_KEY); pendingBuild = null; updateApproved = false; return; }
    if (payload.version !== __BUILD_VERSION__) {
      pendingBuild = payload.version;
      window.dispatchEvent(new CustomEvent('gestao-update-available', { detail: { version: payload.version } }));
    }
  } catch {
    // Sem rede, mantém a versão aberta e tenta novamente quando o app voltar a ficar ativo.
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      void registration.update().catch((error) => console.warn('PWA: atualização do service worker falhou', error));
      window.setInterval(() => { void registration.update().catch(() => undefined); }, UPDATE_CHECK_MS);
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

  window.setInterval(() => { void ensureLatestBuild(); }, UPDATE_CHECK_MS);
}
