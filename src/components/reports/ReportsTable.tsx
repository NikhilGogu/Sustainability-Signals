import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { SustainabilityReport } from '../../types';
import { PDFViewerModal } from './PDFViewerModal';

interface ReportsTableProps {
    reports: SustainabilityReport[];
    sortBy: 'company' | 'country' | 'sector' | 'industry' | 'year';
    sortOrder: 'asc' | 'desc';
    onSort: (field: 'company' | 'country' | 'sector' | 'industry' | 'year') => void;
}

export function ReportsTable({ reports, sortBy, sortOrder, onSort }: ReportsTableProps) {
    const [selectedReport, setSelectedReport] = useState<SustainabilityReport | null>(null);

    const SortIcon = ({ field }: { field: typeof sortBy }) => (
        <svg
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
            className="flex items-center font-semibold text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
            {children}
            <SortIcon field={field} />
        </button>
    );

    if (reports.length === 0) {
        return (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg font-medium">No reports found</p>
                <p className="text-sm mt-1">Try adjusting your filters or search term</p>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4">
                                <HeaderButton field="company">Company</HeaderButton>
                            </th>
                            <th className="text-left py-3 px-4">
                                <HeaderButton field="country">Country</HeaderButton>
                            </th>
                            <th className="text-left py-3 px-4 hidden md:table-cell">
                                <HeaderButton field="sector">Sector</HeaderButton>
                            </th>
                            <th className="text-left py-3 px-4 hidden lg:table-cell">
                                <HeaderButton field="industry">Industry</HeaderButton>
                            </th>
                            <th className="text-left py-3 px-4 hidden sm:table-cell">Pages</th>
                            <th className="text-left py-3 px-4">Report</th>
                            <th className="text-left py-3 px-4">
                                <HeaderButton field="year">Published</HeaderButton>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {reports.map((report) => (
                            <tr
                                key={report.id}
                                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                            >
                                <td className="py-3 px-4">
                                    {report.reportUrl ? (
                                        <button
                                            onClick={() => setSelectedReport(report)}
                                            className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline text-left transition-colors"
                                        >
                                            {report.company}
                                        </button>
                                    ) : (
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {report.company}
                                        </span>
                                    )}
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
                                <td className="py-3 px-4 hidden sm:table-cell">
                                    {report.pageStart && report.pageEnd && report.reportUrl ? (
                                        <button
                                            onClick={() => setSelectedReport(report)}
                                            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:underline"
                                        >
                                            {report.pageStart} - {report.pageEnd}
                                        </button>
                                    ) : (
                                        <span className="text-gray-400">—</span>
                                    )}
                                </td>
                                <td className="py-3 px-4">
                                    {report.reportUrl ? (
                                        <button
                                            onClick={() => setSelectedReport(report)}
                                            className="inline-flex items-center gap-2 group"
                                        >
                                            <span className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium hover:underline inline-flex items-center gap-1">
                                                View
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            </span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gradient-to-r from-brand-100 to-indigo-100 text-brand-800 dark:from-brand-900 dark:to-indigo-900 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                                                <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                AI Chat
                                            </span>
                                        </button>

                                    ) : (
                                        <span className="text-gray-400 text-sm">N/A</span>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                    {report.publishedYear}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* PDF Viewer Modal */}
            {selectedReport && createPortal(
                <PDFViewerModal
                    report={selectedReport}
                    onClose={() => setSelectedReport(null)}
                />,
                document.body
            )}
        </>
    );
}
