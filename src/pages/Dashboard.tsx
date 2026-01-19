import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardHeader } from '../components/ui/Card';
import { KPICard, MomentumChart, SectorHeatmap, SignalsTable } from '../components/dashboard';
import { fetchSignals, fetchMomentumSeries } from '../providers';
import { MOCK_KPIS, MOCK_SECTOR_SCORES, SECTORS } from '../data/mockData';
import type { Signal, MomentumPoint } from '../types';

export function Dashboard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [momentumData, setMomentumData] = useState<MomentumPoint[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [signalsRes, momentumRes] = await Promise.all([
          fetchSignals({ sortBy: 'date', sortOrder: 'desc' }),
          fetchMomentumSeries('ESG_MOMENTUM_INDEX', 3)
        ]);
        
        if (signalsRes.success) setSignals(signalsRes.data);
        if (momentumRes.success) setMomentumData(momentumRes.data);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // Filter and sort signals
  const filteredSignals = useMemo(() => {
    let result = [...signals];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.ticker.toLowerCase().includes(query) ||
        s.companyName.toLowerCase().includes(query) ||
        s.notes.toLowerCase().includes(query)
      );
    }
    
    // Apply sector filter
    if (selectedSector !== 'All Sectors') {
      result = result.filter(s => s.sector === selectedSector);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const aVal = sortBy === 'date' ? new Date(a.date).getTime() : a.score;
      const bVal = sortBy === 'date' ? new Date(b.date).getTime() : b.score;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return result;
  }, [signals, searchQuery, selectedSector, sortBy, sortOrder]);

  const handleSort = (field: 'date' | 'score') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - SustainabilitySignals</title>
        <meta name="description" content="ESG market dashboard with real-time signals, momentum tracking, and sector analysis." />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            ESG Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track sustainability signals and market momentum
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {MOCK_KPIS.map((kpi) => (
            <KPICard key={kpi.title} data={kpi} />
          ))}
        </div>

        {/* Momentum Chart */}
        <Card className="mb-8">
          <CardHeader 
            title="ESG Momentum Index" 
            subtitle="90-day trend across all sectors"
          />
          {loading ? (
            <div className="h-[350px] flex items-center justify-center text-gray-500">
              Loading chart data...
            </div>
          ) : (
            <MomentumChart data={momentumData} />
          )}
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Sector Heatmap */}
          <Card>
            <CardHeader 
              title="Sector Overview" 
              subtitle="ESG scores and momentum by sector"
            />
            <SectorHeatmap data={MOCK_SECTOR_SCORES} />
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader 
              title="Market Summary" 
              subtitle="Key metrics at a glance"
            />
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">Positive Signals (7d)</span>
                <span className="font-semibold text-success-600 dark:text-success-400">12</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">Negative Signals (7d)</span>
                <span className="font-semibold text-error-600 dark:text-error-400">5</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">Avg. ESG Score</span>
                <span className="font-semibold text-gray-900 dark:text-white">56.2</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">Companies Tracked</span>
                <span className="font-semibold text-gray-900 dark:text-white">2,847</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">Data Mode</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 rounded text-xs font-medium">
                  Demo Data
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Signals Table */}
        <Card>
          <CardHeader 
            title="Latest Signals" 
            subtitle="Recent ESG events and rating changes"
          />
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label htmlFor="search" className="sr-only">Search signals</label>
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
                  id="search"
                  type="text"
                  placeholder="Search by ticker, company, or keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label htmlFor="sector" className="sr-only">Filter by sector</label>
              <select
                id="sector"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full sm:w-48 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {SECTORS.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500">
              Loading signals...
            </div>
          ) : (
            <SignalsTable 
              signals={filteredSignals}
              onSort={handleSort}
              sortBy={sortBy}
              sortOrder={sortOrder}
            />
          )}
        </Card>
      </div>
    </>
  );
}
