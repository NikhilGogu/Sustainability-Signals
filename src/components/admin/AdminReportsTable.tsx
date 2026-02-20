import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import { Button } from '../ui';
import type {
  AdminReport,
  DQEntry,
  DQFilterValue,
  EntityFilterValue,
  EntityStatus,
  SortState,
  SortField,
} from './admin-types';
import {
  bandClass,
  entityStatusClass,
  entityStatusLabel,
  fmtDate,
  sortReports,
  statusClass,
  statusLabel,
  PAGE_SIZE_OPTIONS,
} from './admin-utils';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AdminReportsTableProps {
  filtered: AdminReport[];
  dqById: Record<string, DQEntry>;
  entityById: Record<string, EntityStatus>;
  selectedSet: Set<string>;
  allFilteredSelected: boolean;
  activeDetailId: string | null;
  detailLoadingId: string | null;
  detailComputingId: string | null;
  busyDeleteId: string | null;
  dqFilter: DQFilterValue;
  entityFilter: EntityFilterValue;
  onDQFilterChange: (v: DQFilterValue) => void;
  onEntityFilterChange: (v: EntityFilterValue) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onLoadDetail: (report: AdminReport) => void;
  onLoadAndInspect: (report: AdminReport) => void;
  onDelete: (report: AdminReport) => void;
  onViewDiagnostics: (report: AdminReport) => void;
}

/* ------------------------------------------------------------------ */
/*  Sort indicator                                                     */
/* ------------------------------------------------------------------ */

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active)
    return (
      <svg className="w-3 h-3 text-gray-400 dark:text-gray-600 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 5l3-3 3 3M3 7l3 3 3-3" />
      </svg>
    );
  return (
    <svg className="w-3 h-3 text-brand-600 dark:text-brand-400 ml-1" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
      {dir === 'asc' ? <path d="M3 8l3-4 3 4" /> : <path d="M3 4l3 4 3-4" />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AdminReportsTable({
  filtered,
  dqById,
  entityById,
  selectedSet,
  allFilteredSelected,
  activeDetailId,
  detailLoadingId,
  detailComputingId,
  busyDeleteId,
  dqFilter,
  entityFilter,
  onDQFilterChange,
  onEntityFilterChange,
  onToggleSelect,
  onToggleSelectAll,
  onLoadDetail,
  onLoadAndInspect,
  onDelete,
  onViewDiagnostics,
}: AdminReportsTableProps) {
  /* ---- pagination ---- */
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(0);
  const [, startTransition] = useTransition();

  /* ---- sorting ---- */
  const [sort, setSort] = useState<SortState>({ field: 'created', dir: 'desc' });

  const sorted = useMemo(
    () => sortReports(filtered, dqById, sort.field, sort.dir, entityById),
    [filtered, dqById, entityById, sort],
  );

  /* Defer heavy render while sorting/filtering */
  const deferredSorted = useDeferredValue(sorted);

  const totalPages = Math.max(1, Math.ceil(deferredSorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const pageItems = useMemo(
    () => deferredSorted.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [deferredSorted, safePage, pageSize],
  );

  const isStale = deferredSorted !== sorted;

  // Reset page when data changes significantly
  useMemo(() => setPage(0), [filtered.length, sort.field, sort.dir]);

  function toggleSort(field: SortField) {
    startTransition(() => {
      setSort((prev) =>
        prev.field === field
          ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
          : { field, dir: field === 'score' ? 'desc' : 'asc' },
      );
    });
  }

  function Th({
    children,
    field,
    className = '',
  }: {
    children: React.ReactNode;
    field: SortField;
    className?: string;
  }) {
    return (
      <th
        className={`text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs cursor-pointer select-none group hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${className}`}
        onClick={() => toggleSort(field)}
      >
        <span className="inline-flex items-center">
          {children}
          <SortIcon active={sort.field === field} dir={sort.dir} />
        </span>
      </th>
    );
  }

  return (
    <div>
      {/* ---- Filters row ---- */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          DQ Status
          <select
            value={dqFilter}
            onChange={(e) => onDQFilterChange(e.target.value as DQFilterValue)}
            className="ml-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
          >
            <option value="all">All</option>
            <option value="scored">Scored</option>
            <option value="unscored">Unscored</option>
          </select>
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Entities
          <select
            value={entityFilter}
            onChange={(e) => onEntityFilterChange(e.target.value as EntityFilterValue)}
            className="ml-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
          >
            <option value="all">All</option>
            <option value="done">Done</option>
            <option value="none">Missing</option>
          </select>
        </label>
      </div>

      {/* ---- Pagination header ---- */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Showing{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            {deferredSorted.length === 0 ? 0 : safePage * pageSize + 1}
          </span>
          {' - '}
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            {Math.min((safePage + 1) * pageSize, deferredSorted.length)}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-200">
            {deferredSorted.length}
          </span>{' '}
          reports
          {isStale && <span className="ml-1.5 text-amber-500 animate-pulse">updating…</span>}
        </p>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Per page
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="ml-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1">
            <button
              disabled={safePage === 0}
              onClick={() => setPage(0)}
              className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="First page"
            >
              &#x00AB;
            </button>
            <button
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              &#x2039;
            </button>
            <span className="px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 tabular-nums">
              {safePage + 1} / {totalPages}
            </span>
            <button
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              &#x203A;
            </button>
            <button
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
              className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Last page"
            >
              &#x00BB;
            </button>
          </div>
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800/60">
              <th className="text-left px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-gray-300 dark:border-gray-700"
                  aria-label="Select filtered reports"
                />
              </th>
              <Th field="company">Company</Th>
              <Th field="year">Year</Th>
              <Th field="source">Source</Th>
              <Th field="status">DQ</Th>
              <Th field="entity">Entities</Th>
              <Th field="score">Score</Th>
              <th className="text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {pageItems.map((report) => {
              const entry = dqById[report.id];
              const summary = entry?.summary ?? null;
              const score =
                summary && typeof summary.score === 'number'
                  ? Math.round(summary.score)
                  : null;
              const subscores = summary?.subscores;
              const active = activeDetailId === report.id;

              return (
                <tr
                  key={report.id}
                  className={`align-top transition-colors cursor-default ${
                    active
                      ? 'bg-sky-50/40 dark:bg-sky-900/10'
                      : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/30'
                  }`}
                  onDoubleClick={() => onLoadAndInspect(report)}
                  title="Double-click to score & inspect"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(report.id)}
                      onChange={() => onToggleSelect(report.id)}
                      className="rounded border-gray-300 dark:border-gray-700"
                      aria-label={`Select ${report.company}`}
                    />
                  </td>

                  {/* Company */}
                  <td className="px-4 py-3 max-w-[260px]">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {report.company}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {report.country} &middot; {report.sector}
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate" title={report.reportKey}>
                      {report.id}
                    </div>
                  </td>

                  {/* Year */}
                  <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    {report.publishedYear}
                    {fmtDate(report.createdAt, report.source) && (
                      <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {fmtDate(report.createdAt, report.source)}
                      </div>
                    )}
                  </td>

                  {/* Source */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${
                        report.source === 'merged'
                          ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800/50'
                          : report.source === 'uploaded'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800/50'
                            : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700/60'
                      }`}
                    >
                      {report.source === 'merged'
                        ? 'Index + Upload'
                        : report.source === 'uploaded'
                          ? 'Upload'
                          : 'Index'}
                    </span>
                  </td>

                  {/* DQ Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${statusClass(
                        entry?.status ?? 'idle',
                      )}`}
                    >
                      {entry?.status === 'running' && (
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 1a5 5 0 014.33 2.5" strokeLinecap="round" />
                        </svg>
                      )}
                      {statusLabel(entry?.status ?? 'idle')}
                    </span>
                    {entry?.error && (
                      <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1 max-w-[200px] truncate" title={entry.error}>
                        {entry.error}
                      </div>
                    )}
                  </td>

                  {/* Entity Status */}
                  <td className="px-4 py-3">
                    {(() => {
                      const es = entityById[report.id] ?? 'unknown';
                      return (
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${entityStatusClass(es)}`}
                        >
                          {entityStatusLabel(es)}
                        </span>
                      );
                    })()}
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3">
                    {score !== null ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">
                            {score}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${bandClass(
                              summary?.band ?? null,
                            )}`}
                          >
                            {summary?.band ?? 'low'}
                          </span>
                        </div>
                        {subscores && (
                          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            C {Math.round(subscores.completeness)} | K{' '}
                            {Math.round(subscores.consistency)} | A{' '}
                            {Math.round(subscores.assurance)} | T{' '}
                            {Math.round(subscores.transparency)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={detailLoadingId === report.id || detailComputingId === report.id}
                        onClick={() => onLoadDetail(report)}
                      >
                        {detailComputingId === report.id
                          ? 'Computing…'
                          : detailLoadingId === report.id
                            ? 'Loading…'
                            : entry?.detail
                              ? 'Refresh'
                              : entry?.summary
                                ? 'Load'
                                : 'Score'}
                      </Button>

                      {(detailComputingId === report.id) && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 animate-pulse">
                          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="6" cy="6" r="4" strokeDasharray="6 18" />
                          </svg>
                          DQ computing…
                        </span>
                      )}

                      {entry?.detail && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDiagnostics(report)}
                        >
                          Inspect
                        </Button>
                      )}

                      {!entry?.detail && !(detailLoadingId === report.id || detailComputingId === report.id) && (
                        <span title="Score DQ (if needed) then open diagnostics">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onLoadAndInspect(report)}
                          >
                            Score &amp; Inspect
                          </Button>
                        </span>
                      )}

                      {report.canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyDeleteId === report.id}
                          onClick={() => onDelete(report)}
                          className="text-rose-700 dark:text-rose-300 border-rose-300/80 dark:border-rose-700/50 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        >
                          {busyDeleteId === report.id ? '...' : 'Del'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {pageItems.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No reports match the current search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---- Pagination footer ---- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-3">
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 7) {
              pageNum = i;
            } else if (safePage < 4) {
              pageNum = i;
            } else if (safePage > totalPages - 4) {
              pageNum = totalPages - 7 + i;
            } else {
              pageNum = safePage - 3 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  pageNum === safePage
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {pageNum + 1}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
