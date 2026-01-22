import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card } from '../components/ui/Card';
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
                <title>Sustainability Reports - SustainabilitySignals</title>
                <meta name="description" content="Download and query CSRD-compliant sustainability reports from companies worldwide." />
            </Helmet>

            {/* Hero Section */}
            <div className="bg-gradient-to-br from-brand-50 via-white to-brand-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                        Sustainability Reports
                    </h1>
                    <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
                        Download, query, and <strong>chat</strong> with <span className="font-semibold text-brand-600 dark:text-brand-400">{SUSTAINABILITY_REPORTS.length}</span> sustainability reports
                    </p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                        This list contains CSRD-compliant reports for fiscal years starting 01/01/2024. Use the AI assistant to instantly extract insights from any report.
                    </p>

                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Card>
                    {/* Filters Row */}
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <FilterDropdown
                            label="Country"
                            options={REPORT_COUNTRIES}
                            selected={selectedCountries}
                            onChange={setSelectedCountries}
                            searchPlaceholder="Search country..."
                        />
                        <FilterDropdown
                            label="Sector"
                            options={REPORT_SECTORS}
                            selected={selectedSectors}
                            onChange={setSelectedSectors}
                            searchPlaceholder="Search sector..."
                        />
                        <FilterDropdown
                            label="Industry"
                            options={REPORT_INDUSTRIES}
                            selected={selectedIndustries}
                            onChange={setSelectedIndustries}
                            searchPlaceholder="Search industry..."
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
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Reset all filters"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <label htmlFor="company-search" className="sr-only">Search by company name</label>
                        <div className="relative">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                id="company-search"
                                type="text"
                                placeholder="Search by company name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Results Count */}
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Showing <span className="font-medium text-gray-900 dark:text-white">{filteredReports.length}</span> of {SUSTAINABILITY_REPORTS.length} reports
                        </p>
                    </div>

                    {/* Reports Table */}
                    <div className="max-h-[600px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                        <ReportsTable
                            reports={filteredReports}
                            sortBy={sortBy}
                            sortOrder={sortOrder}
                            onSort={handleSort}
                        />
                    </div>
                </Card>
            </div>
        </>
    );
}
