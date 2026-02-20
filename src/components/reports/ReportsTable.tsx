import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import { Link } from 'react-router';
import type { SustainabilityReport } from '../../types';

/* ------------------------------------------------------------------ */
/*  Status types (re-exported for convenience)                         */
/* ------------------------------------------------------------------ */

export type DQFilterValue = 'all' | 'scored' | 'unscored';
export type EntityFilterValue = 'all' | 'done' | 'none';
export type ReportDQStatus = 'scored' | 'unscored' | 'unknown';
export type ReportEntityStatus = 'done' | 'none' | 'unknown';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ReportsTableProps {
    reports: SustainabilityReport[];
    sortBy: 'company' | 'country' | 'sector' | 'industry' | 'year';
    sortOrder: 'asc' | 'desc';
    onSort: (field: 'company' | 'country' | 'sector' | 'industry' | 'year') => void;
    dqStatus?: Record<string, ReportDQStatus>;
    entityStatus?: Record<string, ReportEntityStatus>;
    dqFilter?: DQFilterValue;
    entityFilter?: EntityFilterValue;
    onDQFilterChange?: (v: DQFilterValue) => void;
    onEntityFilterChange?: (v: EntityFilterValue) => void;
    statusLoading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Pagination constants                                               */
/* ------------------------------------------------------------------ */

const PAGE_SIZES = [25, 50, 100, 250] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatUploadDate(report: SustainabilityReport): string {
    // Only show a real timestamp for uploaded reports
    if (!report.createdAt) return '';
    const ts = Date.parse(report.createdAt);
    if (!Number.isFinite(ts)) return '';
    return new Date(ts).toLocaleString();
}

function dqPill(status: ReportDQStatus) {
    if (status === 'scored')
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50';
    if (status === 'unscored')
        return 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700/60';
    return 'bg-gray-50 text-gray-400 border-gray-200/60 dark:bg-gray-900/20 dark:text-gray-500 dark:border-gray-700/40';
}

function entityPill(status: ReportEntityStatus) {
    if (status === 'done')
        return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800/50';
    if (status === 'none')
        return 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700/60';
    return 'bg-gray-50 text-gray-400 border-gray-200/60 dark:bg-gray-900/20 dark:text-gray-500 dark:border-gray-700/40';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ReportsTable({
    reports,
    sortBy,
    sortOrder,
    onSort,
    dqStatus,
    entityStatus,
    dqFilter = 'all',
    entityFilter = 'all',
    onDQFilterChange,
    onEntityFilterChange,
    statusLoading = false,
}: ReportsTableProps) {
    /* ---- pagination ---- */
    const [pageSize, setPageSize] = useState<number>(50);
    const [page, setPage] = useState(0);
    const [, startTransition] = useTransition();

    const showDQ = Boolean(statusLoading || (dqStatus && Object.keys(dqStatus).length));
    const showEntity = Boolean(statusLoading || (entityStatus && Object.keys(entityStatus).length));

    /* ---- defer heavy renders ---- */
    const deferredReports = useDeferredValue(reports);
    const isStale = deferredReports !== reports;

    const totalPages = Math.max(1, Math.ceil(deferredReports.length / pageSize));
    const safePage = Math.min(page, totalPages - 1);
    const pageItems = useMemo(
        () => deferredReports.slice(safePage * pageSize, (safePage + 1) * pageSize),
        [deferredReports, safePage, pageSize],
    );

    // Reset page when dataset changes
    useMemo(() => setPage(0), [reports.length]);

    const SortIcon = ({ field }: { field: typeof sortBy }) => (
        <svg
            aria-hidden="true"
            className={`w-4 h-4 ml-1 transition-transform ${sortBy === field ? 'text-brand-600' : 'text-gray-400'} ${sortBy === field && sortOrder === 'desc' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
    );

    const HeaderButton = ({ field, children }: { field: typeof sortBy; children: React.ReactNode }) => (
        <button
            onClick={() => { startTransition(() => onSort(field)); }}
            aria-label={`Sort by ${field}${sortBy === field ? `, currently sorted ${sortOrder === 'asc' ? 'ascending' : 'descending'}` : ''}`}
            className="flex items-center font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xs uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:rounded"
        >
            {children}
            <SortIcon field={field} />
        </button>
    );

    if (reports.length === 0) {
        return (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500" role="status">
                <svg aria-hidden="true" className="w-12 h-12 mx-auto mb-4 text-gray-200 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-base font-semibold text-gray-500 dark:text-gray-400">No matches found</p>
                <p className="text-sm mt-1">Try adjusting your filters or search term</p>
            </div>
        );
    }

    return (
        <div>
            {/* ---- Filter + Pagination header ---- */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800/60">
                <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Showing{' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                            {deferredReports.length === 0 ? 0 : safePage * pageSize + 1}
                        </span>
                        {' – '}
                        <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                            {Math.min((safePage + 1) * pageSize, deferredReports.length)}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                            {deferredReports.length}
                        </span>
                        {isStale && <span className="ml-1.5 text-amber-500 animate-pulse text-[11px]">updating…</span>}
                    </p>

                    {showDQ && onDQFilterChange && (
                        <label className="text-xs text-gray-500 dark:text-gray-400">
                            DQ
                            <select
                                value={dqFilter}
                                onChange={(e) => { setPage(0); onDQFilterChange(e.target.value as DQFilterValue); }}
                                className="ml-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
                            >
                                <option value="all">All</option>
                                <option value="scored">Scored</option>
                                <option value="unscored">Unscored</option>
                            </select>
                        </label>
                    )}

                    {showEntity && onEntityFilterChange && (
                        <label className="text-xs text-gray-500 dark:text-gray-400">
                            Entities
                            <select
                                value={entityFilter}
                                onChange={(e) => { setPage(0); onEntityFilterChange(e.target.value as EntityFilterValue); }}
                                className="ml-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
                            >
                                <option value="all">All</option>
                                <option value="done">Done</option>
                                <option value="none">Missing</option>
                            </select>
                        </label>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">
                        Per page
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                            className="ml-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-200"
                        >
                            {PAGE_SIZES.map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </label>

                    <div className="flex items-center gap-1">
                        <button disabled={safePage === 0} onClick={() => setPage(0)} className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="First page">&#x00AB;</button>
                        <button disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Previous page">&#x2039;</button>
                        <span className="px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 tabular-nums">{safePage + 1} / {totalPages}</span>
                        <button disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Next page">&#x203A;</button>
                        <button disabled={safePage >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Last page">&#x00BB;</button>
                    </div>
                </div>
            </div>

            {/* ---- Table ---- */}
            <div className="overflow-x-auto" role="region" aria-label="Coverage table" tabIndex={0}>
                <table className="w-full text-sm" aria-label="Coverage universe">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800/60">
                            <th scope="col" className="text-left py-3 px-4">
                                <HeaderButton field="company">Company</HeaderButton>
                            </th>
                            <th scope="col" className="text-left py-3 px-4">
                                <HeaderButton field="country">Country</HeaderButton>
                            </th>
                            <th scope="col" className="text-left py-3 px-4 hidden md:table-cell">
                                <HeaderButton field="sector">Sector</HeaderButton>
                            </th>
                            <th scope="col" className="text-left py-3 px-4 hidden lg:table-cell">
                                <HeaderButton field="industry">Industry Group</HeaderButton>
                            </th>
                            <th scope="col" className="text-left py-3 px-4">
                                <HeaderButton field="year">Published</HeaderButton>
                            </th>
                            {showDQ && (
                                <th scope="col" className="text-left py-3 px-4 hidden sm:table-cell">
                                    <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">DQ</span>
                                </th>
                            )}
                            {showEntity && (
                                <th scope="col" className="text-left py-3 px-4 hidden sm:table-cell">
                                    <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Entities</span>
                                </th>
                            )}
                            <th scope="col" className="text-left py-3 px-4 hidden xl:table-cell">
                                <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Uploaded</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                        {pageItems.map((report) => {
                            const uploadDate = formatUploadDate(report);
                            const dq = dqStatus?.[report.id] ?? 'unknown';
                            const ent = entityStatus?.[report.id] ?? 'unknown';
                            return (
                                <tr
                                    key={report.id}
                                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors group"
                                >
                                    <td className="py-3 px-4">
                                        <Link
                                            to={`/reports/${report.slug}`}
                                            className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:rounded"
                                            aria-label={`Open ${report.company} (${report.publishedYear}) disclosure source`}
                                        >
                                            {report.company}
                                        </Link>
                                    </td>
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{report.country}</td>
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden md:table-cell">{report.sector}</td>
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{report.industry}</td>
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{report.publishedYear}</td>
                                    {showDQ && (
                                        <td className="py-3 px-4 hidden sm:table-cell">
                                            {statusLoading && dq === 'unknown' ? (
                                                <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold bg-gray-50 text-gray-400 border-gray-200/60 dark:bg-gray-900/20 dark:text-gray-500 dark:border-gray-700/40">
                                                    <span className="w-3 h-3 border-[1.5px] border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400 rounded-full animate-spin mr-1" />
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${dqPill(dq)}`}>
                                                    {dq === 'scored' ? 'Scored' : dq === 'unscored' ? 'No' : '—'}
                                                </span>
                                            )}
                                        </td>
                                    )}
                                    {showEntity && (
                                        <td className="py-3 px-4 hidden sm:table-cell">
                                            {statusLoading && ent === 'unknown' ? (
                                                <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold bg-gray-50 text-gray-400 border-gray-200/60 dark:bg-gray-900/20 dark:text-gray-500 dark:border-gray-700/40">
                                                    <span className="w-3 h-3 border-[1.5px] border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400 rounded-full animate-spin mr-1" />
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${entityPill(ent)}`}>
                                                    {ent === 'done' ? 'Done' : ent === 'none' ? 'No' : '—'}
                                                </span>
                                            )}
                                        </td>
                                    )}
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                                        {uploadDate ? (
                                            <div className="text-xs">{uploadDate}</div>
                                        ) : (
                                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ---- Pagination footer ---- */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 py-3 border-t border-gray-100 dark:border-gray-800/60">
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
