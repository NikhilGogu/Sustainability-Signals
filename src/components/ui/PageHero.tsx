import type { ReactNode } from 'react';

type PageHeroTone = 'mesh' | 'signal';
type PageHeroAlign = 'left' | 'center';

interface PageHeroProps {
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: PageHeroAlign;
  tone?: PageHeroTone;
  children?: ReactNode;
  className?: string;
}

export function PageHero({
  label,
  title,
  description,
  align = 'left',
  tone = 'mesh',
  children,
  className = '',
}: PageHeroProps) {
  const alignWrap = align === 'center' ? 'max-w-3xl mx-auto text-center' : 'max-w-3xl';
  // App-wide background now lives at the layout level. Keep hero visuals subtle and consistent
  // to avoid visible "bands" between sections/routes.
  const scrimTone =
    tone === 'signal'
      ? 'from-brand-50/55 via-white/25 to-transparent dark:from-brand-900/14 dark:via-gray-950/35 dark:to-transparent'
      : 'from-sky-50/45 via-white/25 to-transparent dark:from-sky-900/12 dark:via-gray-950/35 dark:to-transparent';

  return (
    <section className={`relative overflow-hidden border-b border-gray-100/70 dark:border-gray-800/50 ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-b ${scrimTone}`} aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/25 to-transparent" aria-hidden="true" />

      <div className="section-container relative py-14 sm:py-20">
        <div className={alignWrap}>
          {label && (
            <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 tracking-widest uppercase mb-3 animate-fade-up">
              {label}
            </p>
          )}
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4 animate-fade-up-delay-1">
            {title}
          </h1>
          {description && (
            <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 leading-relaxed animate-fade-up-delay-2">
              {description}
            </p>
          )}
          {children && (
            <div className="mt-8 animate-fade-up-delay-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
