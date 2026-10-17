import { useEffect, useState } from 'react';

const KEY = 'gestao-privacy-values-hidden';
const EVENT = 'gestao-privacy-change';
export function usePrivacyMode() {
  const [hidden, setHidden] = useState(() => {
    try { return window.localStorage.getItem(KEY) === 'true'; } catch { return false; }
  });
  useEffect(() => {
    const sync = () => { try { setHidden(window.localStorage.getItem(KEY) === 'true'); } catch { /* private storage */ } };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return { hidden, toggle: () => {
    const next = !hidden;
    setHidden(next);
    try { window.localStorage.setItem(KEY, String(next)); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(EVENT));
  } };
}

