import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';


export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
}

interface ChatSidebarProps {
    onSendMessage: (message: string) => Promise<void>;
    messages: ChatMessage[];
    isLoading: boolean;
    isOpen: boolean;
    onClose: () => void;
    onClearHistory: () => void;
    onToggle: () => void;
}


export function ChatSidebar({ onSendMessage, messages, isLoading, isOpen, onToggle, onClearHistory }: ChatSidebarProps) {

    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading, isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        }
    }, [isOpen]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const message = input.trim();
        setInput('');
        await onSendMessage(message);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <>
            {/* Toggle Button (Floating) - Only visible when closed */}
            {!isOpen && (
                <button
                    onClick={onToggle}
                    className="absolute bottom-6 right-6 z-50 p-4 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2 group"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap">
                        Ask AI
                    </span>
                </button>
            )}

            {/* Sidebar Panel */}
            <div
                className={`absolute top-0 right-0 h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-l border-gray-200 dark:border-gray-700 w-full sm:w-[400px] shadow-2xl transform transition-transform duration-300 ease-spring z-40 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                            <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Report Assistant</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Gemini AI</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClearHistory}
                            className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Clear Chat"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                        <button
                            onClick={onToggle}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>


                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-60">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Ask questions about this report</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Try asking about key metrics, risks, or future targets.
                            </p>
                            <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
                                <button onClick={() => onSendMessage("Summarize the key sustainability goals")} className="text-xs py-2 px-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors">
                                    "Summarize the key sustainability goals"
                                </button>
                                <button onClick={() => onSendMessage("What are the main risks mentioned?")} className="text-xs py-2 px-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors">
                                    "What are the main risks mentioned?"
                                </button>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'user'
                                        ? 'bg-brand-600 text-white rounded-br-none'
                                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-none'
                                        }`}
                                >
                                    <div className="text-sm leading-relaxed prose dark:prose-invert max-w-none">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                </div>

                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1">
                                <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                    <form onSubmit={handleSubmit} className="relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask a question..."
                            className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-800 border-0 rounded-xl focus:ring-2 focus:ring-brand-500/50 resize-none text-sm text-gray-900 dark:text-white placeholder-gray-500 max-h-32 min-h-[48px]"
                            rows={1}
                            style={{ minHeight: '48px' }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 bottom-2 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                    <p className="text-center text-[10px] text-gray-400 mt-2">
                        AI can make mistakes. Please check the original document.
                    </p>
                </div>
            </div>
        </>
    );
}
