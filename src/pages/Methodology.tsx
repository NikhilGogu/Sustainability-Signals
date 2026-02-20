import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button, Card, PageHero } from '../components/ui';
import { Seo } from '../components/seo';
import { useReportsCount } from '../utils/reportsCount';

type PipelineStep = {
  title: string;
  desc: string;
  icon: ReactNode;
};

const PIPELINE: PipelineStep[] = [
  {
    title: 'Ingest PDFs',
    desc: 'Fetch disclosures and keep the original PDF as the source of truth.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3h7l3 3v15a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 3v4a1 1 0 001 1h4" />
      </svg>
    ),
  },
  {
    title: 'Normalize and chunk',
    desc: 'Clean conversion artifacts and split content into page-aware chunks.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.5 6h9.75M3.75 6H7.5m3 12h9.75M3.75 18H7.5m9-6h3.75M3.75 12H16.5" />
      </svg>
    ),
  },
  {
    title: 'Route ESG content',
    desc: 'FinBERT-ESG-9 labels chunks into 9 ESG categories. Non-ESG is skipped.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    title: 'Extract entities',
    desc: 'On routed chunks, LangExtract pulls structured ESG facts with evidence spans.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h10M7 12h10M7 17h10" />
      </svg>
    ),
  },
  {
    title: 'Detect disclosure signals',
    desc: 'A deterministic feature layer scans for indicators (standards, scopes, targets, assurance, tables).',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-5.2-5.2m0 0A7.5 7.5 0 105.2 5.2a7.5 7.5 0 0010.6 10.6z" />
      </svg>
    ),
  },
  {
    title: 'Score with evidence',
    desc: 'Signals combine into a 0-100 Disclosure Quality score, backed by ranked evidence quotes.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 4v5c0 5-3 9-7 9s-7-4-7-9V7l7-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

type Pillar = {
  key: 'completeness' | 'consistency' | 'assurance' | 'transparency';
  title: string;
  weight: number;
  gradient: string;
  bullets: string[];
};

const PILLARS: Pillar[] = [
  {
    key: 'completeness',
    title: 'Completeness',
    weight: 35,
    gradient: 'from-emerald-500 to-teal-500',
    bullets: [
      'Breadth of ESG topics and standards coverage',
      'Materiality and scope clarity (value chain, boundaries)',
      'Climate + emissions presence (scope 1/2/3, base year, targets)',
      'Governance package (oversight, policies, controls)',
    ],
  },
  {
    key: 'consistency',
    title: 'Consistency',
    weight: 25,
    gradient: 'from-sky-500 to-blue-600',
    bullets: [
      'Methodology statements and reporting boundaries',
      'Multi-year comparability and quantitative density',
      'Units, tables, and KPI structure signals',
      'Limitations and restatements where applicable',
    ],
  },
  {
    key: 'assurance',
    title: 'Assurance',
    weight: 20,
    gradient: 'from-amber-500 to-orange-500',
    bullets: [
      'Assurance presence (limited / reasonable) and clarity',
      'Assurance standard signals (e.g., ISAE, AA1000)',
      'Named provider and scope details',
      'Breadth signals across the disclosure (not just one line)',
    ],
  },
  {
    key: 'transparency',
    title: 'Transparency',
    weight: 20,
    gradient: 'from-indigo-500 to-sky-500',
    bullets: [
      'Forward-looking statements and transition signals',
      'Targets + progress tracking language',
      'Stakeholder and governance transparency cues',
      'Financial connectivity and disclosure clarity signals',
    ],
  },
];

export function Methodology() {
  const { formatted: reportsCount } = useReportsCount();
  const [expanded, setExpanded] = useState<Pillar['key'] | null>(null);

  return (
    <>
      <Seo
        title="Methodology | How Disclosure Quality Scoring Works — Sustainability Signals"
        description="See the end-to-end methodology: report ingestion, FinBERT ESG routing, entity extraction, and weighted Disclosure Quality scoring with evidence highlights across sustainability disclosures."
        path="/methodology"
        image="/og-image.png"
        imageAlt="Sustainability Signals — Disclosure Quality Methodology"
        keywords={['disclosure quality methodology', 'ESG scoring model', 'FinBERT ESG', 'entity extraction', 'sustainability scoring methodology', 'NLP ESG analysis', 'CSRD assessment']}
        breadcrumbs={[{ name: 'Methodology', path: '/methodology' }]}
      />

      <PageHero
        label="Methodology"
        align="center"
        tone="signal"
        title={<>How Disclosure Quality Works</>}
        description={
          <>
            A hybrid pipeline: route report chunks with FinBERT-ESG-9, extract entities with evidence spans, then score
            disclosure signals into a transparent 0-100 rating.
          </>
        }
      >
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button to="/reports">Explore Coverage</Button>
          <Button to="/" variant="outline">
            Back to Home
          </Button>
        </div>
      </PageHero>

      <section className="relative -mt-8 z-10 pb-10">
        <div className="section-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { value: reportsCount, label: 'Disclosures', sub: 'CSRD-aligned' },
              { value: '9', label: 'ESG Categories', sub: 'FinBERT routing' },
              { value: '60+', label: 'Indicators', sub: 'Deterministic layer' },
              { value: '4', label: 'Pillars', sub: 'Weighted score' },
            ].map((s, i) => (
              <div
                key={s.label}
                data-ss-reveal
                style={{ ['--ss-reveal-delay' as any]: `${i * 70}ms` }}
                className="card-surface px-5 py-5 text-center hover-lift"
              >
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{s.value}</div>
                <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">{s.label}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-section relative overflow-hidden">
        <div className="section-container relative">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 tracking-widest uppercase mb-3">Pipeline</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
              From PDF to score
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              The output is only as trustworthy as the traceability. Everything is designed to stay anchored to the
              underlying report.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {PIPELINE.map((step, i) => (
              <Card
                key={step.title}
                style={{ ['--ss-reveal-delay' as any]: `${i * 70}ms` }}
                className="card-surface p-7 sm:p-8 hover-lift"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-emerald-500 text-white shadow-lg shadow-brand-500/20 flex items-center justify-center flex-shrink-0">
                    {step.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{step.title}</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="page-section relative overflow-hidden">
        <div className="section-container relative">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 tracking-widest uppercase mb-3">Scoring</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
              Four pillars, one score
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Weighted formula (transparent):
              <span className="font-mono font-semibold text-gray-800 dark:text-gray-200"> 0.35*C + 0.25*K + 0.20*A + 0.20*T</span>
            </p>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Bands: <span className="font-semibold text-emerald-700 dark:text-emerald-300">High</span> (75+),{' '}
              <span className="font-semibold text-amber-700 dark:text-amber-300">Medium</span> (50-74),{' '}
              <span className="font-semibold text-rose-700 dark:text-rose-300">Low</span> (&lt;50)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {PILLARS.map((p) => {
              const open = expanded === p.key;
              const panelId = `pillar-${p.key}`;
              return (
                <div key={p.key} className="group relative">
                  <div
                    className={`absolute -inset-px bg-gradient-to-br ${p.gradient} rounded-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 blur-sm`}
                    aria-hidden="true"
                  />
                  <Card className="relative !rounded-2xl" padding="none">
                    <button
                      type="button"
                      className="w-full text-left p-6 sm:p-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-2xl"
                      onClick={() => setExpanded(open ? null : p.key)}
                      aria-expanded={open}
                      aria-controls={panelId}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.gradient} text-white flex items-center justify-center text-sm font-extrabold shadow-lg flex-shrink-0`}>
                            {p.weight}%
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">{p.title}</h3>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click to view components</p>
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      <div className="mt-4 w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${p.gradient} rounded-full transition-all duration-700`} style={{ width: `${p.weight}%` }} />
                      </div>
                    </button>

                    <div
                      id={panelId}
                      aria-hidden={!open}
                      className={`overflow-hidden transition-[max-height,opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        open
                          ? 'max-h-[420px] opacity-100 translate-y-0 border-t border-gray-100 dark:border-gray-800 mt-1'
                          : 'max-h-0 opacity-0 -translate-y-1'
                      }`}
                    >
                      <div className="px-6 sm:px-7 pb-6 sm:pb-7">
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 mt-4">Signals</p>
                        <ul className="space-y-2">
                          {p.bullets.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${p.gradient} flex-shrink-0`} />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="page-section relative overflow-hidden">
        <div className="section-container relative">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 lg:gap-10 items-start">
            <Card className="card-surface p-7 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                What the score is (and is not)
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {[
                  'Deterministic: the score measures disclosure presence and structure, not the truthfulness of claims.',
                  'Evidence-first: every score is backed by traceable snippets and page context.',
                  'Comparable: the same formula runs across the entire coverage universe.',
                  'Evolvable: extracted entities are the next layer for more granular indicators and benchmarks.',
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                    {x}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="card-surface p-7 sm:p-8">
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Try it</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Open a disclosure, run Disclosure Quality, and inspect evidence highlights in-app.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <Button to="/reports">Explore Coverage</Button>
                <Button to="/about" variant="outline">
                  About the project
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
