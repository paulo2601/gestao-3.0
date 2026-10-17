import { useEffect } from 'react';
import { usePrivacyMode } from './usePrivacyMode';

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
