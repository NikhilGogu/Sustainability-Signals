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
        if (messages.length > 0 || isLoading) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [messages, isLoading, isOpen]);

    // Focus input when opened (delayed to wait for animation)
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 350);
            return () => clearTimeout(timer);
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
                    className="absolute bottom-6 right-6 z-50 p-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 flex items-center gap-2 group ring-4 ring-white/10 dark:ring-black/10"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap font-medium">
                        Ask AI
                    </span>
                </button>
            )}

            {/* Sidebar Panel */}
            <div
                className={`absolute top-0 right-0 h-full bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 w-full sm:w-[400px] shadow-2xl transform transition-transform duration-300 ease-spring z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-brand-500 to-teal-500 rounded-xl shadow-lg shadow-brand-500/20 text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">AI Assistant</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Powered by Gemini Pro</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClearHistory}
                            className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Clear Chat"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                        <button
                            onClick={onToggle}
                            className="p-2 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>


                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl flex items-center justify-center shadow-inner">
                                <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">How can I help you?</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[240px] mx-auto leading-relaxed">
                                    Ask me about key metrics, risks, or specific details within this report.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                                <button onClick={() => onSendMessage("What are the key sustainability goals?")} className="text-sm py-3 px-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md rounded-xl text-gray-600 dark:text-gray-300 transition-all font-medium text-left">
                                    🎯 Key sustainability goals
                                </button>
                                <button onClick={() => onSendMessage("Summarize the environmental risks")} className="text-sm py-3 px-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md rounded-xl text-gray-600 dark:text-gray-300 transition-all font-medium text-left">
                                    🌍 Environmental risks
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
                                    className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-br-none shadow-brand-500/20'
                                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-none'
                                        }`}
                                >
                                    <div className="text-sm leading-relaxed prose dark:prose-invert max-w-none break-words">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex items-center gap-1.5">
                                <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
                    <form onSubmit={handleSubmit} className="relative group">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask a question..."
                            className="w-full pl-4 pr-12 py-3.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none text-sm text-gray-900 dark:text-white placeholder-gray-400 shadow-sm transition-all"
                            rows={1}
                            style={{ minHeight: '52px' }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2.5 bottom-2.5 p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-brand-500/20"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                    <p className="text-center text-[10px] text-gray-400 mt-3 font-medium">
                        AI can make mistakes. Please check original documents.
                    </p>
                </div>
            </div>
        </>
    );
}
