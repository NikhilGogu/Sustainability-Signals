import { useEffect, useMemo, useState } from 'react';

import { FilterDropdown, ReportIngestPanel, ReportsTable } from '../components/reports';
import { Seo } from '../components/seo';
import { Button, PageHero } from '../components/ui';
import { SUSTAINABILITY_REPORTS } from '../data/reportsData';
import type { SustainabilityReport } from '../types';
import { normalizeForSearch } from '../utils/textNormalize';
import { fetchUploadedReports, type UploadedReport } from '../utils/uploadedReports';

type SortField = 'company' | 'country' | 'sector' | 'industry' | 'year';

type ActiveChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

function uniqSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function Reports() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);

  const [sortBy, setSortBy] = useState<SortField>('company');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [uploadedReports, setUploadedReports] = useState<UploadedReport[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsError, setUploadsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setUploadsLoading(true);
      setUploadsError(null);
      try {
        const reports = await fetchUploadedReports();
        if (!mounted) return;
        setUploadedReports(reports);
      } catch (err) {
        if (!mounted) return;
        setUploadsError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setUploadsLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const allReports = useMemo<SustainabilityReport[]>(() => {
    const byId = new Map<string, SustainabilityReport>();
    for (const r of SUSTAINABILITY_REPORTS) byId.set(r.id, r);
    for (const r of uploadedReports) byId.set(r.id, r);
    return [...byId.values()];
  }, [uploadedReports]);

  const reportCountries = useMemo(() => uniqSorted(allReports.map((r) => r.country)), [allReports]);
  const reportSectors = useMemo(() => uniqSorted(allReports.map((r) => r.sector)), [allReports]);
  const reportIndustries = useMemo(() => uniqSorted(allReports.map((r) => r.industry)), [allReports]);
  const reportYears = useMemo(
    () =>
      [...new Set(allReports.map((r) => r.publishedYear).filter((y) => Number.isFinite(y)))]
        .map((y) => Number(y))
        .sort((a, b) => b - a),
    [allReports]
  );

  const filteredReports = useMemo(() => {
    let result = [...allReports];

    if (searchQuery) {
      const query = normalizeForSearch(searchQuery);
      if (query) {
        result = result.filter((r) => {
          const company = normalizeForSearch(r.company);
          const slug = normalizeForSearch(r.slug);
          return company.includes(query) || slug.includes(query);
        });
      }
    }

    if (selectedCountries.length > 0) {
      result = result.filter((r) => selectedCountries.includes(r.country));
    }

    if (selectedSectors.length > 0) {
      result = result.filter((r) => selectedSectors.includes(r.sector));
    }

    if (selectedIndustries.length > 0) {
      result = result.filter((r) => selectedIndustries.includes(r.industry));
    }

    if (selectedYears.length > 0) {
      result = result.filter((r) => selectedYears.includes(r.publishedYear.toString()));
    }

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
  }, [allReports, searchQuery, selectedCountries, selectedSectors, selectedIndustries, selectedYears, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleIngested = (report: UploadedReport) => {
    setUploadedReports((prev) => {
      const next = prev.filter((r) => r.id !== report.id);
      return [report, ...next];
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCountries([]);
    setSelectedSectors([]);
    setSelectedIndustries([]);
    setSelectedYears([]);
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedCountries.length > 0 ||
    selectedSectors.length > 0 ||
    selectedIndustries.length > 0 ||
    selectedYears.length > 0;

  const activeChips = useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];

    if (searchQuery) {
      chips.push({
        key: 'search',
        label: `Search: ${searchQuery}`,
        onRemove: () => setSearchQuery(''),
      });
    }

    for (const c of selectedCountries) {
      chips.push({
        key: `country:${c}`,
        label: c,
        onRemove: () => setSelectedCountries((prev) => prev.filter((x) => x !== c)),
      });
    }
    for (const s of selectedSectors) {
      chips.push({
        key: `sector:${s}`,
        label: s,
        onRemove: () => setSelectedSectors((prev) => prev.filter((x) => x !== s)),
      });
    }
    for (const i of selectedIndustries) {
      chips.push({
        key: `industry:${i}`,
        label: i,
        onRemove: () => setSelectedIndustries((prev) => prev.filter((x) => x !== i)),
      });
    }
    for (const y of selectedYears) {
      chips.push({
        key: `year:${y}`,
        label: y,
        onRemove: () => setSelectedYears((prev) => prev.filter((x) => x !== y)),
      });
    }

    return chips;
  }, [searchQuery, selectedCountries, selectedSectors, selectedIndustries, selectedYears]);

  return (
    <>
      <Seo
        title="Coverage Universe | Sustainability Signals"
        description="Explore the Sustainability Signals coverage universe and open disclosures to run Disclosure Quality scoring, evidence review, and ESG entity extraction."
        path="/reports"
        image="/og-image.png"
        imageAlt="Sustainability Signals logo on dark background"
        keywords={['sustainability reports database', 'disclosure quality score', 'ESG evidence extraction']}
      />

      <PageHero
        label="Coverage Universe"
        tone="signal"
        title={
          <>
            Company <span className="gradient-text">Coverage</span>
          </>
        }
        description={
          <>
            Explore <span className="font-semibold text-brand-600 dark:text-brand-400">{allReports.length}</span>{' '}
            source disclosures. Open any report to run Disclosure Quality scoring and extract structured ESG entities.
          </>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
          {[
            { k: 'Universe', v: allReports.length },
            { k: 'Countries', v: reportCountries.length },
            { k: 'Sectors', v: reportSectors.length },
            { k: 'Years', v: reportYears.length },
          ].map((m) => (
            <div key={m.k} className="p-4 rounded-2xl bg-white/70 dark:bg-gray-900/55 backdrop-blur-2xl border border-gray-200/60 dark:border-gray-700/50 soft-shadow text-center hover-lift">
              <div className="text-lg font-extrabold text-gray-900 dark:text-white">{m.v}</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mt-1">{m.k}</div>
            </div>
          ))}
        </div>
      </PageHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10 pb-20">
        <div className="glass-panel-strong rounded-2xl shadow-xl overflow-hidden animate-fade-up-delay-3">
          {/* Controls */}
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/30 dark:bg-gray-900/30">
            <div className="flex flex-col gap-5">
              <ReportIngestPanel onIngested={handleIngested} />

              {uploadsLoading && (
                <div className="text-xs text-gray-500 dark:text-gray-400">Loading previously uploaded reports...</div>
              )}
              {uploadsError && (
                <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/50 rounded-lg p-3">
                  Failed to load uploaded reports: {uploadsError}
                </div>
              )}

              <div className="rounded-2xl border border-brand-200/70 dark:border-brand-800/50 bg-gradient-to-r from-white via-brand-50/55 to-emerald-50/50 dark:from-gray-900/85 dark:via-brand-900/18 dark:to-emerald-900/12 p-4 sm:p-5 shadow-sm shadow-brand-500/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <label htmlFor="company-search" className="text-xs font-extrabold uppercase tracking-widest text-brand-700 dark:text-brand-300">
                    Search coverage
                  </label>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Type a company name to narrow the universe instantly.
                  </div>
                </div>

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-brand-500 group-focus-within:text-brand-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    id="company-search"
                    type="text"
                    placeholder="Search companies, e.g. Unilever..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-12 pr-12 py-4 bg-white/95 dark:bg-gray-900 border-0 ring-2 ring-brand-300/65 dark:ring-brand-700/65 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 transition-all shadow-lg shadow-brand-500/10 text-base font-medium"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-4 inline-flex items-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      aria-label="Clear company search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                <span>
                  <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{filteredReports.length}</span>{' '}
                  of <span className="tabular-nums">{allReports.length}</span>
                </span>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Clear all
                  </Button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown
                  label="Country"
                  options={reportCountries}
                  selected={selectedCountries}
                  onChange={setSelectedCountries}
                  searchPlaceholder="Search country..."
                />
                <FilterDropdown
                  label="GICS Sector"
                  options={reportSectors}
                  selected={selectedSectors}
                  onChange={setSelectedSectors}
                  searchPlaceholder="Search GICS sector..."
                />
                <FilterDropdown
                  label="GICS Industry Group"
                  options={reportIndustries}
                  selected={selectedIndustries}
                  onChange={setSelectedIndustries}
                  searchPlaceholder="Search GICS industry group..."
                />
                <FilterDropdown
                  label="Year"
                  options={reportYears.map(String)}
                  selected={selectedYears}
                  onChange={setSelectedYears}
                  searchPlaceholder="Search year..."
                />
              </div>

              {/* Active chips */}
              {activeChips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/70 dark:bg-brand-900/25 dark:text-brand-300 dark:border-brand-800/50 text-xs font-semibold hover:bg-brand-100 dark:hover:bg-brand-900/35 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
                      aria-label={`Remove filter: ${chip.label}`}
                      title="Remove"
                    >
                      <span className="truncate max-w-[34ch]">{chip.label}</span>
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="relative min-h-[420px]">
            <ReportsTable reports={filteredReports} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
          </div>
        </div>
      </div>
    </>
  );
}
