import { useEffect, useState } from 'react';

/** Opt-in on-device measurements; never sends device data to a server. */
export function ViewportDiagnostics() {
  const [snapshot, setSnapshot] = useState('');
  useEffect(() => {
    const measure = () => {
      const vv = window.visualViewport;
      const header = document.querySelector('.app-header');
      const bounds = header?.getBoundingClientRect();
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe);
      const top = computed.paddingTop;
      const bottom = computed.paddingBottom;
      probe.remove();
      setSnapshot([
        `layout ${window.innerWidth}×${window.innerHeight}`,
        `visual ${vv?.width?.toFixed(0) ?? '-'}×${vv?.height?.toFixed(0) ?? '-'} offset ${vv?.offsetTop?.toFixed(0) ?? '-'}`,
        `safe-area top ${top} bottom ${bottom}`,
        `header top ${bounds?.top.toFixed(0) ?? '-'} height ${bounds?.height.toFixed(0) ?? '-'}`,
        `scrollY ${window.scrollY.toFixed(0)} DPR ${window.devicePixelRatio.toFixed(2)}`,
        `display ${window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}`,
      ].join(' | '));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, []);
  return <output aria-label="Diagnóstico de área útil" style={{ position:'fixed', bottom:'max(8px, env(safe-area-inset-bottom, 0px))', left:8, right:8, zIndex:9999, padding:10, borderRadius:8, background:'#101827', color:'#fff', fontSize:12, lineHeight:1.4, overflowWrap:'anywhere', pointerEvents:'none' }}>{snapshot}</output>;
}
