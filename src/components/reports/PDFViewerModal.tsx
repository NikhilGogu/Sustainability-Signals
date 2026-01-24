import { useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { SustainabilityReport } from '../../types';
import { ChatSidebar, ChatMessage } from './ChatSidebar';


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
    const [useGoogleViewer, setUseGoogleViewer] = useState<boolean>(false);

    // Chat State
    const [chatOpen, setChatOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);



    const startPage = report?.pageStart || 1;
    const endPage = report?.pageEnd || numPages;

    // Ordered list of proxies to try
    // 1. Internal Cloudflare Proxy (Best for Prod - requires /functions)
    // 2. CodeTabs: good for binaries (Fallback/Dev)
    // 3. CORS Proxy IO: reliable fallback
    const getProxiedUrl = (url: string, attempt: number) => {
        switch (attempt) {
            case 0: return `/proxy?url=${encodeURIComponent(url)}`;
            case 1: return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
            case 2: return `https://corsproxy.io/?${encodeURIComponent(url)}`;
            default: return url;
        }
    };

    const currentUrl = report?.reportUrl ? getProxiedUrl(report.reportUrl, retryCount) : null;

    const onDocumentLoadSuccess = useCallback((pdf: pdfjs.PDFDocumentProxy) => {
        setNumPages(pdf.numPages);
        setPdfDocument(pdf);


        setCurrentPage(report?.pageStart || 1);
        setLoading(false);
        setError(null);
    }, [report?.pageStart]);

    const extractTextFromPages = async () => {
        if (!pdfDocument) return '';

        const start = startPage;
        const end = endPage;
        let extractedText = '';

        try {
            // Limit extracted pages to avoid huge payloads (e.g., max 50 pages or just the section)
            // For now, we extract the target section
            for (let i = start; i <= end; i++) {
                const page = await pdfDocument.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item) => 'str' in item ? item.str : '')
                    .join(' ');

                extractedText += `Page ${i}:\n${pageText}\n\n`;

            }
        } catch (err) {
            // console.error('Error extracting text:', err);
        }

        return extractedText;
    };

    const handleSendMessage = async (content: string) => {
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content };
        setMessages(prev => [...prev, userMsg]);
        setIsLoadingChat(true);

        try {
            // Extract text if not already done or if context is dynamic
            const context = await extractTextFromPages();

            // Adjust API URL if needed (e.g., absolute path for dev vs prod handling)
            // On Cloudflare Pages, /chat maps to functions/chat.js
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
                    context
                })
            });

            if (!response.ok) {
                let errorMessage = `API Error (${response.status})`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) errorMessage = errorData.error;
                } catch (e) {
                    // Fallback to text if not JSON
                    const text = await response.text();
                    if (response.status === 404 && text.includes('DOCTYPE')) {
                        errorMessage = 'Backend function not found. Please ensure you are running "npm run dev:functions" and using port 8788.';
                    } else {
                        errorMessage = text || response.statusText;
                    }
                }
                throw new Error(errorMessage);
            }



            const data = await response.json();
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };

            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoadingChat(false);
        }
    };


    const onDocumentLoadError = useCallback(() => {
        if (retryCount < 2) { // Allow trying 0, 1, 2 (3 attempts)
            // console.log(`Proxy attempt ${retryCount + 1} failed, trying next proxy...`);
            setRetryCount(prev => prev + 1);

            setLoading(true);
        } else {
            // console.log('All proxies failed, switching to Google Docs Viewer fallback');
            setUseGoogleViewer(true);
            setLoading(true); // Will be set to false when iframe loads

        }
    }, [retryCount]);

    const goToPage = (page: number) => {
        const validPage = Math.max(startPage, Math.min(page, endPage));
        setCurrentPage(validPage);
    };

    const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 2.5));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.6));

    // Timeout handling to prevent hanging on proxies
    useEffect(() => {
        if (!loading || !currentUrl || useGoogleViewer) return;


        const timer = setTimeout(() => {
            // console.log(`Timeout waiting for ${currentUrl}, triggering error fallback...`);
            onDocumentLoadError();

        }, 10000); // 10 second timeout

        return () => clearTimeout(timer);
    }, [currentUrl, loading, useGoogleViewer, onDocumentLoadError]);

    if (!report || !report.reportUrl) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full h-[100dvh] sm:h-[90vh] max-w-6xl bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl z-20">
                    <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                            {report?.company}
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400">
                                {report?.publishedYear}
                            </span>
                            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                                {report?.sector} • {report?.country}
                            </span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Page info badge - Only if not Google Viewer */}
                        {!useGoogleViewer && (
                            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    Section:
                                </span>
                                <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                                    {startPage}-{endPage}
                                </span>
                            </div>
                        )}

                        {/* Zoom controls - Only for React PDF - Hidden on mobile */}
                        {!useGoogleViewer && (
                            <div className="hidden sm:flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <button
                                    onClick={zoomOut}
                                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-l-lg transition-colors"
                                    title="Zoom out"
                                >
                                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                </button>
                                <span className="px-2 text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[3rem] text-center">
                                    {Math.round(scale * 100)}%
                                </span>
                                <button
                                    onClick={zoomIn}
                                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-r-lg transition-colors"
                                    title="Zoom in"
                                >
                                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />

                        {/* Chat Toggle Button */}
                        <button
                            onClick={() => setChatOpen(!chatOpen)}
                            className={`
                                flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 border
                                ${chatOpen
                                    ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/30 dark:border-brand-800 dark:text-brand-400'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }
                            `}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            <span className="font-medium text-sm">Ask AI</span>
                        </button>

                        <a
                            href={`${report?.reportUrl}#page=${startPage}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden sm:inline-block p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
                            title="Open in new tab"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>

                        <button
                            onClick={onClose}
                            className="p-1.5 sm:p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-900/30 transition-all text-gray-500 dark:text-gray-400"
                            title="Close"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* PDF Content */}
                <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800/50 p-2 sm:p-4 relative custom-scrollbar flex flex-col items-center">
                    {loading && (
                        <div className="flex items-center justify-center absolute inset-0 z-10 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">
                                    {useGoogleViewer ? 'Loading fallback viewer...' : retryCount > 0 ? `Trying proxy ${retryCount + 1}...` : 'Loading PDF...'}
                                </p>
                            </div>
                        </div>
                    )}

                    {useGoogleViewer ? (
                        <iframe
                            src={`https://docs.google.com/gview?url=${encodeURIComponent(report?.reportUrl || '')}&embedded=true`}
                            className="w-full h-full relative z-0 rounded-xl shadow-lg bg-white"
                            onLoad={() => setLoading(false)}
                            title={`${report?.company} Sustainability Report`}
                            allowFullScreen
                        />
                    ) : (
                        !error && currentUrl && (
                            <Document
                                file={currentUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading={null}
                                error={null}
                                className="flex flex-col items-center gap-6 max-w-full"
                            >
                                <Page
                                    pageNumber={currentPage}
                                    scale={scale}
                                    className="shadow-2xl rounded-sm overflow-hidden max-w-full"
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    width={window.innerWidth < 640 ? window.innerWidth - 32 : undefined}
                                />
                            </Document>
                        )
                    )}
                </div>

                {/* Footer - Page Navigation */}
                {!useGoogleViewer && !error && numPages > 0 && (
                    <div className="flex items-center justify-center gap-4 px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md z-20">
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage <= startPage}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600 dark:text-gray-400"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Page</span>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={startPage}
                                    max={endPage}
                                    value={currentPage}
                                    onChange={(e) => goToPage(parseInt(e.target.value) || startPage)}
                                    className="w-16 px-2 py-1 text-center text-sm font-bold bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                of {endPage}
                            </span>
                        </div>

                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage >= endPage}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-600 dark:text-gray-400"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* Chat Sidebar */}
            <ChatSidebar
                isOpen={chatOpen}
                onToggle={() => setChatOpen(!chatOpen)}
                onClose={() => setChatOpen(false)}
                onClearHistory={() => setMessages([])}
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoadingChat}
            />
        </div>
    );
}
