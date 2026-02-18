import type { ReactNode } from 'react';
import { useState } from 'react';
import { Seo } from '../components/seo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { BrandLogo } from '../components/layout/BrandLogo';
import { useReportsCount } from '../utils/reportsCount';

type LandingFeature = {
  key: 'reports' | 'chat' | 'dq' | 'entities' | 'hybrid';
  title: string;
  description: string | null;
  isNew?: boolean;
  icon: ReactNode;
};

const features: LandingFeature[] = [
  {
    key: 'dq',
    title: 'Disclosure Quality Rating',
    description: 'A transparent 0-100 score across completeness, consistency, assurance, and transparency, with evidence highlights grounded in disclosures.',
    isNew: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 5-3 9-7 9s-7-4-7-9V7l7-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
      </svg>
    )
  },
  {
    key: 'hybrid',
    title: 'ESG Ratings Roadmap',
    description: 'Building toward transparent ESG ratings grounded in evidence: Disclosure Quality + extracted entities + model signals.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7l10 10M17 7L7 17" opacity={0.35} />
      </svg>
    )
  },
  {
    key: 'entities',
    title: 'Evidence Entity Extraction',
    description: 'FinBERT-ESG-9 routes report chunks by category, then LangExtract extracts structured ESG entities (emissions, targets, policies, metrics) with evidence spans.',
    isNew: true,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10" />
      </svg>
    )
  },
  {
    key: 'chat',
    title: 'Report-Grounded AI Chat',
    description: 'Ask questions and validate disclosures with answers grounded in the exact pages you are viewing.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    )
  },
  {
    key: 'reports',
    title: 'Coverage Universe',
    description: null, // Will be populated dynamically in component
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
];

type DemoTabKey = 'evidence' | 'entities' | 'dq';

const DEMO_DQ = {
  total: 82,
  band: 'High',
  subscores: [
    { label: 'Completeness', value: 86, bar: 'from-emerald-500 to-teal-500' },
    { label: 'Consistency', value: 74, bar: 'from-sky-500 to-blue-600' },
    { label: 'Assurance', value: 80, bar: 'from-amber-500 to-orange-500' },
    { label: 'Transparency', value: 71, bar: 'from-violet-500 to-indigo-600' },
  ],
};

function DemoPanel({ active }: { active: DemoTabKey }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - DEMO_DQ.total / 100);

  const panelClass = (key: DemoTabKey) =>
    `transition-all duration-300 ${
      active === key
        ? 'opacity-100 translate-y-0'
        : 'opacity-0 translate-y-2 pointer-events-none absolute inset-0'
    }`;

  return (
    <div className="relative min-h-[360px]">
      <div className={panelClass('evidence')} role="tabpanel" aria-label="Evidence demo">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Evidence Snippet</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate">Scope 3 emissions disclosure</div>
          </div>
          <span className="px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40">
            p.42
          </span>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
            In FY2024, our total value chain (Scope 3) greenhouse gas emissions were{' '}
            <span className="px-1.5 py-0.5 rounded-md bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200 font-semibold">
              1,673,903 tCO2e
            </span>
            , calculated in accordance with the{' '}
            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 font-semibold">
              GHG Protocol
            </span>
            .
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { k: 'Grounding', v: 'Page-aware extraction' },
            { k: 'Traceability', v: 'Evidence span stored' },
            { k: 'Signals', v: 'Unit + large number' },
            { k: 'Outcome', v: 'Feeds scoring + chat' },
          ].map((row) => (
            <div key={row.k} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{row.k}</div>
              <div className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">{row.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
          Demo only. Real results are grounded on the exact PDF pages you open in-app.
        </div>
      </div>

      <div className={panelClass('entities')} role="tabpanel" aria-label="Entities demo">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Structured Entities</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate">Extracted with evidence spans</div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40">E</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800/40">S</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800/40">G</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {[
            { p: 'E', cls: 'ghg_emissions', text: 'Scope 3 1,673,903 tCO2e', page: 42 },
            { p: 'E', cls: 'climate_target', text: '100% reduction in absolute scope 1 and 2 GHG emissions by FY28', page: 18 },
            { p: 'G', cls: 'assurance', text: 'Limited assurance stated for selected sustainability KPIs', page: 6 },
          ].map((row, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    row.p === 'E'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40'
                      : row.p === 'S'
                        ? 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/40'
                        : 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/40'
                  }`}>{row.p}</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{row.cls}</span>
                </div>
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/40 px-2 py-0.5 rounded-md">
                  p.{row.page}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{row.text}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
          FinBERT-ESG-9 routes chunks first. Non-ESG text is skipped to reduce LLM calls.
        </div>
      </div>

      <div className={panelClass('dq')} role="tabpanel" aria-label="Disclosure Quality demo">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Disclosure Quality</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate">Score + evidence highlights</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
              {DEMO_DQ.total}
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{DEMO_DQ.band}</span>
          </div>
        </div>

        <div className="mt-4 grid sm:grid-cols-[120px_1fr] gap-5 items-start">
          <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-4">
            <div className="relative w-[108px] h-[108px]">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <defs>
                  <linearGradient id="dqRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="55%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r={r} strokeWidth="10" fill="none" className="text-gray-200 dark:text-gray-700" stroke="currentColor" />
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  stroke="url(#dqRingGrad)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${c} ${c}`}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">{DEMO_DQ.total}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">of 100</div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed sm:max-w-[12ch]">
              Deterministic indicators, weighted into subscores.
            </div>
          </div>

          <div className="space-y-3">
            {DEMO_DQ.subscores.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{row.value}/100</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-gray-200/70 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${row.bar} rounded-full transition-all duration-700`} style={{ width: `${row.value}%` }} />
                </div>
              </div>
            ))}

            <div className="pt-1.5">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Evidence highlights</div>
              <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 leading-relaxed shadow-sm">
                Assurance is mentioned for selected sustainability disclosures.
                <br />
                Methodology and boundary statements describe how emissions are calculated and reported.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const { formatted: reportsCount } = useReportsCount();
  const [demoTab, setDemoTab] = useState<DemoTabKey>('evidence');

  // Update features with dynamic count
  const dynamicFeatures = features.map(f =>
    f.key === 'reports'
      ? { ...f, description: `Explore ${reportsCount} CSRD-aligned disclosures that power Disclosure Quality and the ESG ratings roadmap. Open PDFs in-app, inspect evidence, and run scoring.` }

      : f
  );
  const mainFeatures = dynamicFeatures.filter((f) => f.key !== 'hybrid');
  const roadmapFeature = dynamicFeatures.find((f) => f.key === 'hybrid') ?? null;
  const landingDescription = `Sustainability Signals is building transparent, auditable ESG ratings. Start with Disclosure Quality scoring, grounded chat, and entity extraction across ${reportsCount} CSRD-aligned disclosures.`;
  const landingSchemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Sustainability Signals',
      url: 'https://www.sustainabilitysignals.com/',
      inLanguage: 'en-US',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Sustainability Signals',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: landingDescription,
      url: 'https://www.sustainabilitysignals.com/',
    },
  ];

  return (
    <>
      <Seo
        title="Sustainability Signals | Evidence-Grounded ESG Ratings"
        description={landingDescription}
        path="/"
        type="website"
        image="/og-image.png"
        imageAlt="Sustainability Signals logo on dark background"
        keywords={[
          'ESG ratings',
          'disclosure quality',
          'sustainability reports',
          'CSRD',
          'ESG entity extraction',
        ]}
        structuredData={landingSchemas}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden -mt-16 pt-16 min-h-[92svh] sm:min-h-[100svh]">
        {/* Keep the hero background consistent with the app-wide layout backdrop (no section "bands"). */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/25 to-transparent dark:from-gray-950/55 dark:via-gray-950/25 dark:to-transparent" />

        <div className="relative z-10 flex flex-col min-h-[calc(100svh_-_4rem)]">
          <div className="flex-1 flex items-center">
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-14 lg:py-16">
              <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                {/* Copy */}
                <div className="lg:col-span-6">
                  <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/70 dark:bg-gray-900/50 backdrop-blur-2xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm animate-fade-up">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Live: Disclosure Quality + Entity Extraction
                    </span>
                  </div>

                  <h1 className="mt-6 font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white animate-fade-up-delay-1 leading-[1.05]">
                    Build evidence-grounded{' '}
                    <span className="gradient-text animate-gradient bg-[length:200%_auto]">ESG ratings</span>.
                  </h1>

                  <p className="mt-5 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed animate-fade-up-delay-2">
                    Disclosure Quality is our first rating layer: score completeness, consistency, assurance, and transparency with evidence highlights. Next: entity-backed indicators and peer benchmarks across{' '}
                    <strong className="text-gray-800 dark:text-gray-100">{reportsCount} CSRD-aligned disclosures</strong>.
                  </p>

                  <div className="mt-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center animate-fade-up-delay-3">
                    <Button to="/reports" size="xl" className="shadow-xl shadow-brand-500/20 hover:shadow-brand-500/30">
                      Explore Disclosure Quality
                      <svg className="w-5 h-5 ml-2 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Button>
                    <Button to="/methodology" variant="outline" size="xl">
                      Read Methodology
                    </Button>
                  </div>

                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        k: 'Open PDFs',
                        v: 'Chunk + route ESG text',
                        icon: (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h7l3 3v15a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v4a1 1 0 001 1h4" />
                          </svg>
                        ),
                      },
                      {
                        k: 'Ground Evidence',
                        v: 'Page-aware spans',
                        icon: (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 5h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2z" />
                          </svg>
                        ),
                      },
                      {
                        k: 'Extract Entities',
                        v: 'Rating-ready ESG facts',
                        icon: (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10" />
                          </svg>
                        ),
                      },
                      {
                        k: 'Score Quality',
                        v: 'DQ as layer 1',
                        icon: (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 5-3 9-7 9s-7-4-7-9V7l7-4z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                          </svg>
                        ),
                      },
                    ].map((x) => (
                      <div key={x.k} className="p-3.5 rounded-2xl bg-white/70 dark:bg-gray-900/50 backdrop-blur-xl border border-gray-200/60 dark:border-gray-700/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-white/80 dark:bg-gray-900/60 backdrop-blur border border-gray-200/60 dark:border-gray-700/60 shadow-sm flex items-center justify-center text-gray-700 dark:text-gray-200 flex-shrink-0">
                            {x.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{x.k}</div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 truncate">{x.v}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signal Console */}
                <div className="lg:col-span-6">
                  <div className="relative">
                    <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-brand-500/35 via-emerald-500/10 to-sky-500/25 blur-sm" aria-hidden="true" />
                    <div className="relative rounded-3xl bg-white/70 dark:bg-gray-900/55 backdrop-blur-2xl border border-gray-200/70 dark:border-gray-700/50 shadow-[0_12px_40px_rgba(16,24,40,0.12)] overflow-hidden">
                      <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/60 dark:border-gray-700/60 bg-white/50 dark:bg-gray-900/40">
                        <div className="flex items-center gap-3 min-w-0">
                          <BrandLogo wrapperClassName="w-10 h-10 rounded-2xl overflow-hidden shadow-lg shadow-brand-600/15 ring-1 ring-white/40 dark:ring-gray-700/60 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-gray-900 dark:text-white truncate">Ratings Console</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">Illustrative sample UI</div>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                          <span className="relative flex h-2 w-2" aria-hidden="true">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                          </span>
                          Demo
                        </span>
                      </div>

                      <div className="px-5 sm:px-6 pt-4">
                        <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-gray-100/70 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60">
                          {[
                            { key: 'evidence', label: 'Evidence' },
                            { key: 'entities', label: 'Entities' },
                            { key: 'dq', label: 'DQ Score' },
                          ].map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setDemoTab(tab.key as DemoTabKey)}
                              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                                demoTab === tab.key
                                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                              }`}
                              aria-pressed={demoTab === tab.key}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="px-5 sm:px-6 py-5 sm:py-6">
                        <DemoPanel active={demoTab} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="pb-10 sm:pb-12">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                {[
                  { value: reportsCount, label: 'Disclosures', sub: 'CSRD-aligned' },
                  { value: '30+', label: 'Countries', sub: 'European coverage' },
                  { value: '11', label: 'GICS Sectors', sub: 'Full classification' },
                  { value: '60+', label: 'Indicators', sub: 'DQ engine v4.1' },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    data-ss-reveal
                    style={{ ['--ss-reveal-delay' as any]: `${i * 70}ms` }}
                    className="hover-lift p-5 text-center rounded-2xl bg-white/70 dark:bg-gray-900/50 backdrop-blur-2xl border border-gray-200/60 dark:border-gray-700/50 soft-shadow"
                  >
                    <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{stat.value}</div>
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">{stat.label}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stat.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="cv-auto py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div data-ss-reveal className="text-center mb-16">
            <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 tracking-widest uppercase mb-3">Capabilities</p>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-5 tracking-tight">
              Evidence-First Research Stack
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Score Disclosure Quality, extract structured ESG entities, and trace outputs back to evidence. Built toward transparent ESG ratings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {mainFeatures.map((feature, i) => {
              const isNew = Boolean(feature.isNew);
              return (
                <div key={feature.key} className="group relative">
                  <div
                    className={`absolute -inset-px bg-gradient-to-br rounded-2xl transition-all duration-500 blur-sm ${
                      isNew
                        ? 'from-emerald-500 via-brand-500 to-teal-500 opacity-60'
                        : 'from-brand-500 to-teal-500 opacity-0 group-hover:opacity-40'
                    }`}
                    aria-hidden="true"
                  />
                  <Card
                    style={{ ['--ss-reveal-delay' as any]: `${i * 80}ms` }}
                    className={`relative h-full bg-white dark:bg-gray-900 p-7 sm:p-8 rounded-2xl border transition-all duration-300 group-hover:shadow-xl ${
                      isNew
                        ? 'border-emerald-200/70 dark:border-emerald-800/40 ring-1 ring-emerald-500/15'
                        : 'border-gray-100 dark:border-gray-800'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 ${
                        isNew
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-gradient-to-br from-brand-500 to-emerald-500 text-white shadow-lg shadow-brand-500/20'
                      }`}
                    >
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2.5 flex items-center gap-2">
                      <span>{feature.title}</span>
                      {isNew && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wide">
                          New
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-[15px]">
                      {feature.description}
                    </p>
                  </Card>
                </div>
              );
            })}

            {roadmapFeature && (
              <div className="group relative md:col-span-2">
                <div className="absolute -inset-px bg-gradient-to-br from-emerald-500 via-brand-500 to-sky-500 opacity-55 rounded-3xl blur-sm" aria-hidden="true" />
                <Card
                  style={{ ['--ss-reveal-delay' as any]: `${mainFeatures.length * 80}ms` }}
                  className="relative overflow-hidden p-8 sm:p-10 rounded-3xl border border-emerald-200/70 dark:border-emerald-800/40"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-50/80 via-white to-white dark:from-emerald-900/12 dark:via-gray-900 dark:to-gray-900" aria-hidden="true" />
                  <div className="relative">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                      <div className="max-w-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-brand-600/20 flex-shrink-0">
                            {roadmapFeature.icon}
                          </div>
                          <div>
                            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {roadmapFeature.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  Disclosure Quality is the first layer. Next: transparent pillar indicators and peer benchmarks grounded in extracted entities and auditable evidence.
                </p>
              </div>
            </div>
          </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button to="/methodology" variant="outline" size="md" className="whitespace-nowrap">
                          Methodology
                        </Button>
                        <Button to="/reports" size="md" className="whitespace-nowrap shadow-xl shadow-brand-500/15 hover:shadow-brand-500/25">
                          Explore Coverage
                        </Button>
                      </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { t: 'Now', d: 'DQ scoring + grounded chat + entity extraction', cls: 'from-emerald-500 to-teal-500' },
                        { t: 'Next', d: 'Entity-backed indicators + peer benchmarks', cls: 'from-sky-500 to-blue-600' },
                        { t: 'Then', d: 'Transparent ESG ratings methodology', cls: 'from-violet-500 to-indigo-600' },
                      ].map((s) => (
                        <div key={s.t} className="p-4 rounded-2xl bg-white/75 dark:bg-gray-900/55 backdrop-blur-2xl border border-gray-200/60 dark:border-gray-700/50 soft-shadow">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${s.cls}`} aria-hidden="true" />
                            <div className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{s.t}</div>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                            {s.d}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reports Highlight Section */}
      <section className="cv-auto py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div data-ss-reveal className="card-surface rounded-3xl overflow-hidden soft-shadow-xl">
            <div className="grid md:grid-cols-2 gap-10 lg:gap-16 p-8 sm:p-12 lg:p-16 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-full text-xs font-bold uppercase tracking-widest">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500"></span>
                  </span>
                  Live Beta
                </div>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Validate disclosures fast
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                  Stop searching through hundreds of pages. Open any disclosure and ask the AI assistant to instantly find evidence for targets, emissions, assurance, and governance.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['Scope 1, 2, 3', 'GRI Standards', 'TCFD', 'SASB'].map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium border border-gray-200/60 dark:border-gray-700/60">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="pt-2">
                  <Button to="/reports" size="lg" className="shadow-xl shadow-brand-500/10 hover:shadow-brand-500/20">
                    Try Grounded Chat
                    <svg className="w-5 h-5 ml-2 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-r from-brand-500/15 to-blue-500/15 dark:from-brand-500/8 dark:to-blue-500/8 blur-2xl rounded-full" />
                <div className="relative bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-lg">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md shadow-brand-500/20">
                      AI
                    </div>
                    <div className="p-3.5 bg-white dark:bg-gray-900 rounded-2xl rounded-tl-sm border border-gray-100 dark:border-gray-700 shadow-sm">
                      <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed">
                        Based on the 2024 report, the company has reduced Scope 1 emissions by 15% through renewable energy adoption...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-emerald-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/20">
                      What are the Scope 3 targets?
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LangExtract Entities Highlight Section */}
      <section className="cv-auto py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div data-ss-reveal className="card-surface rounded-3xl overflow-hidden border-emerald-200/40 dark:border-emerald-900/30 soft-shadow-xl">
            <div className="grid md:grid-cols-2 gap-10 lg:gap-16 p-8 sm:p-12 lg:p-16 items-center">
              <div className="space-y-6 md:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
                  </span>
                  New Feature
                </div>
                <h3 className="text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight break-words">
                  LangExtract-style ESG entity extraction
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                  Pull structured ESG entities from long PDFs: <span className="font-semibold text-gray-700 dark:text-gray-200">Scope 1/2/3</span>, targets, water and waste metrics, policies, and frameworks. Chunks are first routed by <span className="font-semibold text-gray-700 dark:text-gray-200">FinBERT-ESG-9</span>, then entities are extracted and mapped to <span className="font-semibold text-gray-700 dark:text-gray-200">E/S/G</span> with best-effort page grounding.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['FinBERT-9 routing', 'Emissions', 'Targets', 'Water', 'Waste', 'Policies', 'Frameworks'].map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium border border-gray-200/60 dark:border-gray-700/60">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="pt-2">
                  <Button to="/reports" size="lg" className="shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20">
                    Try Entity Extraction
                    <svg className="w-5 h-5 ml-2 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Button>
                </div>
              </div>

              <div className="relative md:order-1">
                <div className="absolute -inset-6 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 dark:from-emerald-500/8 dark:to-teal-500/8 blur-2xl rounded-full" />
                <div className="relative bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-lg">
                  <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/20">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 dark:text-white truncate">Extracted Entities</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">Structured from the report text</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 ml-auto sm:ml-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                        E
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800">
                        S
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800">
                        G
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {[
                      { p: 'E', cls: 'ghg_emissions', text: 'Scope 3 1,673,903 tCO2e', page: 42 },
                      { p: 'E', cls: 'climate_target', text: '100% reduction in absolute scope 1 and 2 GHG emissions by FY28', page: 18 },
                      { p: 'G', cls: 'regulatory', text: 'prepared in accordance with the GRI Standards 2021', page: 3 },
                    ].map((row, i) => (
                      <div key={i} className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              row.p === 'E'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40'
                                : row.p === 'S'
                                  ? 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/40'
                                  : 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/40'
                            }`}>{row.p}</span>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 break-all">{row.cls}</span>
                          </div>
                          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/40 px-2 py-0.5 rounded-md">
                            p.{row.page}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                          {row.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Disclosure Quality Highlight Section */}
      <section className="cv-auto py-16 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div data-ss-reveal className="card-surface rounded-3xl overflow-hidden border-emerald-200/40 dark:border-emerald-900/30 soft-shadow-xl">
            <div className="grid md:grid-cols-2 gap-10 lg:gap-16 p-8 sm:p-12 lg:p-16 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
                  </span>
                  New Feature
                </div>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Disclosure Quality, at a glance
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                  Score reporting <span className="font-semibold text-gray-700 dark:text-gray-200">completeness</span>, <span className="font-semibold text-gray-700 dark:text-gray-200">consistency</span>, <span className="font-semibold text-gray-700 dark:text-gray-200">assurance</span>, and <span className="font-semibold text-gray-700 dark:text-gray-200">transparency</span>, then review evidence highlights grounded in the report text.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['Completeness', 'Consistency', 'Assurance', 'Transparency', 'Evidence Highlights'].map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium border border-gray-200/60 dark:border-gray-700/60">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="pt-2">
                  <Button to="/reports" size="lg" className="shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20">
                    Try Disclosure Quality
                    <svg className="w-5 h-5 ml-2 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 dark:from-emerald-500/8 dark:to-teal-500/8 blur-2xl rounded-full" />
                <div className="relative bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-lg">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/20">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 5-3 9-7 9s-7-4-7-9V7l7-4z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 dark:text-white truncate">Disclosure Quality</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">Report integrity lens</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                        82
                      </span>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        High
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {[
                      { label: 'Completeness', value: 86, bar: 'from-emerald-500 to-teal-500' },
                      { label: 'Consistency', value: 74, bar: 'from-sky-500 to-blue-600' },
                      { label: 'Assurance', value: 80, bar: 'from-amber-500 to-orange-500' },
                      { label: 'Transparency', value: 71, bar: 'from-violet-500 to-purple-600' },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                          <span>{row.label}</span>
                          <span className="tabular-nums">{row.value}/100</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-gray-200/70 dark:bg-gray-700 overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${row.bar} rounded-full transition-all duration-700`} style={{ width: `${row.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Evidence highlights</div>
                    <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      Independent assurance is mentioned for selected sustainability disclosures.

                      Methodology and boundary statements describe how emissions are calculated and reported.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="cv-auto py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div data-ss-reveal className="card-surface bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-900 rounded-3xl p-8 sm:p-12 soft-shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 tracking-widest uppercase mb-3">In Development</p>
                <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
                  ESG Ratings Methodology
                </h3>
                <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
                  We are building a transparent ESG ratings methodology: published weights, indicator definitions, and audit-ready evidence for every score. Disclosure Quality is layer 1; entity-backed indicators and peer benchmarks are next.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-default">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">ESG ratings</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">Methodology + benchmarks</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cv-auto py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div data-ss-reveal className="relative overflow-hidden rounded-3xl border border-emerald-200/40 dark:border-emerald-900/30 soft-shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-emerald-600 to-teal-600" aria-hidden="true">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_var(--tw-gradient-stops))] from-white/15 to-transparent" />
              <div className="absolute inset-0 dot-grid opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)' }} />
            </div>

            <div className="relative px-7 py-12 sm:px-12 sm:py-14 lg:px-16 text-center">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
                Ready to score?
              </h2>
              <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
                Explore coverage, run Disclosure Quality scoring, and trace every claim back to evidence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button to="/reports" variant="secondary" size="xl" className="shadow-xl shadow-black/10">
                  Explore Coverage
                </Button>
                <Button to="/methodology" variant="outline" size="xl" className="border-white/30 text-white hover:bg-white/10 hover:border-white/50">
                  Read Methodology
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
