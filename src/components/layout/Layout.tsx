import { Outlet, useLocation } from 'react-router';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { AppBackdrop, backdropVariantForPath } from './AppBackdrop';
import { useShellMotion } from './useShellMotion';

export function Layout() {
  const location = useLocation();
  const variant = useMemo(() => backdropVariantForPath(location.pathname), [location.pathname]);
  const shellRef = useRef<HTMLDivElement>(null);

  useShellMotion(shellRef);

  // Scroll to top on route change
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  // Scroll-reveal for any elements opting into `data-ss-reveal`.
  useLayoutEffect(() => {
    const root = document.querySelector('main');
    if (!root) return;

    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-ss-reveal]'));
    if (!els.length) return;

    const lightweightMotion =
      window.matchMedia?.(
        '(max-width: 768px), (hover: none) and (pointer: coarse), (prefers-reduced-motion: reduce)'
      )?.matches ?? false;
    if (lightweightMotion) {
      for (const el of els) el.dataset.ssRevealed = 'true';
      return;
    }

    const vh = window.innerHeight || 0;
    for (const el of els) {
      if (el.dataset.ssRevealed === 'true') continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.9) el.dataset.ssRevealed = 'true';
    }

    if (!('IntersectionObserver' in window)) {
      for (const el of els) el.dataset.ssRevealed = 'true';
      return;
    }

    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.dataset.ssRevealed = 'true';
          obs.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
    );

    for (const el of els) {
      if (el.dataset.ssRevealed === 'true') continue;
      io.observe(el);
    }

    return () => io.disconnect();
  }, [location.pathname]);

  return (
    <div
      ref={shellRef}
      className="ss-shell min-h-screen relative isolate bg-gray-50 dark:bg-gray-950"
      data-variant={variant}
    >
      <AppBackdrop variant={variant} />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <div key={location.pathname} className="ss-page animate-page-in">
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
