import type { CSSProperties } from 'react';

export type BackdropVariant =
  | 'landing'
  | 'coverage'
  | 'report'
  | 'methodology'
  | 'about'
  | 'default';

export function backdropVariantForPath(pathname: string): BackdropVariant {
  if (pathname === '/') return 'landing';
  if (pathname.startsWith('/reports/')) return 'report';
  if (pathname.startsWith('/reports')) return 'coverage';
  if (pathname.startsWith('/methodology')) return 'methodology';
  if (pathname.startsWith('/about')) return 'about';
  return 'default';
}

const patternByVariant: Record<BackdropVariant, 'mesh-gradient' | 'signal-grid'> = {
  landing: 'signal-grid',
  coverage: 'signal-grid',
  report: 'signal-grid',
  methodology: 'signal-grid',
  about: 'mesh-gradient',
  default: 'mesh-gradient',
};

export function AppBackdrop({ variant }: { variant: BackdropVariant }) {
  const pattern = patternByVariant[variant] ?? 'mesh-gradient';

  // Some layers use animation delays; keep them stable across renders.
  const orbBStyle = { animationDelay: '-4s' } satisfies CSSProperties;

  return (
    <div className="ss-backdrop" aria-hidden="true">
      <div className="ss-backdrop-wash" />

      <div className={`ss-backdrop-pattern ${pattern}`} />
      <div className="ss-backdrop-dots dot-grid" />

      <div className="ss-backdrop-net">
        <svg className="w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ssNetStroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(16,185,129,0.0)" />
              <stop offset="18%" stopColor="rgba(16,185,129,0.45)" />
              <stop offset="55%" stopColor="rgba(16,185,129,0.22)" />
              <stop offset="82%" stopColor="rgba(59,130,246,0.35)" />
              <stop offset="100%" stopColor="rgba(59,130,246,0.0)" />
            </linearGradient>
          </defs>

          <path
            d="M-60 520 C 120 420, 240 640, 420 530 C 610 414, 720 630, 900 520 C 1040 430, 1140 520, 1260 470"
            fill="none"
            stroke="url(#ssNetStroke)"
            strokeWidth="2"
            className="signal-dash"
            opacity="0.65"
          />
          <path
            d="M-60 300 C 140 360, 250 220, 420 315 C 610 420, 730 250, 880 330 C 1040 414, 1120 330, 1260 390"
            fill="none"
            stroke="url(#ssNetStroke)"
            strokeWidth="1.5"
            className="signal-dash"
            style={{ strokeDasharray: '6 20', animationDuration: '26s' }}
            opacity="0.45"
          />

          {/*
            A few "node" dots for depth. Keep opacity low so it reads as texture, not UI.
          */}
          {[
            { cx: 210, cy: 610, r: 2.2 },
            { cx: 420, cy: 530, r: 2.0 },
            { cx: 610, cy: 414, r: 2.0 },
            { cx: 720, cy: 630, r: 2.2 },
            { cx: 900, cy: 520, r: 2.0 },
            { cx: 880, cy: 330, r: 1.8 },
            { cx: 420, cy: 315, r: 1.8 },
          ].map((n, i) => (
            <circle key={i} cx={n.cx} cy={n.cy} r={n.r} fill="rgba(16,185,129,0.22)" />
          ))}
        </svg>
      </div>

      <div className="ss-backdrop-ring-wrap">
        <div className="ss-backdrop-ring animate-spin-slow" />
      </div>
      <div className="ss-backdrop-orb-a-wrap">
        <div className="ss-backdrop-orb-a animate-float" />
      </div>
      <div className="ss-backdrop-orb-b-wrap">
        <div className="ss-backdrop-orb-b animate-float" style={orbBStyle} />
      </div>

      <div className="ss-backdrop-vignette" />
      <div className="ss-backdrop-grain" />
    </div>
  );
}
