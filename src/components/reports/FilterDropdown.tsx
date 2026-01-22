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
          flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all
          ${selected.length > 0
                        ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/20 dark:border-brand-700 dark:text-brand-400'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                    }
        `}
            >
                <span>{label}</span>
                {selected.length > 0 && (
                    <span className="flex items-center justify-center w-5 h-5 bg-brand-600 text-white text-xs rounded-full">
                        {selected.length}
                    </span>
                )}
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                    {/* Search */}
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                    </div>

                    {/* Options */}
                    <div className="max-h-60 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                No options found
                            </div>
                        ) : (
                            filteredOptions.map(option => (
                                <label
                                    key={option}
                                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(option)}
                                        onChange={() => toggleOption(option)}
                                        className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
                                </label>
                            ))
                        )}
                    </div>

                    {/* Clear button */}
                    {selected.length > 0 && (
                        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={clearAll}
                                className="w-full px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                Clear selection
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
