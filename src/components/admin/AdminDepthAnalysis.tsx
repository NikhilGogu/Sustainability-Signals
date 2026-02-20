import { useMemo, useState } from 'react';
import type {
  AdminReport,
  DQEntry,
  ScoredRow,
  SectorBenchmark,
  YearTrend,
  FeatureCoverageRow,
  PerformerRow,
  CountryBucket,
  SubscoreCorrelation,
} from './admin-types';
import {
  stddev,
  hasNumericScore,
  featureLabel,
  bandClass,
  buildSectorBenchmarks,
  buildYearTrends,
  buildFeatureCoverage,
  buildPerformers,
  buildCountryBuckets,
  buildSubscoreCorrelations,
} from './admin-utils';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AdminDepthAnalysisProps {
  runScope: AdminReport[];
  dqById: Record<string, DQEntry>;
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/60 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      {subtitle && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">
          {subtitle}
        </p>
      )}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  1. Sector Benchmarking                                             */
/* ------------------------------------------------------------------ */

function SectorBenchmarking({ data }: { data: SectorBenchmark[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? data : data.slice(0, 12);

  if (data.length === 0)
    return <EmptyState message="No sector data available." />;

  return (
    <div className="space-y-3">
      {visible.map((row) => (
        <div key={row.sector}>
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[200px]">
                {row.sector}
              </span>
              <span className="text-gray-400 dark:text-gray-500 tabular-nums">
                ({row.count})
              </span>
            </div>
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 tabular-nums">
              <span>
                Avg <span className="font-semibold text-gray-800 dark:text-gray-100">{Math.round(row.avg)}</span>
              </span>
              <span>
                Med <span className="font-semibold text-gray-800 dark:text-gray-100">{Math.round(row.median)}</span>
              </span>
              <span>
                Range {Math.round(row.min)}-{Math.round(row.max)}
              </span>
            </div>
          </div>
          <div className="relative h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            {/* Min-max range bar */}
            <div
              className="absolute h-full bg-gray-200 dark:bg-gray-700 rounded-full"
              style={{
                left: `${(row.min / 100) * 100}%`,
                width: `${((row.max - row.min) / 100) * 100}%`,
              }}
            />
            {/* Average bar */}
            <div
              className={`absolute h-full rounded-full bg-gradient-to-r ${
                row.avg >= 70
                  ? 'from-emerald-400 to-emerald-500'
                  : row.avg >= 40
                    ? 'from-amber-400 to-amber-500'
                    : 'from-rose-400 to-rose-500'
              } transition-all duration-500`}
              style={{ width: `${(row.avg / 100) * 100}%` }}
            />
          </div>
          {row.avgSubscores && (
            <div className="flex gap-3 mt-1 text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
              <span>C {Math.round(row.avgSubscores.completeness)}</span>
              <span>K {Math.round(row.avgSubscores.consistency)}</span>
              <span>A {Math.round(row.avgSubscores.assurance)}</span>
              <span>T {Math.round(row.avgSubscores.transparency)}</span>
            </div>
          )}
        </div>
      ))}
      {data.length > 12 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${data.length} sectors`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Year-over-Year Trends                                           */
/* ------------------------------------------------------------------ */

function YearTrends({ data }: { data: YearTrend[] }) {
  if (data.length === 0)
    return <EmptyState message="No year trend data available." />;


  return (
    <div className="space-y-2">
      {/* Mini chart: bars for each year */}
      <div className="flex items-end gap-2 h-32">
        {data.map((row) => {
          const heightPct = (row.avg / 100) * 100;
          return (
            <div
              key={row.year}
              className="flex-1 flex flex-col items-center justify-end gap-1"
              title={`${row.year}: avg ${Math.round(row.avg)}, n=${row.count}`}
            >
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                {Math.round(row.avg)}
              </span>
              <div
                className={`w-full rounded-t transition-all duration-500 ${
                  row.avg >= 70
                    ? 'bg-emerald-400 dark:bg-emerald-500'
                    : row.avg >= 40
                      ? 'bg-amber-400 dark:bg-amber-500'
                      : 'bg-rose-400 dark:bg-rose-500'
                }`}
                style={{ height: `${Math.max(heightPct, 4)}%` }}
              />
              <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
                {row.year}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800/70">
              <th className="text-left py-1.5 pr-2">Year</th>
              <th className="text-right py-1.5 px-2">Count</th>
              <th className="text-right py-1.5 px-2">Avg</th>
              <th className="text-right py-1.5 px-2">Med</th>
              <th className="text-right py-1.5 px-2">High</th>
              <th className="text-right py-1.5 px-2">Medium</th>
              <th className="text-right py-1.5 pl-2">Low</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70">
            {data.map((row) => (
              <tr key={row.year} className="text-gray-700 dark:text-gray-200">
                <td className="py-1.5 pr-2 font-semibold tabular-nums">{row.year}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{row.count}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{Math.round(row.avg)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{Math.round(row.median)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{row.high}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-amber-600 dark:text-amber-400">{row.medium}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{row.low}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Year-over-year delta */}
      {data.length >= 2 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {data.slice(1).map((curr, idx) => {
            const prev = data[idx];
            const delta = curr.avg - prev.avg;
            return (
              <span
                key={curr.year}
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                  delta >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50'
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/50'
                }`}
              >
                {prev.year}&rarr;{curr.year}: {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Feature Coverage Heatmap                                        */
/* ------------------------------------------------------------------ */

function FeatureCoverage({ data }: { data: FeatureCoverageRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 30;
  const visible = showAll ? data : data.slice(0, LIMIT);

  if (data.length === 0)
    return (
      <EmptyState message="No feature coverage data. Load detail for scored reports first." />
    );

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white dark:bg-gray-900/95 z-10">
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800/70">
              <th className="text-left py-2 pr-2">Feature</th>
              <th className="text-right py-2 px-2">Hit Rate</th>
              <th className="text-right py-2 px-2">Hits</th>
              <th className="text-right py-2 px-2">Avg Occ.</th>
              <th className="text-right py-2 pl-2">Avg Pages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70">
            {visible.map((row) => (
              <tr key={row.key} className="text-gray-700 dark:text-gray-200">
                <td className="py-1.5 pr-2 max-w-[200px] truncate" title={row.key}>
                  {row.label}
                </td>
                <td className="py-1.5 px-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          row.hitRate >= 70
                            ? 'bg-emerald-400'
                            : row.hitRate >= 40
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                        }`}
                        style={{ width: `${Math.min(100, row.hitRate)}%` }}
                      />
                    </div>
                    <span className="tabular-nums font-semibold w-10 text-right">
                      {Math.round(row.hitRate)}%
                    </span>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">{row.hitCount}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {row.avgOccurrences.toFixed(1)}
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums">
                  {row.avgPages.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline"
        >
          {showAll
            ? 'Show fewer'
            : `Show all ${data.length} features (${data.length - LIMIT} more)`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. Subscore Correlation Matrix                                     */
/* ------------------------------------------------------------------ */

function SubscoreCorrelations({ data }: { data: SubscoreCorrelation[] }) {
  if (data.length === 0)
    return (
      <EmptyState message="Not enough subscore data for correlations. Need at least 3 scored reports with subscores." />
    );

  function corrColor(r: number): string {
    if (r >= 0.7) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (r >= 0.4) return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300';
    if (r >= 0) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    if (r >= -0.4) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
  }

  function corrStrength(r: number): string {
    const abs = Math.abs(r);
    if (abs >= 0.7) return 'Strong';
    if (abs >= 0.4) return 'Moderate';
    if (abs >= 0.2) return 'Weak';
    return 'Negligible';
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {data.map((item) => (
        <div
          key={item.pair.join('-')}
          className={`rounded-lg p-3 text-center ${corrColor(item.r)}`}
        >
          <p className="text-[11px] font-medium capitalize">
            {featureLabel(item.pair[0])} &times; {featureLabel(item.pair[1])}
          </p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">
            {item.r.toFixed(2)}
          </p>
          <p className="text-[10px] opacity-70">{corrStrength(item.r)}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  5. Top & Bottom Performers                                         */
/* ------------------------------------------------------------------ */

function PerformersTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: PerformerRow[];
  tone: 'top' | 'bottom';
}) {
  if (rows.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
        {title}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800/70">
              <th className="text-left py-1.5 pr-2 w-8">#</th>
              <th className="text-left py-1.5 px-2">Company</th>
              <th className="text-right py-1.5 px-2">Score</th>
              <th className="text-center py-1.5 px-2">Band</th>
              <th className="text-right py-1.5 pl-2">Subscores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70">
            {rows.map((row, idx) => (
              <tr
                key={row.report.id}
                className={`text-gray-700 dark:text-gray-200 ${
                  tone === 'top'
                    ? 'hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10'
                    : 'hover:bg-rose-50/40 dark:hover:bg-rose-900/10'
                }`}
              >
                <td className="py-1.5 pr-2 tabular-nums text-gray-400 dark:text-gray-500">
                  {idx + 1}
                </td>
                <td className="py-1.5 px-2">
                  <div className="font-semibold truncate max-w-[180px]">
                    {row.report.company}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">
                    {row.report.publishedYear} &middot; {row.report.sector}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums font-bold">
                  {Math.round(row.score)}
                </td>
                <td className="py-1.5 px-2 text-center">
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${bandClass(
                      row.band,
                    )}`}
                  >
                    {row.band ?? 'low'}
                  </span>
                </td>
                <td className="py-1.5 pl-2 text-right text-[10px] text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                  {row.subscores
                    ? `C${Math.round(row.subscores.completeness)} K${Math.round(row.subscores.consistency)} A${Math.round(row.subscores.assurance)} T${Math.round(row.subscores.transparency)}`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  6. Country Distribution                                            */
/* ------------------------------------------------------------------ */

function CountryDistribution({ data }: { data: CountryBucket[] }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 15;
  const visible = expanded ? data : data.slice(0, LIMIT);

  if (data.length === 0)
    return <EmptyState message="No country data available." />;

  return (
    <div className="space-y-2">
      {visible.map((row) => (
        <div key={row.country} className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-28 truncate" title={row.country}>
            {row.country}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums w-8 text-right">
            ({row.count})
          </span>
          <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                row.avg >= 70
                  ? 'bg-emerald-400 dark:bg-emerald-500'
                  : row.avg >= 40
                    ? 'bg-amber-400 dark:bg-amber-500'
                    : 'bg-rose-400 dark:bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, row.avg)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 tabular-nums w-8 text-right">
            {Math.round(row.avg)}
          </span>
        </div>
      ))}
      {data.length > LIMIT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${data.length} countries`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  7. Summary Statistics Panel                                        */
/* ------------------------------------------------------------------ */

function SummaryStats({ scoredRows }: { scoredRows: ScoredRow[] }) {
  const scores = scoredRows.map((r) => r.summary.score ?? 0);
  const sd = stddev(scores);

  const withDetail = scoredRows.filter((r) => r.detail !== null);

  const sectors = new Set(scoredRows.map((r) => r.report.sector)).size;
  const countries = new Set(scoredRows.map((r) => r.report.country)).size;
  const years = new Set(scoredRows.map((r) => r.report.publishedYear)).size;

  const cards = [
    { label: 'Reports Scored', value: String(scoredRows.length) },
    { label: 'With Detail', value: String(withDetail.length) },
    { label: 'Std Dev', value: sd !== null ? sd.toFixed(1) : '-' },
    { label: 'Sectors', value: String(sectors) },
    { label: 'Countries', value: String(countries) },
    { label: 'Year Span', value: String(years) },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-3 text-center"
        >
          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {c.label}
          </p>
          <p className="mt-1 text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AdminDepthAnalysis({
  runScope,
  dqById,
}: AdminDepthAnalysisProps) {
  /* ---- Build scored rows ---- */
  const scoredRows = useMemo<ScoredRow[]>(() => {
    return runScope.flatMap((report) => {
      const entry = dqById[report.id];
      const summary = entry?.summary;
      if (!hasNumericScore(summary)) return [];
      return [{ report, summary, detail: entry?.detail ?? null }];
    });
  }, [dqById, runScope]);

  /* ---- Build analysis data ---- */
  const sectorData = useMemo(
    () => buildSectorBenchmarks(scoredRows),
    [scoredRows],
  );

  const yearData = useMemo(
    () => buildYearTrends(scoredRows),
    [scoredRows],
  );

  const featureData = useMemo(
    () => buildFeatureCoverage(scoredRows),
    [scoredRows],
  );

  const performers = useMemo(
    () => buildPerformers(scoredRows, 10),
    [scoredRows],
  );

  const countryData = useMemo(
    () => buildCountryBuckets(scoredRows),
    [scoredRows],
  );

  const correlations = useMemo(
    () => buildSubscoreCorrelations(scoredRows),
    [scoredRows],
  );

  /* ---- No data state ---- */
  if (scoredRows.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No scored reports in scope. Switch to the{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            Reports
          </span>{' '}
          tab and run a DQ batch first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---- Summary stats ---- */}
      <SummaryStats scoredRows={scoredRows} />

      {/* ---- Grid: Sector + Year ---- */}
      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard
          title="Sector Benchmarking"
          subtitle="Average DQ scores per GICS sector with range indicators"
        >
          <SectorBenchmarking data={sectorData} />
        </SectionCard>

        <SectionCard
          title="Year-over-Year Trends"
          subtitle="DQ score evolution across reporting years"
        >
          <YearTrends data={yearData} />
        </SectionCard>
      </div>

      {/* ---- Country Distribution ---- */}
      <SectionCard
        title="Country Distribution"
        subtitle="Average DQ score by country of origin"
      >
        <CountryDistribution data={countryData} />
      </SectionCard>

      {/* ---- Feature Coverage + Correlations ---- */}
      <div className="grid lg:grid-cols-[2fr_1fr] gap-5">
        <SectionCard
          title="Feature Coverage Heatmap"
          subtitle="Detection rates across the scored corpus. Requires detail-loaded reports."
        >
          <FeatureCoverage data={featureData} />
        </SectionCard>

        <SectionCard
          title="Subscore Correlations"
          subtitle="Pearson r between C/K/A/T subscore pairs"
        >
          <SubscoreCorrelations data={correlations} />
        </SectionCard>
      </div>

      {/* ---- Top & Bottom Performers ---- */}
      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Top Performers" subtitle="Highest scoring reports">
          <PerformersTable title="" rows={performers.top} tone="top" />
        </SectionCard>

        <SectionCard title="Bottom Performers" subtitle="Lowest scoring reports">
          <PerformersTable title="" rows={performers.bottom} tone="bottom" />
        </SectionCard>
      </div>
    </div>
  );
}
