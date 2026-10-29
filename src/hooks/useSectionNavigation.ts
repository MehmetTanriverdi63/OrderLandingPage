import { useLayoutEffect, useRef } from 'react';
const sections = new Set(['angebot', 'speisekarte', 'so-gehts', 'restaurant']);
/** Resolve fragment links after React mounts, and align again after initial layout settles. */
export function useSectionNavigation(enabled: boolean, contentReady: boolean) {
  const alignRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (!enabled) return;
    let disposed = false, interrupted = false, frame = 0;
    let target: HTMLElement | null = null;
    const align = () => {
      if (!disposed && !interrupted && target?.isConnected) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    };
    const navigate = () => {
      cancelAnimationFrame(frame);
      target = null;
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!sections.has(id)) return;
      target = document.getElementById(id);
      interrupted = false;
      align();
      frame = requestAnimationFrame(align);
      // Font metrics can change the height of the introductory section.
      void document.fonts?.ready.then(align);
    };
    const interrupt = () => { interrupted = true; };
    alignRef.current = align;
    window.addEventListener('hashchange', navigate);
    window.addEventListener('load', align);
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    for (const event of events) window.addEventListener(event, interrupt, { passive: true });
    navigate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      alignRef.current = null;
      window.removeEventListener('hashchange', navigate);
      window.removeEventListener('load', align);
      for (const event of events) window.removeEventListener(event, interrupt);
    };
  }, [enabled]);
  // Menu data expands the content above later sections; respect any manual scrolling.
  useLayoutEffect(() => { alignRef.current?.(); }, [contentReady]);
}
