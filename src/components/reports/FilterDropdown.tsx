import { useState, useRef, useEffect } from 'react';

interface FilterDropdownProps {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    searchPlaceholder?: string;
}

export function FilterDropdown({
    label,
    options,
    selected,
    onChange,
    searchPlaceholder = 'Search...'
}: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(search.toLowerCase())
    );

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(s => s !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    const clearAll = () => {
        onChange([]);
        setSearch('');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border
          ${selected.length > 0
                        ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/30 dark:border-brand-800 dark:text-brand-400 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800'
                    }
          ${isOpen ? 'ring-2 ring-brand-500/20 border-brand-500/50' : ''}
        `}
            >
                <span>{label}</span>
                {selected.length > 0 && (
                    <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-brand-600 text-white text-[10px] font-bold rounded-full">
                        {selected.length}
                    </span>
                )}
                <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/50 overflow-hidden animate-slide-down origin-top-left">
                    {/* Search */}
                    <div className="p-3 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
                        <div className="relative">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                            />
                            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
                                <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                No matches found
                            </div>
                        ) : (
                            filteredOptions.map(option => (
                                <label
                                    key={option}
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
                                >
                                    <div className={`
                                        flex items-center justify-center w-5 h-5 rounded border transition-all duration-200
                                        ${selected.includes(option)
                                            ? 'bg-brand-600 border-brand-600 text-white'
                                            : 'bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 group-hover:border-brand-400'
                                        }
                                    `}>
                                        <svg className={`w-3.5 h-3.5 transform transition-transform ${selected.includes(option) ? 'scale-100' : 'scale-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(option)}
                                        onChange={() => toggleOption(option)}
                                        className="hidden"
                                    />
                                    <span className={`text-sm transition-colors ${selected.includes(option) ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {option}
                                    </span>
                                </label>
                            ))
                        )}
                    </div>

                    {/* Clear button */}
                    {selected.length > 0 && (
                        <div className="p-2 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/50">
                            <button
                                onClick={clearAll}
                                className="w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Clear selection
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
