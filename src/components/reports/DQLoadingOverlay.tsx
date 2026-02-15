import { useEffect, useState, useRef } from 'react';

/* ─── types ────────────────────────────────────────────────────── */
interface DQLoadingOverlayProps {
    /** Whether we're computing (POST) vs just loading (GET) */
    isComputing?: boolean;
}

/* ─── constants ────────────────────────────────────────────────── */
const DIMENSIONS = [
    { label: 'Completeness', color: '#10b981', accent: 'text-emerald-500', bg: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
    { label: 'Consistency', color: '#3b82f6', accent: 'text-blue-500', bg: 'bg-blue-500', ring: 'ring-blue-500/20' },
    { label: 'Assurance', color: '#8b5cf6', accent: 'text-violet-500', bg: 'bg-violet-500', ring: 'ring-violet-500/20' },
    { label: 'Transparency', color: '#f59e0b', accent: 'text-amber-500', bg: 'bg-amber-500', ring: 'ring-amber-500/20' },
] as const;

/* ─── animated ring ────────────────────────────────────────────── */
function ScoringRing({ dimension, delay }: { dimension: (typeof DIMENSIONS)[number]; delay: number }) {
    const r = 22;
    const circumference = 2 * Math.PI * r;
    const [fill, setFill] = useState(0);

    useEffect(() => {
        const t1 = setTimeout(() => setFill(0.15 + Math.random() * 0.25), delay);
        const interval = setInterval(() => {
            setFill((prev) => {
                const next = prev + 0.03 + Math.random() * 0.06;
                return next >= 0.95 ? 0.15 + Math.random() * 0.2 : next;
            });
        }, 400 + Math.random() * 300);
        return () => { clearTimeout(t1); clearInterval(interval); };
    }, [delay]);

    return (
        <div className="flex flex-col items-center gap-1.5 dq-ring-entrance" style={{ animationDelay: `${delay}ms` }}>
            <div className="relative w-14 h-14">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
                    <circle cx={26} cy={26} r={r} fill="none" stroke="currentColor"
                        className="text-gray-100 dark:text-gray-800/60" strokeWidth={3} />
                    <circle cx={26} cy={26} r={r} fill="none" stroke={dimension.color}
                        strokeWidth={3.5} strokeLinecap="round"
                        strokeDasharray={`${circumference * fill} ${circumference * (1 - fill)}`}
                        className="transition-all duration-700 ease-out"
                        style={{ filter: `drop-shadow(0 0 4px ${dimension.color}44)` }} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center">
                    <span className={`w-1.5 h-1.5 rounded-full ${dimension.bg} dq-dot-pulse`}
                        style={{ animationDelay: `${delay}ms` }} />
                </span>
            </div>
            <span className="text-[9px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500">
                {dimension.label.slice(0, 4)}
            </span>
        </div>
    );
}

/* ─── main component ───────────────────────────────────────────── */
export function DQLoadingOverlay({ isComputing = false }: DQLoadingOverlayProps) {
    const [scanIdx, setScanIdx] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

    useEffect(() => {
        timerRef.current = setInterval(() => setScanIdx((i) => (i + 1) % DIMENSIONS.length), 2000);
        return () => clearInterval(timerRef.current);
    }, []);

    const [dots, setDots] = useState('');
    useEffect(() => {
        const t = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 500);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="flex flex-col items-center py-8 px-4 dq-overlay-enter">
            {/* Shield with pulse */}
            <div className="relative mb-5">
                <div className="absolute -inset-3 rounded-full dq-pulse-ring"
                    style={{ background: `radial-gradient(circle, ${DIMENSIONS[scanIdx].color}22 0%, transparent 70%)` }} />
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700/60 flex items-center justify-center dq-shield-breathe">
                    <svg className="w-6 h-6 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 4v5c0 5-3 9-7 9s-7-4-7-9V7l7-4z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4" />
                    </svg>
                </div>
            </div>

            {/* Status text */}
            <div className="text-center mb-5 space-y-1">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {isComputing ? 'Computing Score' : 'Loading Score'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isComputing ? (
                        <>
                            Analysing{' '}
                            <span className="font-semibold dq-dimension-swap" key={scanIdx}
                                style={{ color: DIMENSIONS[scanIdx].color }}>
                                {DIMENSIONS[scanIdx].label.toLowerCase()}
                            </span>
                            {dots}
                        </>
                    ) : (
                        <>Fetching cached score{dots}</>
                    )}
                </p>
            </div>

            {/* Dimension rings */}
            {isComputing && (
                <div className="flex items-center justify-center gap-3 mb-5">
                    {DIMENSIONS.map((dim, i) => (
                        <ScoringRing key={dim.label} dimension={dim} delay={i * 200} />
                    ))}
                </div>
            )}

            {/* Progress bar (indeterminate) */}
            <div className="w-full max-w-[240px]">
                <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden border border-gray-200/40 dark:border-gray-700/30">
                    <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-500/80 to-teal-400/80 dq-indeterminate" />
                </div>
            </div>

            {/* Detail text for computing */}
            {isComputing && (
                <p className="mt-4 text-[10px] text-gray-400 dark:text-gray-500 text-center leading-relaxed max-w-[240px]">
                    Scanning 60+ indicators across completeness, consistency, assurance &amp; transparency
                </p>
            )}
        </div>
    );
}
