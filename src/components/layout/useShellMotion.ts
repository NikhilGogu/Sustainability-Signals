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
  '--ss-parallax-orb-c-x',
  '--ss-parallax-orb-c-y',
] as const;

const PARALLAX_EPSILON = 0.012;

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
  el.style.setProperty('--ss-parallax-orb-c-x', `${x * 10}px`);
  el.style.setProperty('--ss-parallax-orb-c-y', `${y * -8}px`);
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
    let targetX = 0;
    let targetY = 0;
    let lastX = 0;
    let lastY = 0;
    let viewportWidth = Math.max(1, window.innerWidth);
    let viewportHeight = Math.max(1, window.innerHeight);

    const updateViewport = () => {
      viewportWidth = Math.max(1, window.innerWidth);
      viewportHeight = Math.max(1, window.innerHeight);
    };

    const queueUpdate = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;

        if (
          Math.abs(targetX - lastX) < PARALLAX_EPSILON &&
          Math.abs(targetY - lastY) < PARALLAX_EPSILON
        ) {
          return;
        }

        lastX = targetX;
        lastY = targetY;
        setParallax(shell, targetX, targetY);
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      targetX = (e.clientX / viewportWidth) * 2 - 1;
      targetY = (e.clientY / viewportHeight) * 2 - 1;
      queueUpdate();
    };

    const reset = () => {
      targetX = 0;
      targetY = 0;
      queueUpdate();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') reset();
    };

    // Initialize to a stable baseline.
    setParallax(shell, 0, 0);
    updateViewport();

    window.addEventListener('resize', updateViewport, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('blur', reset, { passive: true });
    document.documentElement.addEventListener('mouseleave', reset, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('blur', reset);
      document.documentElement.removeEventListener('mouseleave', reset);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (raf) cancelAnimationFrame(raf);
      resetParallax(shell);
    };
  }, [shellRef]);
}
