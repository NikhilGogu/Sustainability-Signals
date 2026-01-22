import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { SustainabilityReport } from '../../types';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerModalProps {
    report: SustainabilityReport | null;
    onClose: () => void;
}

export function PDFViewerModal({ report, onClose }: PDFViewerModalProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.2);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState<number>(0);

    const startPage = report?.pageStart || 1;
    const endPage = report?.pageEnd || numPages;

    // Ordered list of proxies to try
    // 1. CodeTabs: good for binaries
    // 2. CORS Proxy IO: reliable fallback
    // 3. CORS Anywhere: standard fallback
    const getProxiedUrl = (url: string, attempt: number) => {
        switch (attempt) {
            case 0: return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
            case 1: return `https://corsproxy.io/?${encodeURIComponent(url)}`;
            case 2: return `https://cors-anywhere.herokuapp.com/${url}`;
            default: return url;
        }
    };

    const currentUrl = report?.reportUrl ? getProxiedUrl(report.reportUrl, retryCount) : null;

    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setCurrentPage(report?.pageStart || 1);
        setLoading(false);
        setError(null);
    }, [report?.pageStart]);

    const onDocumentLoadError = useCallback(() => {
        if (retryCount < 2) {
            console.log(`Proxy attempt ${retryCount + 1} failed, trying next proxy...`);
            setRetryCount(prev => prev + 1);
            setLoading(true);
        } else {
            console.error('All proxies failed');
            setLoading(false);
            setError('Unable to load PDF directly. trying to open externally...');
        }
    }, [retryCount]);

    const goToPage = (page: number) => {
        const validPage = Math.max(startPage, Math.min(page, endPage));
        setCurrentPage(validPage);
    };

    const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 2.5));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.6));

    if (!report || !report.reportUrl || !currentUrl) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-[95vw] max-w-6xl h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-50 to-green-50 dark:from-gray-800 dark:to-gray-800">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                            {report.company}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {report.sector} • {report.country} • {report.publishedYear}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-3 ml-4">
                        {/* Page info badge */}
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Sustainability Section:
                            </span>
                            <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                                pg. {startPage} - {endPage}
                            </span>
                        </div>

                        {/* Zoom controls */}
                        <div className="flex items-center bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                            <button
                                onClick={zoomOut}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-l-lg transition-colors"
                                title="Zoom out"
                            >
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </button>
                            <span className="px-2 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[3rem] text-center">
                                {Math.round(scale * 100)}%
                            </span>
                            <button
                                onClick={zoomIn}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-r-lg transition-colors"
                                title="Zoom in"
                            >
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>

                        {/* Open externally */}
                        <a
                            href={`${report.reportUrl}#page=${startPage}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                            title="Open in new tab"
                        >
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            title="Close"
                        >
                            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* PDF Content */}
                <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800 p-4">
                    {loading && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-gray-600 dark:text-gray-400">
                                    {retryCount > 0 ? `Trying proxy ${retryCount + 1}...` : 'Loading PDF...'}
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center max-w-md">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{error}</h3>
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm text-gray-500 text-center mb-2">The proxy server may be blocked or busy.</p>
                                    <a
                                        href={`${report.reportUrl}#page=${startPage}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors justify-center"
                                    >
                                        Open PDF Externally
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {!error && (
                        <Document
                            file={currentUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={null}
                            className="flex flex-col items-center gap-4"
                        >
                            <Page
                                pageNumber={currentPage}
                                scale={scale}
                                className="shadow-xl rounded-lg overflow-hidden"
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                            />
                        </Document>
                    )}
                </div>

                {/* Footer - Page Navigation */}
                {!error && numPages > 0 && (
                    <div className="flex items-center justify-center gap-4 px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage <= startPage}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Page</span>
                            <input
                                type="number"
                                min={startPage}
                                max={endPage}
                                value={currentPage}
                                onChange={(e) => goToPage(parseInt(e.target.value) || startPage)}
                                className="w-16 px-2 py-1 text-center text-sm font-medium bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                            />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                of {endPage} <span className="text-gray-400 dark:text-gray-500">(section: {startPage}-{endPage})</span>
                            </span>
                        </div>

                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage >= endPage}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
