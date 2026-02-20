import { useMemo, useState } from 'react';
import type { EsgBertReportSummary } from '../../utils/esgBert';

type Pillar = 'E' | 'S' | 'G' | '';

export type ExtractedEntity = {
  extraction_class: string;
  extraction_text: string;
  attributes: Record<string, unknown>;
  pillar: Pillar;
  chunk_index?: number;
  routed_pillar?: Pillar | null;
  routed_category?: string | null;
  route_score?: number;
  page?: number | null;
  heading?: string | null;
};

export type RoutingStats = {
  model?: string;
  total_chunks: number;
  routed_chunks: number;
  skipped_chunks: number;
  by_pillar: { E: number; S: number; G: number };
  by_category?: Record<string, number>;
  efficiency_pct: number;
};

export type EntityExtractionSummary = {
  total_entities: number;
  by_pillar: { E: number; S: number; G: number };
  by_class: Record<string, number>;
  pillar_share: { E: number; S: number; G: number };
};

export type EntityExtractionResponse = {
  ok: boolean;
  reportId: string;
  cached: boolean;
  reportKey?: string;
  method?: { kind?: string; model?: string; textProvided?: boolean };
  summary?: EntityExtractionSummary;
  routing?: RoutingStats;
  entities: ExtractedEntity[] | null;
  meta?: {
    chunks_processed?: number;
    total_chunks?: number;
    total_chars?: number;
    pages_detected?: number;
    routing_efficiency_pct?: number;
    duration_ms?: number;
    ts?: number;
  };
};

const CLASS_LABELS: Record<string, string> = {
  ghg_emissions: 'GHG Emissions',
  climate_target: 'Climate Target',
  energy: 'Energy',
  water: 'Water',
  waste: 'Waste',
  biodiversity: 'Biodiversity',
  social_metric: 'Social Metric',
  governance_policy: 'Governance / Policy',
  financial_esg: 'Financial ESG',
  regulatory: 'Regulatory Framework',
};

const ISSUE_TO_ENTITY_CLASSES: Record<string, string[]> = {
  // Environmental
  GHG_Emissions: ['ghg_emissions'],
  Energy_Management: ['energy'],
  Water_And_Wastewater_Management: ['water'],
  Waste_And_Hazardous_Materials_Management: ['waste'],
  Ecological_Impacts: ['biodiversity'],
  Air_Quality: ['waste'],
  Physical_Impacts_Of_Climate_Change: ['ghg_emissions', 'climate_target', 'biodiversity'],
  Product_Design_And_Lifecycle_Management: ['waste', 'energy'],

  // Governance
  Business_Ethics: ['governance_policy'],
  Data_Security: ['governance_policy'],
  Customer_Privacy: ['governance_policy'],
  Competitive_Behavior: ['governance_policy'],
  Director_Removal: ['governance_policy'],
  Critical_Incident_Risk_Management: ['governance_policy'],
  Systemic_Risk_Management: ['governance_policy'],
  Management_Of_Legal_And_Regulatory_Framework: ['regulatory'],
  Business_Model_Resilience: ['financial_esg', 'governance_policy'],

  // Social
  Supply_Chain_Management: ['social_metric', 'governance_policy'],
  Labor_Practices: ['social_metric'],
  Employee_Health_And_Safety: ['social_metric'],
  Employee_Engagement_Inclusion_And_Diversity: ['social_metric'],
  Human_Rights_And_Community_Relations: ['social_metric'],
  Access_And_Affordability: ['social_metric'],
  Customer_Welfare: ['social_metric'],
  Selling_Practices_And_Product_Labeling: ['social_metric', 'governance_policy'],
  Product_Quality_And_Safety: ['social_metric'],
};

function pillarPill(p: Pillar) {
  if (p === 'E') return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40';
  if (p === 'S') return 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/40';
  if (p === 'G') return 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/40';
  return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:border-gray-800/60';
}

function fmtMs(ms: unknown) {
  const n = typeof ms === 'number' ? ms : Number(ms);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1000) return `${Math.round(n)}ms`;
  const s = n / 1000;
  if (s < 90) return `${Math.round(s * 10) / 10}s`;
  return `${Math.round(s)}s`;
}

function fmtAttr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 120 ? s.slice(0, 120) + '...' : s;
  } catch {
    return String(v);
  }
}

function fmtPct01(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return '0%';
  if (n >= 1) return '100%';
  return `${Math.round(n * 100)}%`;
}

function normalizeESGShare(share: unknown): { E: number; S: number; G: number } | null {
  if (!share || typeof share !== 'object') return null;
  const raw = share as Record<string, unknown>;
  const E = typeof raw.E === 'number' ? raw.E : Number(raw.E);
  const S = typeof raw.S === 'number' ? raw.S : Number(raw.S);
  const G = typeof raw.G === 'number' ? raw.G : Number(raw.G);
  const e = Number.isFinite(E) ? E : 0;
  const s = Number.isFinite(S) ? S : 0;
  const g = Number.isFinite(G) ? G : 0;
  const total = e + s + g;
  if (!Number.isFinite(total) || total <= 0) return null;
  return { E: e / total, S: s / total, G: g / total };
}

function agreementScore(a: unknown, b: unknown): number | null {
  const A = normalizeESGShare(a);
  const B = normalizeESGShare(b);
  if (!A || !B) return null;
  const tvd = 0.5 * (Math.abs(A.E - B.E) + Math.abs(A.S - B.S) + Math.abs(A.G - B.G));
  const agree = 1 - tvd;
  if (!Number.isFinite(agree)) return null;
  return Math.max(0, Math.min(1, agree));
}

function prettyIssue(issue: string): string {
  return String(issue || '').replace(/_/g, ' ');
}

export function EntityExtractionPanel(props: {
  loading: boolean;
  computing: boolean;
  error: string | null;
  data: EntityExtractionResponse | null;
  progress?: { pct: number; msg: string } | null;
  bertLoading?: boolean;
  bertError?: string | null;
  bertSummary?: EsgBertReportSummary | null;
  canCompute: boolean;
  onCompute: () => void;
  onRefresh: () => void;
  onGoToPage: (page: number) => void;
}) {
  const [pillar, setPillar] = useState<'all' | 'E' | 'S' | 'G'>('all');
  const [query, setQuery] = useState('');
  const [klass, setKlass] = useState<string>('all');

  const entities = props.data?.entities ?? null;
  const summary = props.data?.summary ?? null;
  const bert = props.bertSummary ?? null;
  const agree = agreementScore(bert?.pillar_share, summary?.pillar_share);

  const allClasses = useMemo(() => {
    const byClass = summary?.by_class || {};
    const keys = Object.keys(byClass);
    keys.sort((a, b) => (byClass[b] || 0) - (byClass[a] || 0));
    return keys;
  }, [summary]);

  const filtered = useMemo(() => {
    if (!entities || !Array.isArray(entities)) return [];
    const q = query.trim().toLowerCase();
    return entities.filter((e) => {
      if (pillar !== 'all' && e.pillar !== pillar) return false;
      if (klass !== 'all' && e.extraction_class !== klass) return false;
      if (!q) return true;
      const hay = `${e.extraction_class} ${e.extraction_text}`.toLowerCase();
      return hay.includes(q);
    });
  }, [entities, pillar, klass, query]);

  const isEmpty = !props.loading && !props.computing && (!entities || entities.length === 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">LangExtract ESG Entities</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40">
                Beta
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              Hybrid pipeline: FinBERT-ESG-9 routes chunks by category, then LangExtract extracts structured entities (emissions, targets, policies, metrics) with evidence spans.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={props.onRefresh}
              className="px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={props.onCompute}
              disabled={props.computing || !props.canCompute}
              className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={!props.canCompute ? 'Missing report key' : 'Run extraction'}
            >
              {props.computing ? 'Extracting...' : 'Extract Entities'}
            </button>
          </div>
        </div>

        {props.error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">
            {props.error}
          </div>
        )}

        {/* Progress bar */}
        {props.computing && props.progress && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium truncate mr-2">{props.progress.msg}</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold tabular-nums flex-shrink-0">{props.progress.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-700 ease-out"
                style={{ width: `${Math.max(props.progress.pct, 2)}%` }}
              />
            </div>
          </div>
        )}

        {/* Hybrid: ESG-BERT x Entities */}
        {props.bertLoading ? (
          <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-gray-900 dark:border-gray-800 dark:border-t-white rounded-full animate-spin" />
            <div>Loading ESG-BERT signals…</div>
          </div>
        ) : props.bertError ? (
          <div className="mt-4 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-3 text-[11px] text-amber-800 dark:text-amber-300">
            ESG-BERT signals unavailable: {props.bertError}
          </div>
        ) : bert ? (
          <div className="mt-4 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/30 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-extrabold text-gray-900 dark:text-white">Hybrid Signals</div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-800/60">
                    ESG-BERT × LangExtract
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  ESG-BERT provides a report-level E/S/G “prior” (issue classifier). LangExtract provides structured entities (high-precision evidence). Agreement is a simple distribution match.
                </div>
              </div>

              {agree != null ? (
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Agreement</div>
                  <div className={`mt-0.5 text-sm font-extrabold tabular-nums ${agree >= 0.8 ? 'text-emerald-700 dark:text-emerald-300' : agree >= 0.6 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}>
                    {Math.round(agree * 100)}%
                  </div>
                </div>
              ) : (
                <div className="text-right text-[11px] text-gray-500 dark:text-gray-400">
                  Run extraction to compute agreement
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['E', 'S', 'G'] as const).map((p) => (
                <div key={p} className="rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${pillarPill(p)}`}>{p}</span>
                    <span className="text-xs font-extrabold text-gray-900 dark:text-white tabular-nums">{fmtPct01(bert.pillar_share?.[p])}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">ESG-BERT prior</div>
                </div>
              ))}
            </div>

            {bert.top_issues && bert.top_issues.length > 0 ? (
              <details className="mt-3 rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-gray-950/40 p-3" open>
                <summary className="cursor-pointer select-none text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                  Top ESG-BERT issues ({Math.min(bert.top_issues.length, 7)})
                </summary>
                <div className="mt-2 space-y-2">
                  {bert.top_issues.slice(0, 7).map((it) => {
                    const pillar = (it.pillar || '') as Pillar;
                    const mapped = ISSUE_TO_ENTITY_CLASSES[it.issue] || [];
                    const supportCount = mapped.reduce((acc, cls) => acc + (summary?.by_class?.[cls] ?? 0), 0);
                    return (
                      <div key={it.issue} className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${pillarPill(pillar)}`}>{pillar || '-'}</span>
                          <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate" title={it.issue}>
                            {prettyIssue(it.issue)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tabular-nums">{Math.round(it.score * 10) / 10}</div>
                          {summary?.by_class ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${supportCount > 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40' : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:border-gray-800/60'}`}>
                              {supportCount > 0 ? `${supportCount} entities` : 'no entities'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {summary?.by_class ? (
                  <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                    “Entities” counts are based on a rough issue → entity-class mapping (best-effort).
                  </div>
                ) : null}
              </details>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 text-[11px] text-gray-500 dark:text-gray-400">
            ESG-BERT signals are not available for this report yet.
          </div>
        )}

        {/* Summary */}
        {summary && entities && entities.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/30 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Total</div>
              <div className="mt-1 text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">{summary.total_entities ?? entities.length}</div>
            </div>
            <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-900/10 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">E</div>
              <div className="mt-1 text-lg font-extrabold text-emerald-800 dark:text-emerald-200 tabular-nums">{summary.by_pillar?.E ?? 0}</div>
            </div>
            <div className="rounded-xl border border-sky-200/60 dark:border-sky-800/40 bg-sky-50/40 dark:bg-sky-900/10 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">S</div>
              <div className="mt-1 text-lg font-extrabold text-sky-800 dark:text-sky-200 tabular-nums">{summary.by_pillar?.S ?? 0}</div>
            </div>
            <div className="rounded-xl border border-violet-200/60 dark:border-violet-800/40 bg-violet-50/40 dark:bg-violet-900/10 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-300">G</div>
              <div className="mt-1 text-lg font-extrabold text-violet-800 dark:text-violet-200 tabular-nums">{summary.by_pillar?.G ?? 0}</div>
            </div>
          </div>
        ) : null}

        {/* Meta */}
        {props.data?.meta ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            {typeof props.data.meta.chunks_processed === 'number' && <span className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/60">chunks {props.data.meta.chunks_processed}{typeof props.data.meta.total_chunks === 'number' ? `/${props.data.meta.total_chunks}` : ''}</span>}
            {typeof props.data.meta.routing_efficiency_pct === 'number' && props.data.meta.routing_efficiency_pct > 0 && <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 font-semibold">{props.data.meta.routing_efficiency_pct}% skipped by router</span>}
            {typeof props.data.meta.pages_detected === 'number' && <span className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/60">pages {props.data.meta.pages_detected}</span>}
            {fmtMs(props.data.meta.duration_ms) && <span className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/60">time {fmtMs(props.data.meta.duration_ms)}</span>}
            {props.data.method?.kind && <span className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/60">method {props.data.method.kind}</span>}
          </div>
        ) : null}

        {/* Routing Stats */}
        {props.data?.routing && props.data.routing.total_chunks > 0 ? (
          <div className="mt-4 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-extrabold text-gray-900 dark:text-white">FinBERT-9 Routing</div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/40">
                    {props.data.routing.model || 'keyword-proxy'}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {props.data.routing.routed_chunks} of {props.data.routing.total_chunks} chunks classified as ESG-relevant;
                  {' '}{props.data.routing.skipped_chunks} skipped ({props.data.routing.efficiency_pct}% efficiency gain)
                </div>
              </div>
            </div>

            {/* Pillar breakdown */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['E', 'S', 'G'] as const).map((p) => (
                <div key={p} className="rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-2.5 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${pillarPill(p)}`}>{p}</span>
                  <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white tabular-nums">{props.data!.routing!.by_pillar?.[p] ?? 0}</div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">chunks</div>
                </div>
              ))}
            </div>

            {/* Category breakdown */}
            {props.data.routing.by_category && Object.keys(props.data.routing.by_category).length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer select-none text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                  Category breakdown ({Object.keys(props.data.routing.by_category).length} categories)
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(props.data.routing.by_category)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([cat, count]) => (
                      <span key={cat} className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/60 text-[11px] text-gray-700 dark:text-gray-200">
                        <span className="font-semibold">{cat}</span>
                        <span className="text-gray-400 dark:text-gray-500 ml-1">{count as number}</span>
                      </span>
                    ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {(['all', 'E', 'S', 'G'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPillar(p)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${pillar === p
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                  {p === 'all' ? 'All' : p}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={klass}
                onChange={(e) => setKlass(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                <option value="all">All classes</option>
                {allClasses.map((k) => (
                  <option key={k} value={k}>
                    {CLASS_LABELS[k] || k} ({summary?.by_class?.[k] ?? 0})
                  </option>
                ))}
              </select>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entities..."
                className="w-full sm:w-56 px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Showing <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{filtered.length}</span> of{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{entities?.length ?? 0}</span>
          </div>
        </div>
      </div>

      {/* List */}
      {props.loading && !props.data ? (
        <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 dark:border-gray-800 dark:border-t-white rounded-full animate-spin" />
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Loading entities...</div>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-6">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">Not extracted yet</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            Run extraction to generate structured ESG entities for this report. Results are cached for faster reloads.
          </div>
          {!props.canCompute && (
            <div className="mt-3 text-xs text-red-600 dark:text-red-400">Missing report key. Please reopen the report.</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e, idx) => {
            const attrs = e.attributes && typeof e.attributes === 'object' ? e.attributes : {};
            const attrEntries = Object.entries(attrs).filter(([, v]) => v != null && fmtAttr(v).trim());
            const classLabel = CLASS_LABELS[e.extraction_class] || e.extraction_class;
            return (
              <details
                key={`${e.extraction_class}:${e.extraction_text.slice(0, 80)}:${idx}`}
                className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-4"
                open={idx < 2}
              >
                <summary className="cursor-pointer select-none list-none">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${pillarPill(e.pillar)}`}>
                          {e.pillar || '-'}
                        </span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{classLabel}</span>
                        {typeof e.page === 'number' && e.page > 0 ? (
                          <button
                            onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); props.onGoToPage(e.page!); }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 cursor-pointer transition-colors"
                            title={`Navigate to page ${e.page}`}
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            p.{e.page}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                        {e.extraction_text}
                      </div>
                      {e.heading ? (
                        <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-500 truncate">
                          {e.heading}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums flex flex-col items-end gap-0.5">
                      {typeof e.chunk_index === 'number' ? <span>chunk {e.chunk_index + 1}</span> : null}
                      {e.routed_category && e.routed_category !== 'Non-ESG' ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-50 dark:bg-violet-900/20 border border-violet-200/60 dark:border-violet-800/40 text-violet-700 dark:text-violet-300">
                          {e.routed_category}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </summary>

                {attrEntries.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
                      Attributes
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attrEntries.slice(0, 18).map(([k, v]) => (
                        <span
                          key={k}
                          className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/60 text-[11px] text-gray-700 dark:text-gray-200"
                        >
                          <span className="font-semibold">{k}</span>
                          <span className="text-gray-400 dark:text-gray-500">:</span> {fmtAttr(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60 text-[11px] text-gray-500 dark:text-gray-400">
                    No attributes provided.
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
