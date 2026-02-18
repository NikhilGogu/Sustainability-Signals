import { Link } from 'react-router';
import type { SustainabilityReport } from '../../types';

interface ReportsTableProps {
    reports: SustainabilityReport[];
    sortBy: 'company' | 'country' | 'sector' | 'industry' | 'year';
    sortOrder: 'asc' | 'desc';
    onSort: (field: 'company' | 'country' | 'sector' | 'industry' | 'year') => void;
}

export function ReportsTable({
    reports,
    sortBy,
    sortOrder,
    onSort,
}: ReportsTableProps) {
    const formatDateTime = (report: SustainabilityReport): { value: string; note: string } => {
        if (report.createdAt) {
            const ts = Date.parse(report.createdAt);
            if (Number.isFinite(ts)) {
                return {
                    value: new Date(ts).toLocaleString(),
                    note: 'Uploaded',
                };
            }
        }

        const year = Number.isFinite(report.publishedYear) ? report.publishedYear : 0;
        if (year >= 1900) {
            const fallback = new Date(year, 0, 1, 0, 0, 0, 0);
            return {
                value: fallback.toLocaleString(),
                note: 'Published year fallback',
            };
        }

        return { value: '-', note: 'Unknown' };
    };

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
            onClick={() => onSort(field)}
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
        <>
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
                            <th scope="col" className="text-left py-3 px-4 hidden xl:table-cell">
                                <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                                    Date &amp; Time
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                        {reports.map((report) => {
                            const dateTime = formatDateTime(report);
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
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                        {report.country}
                                    </td>
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden md:table-cell">
                                        {report.sector}
                                    </td>
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                                        {report.industry}
                                    </td>
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                        {report.publishedYear}
                                    </td>
                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 hidden xl:table-cell">
                                        <div className="text-xs">{dateTime.value}</div>
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                            {dateTime.note}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

        </>
    );
}
