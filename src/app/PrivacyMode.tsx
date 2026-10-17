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

// Visual presentation mode only; never mutates persisted monetary data.
export function PrivacyMask() {
  const { hidden } = usePrivacyMode();
  useEffect(() => {
    document.documentElement.classList.toggle('gestao-private', hidden);
    if (!hidden) return () => document.documentElement.classList.remove('gestao-private');
    const pattern = /(?:R\$\s*[-+]?\s*\d[\d.,]*|(?:[-+]?\d[\d.,]*\s*(?:%|reais|mil|milh(?:ão|ões))))/i;
    const root = document.querySelector('#app-main');
    if (!root) return;
    const mark = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || !pattern.test(node.textContent ?? '')) continue;
        if (parent.closest('input,textarea,select,[contenteditable="true"],.gestao-privacy-exempt')) continue;
        if (parent.children.length === 0 || parent.textContent?.trim() === node.textContent?.trim()) {
          parent.classList.add('gestao-private-value');
        } else {
          parent.classList.add('gestao-private-mixed');
        }
      }
    };
    mark();
    const observer = new MutationObserver(mark);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); document.documentElement.classList.remove('gestao-private'); };
  }, [hidden]);
  return null;
}
