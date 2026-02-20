import { useMemo, useState } from 'react';
import type {
  AdminReport,
  DQEntry,
  DisclosureQualityScore,
  RegexDepthRow,
  ProvenanceRow,
} from './admin-types';
import {
  asObj,
  bandClass,
  buildProvenanceRows,
  buildRegexDepthRows,
  fmtCompact,
  fmtDate,
  hasNumericScore,
  toBool,
  toNum,
} from './admin-utils';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AdminDiagnosticsProps {
  reports: AdminReport[];
  dqById: Record<string, DQEntry>;
  activeReportId: string | null;
  onSelectReport: (id: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REGEX_LIMIT = 80;
const PROVENANCE_LIMIT = 24;

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ScoreCard({ summary }: { summary: DisclosureQualityScore }) {
  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4 min-w-[200px]">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        DQ Score
      </p>
      <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums">
        {summary.score !== null ? Math.round(summary.score) : '-'}
      </p>
      <span
        className={`mt-2 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${bandClass(
          summary.band,
        )}`}
      >
        {summary.band ?? 'unclassified'}
      </span>
      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        Updated: {fmtDate(summary.generatedAt)}
      </p>
    </div>
  );
}

function SubscorePanel({ summary }: { summary: DisclosureQualityScore }) {
  if (!summary.subscores)
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Subscores not available.
      </p>
    );

  const items = [
    {
      label: 'Completeness',
      value: summary.subscores.completeness,
      bar: 'from-emerald-500 to-teal-500',
    },
    {
      label: 'Consistency',
      value: summary.subscores.consistency,
      bar: 'from-sky-500 to-blue-500',
    },
    {
      label: 'Assurance',
      value: summary.subscores.assurance,
      bar: 'from-amber-500 to-orange-500',
    },
    {
      label: 'Transparency',
      value: summary.subscores.transparency,
      bar: 'from-violet-500 to-indigo-500',
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-3">
        Subscores
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
              <span>{item.label}</span>
              <span className="font-semibold tabular-nums">
                {Math.round(item.value)}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${item.bar} rounded-full`}
                style={{
                  width: `${Math.max(0, Math.min(100, Math.round(item.value)))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MethodGrid({ detail }: { detail: DisclosureQualityScore }) {
  const method = useMemo(() => asObj(detail.method), [detail]);

  const cells = [
    { label: 'Method kind', value: typeof method?.kind === 'string' ? method.kind : 'unknown' },
    { label: 'Blocks analyzed', value: fmtCompact(toNum(method?.blocks), 0) },
    { label: 'Pages detected', value: fmtCompact(toNum(method?.pagesDetected), 0) },
    { label: 'Corpus chars', value: fmtCompact(toNum(method?.corpusChars), 0) },
    {
      label: 'Feature coverage',
      value: `${detail.featureCount ?? '-'} / ${detail.featureTotal ?? '-'}`,
    },
    {
      label: 'Evidence refined by AI',
      value: fmtCompact(toNum(method?.evidenceRefinedByAI), 0),
    },
    {
      label: 'Corpus sampled',
      value: toBool(method?.corpusSampled) ? 'yes' : 'no',
    },
    {
      label: 'Text provided',
      value: toBool(method?.textProvided) ? 'yes' : 'no',
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Method &amp; Processing
      </h4>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-gray-600 dark:text-gray-300">
        {cells.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5"
          >
            <p className="text-gray-500 dark:text-gray-400">{c.label}</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuantGrid({ detail }: { detail: DisclosureQualityScore }) {
  const qp = detail.quantitativeProfile;
  if (!qp) return null;

  const cells = [
    { label: 'Numeric density', value: fmtCompact(qp.numericDensity, 2) },
    { label: 'Percentages', value: fmtCompact(qp.percentageCount, 0) },
    { label: 'Table rows', value: fmtCompact(qp.tableRows, 0) },
    { label: 'KPI numbers', value: fmtCompact(qp.kpiNumbers, 0) },
    { label: 'Distinct years', value: fmtCompact(qp.distinctYears, 0) },
    {
      label: 'Evidence families',
      value: String(Object.keys(detail.evidenceQuotes ?? {}).length),
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Quantitative Profile
      </h4>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600 dark:text-gray-300">
        {cells.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5"
          >
            <p className="text-gray-500 dark:text-gray-400">{c.label}</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-white tabular-nums">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {detail.topicProfile && (
        <div className="mt-3 rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-2.5 text-xs text-gray-600 dark:text-gray-300">
          <p className="text-gray-500 dark:text-gray-400">Topic profile model</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white">
            {typeof detail.topicProfile.model === 'string'
              ? detail.topicProfile.model
              : 'n/a'}
          </p>
          <p className="mt-1">
            ESG relevant blocks:{' '}
            <span className="font-semibold tabular-nums">
              {fmtCompact(toNum(detail.topicProfile.esg_relevant_blocks), 0)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

function RegexDepthTable({ rows }: { rows: RegexDepthRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, REGEX_LIMIT);

  if (rows.length === 0)
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        No regex depth data available.
      </p>
    );

  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Regex Depth Overview
      </h4>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="sticky top-0 bg-white dark:bg-gray-900/95 z-10">
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800/70">
              <th className="text-left py-2 pr-2">Feature</th>
              <th className="text-right py-2 px-2">Found</th>
              <th className="text-right py-2 px-2">Occurrences</th>
              <th className="text-right py-2 px-2">Pages</th>
              <th className="text-right py-2 pl-2">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70">
            {visible.map((row) => (
              <tr key={row.key} className="text-gray-700 dark:text-gray-200">
                <td className="py-1.5 pr-2">{row.label}</td>
                <td className="py-1.5 px-2 text-right">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                      row.found
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50'
                        : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700/60'
                    }`}
                  >
                    {row.found ? 'yes' : 'no'}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">{row.occurrences}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{row.pages}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums">{row.quoteCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > REGEX_LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-[11px] text-brand-600 dark:text-brand-400 hover:underline"
        >
          {showAll
            ? 'Show fewer'
            : `Show all ${rows.length} rows (${rows.length - REGEX_LIMIT} more)`}
        </button>
      )}
    </div>
  );
}

function ProvenancePanel({ rows }: { rows: ProvenanceRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, PROVENANCE_LIMIT);

  if (rows.length === 0)
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        No evidence-line provenance available.
      </p>
    );

  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-white dark:bg-gray-900/70 p-4">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Evidence Line Provenance
      </h4>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        Feature-by-feature evidence lines used in scoring.
      </p>

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
        {visible.map((row) => (
          <div
            key={row.key}
            className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-3"
          >
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  {row.label}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  ({row.key})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-md border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-300">
                  found: {row.found ? 'yes' : 'no'}
                </span>
                <span className="rounded-md border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-300 tabular-nums">
                  occ: {row.occurrences}
                </span>
                <span className="rounded-md border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-300 tabular-nums">
                  pg: {row.pages}
                </span>
              </div>
            </div>

            <div className="mt-2 space-y-2">
              {row.quotes.length > 0
                ? row.quotes.map((quote, idx) => (
                    <div
                      key={`${row.key}:q:${idx}`}
                      className="rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-2.5 py-2"
                    >
                      <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-600 dark:text-gray-300">
                          #{idx + 1}
                        </span>
                        <span>page {quote.page ?? '-'}</span>
                        <span>heading {quote.heading ?? '-'}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                        {quote.text}
                      </p>
                    </div>
                  ))
                : row.rawLines.length > 0
                  ? row.rawLines.map((line, idx) => (
                      <div
                        key={`${row.key}:r:${idx}`}
                        className="rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 px-2.5 py-2"
                      >
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          Raw #{idx + 1}
                        </div>
                        <p className="mt-1 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                          {line}
                        </p>
                      </div>
                    ))
                  : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No evidence lines for this feature.
                    </p>
                  )}
            </div>
          </div>
        ))}
      </div>

      {rows.length > PROVENANCE_LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-[11px] text-brand-600 dark:text-brand-400 hover:underline"
        >
          {showAll
            ? 'Show fewer'
            : `Show all ${rows.length} groups (${rows.length - PROVENANCE_LIMIT} more)`}
        </button>
      )}
    </div>
  );
}

function Recommendations({
  recommendations,
}: {
  recommendations: string[];
}) {
  if (recommendations.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-900/20 p-4">
      <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
        Improvement Recommendations
      </h4>
      <ul className="space-y-1.5 text-xs text-amber-900/90 dark:text-amber-200/90 list-disc list-inside">
        {recommendations.map((rec) => (
          <li key={rec}>{rec}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AdminDiagnostics({
  reports,
  dqById,
  activeReportId,
  onSelectReport,
}: AdminDiagnosticsProps) {
  // reports with scored results (for the dropdown)
  const scoredReports = useMemo(
    () =>
      reports.filter((r) => {
        const entry = dqById[r.id];
        return entry && hasNumericScore(entry.summary);
      }),
    [reports, dqById],
  );

  const activeReport = useMemo(
    () => reports.find((r) => r.id === activeReportId) ?? null,
    [reports, activeReportId],
  );

  const activeEntry = activeReportId ? dqById[activeReportId] ?? null : null;
  const activeSummary = activeEntry?.summary ?? null;
  const activeDetail = activeEntry?.detail ?? null;

  const regexRows = useMemo<RegexDepthRow[]>(
    () => (activeDetail ? buildRegexDepthRows(activeDetail) : []),
    [activeDetail],
  );

  const provenanceRows = useMemo<ProvenanceRow[]>(
    () => (activeDetail ? buildProvenanceRows(activeDetail) : []),
    [activeDetail],
  );

  return (
    <div className="space-y-6">
      {/* ---- Report picker ---- */}
      <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/30 p-4">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          Select scored report to inspect
          <select
            value={activeReportId ?? ''}
            onChange={(e) =>
              onSelectReport(e.target.value || null)
            }
            className="mt-1.5 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
          >
            <option value="">— choose a report —</option>
            {scoredReports.map((r) => {
              const entry = dqById[r.id];
              const score =
                entry?.summary?.score !== null &&
                entry?.summary?.score !== undefined
                  ? Math.round(entry.summary.score)
                  : '?';
              return (
                <option key={r.id} value={r.id}>
                  {r.company} ({r.publishedYear}) — Score: {score}
                  {entry?.detail ? ' ★' : ''}
                </option>
              );
            })}
          </select>
        </label>
        {scoredReports.length === 0 && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            No scored reports. Run a DQ batch from the Reports tab first.
          </p>
        )}
        {activeReport && !activeDetail && activeSummary && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Deep detail not yet loaded for this report. Use "Load" on the Reports tab to fetch it.
          </p>
        )}
      </div>

      {/* ---- Active report detail ---- */}
      {activeReport && activeSummary && (
        <div className="space-y-5">
          {/* Score + Subscores */}
          <div className="grid lg:grid-cols-[auto_1fr] gap-4 items-start">
            <ScoreCard summary={activeSummary} />
            <SubscorePanel summary={activeSummary} />
          </div>

          {activeDetail && (
            <>
              {/* Method + Quant */}
              <div className="grid lg:grid-cols-2 gap-4">
                <MethodGrid detail={activeDetail} />
                <QuantGrid detail={activeDetail} />
              </div>

              {/* Regex depth */}
              <RegexDepthTable rows={regexRows} />

              {/* Provenance */}
              <ProvenancePanel rows={provenanceRows} />

              {/* Recommendations */}
              <Recommendations
                recommendations={activeDetail.recommendations ?? []}
              />
            </>
          )}
        </div>
      )}

      {/* ---- Empty state ---- */}
      {!activeReport && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a scored report above to view regex depth, evidence provenance, and recommendations.
          </p>
        </div>
      )}
    </div>
  );
}
