import { useState, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useReportsCount } from '../utils/reportsCount';

/* ─── tiny helpers ─── */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 tracking-widest uppercase mb-3">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
      {children}
    </h2>
  );
}

function Pill({ children, color = 'brand' }: { children: ReactNode; color?: string }) {
  const map: Record<string, string> = {
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border-brand-200 dark:border-brand-800',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${map[color] ?? map.brand}`}>
      {children}
    </span>
  );
}

/* ─── data ─── */
const pipelineSteps = [
  {
    num: '01', title: 'PDF Ingestion', desc: 'Sustainability PDFs are fetched from R2 object storage and converted to clean Markdown via Cloudflare Workers AI.', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
    )
  },
  {
    num: '02', title: 'Text Normalization', desc: 'Whitespace, conversion noise, broken links, unicode artifacts, and decorative symbols are stripped. Large documents (>800k chars) are sampled head+tail.', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
    )
  },
  {
    num: '03', title: 'Page Segmentation & Chunking', desc: 'Markdown headings and viewer markers split content into page-aware blocks. Text is chunked into BERT-sized segments with overlap for downstream classification.', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
    )
  },
  {
    num: '04', title: 'FinBERT-ESG Routing', desc: 'Each chunk is classified by the real yiyanghkust/finbert-esg-9-categories model running as a hosted Docker service (Azure Container Apps) — one of 9 ESG categories (Climate Change, Natural Capital, Pollution & Waste, Human Capital, Product Liability, Community Relations, Corporate Governance, Business Ethics, Non-ESG). Non-ESG chunks are skipped, saving ~40-60% of LLM calls.', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
    )
  },
  {
    num: '05', title: 'LangExtract on Routed Chunks', desc: 'Only ESG-relevant chunks are sent to Workers AI (Llama 3.3 70B) for structured entity extraction — emissions data, targets, policies, and metrics with verbatim evidence spans.', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
    )
  },
  {
    num: '06', title: 'Feature Detection', desc: '60+ regex-based indicators scan every evidence block, counting occurrences and tracking page spread for depth scoring.', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
    )
  },
  {
    num: '07', title: 'Scoring Engine', desc: 'Detected features feed into four weighted subscores that combine into a 0-100 overall score with High / Medium / Low banding.', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
    )
  },
  {
    num: '08', title: 'Evidence & AI Refinement', desc: 'Top-ranked evidence quotes are extracted with page/heading context, then optionally cleaned by Llama 3.1 to remove PDF artifacts while preserving facts.', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17l-5.384 3.174 1.414-5.998L2.25 7.846l6.09-.51L11.42 2.25l3.08 5.086 6.09.51-5.2 4.5 1.414 5.998z" /></svg>
    )
  },
];

const pillars: {
  key: string; title: string; weight: number; color: string; gradient: string;
  maxPts: string; components: string[];
}[] = [
    {
      key: 'completeness', title: 'Completeness', weight: 35, color: 'emerald',
      gradient: 'from-emerald-500 to-teal-500',
      maxPts: '100',
      components: [
        'Frameworks & standards coverage (ESRS, GRI, SASB, TCFD, ISSB…) — up to 18 pts',
        'Materiality assessment & double materiality — up to 10 pts',
        'Governance package (board oversight, audit, ESG remuneration…) — up to 8 pts',
        'Climate & emissions (Scope 1/2/3, GHG protocol, base year…) — up to 22 pts',
        'Targets & transition strategy — up to 10 pts',
        'Environment beyond climate (energy, water, waste, biodiversity…) — up to 8 pts',
        'Social package & value chain — up to 12 pts',
        'EU Taxonomy depth — up to 4 pts',
        'Sector-specific disclosures — up to 2 pts',
      ],
    },
    {
      key: 'consistency', title: 'Consistency', weight: 25, color: 'sky',
      gradient: 'from-sky-500 to-blue-600',
      maxPts: '100',
      components: [
        'Methodology, boundary & data quality statements — up to 20 pts',
        'GHG protocol & base year alignment — up to 10 pts',
        'Reporting period clarity — up to 5 pts',
        'Comparative years (multi-year data) — up to 18 pts',
        'Quantitative density (percentages, tables, KPI numbers) — up to 15 pts',
        'Limitations & restatements — up to 10 pts',
        'Control environment (internal control, risk, audit) — up to 8 pts',
        'Units present (tCO₂e, MWh, GJ, tonnes…) — up to 5 pts',
        'Data tables depth — up to 4 pts',
        'Quantitative targets — up to 5 pts',
      ],
    },
    {
      key: 'assurance', title: 'Assurance', weight: 20, color: 'amber',
      gradient: 'from-amber-500 to-orange-500',
      maxPts: '100',
      components: [
        'Base: No assurance → 0 | Generic mention → 38 | Limited → 60 | Reasonable → 82 | Both → 90',
        'Assurance standard (ISAE 3000, AA1000) — +6 bonus',
        'Named assurance provider — +5 bonus',
        'Scope clarity (what is assured) — +4 bonus',
        'Breadth (assurance on ≥5 pages) — +3 bonus',
      ],
    },
    {
      key: 'transparency', title: 'Transparency', weight: 20, color: 'violet',
      gradient: 'from-violet-500 to-purple-600',
      maxPts: '100',
      components: [
        'Forward-looking statements & transition plan — up to 15 pts',
        'Limitations & restatement disclosure — up to 15 pts',
        'Named assurance provider — up to 8 pts',
        'Methodology & data quality — up to 10 pts',
        'Stakeholder engagement — up to 8 pts',
        'Scope 3 category detail — up to 7 pts',
        'Boundary clarity & reporting period — up to 9 pts',
        'Quantitative targets & progress tracking — up to 8 pts',
        'Financial connectivity — up to 5 pts',
        'IRO / materiality process detail — up to 5 pts',
        'ESRS datapoint references — up to 5 pts',
        'GRI content index — up to 3 pts',
      ],
    },
  ];

const featureFamilies: { title: string; color: string; items: string[] }[] = [
  { title: 'Frameworks & Standards', color: 'brand', items: ['ESRS', 'CSRD', 'GRI', 'SASB', 'TCFD', 'ISSB / IFRS S1-S2', 'EU Taxonomy', 'TNFD', 'CDP', 'SDGs', 'Paris Agreement'] },
  { title: 'Materiality & Scope', color: 'emerald', items: ['Double materiality', 'Materiality assessment', 'Materiality matrix', 'IRO process', 'Value chain', 'Supply chain'] },
  { title: 'Governance & Controls', color: 'sky', items: ['Board oversight', 'Audit committee', 'Internal control', 'Risk management', 'ESG-linked remuneration', 'Whistleblower', 'Anti-corruption', 'Data privacy', 'Sustainability committee'] },
  { title: 'Climate & Emissions', color: 'amber', items: ['Scope 1/2/3', 'GHG Protocol', 'Base year', 'Scope 2 method', 'Emissions intensity', 'Emissions numbers', 'Scope 3 categories'] },
  { title: 'Targets & Transition', color: 'violet', items: ['Net zero', 'SBTi', 'Transition plan', 'Quantitative targets', 'Interim targets', 'Progress vs targets', 'Climate scenario', 'Carbon pricing'] },
  { title: 'Environmental Topics', color: 'emerald', items: ['Energy', 'Renewable energy', 'Water', 'Waste', 'Biodiversity', 'Circular economy', 'Pollution'] },
  { title: 'Social Topics', color: 'rose', items: ['Workforce', 'Safety (H&S)', 'Diversity', 'Human rights', 'Training', 'Stakeholder engagement', 'Community investment', 'Living wage', 'Just transition', 'Employee turnover'] },
  { title: 'Assurance Signals', color: 'amber', items: ['Limited assurance', 'Reasonable assurance', 'ISAE 3000 / AA1000', 'Named provider', 'Assurance scope', 'Negative assurance'] },
  { title: 'Disclosure Quality Signals', color: 'sky', items: ['Methodology', 'Boundaries', 'Limitations', 'Restatement', 'Forward-looking', 'Data tables', 'Data quality', 'Financial connectivity', 'ESRS datapoints', 'GRI content index'] },
];

const evidenceSignals = [
  { label: 'Percentages', icon: '%' },
  { label: 'Large numbers', icon: '#' },
  { label: 'Units (tCO₂e, MWh…)', icon: 'U' },
  { label: 'Year mentions', icon: 'Y' },
  { label: 'Target language', icon: 'T' },
  { label: 'Scope mentions', icon: 'S' },
  { label: 'Table-like rows', icon: '⊞' },
  { label: 'Page reference', icon: 'P' },
];

const archLayers = [
  { label: 'Frontend', tech: 'React + TypeScript + Vite', color: 'from-brand-500 to-emerald-500' },
  { label: 'Hosting', tech: 'Cloudflare Pages (static) + Pages Functions (API)', color: 'from-sky-500 to-blue-600' },
  { label: 'Containers', tech: 'Azure Container Apps (FinBERT-ESG-9 inference, Docker)', color: 'from-teal-500 to-cyan-600' },
  { label: 'Storage', tech: 'Cloudflare R2 (PDFs, Markdown, Scores)', color: 'from-amber-500 to-orange-500' },
  { label: 'AI', tech: 'Cloudflare Workers AI (PDF→MD, Chat, Evidence Cleanup)', color: 'from-violet-500 to-purple-600' },
  { label: 'Search', tech: 'Cloudflare Vectorize (semantic retrieval, optional)', color: 'from-rose-500 to-pink-600' },
];

/* ─── component ─── */
export function Methodology() {
  const { formatted: reportsCount } = useReportsCount();
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [showAllFamilies, setShowAllFamilies] = useState(false);

  return (
    <>
      <Helmet>
        <title>Methodology - SustainabilitySignals</title>
        <meta name="description" content="Deep-dive into how SustainabilitySignals scores Disclosure Quality across 60+ indicators and turns disclosure evidence into the building blocks of transparent ESG ratings." />
      </Helmet>

      {/* ═══════════════  HERO  ═══════════════ */}
      <section className="relative overflow-hidden min-h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-gray-50 to-white dark:from-gray-950 dark:via-gray-950 dark:to-gray-900" />
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 dot-grid opacity-50" />
        <div className="absolute top-1/4 right-1/4 w-[420px] h-[420px] bg-brand-400/12 dark:bg-brand-400/6 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-1/3 left-1/4 w-[350px] h-[350px] bg-blue-400/10 dark:bg-blue-400/5 rounded-full blur-[90px] animate-float" style={{ animationDelay: '-4s' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center space-y-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/60 dark:bg-gray-800/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm animate-fade-up">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
            </span>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Hybrid Pipeline &middot; FinBERT-9 + LangExtract</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white animate-fade-up-delay-1 leading-[1.1]">
            Inside the{' '}
            <span className="gradient-text animate-gradient bg-[length:200%_auto]">Scoring Engine</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed animate-fade-up-delay-2">
            A hybrid pipeline that routes report chunks through FinBERT-ESG-9-Categories, then extracts structured entities via LangExtract — powering Disclosure Quality today and ESG ratings next.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2 animate-fade-up-delay-3">
            {['FinBERT-9 Routing', 'Evidence-grounded', 'AI-refined', 'Open formula'].map(t => (
              <span key={t} className="px-3.5 py-1.5 bg-white/70 dark:bg-gray-800/50 backdrop-blur-lg border border-gray-200/50 dark:border-gray-700/50 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-gray-900 to-transparent" />
      </section>

      {/* ═══════════════  OVERVIEW STATS  ═══════════════ */}
      <section className="relative -mt-12 z-10 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { value: reportsCount, label: 'Disclosures Scored', sub: 'CSRD-aligned' },
              { value: '9', label: 'ESG Categories', sub: 'FinBERT routing' },
              { value: '60+', label: 'Indicators', sub: 'Regex features' },
              { value: '8', label: 'Pipeline Steps', sub: 'Route → Extract → Score' },
            ].map(s => (
              <div key={s.label} className="card-surface px-5 py-5 text-center hover-lift">
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{s.value}</div>
                <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">{s.label}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════  PIPELINE  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-white dark:bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="section-container relative">
          <div className="text-center mb-16">
            <SectionLabel>The Pipeline</SectionLabel>
            <SectionTitle>From PDF to Score in 8 Steps</SectionTitle>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Every report follows the same hybrid pipeline — FinBERT-9 routes chunks by ESG category, then only relevant chunks get LLM extraction.
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            {/* vertical connector line */}
            <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-brand-300 via-brand-400/50 to-brand-300/20 dark:from-brand-700 dark:via-brand-600/40 dark:to-brand-700/10 hidden md:block" />

            <div className="space-y-6">
              {pipelineSteps.map((step, i) => (
                <div key={step.num} className="relative flex gap-5 sm:gap-7 items-start group" style={{ animationDelay: `${i * 0.07}s` }}>
                  {/* node dot */}
                  <div className="relative z-10 flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-110 transition-transform duration-300">
                    {step.icon}
                  </div>
                  <Card className="flex-1 !rounded-2xl group-hover:shadow-lg transition-shadow duration-300" hover>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-bold text-brand-500 dark:text-brand-400 tracking-widest">STEP {step.num}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{step.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════  THE FOUR PILLARS  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-50/40 via-transparent to-transparent dark:from-emerald-900/8" />
        <div className="section-container relative">
          <div className="text-center mb-16">
            <SectionLabel>Scoring Dimensions</SectionLabel>
            <SectionTitle>Four Pillars, One Score</SectionTitle>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-8">
              Each pillar evaluates a distinct quality dimension. They combine into a single 0-100 score via a transparent weighted formula.
            </p>

            {/* formula card */}
            <div className="inline-block">
              <div className="card-surface px-6 sm:px-8 py-5 soft-shadow-lg text-center">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Overall Score Formula</p>
                <p className="font-mono text-base sm:text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">0.35</span> × Completeness +{' '}
                  <span className="text-sky-600 dark:text-sky-400 font-bold">0.25</span> × Consistency +{' '}
                  <span className="text-amber-600 dark:text-amber-400 font-bold">0.20</span> × Assurance +{' '}
                  <span className="text-violet-600 dark:text-violet-400 font-bold">0.20</span> × Transparency
                </p>
                <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-400 dark:text-gray-500 font-medium">
                  <span>≥ 75 → <span className="text-emerald-600 dark:text-emerald-400 font-bold">High</span></span>
                  <span className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
                  <span>50-74 → <span className="text-amber-600 dark:text-amber-400 font-bold">Medium</span></span>
                  <span className="w-px h-3 bg-gray-200 dark:bg-gray-700" />
                  <span>&lt; 50 → <span className="text-rose-600 dark:text-rose-400 font-bold">Low</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* pillar cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {pillars.map(p => {
              const open = expandedPillar === p.key;
              return (
                <div key={p.key} className="group relative">
                  <div className={`absolute -inset-px bg-gradient-to-br ${p.gradient} rounded-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500 blur-sm`} aria-hidden="true" />
                  <Card className="relative h-full !rounded-2xl" padding="none">
                    <button
                      type="button"
                      className="w-full text-left p-6 sm:p-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-2xl"
                      onClick={() => setExpandedPillar(open ? null : p.key)}
                      aria-expanded={open}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.gradient} text-white flex items-center justify-center text-sm font-extrabold shadow-lg`}>
                            {p.weight}%
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{p.title}</h3>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Max {p.maxPts} points</p>
                          </div>
                        </div>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* weight bar */}
                      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${p.gradient} rounded-full transition-all duration-700`} style={{ width: `${p.weight}%` }} />
                      </div>
                    </button>

                    {open && (
                      <div className="px-6 sm:px-7 pb-6 sm:pb-7 pt-0 border-t border-gray-100 dark:border-gray-800 mt-1 animate-fade-in">
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 mt-4">Score Components</p>
                        <ul className="space-y-2">
                          {p.components.map((c, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${p.gradient} flex-shrink-0`} />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════  FEATURE FAMILIES  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-white dark:bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-25" />
        <div className="section-container relative">
          <div className="text-center mb-14">
            <SectionLabel>Feature Detection</SectionLabel>
            <SectionTitle>60+ Regex-Based Indicators</SectionTitle>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Each indicator is a carefully constructed regex pattern that counts occurrences and tracks which pages the signal appears on, providing both breadth and depth measurement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {(showAllFamilies ? featureFamilies : featureFamilies.slice(0, 6)).map(fam => (
              <Card key={fam.title} className="!rounded-2xl" padding="none" hover>
                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">{fam.title}</h3>
                    <Pill color={fam.color}>{fam.items.length}</Pill>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fam.items.map(item => (
                      <span key={item} className="px-2.5 py-1 bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium border border-gray-100 dark:border-gray-700/60">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {!showAllFamilies && featureFamilies.length > 6 && (
            <div className="text-center mt-8">
              <Button variant="outline" onClick={() => setShowAllFamilies(true)}>
                Show All {featureFamilies.length} Families
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════  EVIDENCE RANKING  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-sky-50/50 via-transparent to-transparent dark:from-sky-900/8" />
        <div className="section-container relative">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-6">
              <SectionLabel>Evidence Extraction</SectionLabel>
              <SectionTitle>Quality-Ranked Evidence</SectionTitle>
              <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                For every detected feature, the engine extracts the best evidence quotes — not just the first match. Each quote receives a <strong className="text-gray-700 dark:text-gray-200">quality score</strong> based on eight ranking signals, and only the top-ranked quotes are kept.
              </p>
              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Quality Ranking Signals</p>
                <div className="grid grid-cols-2 gap-2">
                  {evidenceSignals.map(sig => (
                    <div key={sig.label} className="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                      <span className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                        {sig.icon}
                      </span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{sig.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* evidence demo card */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-brand-500/10 to-sky-500/10 dark:from-brand-500/5 dark:to-sky-500/5 blur-2xl rounded-full" />
              <div className="relative card-surface rounded-2xl p-5 sm:p-6 soft-shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-brand-500/20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">Evidence Block</p>
                    <p className="text-[11px] text-gray-400">Page 42 · GHG Emissions</p>
                  </div>
                  <div className="ml-auto">
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">Quality: 0.87</span>
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                  "Total Scope 1 emissions were <strong className="text-gray-900 dark:text-white">42,350 tCO₂e</strong> in 2024, a <strong className="text-gray-900 dark:text-white">15% reduction</strong> from the 2022 base year.
                  Scope 2 (market-based) was <strong className="text-gray-900 dark:text-white">28,100 tCO₂e</strong>."
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {['Percentage ✓', 'Large number ✓', 'Unit (tCO₂e) ✓', 'Year ✓', 'Scope ✓'].map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-md text-[10px] font-semibold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════  QUANTITATIVE PROFILE  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-white dark:bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-25" />
        <div className="section-container relative">
          <div className="text-center mb-14">
            <SectionLabel>Quantitative Diagnostics</SectionLabel>
            <SectionTitle>Data Density Profiling</SectionTitle>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Beyond feature detection, the engine computes numeric diagnostics that feed into consistency scoring and output metadata.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {[
              { label: 'Percentage Count', desc: 'Count of % expressions across the report', icon: '%' },
              { label: 'Table Rows', desc: 'Detected markdown-like table rows', icon: '⊞' },
              { label: 'KPI Numbers', desc: 'Large/typed numeric KPI patterns', icon: '#' },
              { label: 'Distinct Years', desc: 'Years (2018-2026) with ≥4 mentions', icon: 'Y' },
              { label: 'Numeric Density', desc: 'Numeric tokens per 1,000 characters', icon: 'δ' },
            ].map(m => (
              <div key={m.label} className="card-surface p-5 text-center hover-lift">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-emerald-100 dark:from-brand-900/30 dark:to-emerald-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-3 text-lg font-extrabold">
                  {m.icon}
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{m.label}</h4>
                <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════  ARCHITECTURE  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-violet-50/30 via-transparent to-transparent dark:from-violet-900/5" />
        <div className="section-container relative">
          <div className="text-center mb-14">
            <SectionLabel>Technical Architecture</SectionLabel>
            <SectionTitle>Edge-Native Infrastructure</SectionTitle>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              The entire platform runs on Cloudflare's edge network — no origin servers, no cold starts, global latency.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {archLayers.map((layer, i) => (
              <div key={layer.label} className="group relative" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={`absolute -inset-px bg-gradient-to-r ${layer.color} rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-sm`} aria-hidden="true" />
                <Card className="relative !rounded-2xl" hover>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${layer.color} text-white flex items-center justify-center font-extrabold text-sm shadow-lg flex-shrink-0`}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white">{layer.label}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{layer.tech}</p>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>

          {/* endpoints grid */}
          <div className="mt-14 max-w-5xl mx-auto">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-5 text-center">API Endpoints</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { path: '/r2/*', method: 'GET', desc: 'PDF byte serving from R2 with Range support and immutable caching' },
                { path: '/chat', method: 'POST', desc: 'Grounded Q&A over report pages, with optional Vectorize retrieval' },
                { path: '/score/disclosure-quality', method: 'GET|POST', desc: 'Fetch cached score (GET) or compute & cache (POST) with evidence' },
                { path: '/score/disclosure-quality-batch', method: 'POST', desc: 'Bulk fetch cached DQ summaries for the reports table (up to 200)' },
              ].map(ep => (
                <div key={ep.path} className="card-surface p-4 hover-lift">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-[10px] font-bold rounded-md font-mono">{ep.method}</span>
                  </div>
                  <p className="font-mono text-sm font-bold text-gray-900 dark:text-white mb-1 break-all">{ep.path}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{ep.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════  AI CHAT  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-white dark:bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-brand-50/40 via-transparent to-transparent dark:from-brand-900/8" />
        <div className="section-container relative">
          <div className="card-surface rounded-3xl overflow-hidden soft-shadow-xl">
            <div className="grid md:grid-cols-2 gap-10 lg:gap-16 p-8 sm:p-12 lg:p-16 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-full text-xs font-bold uppercase tracking-widest">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
                  </span>
                  AI-Powered
                </div>
                <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Report-Grounded Chat
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                  The AI assistant extracts page text via PDF.js, combines it with optional Vectorize semantic retrieval, and answers questions using <strong className="text-gray-700 dark:text-gray-200">only report content</strong> — never hallucinated facts.
                </p>
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  {[
                    'Page-windowed context extraction around current view',
                    'Semantic retrieval via Vectorize embeddings (when indexed)',
                    'Background PDF→Markdown→Embed pipeline on first chat',
                    'System prompt enforces fact-grounding, no invented references',
                    'Hard cap of 120K chars per request to bound payloads',
                  ].map(item => (
                    <div key={item} className="flex items-start gap-2.5">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* chat preview */}
              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-r from-brand-500/12 to-blue-500/12 dark:from-brand-500/6 dark:to-blue-500/6 blur-2xl rounded-full" />
                <div className="relative bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-lg">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md shadow-brand-500/20">AI</div>
                    <div className="p-3.5 bg-white dark:bg-gray-900 rounded-2xl rounded-tl-sm border border-gray-100 dark:border-gray-700 shadow-sm">
                      <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed">
                        Based on the 2024 report (Page 87), Scope 1 emissions decreased by <strong>15%</strong> through a transition to renewable electricity sourcing, reducing absolute emissions to <strong>42,350 tCO₂e</strong>.
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

      {/* ═══════════════  RECOMMENDATIONS ENGINE  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
        <div className="section-container relative">
          <div className="text-center mb-14">
            <SectionLabel>Actionable Insights</SectionLabel>
            <SectionTitle>Auto-Generated Recommendations</SectionTitle>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              The engine generates up to 6 rule-based improvement suggestions derived from missing signals, guiding companies toward better disclosure quality.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {[
              { title: 'Add Scope 3 Disclosure', desc: 'Include Scope 3 emissions with category-level breakdown for full value chain coverage', icon: '🌍' },
              { title: 'Double Materiality', desc: 'Conduct and document a double materiality assessment aligned with ESRS requirements', icon: '⚖️' },
              { title: 'Upgrade Assurance', desc: 'Obtain limited or reasonable assurance from a named external provider', icon: '🛡️' },
              { title: 'Quantitative Targets', desc: 'Set measurable, time-bound targets with progress tracking against baseline', icon: '🎯' },
              { title: 'Transition Plan', desc: 'Publish a credible climate transition plan with interim milestones', icon: '🗺️' },
              { title: 'Framework Alignment', desc: 'Align with additional frameworks (GRI, TCFD, ISSB) when coverage is low', icon: '📐' },
            ].map(rec => (
              <Card key={rec.title} className="!rounded-2xl" hover>
                <div className="text-2xl mb-3">{rec.icon}</div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1.5">{rec.title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{rec.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════  DATA COLLECTION  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-white dark:bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="section-container relative">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div className="space-y-6">
              <SectionLabel>Data Collection</SectionLabel>
              <SectionTitle>Coverage Universe</SectionTitle>
              <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed">
                The coverage universe contains <strong className="text-gray-700 dark:text-gray-200">{reportsCount}</strong> CSRD-aligned sustainability disclosures from European companies, sourced from official company filings and regulatory disclosures.
              </p>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                {[
                  'Company name, country, and GICS sector/industry group classification',
                  'Publication year and direct PDF link via R2',
                  'Exact page range for sustainability section',
                  '30+ European countries, 11 GICS sectors',
                  'Filter by country, sector, industry group',
                ].map(item => (
                  <div key={item} className="flex items-start gap-2.5">
                    <span className="text-brand-500 mt-0.5 flex-shrink-0">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Button to="/reports" size="lg">
                Explore Coverage
                <svg className="w-5 h-5 ml-2 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { value: reportsCount, label: 'Disclosures', color: 'from-brand-500 to-emerald-500' },
                { value: '30+', label: 'Countries', color: 'from-sky-500 to-blue-600' },
                { value: '11', label: 'GICS Sectors', color: 'from-amber-500 to-orange-500' },
                { value: '2024–25', label: 'Fiscal Years', color: 'from-violet-500 to-purple-600' },
              ].map(s => (
                <div key={s.label} className="card-surface p-5 text-center hover-lift">
                  <div className={`text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${s.color}`}>{s.value}</div>
                  <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════  ROADMAP  ═══════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-950 relative overflow-hidden">
        <div className="section-container relative">
          <div className="text-center mb-14">
            <SectionLabel>Roadmap</SectionLabel>
            <SectionTitle>What's Coming Next</SectionTitle>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {[
              { title: 'LangExtract Entities', desc: 'Structured ESG entity extraction grounded in report text (emissions, targets, policies, metrics).', pill: 'New', color: 'emerald' },
              { title: 'ESG Signals', desc: 'Real-time tracking of ESG rating changes, controversies, and disclosure events.', pill: 'Planned', color: 'sky' },
              { title: 'Company Profiles', desc: 'Deep-dive ESG profiles with score breakdowns and risk analysis.', pill: 'Planned', color: 'violet' },
              { title: 'ESG Ratings', desc: 'Transparent, evidence-grounded ESG ratings methodology built on Disclosure Quality and extracted entities.', pill: 'In Dev', color: 'amber' },
              { title: 'Advanced Analytics', desc: 'Comparative analysis, trend detection, and portfolio-level ESG insights.', pill: 'Planned', color: 'rose' },
            ].map(item => (
              <Card key={item.title} className="!rounded-2xl" hover>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-bold text-gray-900 dark:text-white text-base">{item.title}</h4>
                  <Pill color={item.color}>{item.pill}</Pill>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════  BUILT BY + DISCLAIMERS  ═══════════════ */}
      <section className="py-16 sm:py-20 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800/60">
        <div className="section-container">
          <div className="max-w-3xl mx-auto grid gap-8">
            {/* built by */}
            <Card className="!rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-brand-500 to-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Built as a Student Project</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                    This platform was built by Nikhil Reddy Gogu, with a focus on ESG reporting and sustainable finance. Portfolio: <a className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium underline underline-offset-2 decoration-brand-300 dark:decoration-brand-700" href="https://nikhil.chat">nikhil.chat</a>
                  </p>
                </div>
              </div>
            </Card>

            {/* disclaimers */}
            <Card className="!rounded-2xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Disclaimers</h3>
              <ul className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
                {[
                  'Disclosures are sourced from publicly available company filings and may be subject to updates.',
                  'This platform is for informational purposes only and does not constitute investment advice.',
                  'Self-reported company data may be subject to incomplete disclosure.',
                  'Disclosure Quality scores are deterministic and regex-based — they measure disclosure presence, not disclosure truthfulness.',
                ].map((d, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-gray-300 dark:text-gray-600 mt-0.5">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══════════════  CTA  ═══════════════ */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-emerald-600 to-teal-600">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_var(--tw-gradient-stops))] from-white/15 to-transparent" />
          <div className="absolute inset-0 dot-grid opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight">
            See it in action
          </h2>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Open any disclosure, run Disclosure Quality scoring, and chat with the AI — all evidence-grounded, all transparent.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button to="/reports" variant="secondary" size="xl" className="shadow-xl shadow-black/10">
              Explore Coverage
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
