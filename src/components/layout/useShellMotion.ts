import { useEffect } from 'react';
import type { RefObject } from 'react';

type ShellEl = HTMLElement | null;

const PARALLAX_VARS = [
  '--ss-parallax-slow-x',
  '--ss-parallax-slow-y',
  '--ss-parallax-net-x',
  '--ss-parallax-net-y',
  '--ss-parallax-dot-x',
  '--ss-parallax-dot-y',
  '--ss-parallax-orb-a-x',
  '--ss-parallax-orb-a-y',
  '--ss-parallax-orb-b-x',
  '--ss-parallax-orb-b-y',
] as const;

function setParallax(el: HTMLElement, nx: number, ny: number) {
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  const x = clamp(nx);
  const y = clamp(ny);

  // Depth layers (px offsets) tuned to feel present but not distracting.
  el.style.setProperty('--ss-parallax-slow-x', `${x * 8}px`);
  el.style.setProperty('--ss-parallax-slow-y', `${y * 6}px`);
  el.style.setProperty('--ss-parallax-net-x', `${x * 14}px`);
  el.style.setProperty('--ss-parallax-net-y', `${y * 10}px`);
  el.style.setProperty('--ss-parallax-dot-x', `${x * 5}px`);
  el.style.setProperty('--ss-parallax-dot-y', `${y * 4}px`);
  el.style.setProperty('--ss-parallax-orb-a-x', `${x * 18}px`);
  el.style.setProperty('--ss-parallax-orb-a-y', `${y * 14}px`);
  el.style.setProperty('--ss-parallax-orb-b-x', `${x * -12}px`);
  el.style.setProperty('--ss-parallax-orb-b-y', `${y * -10}px`);
}

function resetParallax(el: HTMLElement) {
  for (const v of PARALLAX_VARS) el.style.removeProperty(v);
}

export function useShellMotion(shellRef: RefObject<ShellEl>) {
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const coarsePointer = window.matchMedia?.('(hover: none), (pointer: coarse)')?.matches ?? false;
    if (reduceMotion || coarsePointer) {
      resetParallax(shell);
      return;
    }

    let raf = 0;
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (!window.innerWidth || !window.innerHeight) return;

      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setParallax(shell, nx, ny));
    };

    const reset = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setParallax(shell, 0, 0));
    };

    // Initialize to a stable baseline.
    setParallax(shell, 0, 0);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('blur', reset, { passive: true } as AddEventListenerOptions);
    document.documentElement.addEventListener('mouseleave', reset, { passive: true } as AddEventListenerOptions);

    return () => {
      window.removeEventListener('pointermove', onPointerMove as EventListener);
      window.removeEventListener('blur', reset as EventListener);
      document.documentElement.removeEventListener('mouseleave', reset as EventListener);
      if (raf) cancelAnimationFrame(raf);
      resetParallax(shell);
    };
  }, [shellRef]);
}
