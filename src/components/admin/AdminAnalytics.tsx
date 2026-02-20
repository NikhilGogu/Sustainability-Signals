import { useMemo } from 'react';
import { Button } from '../ui';
import type {
  AdminReport,
  DQEntry,
  DisclosureQualitySubscores,
  ScoredRow,
} from './admin-types';
import {
  avg,
  median,
  pct,
  fmtCompact,
  hasNumericScore,
  exportScoredRowsCSV,
  exportScoredRowsJSON,
} from './admin-utils';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AdminAnalyticsProps {
  runScope: AdminReport[];
  dqById: Record<string, DQEntry>;
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  subtitle,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/60 p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
        {label}
      </p>
      {value !== undefined && (
        <p className="mt-1.5 text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
          {value}
        </p>
      )}
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      )}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini bar                                                           */
/* ------------------------------------------------------------------ */

function SubscoreBar({
  label,
  value,
  gradient,
}: {
  label: string;
  value: number;
  gradient: string;
}) {
  const pctWidth = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 mb-1">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-500`}
          style={{ width: `${pctWidth}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Band distribution bar                                              */
/* ------------------------------------------------------------------ */

function BandBar({
  high,
  medium,
  low,
  total,
}: {
  high: number;
  medium: number;
  low: number;
  total: number;
}) {
  if (total === 0)
    return (
      <div className="h-5 rounded-full bg-gray-100 dark:bg-gray-800" />
    );

  const hPct = (high / total) * 100;
  const mPct = (medium / total) * 100;
  const lPct = (low / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-5 rounded-full overflow-hidden border border-gray-200/70 dark:border-gray-800/70">
        {hPct > 0 && (
          <div
            className="bg-emerald-500 dark:bg-emerald-600 transition-all duration-500"
            style={{ width: `${hPct}%` }}
            title={`High: ${high}`}
          />
        )}
        {mPct > 0 && (
          <div
            className="bg-amber-400 dark:bg-amber-500 transition-all duration-500"
            style={{ width: `${mPct}%` }}
            title={`Medium: ${medium}`}
          />
        )}
        {lPct > 0 && (
          <div
            className="bg-rose-400 dark:bg-rose-500 transition-all duration-500"
            style={{ width: `${lPct}%` }}
            title={`Low: ${low}`}
          />
        )}
      </div>
      <div className="flex justify-between text-[11px] font-medium">
        <span className="text-emerald-700 dark:text-emerald-300">
          High {high} ({Math.round(hPct)}%)
        </span>
        <span className="text-amber-700 dark:text-amber-300">
          Medium {medium} ({Math.round(mPct)}%)
        </span>
        <span className="text-rose-700 dark:text-rose-300">
          Low {low} ({Math.round(lPct)}%)
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Score histogram                                                    */
/* ------------------------------------------------------------------ */

function ScoreHistogram({ values }: { values: number[] }) {
  if (values.length === 0)
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">No scores yet.</p>
    );

  const buckets = Array.from({ length: 10 }, (_, i) => ({
    min: i * 10,
    max: (i + 1) * 10,
    count: 0,
  }));

  for (const v of values) {
    const idx = Math.min(9, Math.max(0, Math.floor(v / 10)));
    buckets[idx].count++;
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-24">
        {buckets.map((b) => {
          const heightPct = (b.count / maxCount) * 100;
          return (
            <div
              key={b.min}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${b.min}-${b.max}: ${b.count}`}
            >
              <div
                className={`w-full rounded-t transition-all duration-500 ${
                  b.min >= 70
                    ? 'bg-emerald-400 dark:bg-emerald-500'
                    : b.min >= 40
                      ? 'bg-amber-400 dark:bg-amber-500'
                      : 'bg-rose-400 dark:bg-rose-500'
                }`}
                style={{ height: `${Math.max(heightPct, b.count > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {buckets.map((b) => (
          <div
            key={b.min}
            className="flex-1 text-center text-[9px] text-gray-400 dark:text-gray-500 tabular-nums"
          >
            {b.min}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Source breakdown                                                    */
/* ------------------------------------------------------------------ */

function SourceBreakdown({ reports }: { reports: AdminReport[] }) {
  const indexCount = reports.filter((r) => r.source === 'index').length;
  const uploadCount = reports.filter((r) => r.source === 'uploaded').length;
  const mergedCount = reports.filter((r) => r.source === 'merged').length;

  return (
    <div className="space-y-2">
      {[
        { label: 'Index', count: indexCount, color: 'bg-slate-400' },
        { label: 'Uploaded', count: uploadCount, color: 'bg-indigo-400' },
        { label: 'Merged', count: mergedCount, color: 'bg-cyan-400' },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
          <span className="text-gray-600 dark:text-gray-300 flex-1">{item.label}</span>
          <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AdminAnalytics({ runScope, dqById }: AdminAnalyticsProps) {
  const scoredRows = useMemo<ScoredRow[]>(() => {
    return runScope.flatMap((report) => {
      const entry = dqById[report.id];
      const summary = entry?.summary;
      if (!hasNumericScore(summary)) return [];
      return [{ report, summary, detail: entry?.detail ?? null }];
    });
  }, [dqById, runScope]);

  const stats = useMemo(() => {
    const coverage = Math.round(pct(scoredRows.length, runScope.length));

    if (scoredRows.length === 0) {
      return {
        coverage,
        avg: null as number | null,
        median: null as number | null,
        high: 0,
        medium: 0,
        low: 0,
        detailLoaded: 0,
        avgSubscores: null as DisclosureQualitySubscores | null,
        scoreValues: [] as number[],
      };
    }

    let high = 0;
    let medium = 0;
    let low = 0;
    const values: number[] = [];
    const subValues: DisclosureQualitySubscores[] = [];

    for (const row of scoredRows) {
      const s = row.summary.score ?? 0;
      values.push(s);
      if (row.summary.band === 'high') high++;
      else if (row.summary.band === 'medium') medium++;
      else low++;
      if (row.summary.subscores) subValues.push(row.summary.subscores);
    }

    const avgSubscores =
      subValues.length > 0
        ? {
            completeness:
              subValues.reduce((sum, i) => sum + i.completeness, 0) / subValues.length,
            consistency:
              subValues.reduce((sum, i) => sum + i.consistency, 0) / subValues.length,
            assurance:
              subValues.reduce((sum, i) => sum + i.assurance, 0) / subValues.length,
            transparency:
              subValues.reduce((sum, i) => sum + i.transparency, 0) / subValues.length,
          }
        : null;

    return {
      coverage,
      avg: avg(values),
      median: median(values),
      high,
      medium,
      low,
      detailLoaded: scoredRows.filter((r) => r.detail !== null).length,
      avgSubscores,
      scoreValues: values,
    };
  }, [runScope.length, scoredRows]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      idle: 0,
      queued: 0,
      running: 0,
      cached: 0,
      computed: 0,
      error: 0,
    };
    for (const report of runScope) {
      const status = dqById[report.id]?.status ?? 'idle';
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [runScope, dqById]);

  return (
    <div className="space-y-6">
      {/* ---- Export bar ---- */}
      {scoredRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Export {scoredRows.length} scored results:
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportScoredRowsCSV(scoredRows)}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportScoredRowsJSON(scoredRows)}
          >
            JSON
          </Button>
        </div>
      )}

      {/* ---- Top-level stat cards ---- */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Coverage"
          value={`${stats.coverage}%`}
          subtitle={`${scoredRows.length} scored of ${runScope.length}`}
        />
        <StatCard
          label="Avg / Median DQ"
          value={`${fmtCompact(stats.avg, 0)} / ${fmtCompact(stats.median, 0)}`}
          subtitle={`Details loaded: ${stats.detailLoaded}`}
        />
        <StatCard label="Source Breakdown">
          <div className="mt-2">
            <SourceBreakdown reports={runScope} />
          </div>
        </StatCard>
        <StatCard label="DQ Status">
          <div className="mt-2 space-y-1.5">
            {Object.entries(statusBreakdown)
              .filter(([, c]) => c > 0)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300 capitalize">
                    {status}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </StatCard>
      </div>

      {/* ---- Band distribution ---- */}
      <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/60 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Band Distribution
        </h3>
        <BandBar
          high={stats.high}
          medium={stats.medium}
          low={stats.low}
          total={scoredRows.length}
        />
      </div>

      {/* ---- Score histogram ---- */}
      <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/60 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Score Distribution
        </h3>
        <ScoreHistogram values={stats.scoreValues} />
      </div>

      {/* ---- Subscores ---- */}
      <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-900/60 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Average Subscores
        </h3>
        {stats.avgSubscores ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <SubscoreBar
              label="Completeness"
              value={stats.avgSubscores.completeness}
              gradient="from-emerald-500 to-teal-500"
            />
            <SubscoreBar
              label="Consistency"
              value={stats.avgSubscores.consistency}
              gradient="from-sky-500 to-blue-500"
            />
            <SubscoreBar
              label="Assurance"
              value={stats.avgSubscores.assurance}
              gradient="from-amber-500 to-orange-500"
            />
            <SubscoreBar
              label="Transparency"
              value={stats.avgSubscores.transparency}
              gradient="from-violet-500 to-indigo-500"
            />
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No subscore data yet. Run a DQ batch first.
          </p>
        )}
      </div>

      {/* ---- No data state ---- */}
      {scoredRows.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No scores yet. Switch to the{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              Reports
            </span>{' '}
            tab and run a DQ batch.
          </p>
        </div>
      )}
    </div>
  );
}
