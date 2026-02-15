import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';

import { FilterDropdown, ReportsTable } from '../components/reports';
import {
    SUSTAINABILITY_REPORTS,
    REPORT_COUNTRIES,
    REPORT_SECTORS,
    REPORT_INDUSTRIES,
    REPORT_YEARS
} from '../data/reportsData';

type SortField = 'company' | 'country' | 'sector' | 'industry' | 'year';

export function Reports() {
    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
    const [selectedYears, setSelectedYears] = useState<string[]>([]);

    // Sort state
    const [sortBy, setSortBy] = useState<SortField>('company');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Filter and sort reports
    const filteredReports = useMemo(() => {
        let result = [...SUSTAINABILITY_REPORTS];

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.company.toLowerCase().includes(query)
            );
        }

        // Apply country filter
        if (selectedCountries.length > 0) {
            result = result.filter(r => selectedCountries.includes(r.country));
        }

        // Apply sector filter
        if (selectedSectors.length > 0) {
            result = result.filter(r => selectedSectors.includes(r.sector));
        }

        // Apply industry filter
        if (selectedIndustries.length > 0) {
            result = result.filter(r => selectedIndustries.includes(r.industry));
        }

        // Apply year filter
        if (selectedYears.length > 0) {
            result = result.filter(r => selectedYears.includes(r.publishedYear.toString()));
        }

        // Apply sorting
        result.sort((a, b) => {
            let aVal: string | number;
            let bVal: string | number;

            switch (sortBy) {
                case 'company':
                    aVal = a.company.toLowerCase();
                    bVal = b.company.toLowerCase();
                    break;
                case 'country':
                    aVal = a.country.toLowerCase();
                    bVal = b.country.toLowerCase();
                    break;
                case 'sector':
                    aVal = a.sector.toLowerCase();
                    bVal = b.sector.toLowerCase();
                    break;
                case 'industry':
                    aVal = a.industry.toLowerCase();
                    bVal = b.industry.toLowerCase();
                    break;
                case 'year':
                    aVal = a.publishedYear;
                    bVal = b.publishedYear;
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [searchQuery, selectedCountries, selectedSectors, selectedIndustries, selectedYears, sortBy, sortOrder]);

    const handleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const resetFilters = () => {
        setSearchQuery('');
        setSelectedCountries([]);
        setSelectedSectors([]);
        setSelectedIndustries([]);
        setSelectedYears([]);
    };

    const hasActiveFilters = searchQuery || selectedCountries.length > 0 || selectedSectors.length > 0 || selectedIndustries.length > 0 || selectedYears.length > 0;

    return (
        <>
            <Helmet>
                <title>Coverage - SustainabilitySignals</title>
                <meta name="description" content="Explore the coverage universe and open any disclosure to run Disclosure Quality scoring and extract structured ESG entities." />
            </Helmet>

            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800/60">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-gray-50 to-gray-50 dark:from-brand-900/10 dark:via-gray-950 dark:to-gray-950" />
                <div className="absolute inset-0 dot-grid opacity-40" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 relative">
                    <div className="max-w-3xl">
                        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 tracking-widest uppercase mb-3 animate-fade-up">Coverage Universe</p>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4 animate-fade-up-delay-1">
                            Company <span className="gradient-text">Coverage</span>
                        </h1>
                        <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 leading-relaxed animate-fade-up-delay-2">
                            Explore <span className="font-semibold text-brand-600 dark:text-brand-400">{SUSTAINABILITY_REPORTS.length}</span> source disclosures. Open any report to run Disclosure Quality scoring and extract structured ESG entities (FinBERT-9 + LangExtract).
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10 pb-20">
                <div className="glass-panel-strong rounded-2xl shadow-xl overflow-hidden animate-fade-up-delay-3">
                    {/* Controls Header */}
                    <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/30 dark:bg-gray-900/30">
                        <div className="flex flex-col gap-5">
                            {/* Search Bar */}
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400 group-focus-within:text-brand-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    id="company-search"
                                    type="text"
                                    placeholder="Search companies..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-900 border-0 ring-1 ring-gray-200 dark:ring-gray-700/60 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 transition-all shadow-sm text-sm"
                                />
                            </div>

                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    <FilterDropdown
                                        label="Country"
                                        options={REPORT_COUNTRIES}
                                        selected={selectedCountries}
                                        onChange={setSelectedCountries}
                                        searchPlaceholder="Search country..."
                                    />
                                    <FilterDropdown
                                        label="GICS Sector"
                                        options={REPORT_SECTORS}
                                        selected={selectedSectors}
                                        onChange={setSelectedSectors}
                                        searchPlaceholder="Search GICS sector..."
                                    />
                                    <FilterDropdown
                                        label="GICS Industry Group"
                                        options={REPORT_INDUSTRIES}
                                        selected={selectedIndustries}
                                        onChange={setSelectedIndustries}
                                        searchPlaceholder="Search GICS industry group..."
                                    />
                                    <FilterDropdown
                                        label="Year"
                                        options={REPORT_YEARS.map(String)}
                                        selected={selectedYears}
                                        onChange={setSelectedYears}
                                        searchPlaceholder="Search year..."
                                    />

                                    {hasActiveFilters && (
                                        <button
                                            onClick={resetFilters}
                                            className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-lg transition-colors flex items-center gap-1.5"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            Clear Filters
                                        </button>
                                    )}

                                </div>

                                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    <span className="font-medium text-gray-900 dark:text-white">{filteredReports.length}</span>
                                    <span>companies found</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="relative min-h-[400px]">
                        <div className="overflow-x-auto">
                            <ReportsTable
                                reports={filteredReports}
                                sortBy={sortBy}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
