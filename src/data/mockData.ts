/**
 * Mock Data for SustainabilitySignals
 * This data is used during development and demo mode
 * Replace with real API calls when integrating Refinitiv
 */

import type { 
  Signal, 
  CompanySnapshot, 
  MomentumPoint, 
  SectorScore, 
  GreenBondSpread,
  KPIData 
} from '../types';

// Mock companies database
export const MOCK_COMPANIES: Record<string, CompanySnapshot> = {
  AAPL: {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    description: 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.',
    marketCap: '$2.89T',
    esgScore: 72,
    environmentScore: 68,
    socialScore: 75,
    governanceScore: 73,
    keyRisks: [
      'Supply chain emissions from manufacturing partners',
      'Recycling infrastructure limitations in emerging markets',
      'Labor practices scrutiny in supplier facilities'
    ],
    keyPositives: [
      'Carbon neutral for corporate operations since 2020',
      'Industry-leading renewable energy adoption (100%)',
      'Strong board diversity and governance practices'
    ],
    lastUpdated: '2026-01-15'
  },
  MSFT: {
    ticker: 'MSFT',
    name: 'Microsoft Corporation',
    sector: 'Technology',
    industry: 'Software',
    description: 'Microsoft Corporation develops, licenses, and supports software, services, devices, and solutions worldwide.',
    marketCap: '$2.95T',
    esgScore: 78,
    environmentScore: 82,
    socialScore: 74,
    governanceScore: 78,
    keyRisks: [
      'Data center energy consumption growth',
      'AI compute carbon footprint expansion',
      'Antitrust regulatory challenges'
    ],
    keyPositives: [
      'Committed to carbon negative by 2030',
      'Leading cloud sustainability innovations',
      'Strong employee satisfaction scores'
    ],
    lastUpdated: '2026-01-14'
  },
  XOM: {
    ticker: 'XOM',
    name: 'Exxon Mobil Corporation',
    sector: 'Energy',
    industry: 'Oil & Gas',
    description: 'Exxon Mobil Corporation explores for and produces crude oil and natural gas worldwide.',
    marketCap: '$456B',
    esgScore: 38,
    environmentScore: 28,
    socialScore: 45,
    governanceScore: 41,
    keyRisks: [
      'Transition risk from fossil fuel dependency',
      'Climate litigation exposure',
      'Stranded asset risk from reserves'
    ],
    keyPositives: [
      'CCS technology investments increasing',
      'Low-carbon business unit established',
      'Improved safety record year-over-year'
    ],
    lastUpdated: '2026-01-12'
  },
  JPM: {
    ticker: 'JPM',
    name: 'JPMorgan Chase & Co.',
    sector: 'Financials',
    industry: 'Banks',
    description: 'JPMorgan Chase & Co. operates as a financial services company worldwide.',
    marketCap: '$580B',
    esgScore: 62,
    environmentScore: 55,
    socialScore: 68,
    governanceScore: 63,
    keyRisks: [
      'Financed emissions from loan portfolio',
      'Greenwashing litigation risk',
      'Regulatory compliance complexity'
    ],
    keyPositives: [
      '$2.5T sustainable financing commitment',
      'Strong DEI initiatives and reporting',
      'Net-zero 2050 pledge for operations'
    ],
    lastUpdated: '2026-01-13'
  },
  TSLA: {
    ticker: 'TSLA',
    name: 'Tesla, Inc.',
    sector: 'Consumer Discretionary',
    industry: 'Automobiles',
    description: 'Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems.',
    marketCap: '$780B',
    esgScore: 58,
    environmentScore: 85,
    socialScore: 42,
    governanceScore: 47,
    keyRisks: [
      'Governance concerns around board independence',
      'Labor relations and unionization disputes',
      'Supply chain cobalt sourcing concerns'
    ],
    keyPositives: [
      'Category leader in EV transition',
      'Massive avoided emissions from products',
      'Energy storage accelerating grid decarbonization'
    ],
    lastUpdated: '2026-01-15'
  },
  NVDA: {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    sector: 'Technology',
    industry: 'Semiconductors',
    description: 'NVIDIA Corporation provides graphics, and compute and networking solutions worldwide.',
    marketCap: '$1.2T',
    esgScore: 68,
    environmentScore: 62,
    socialScore: 72,
    governanceScore: 70,
    keyRisks: [
      'Indirect emissions from AI data centers',
      'Semiconductor manufacturing water usage',
      'Export control regulatory uncertainty'
    ],
    keyPositives: [
      'Energy-efficient chip architectures',
      'Strong R&D investment in sustainable computing',
      'Diverse and inclusive workforce initiatives'
    ],
    lastUpdated: '2026-01-14'
  }
};

// Generate mock momentum series (60-90 data points)
export function generateMomentumSeries(
  months: number = 3,
  baseValue: number = 50,
  volatility: number = 5
): MomentumPoint[] {
  const points: MomentumPoint[] = [];
  const daysPerMonth = 30;
  const totalDays = months * daysPerMonth;
  
  let value = baseValue;
  const startDate = new Date('2025-10-01');
  
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // Random walk with mean reversion
    const change = (Math.random() - 0.5) * volatility;
    const meanReversion = (baseValue - value) * 0.02;
    value = Math.max(0, Math.min(100, value + change + meanReversion));
    
    points.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100,
      label: `ESG Momentum Index`
    });
  }
  
  return points;
}

// Mock signals
export const MOCK_SIGNALS: Signal[] = [
  {
    id: 'sig-001',
    date: '2026-01-18',
    ticker: 'MSFT',
    companyName: 'Microsoft Corporation',
    signal: 'positive',
    signalType: 'momentum',
    score: 78,
    notes: 'ESG rating upgraded by MSCI following carbon reduction milestone.',
    sector: 'Technology'
  },
  {
    id: 'sig-002',
    date: '2026-01-17',
    ticker: 'XOM',
    companyName: 'Exxon Mobil Corporation',
    signal: 'negative',
    signalType: 'controversy',
    score: -45,
    notes: 'New climate litigation filed in California regarding emissions disclosure.',
    sector: 'Energy'
  },
  {
    id: 'sig-003',
    date: '2026-01-16',
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    signal: 'positive',
    signalType: 'disclosure',
    score: 62,
    notes: 'Published enhanced supply chain emissions report with third-party verification.',
    sector: 'Technology'
  },
  {
    id: 'sig-004',
    date: '2026-01-15',
    ticker: 'TSLA',
    companyName: 'Tesla, Inc.',
    signal: 'negative',
    signalType: 'rating_change',
    score: -28,
    notes: 'S&P removed from ESG index citing governance concerns.',
    sector: 'Consumer Discretionary'
  },
  {
    id: 'sig-005',
    date: '2026-01-14',
    ticker: 'JPM',
    companyName: 'JPMorgan Chase & Co.',
    signal: 'positive',
    signalType: 'policy',
    score: 55,
    notes: 'Announced expanded financed emissions reduction targets for 2030.',
    sector: 'Financials'
  },
  {
    id: 'sig-006',
    date: '2026-01-13',
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    signal: 'positive',
    signalType: 'momentum',
    score: 71,
    notes: 'Launched new energy-efficient AI chip architecture with 40% power reduction.',
    sector: 'Technology'
  },
  {
    id: 'sig-007',
    date: '2026-01-12',
    ticker: 'XOM',
    companyName: 'Exxon Mobil Corporation',
    signal: 'neutral',
    signalType: 'disclosure',
    score: 12,
    notes: 'Annual sustainability report released, minimal progress on Scope 3 targets.',
    sector: 'Energy'
  },
  {
    id: 'sig-008',
    date: '2026-01-11',
    ticker: 'MSFT',
    companyName: 'Microsoft Corporation',
    signal: 'positive',
    signalType: 'policy',
    score: 85,
    notes: 'Committed to water-positive status by 2030 across all operations.',
    sector: 'Technology'
  },
  {
    id: 'sig-009',
    date: '2026-01-10',
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    signal: 'neutral',
    signalType: 'rating_change',
    score: 8,
    notes: 'ESG rating affirmed at current level by Sustainalytics.',
    sector: 'Technology'
  },
  {
    id: 'sig-010',
    date: '2026-01-09',
    ticker: 'JPM',
    companyName: 'JPMorgan Chase & Co.',
    signal: 'negative',
    signalType: 'controversy',
    score: -32,
    notes: 'NGO report criticizes fossil fuel financing despite net-zero pledge.',
    sector: 'Financials'
  }
];

// Mock sector scores
export const MOCK_SECTOR_SCORES: SectorScore[] = [
  { sector: 'Technology', esgScore: 72, momentum: 15, riskLevel: 'low', signalCount: 23, topCompany: 'Microsoft' },
  { sector: 'Healthcare', esgScore: 68, momentum: 8, riskLevel: 'low', signalCount: 18, topCompany: 'Johnson & Johnson' },
  { sector: 'Financials', esgScore: 58, momentum: -3, riskLevel: 'medium', signalCount: 31, topCompany: 'Bank of America' },
  { sector: 'Consumer Discretionary', esgScore: 55, momentum: 5, riskLevel: 'medium', signalCount: 15, topCompany: 'Home Depot' },
  { sector: 'Industrials', esgScore: 52, momentum: -8, riskLevel: 'medium', signalCount: 22, topCompany: 'Caterpillar' },
  { sector: 'Materials', esgScore: 48, momentum: 2, riskLevel: 'medium', signalCount: 12, topCompany: 'Linde' },
  { sector: 'Utilities', esgScore: 45, momentum: 12, riskLevel: 'medium', signalCount: 19, topCompany: 'NextEra Energy' },
  { sector: 'Energy', esgScore: 35, momentum: -18, riskLevel: 'high', signalCount: 28, topCompany: 'Exxon Mobil' },
  { sector: 'Real Estate', esgScore: 61, momentum: 6, riskLevel: 'low', signalCount: 9, topCompany: 'Prologis' },
  { sector: 'Consumer Staples', esgScore: 64, momentum: 4, riskLevel: 'low', signalCount: 14, topCompany: 'Procter & Gamble' },
  { sector: 'Communication Services', esgScore: 59, momentum: -2, riskLevel: 'medium', signalCount: 11, topCompany: 'Alphabet' }
];

// Mock KPI data
export const MOCK_KPIS: KPIData[] = [
  {
    title: 'ESG Momentum',
    value: 58.4,
    change: 3.2,
    changeLabel: 'vs last month',
    trend: 'up'
  },
  {
    title: 'Green Bond Spread',
    value: '-12 bps',
    change: -5,
    changeLabel: 'vs benchmark',
    trend: 'up'
  },
  {
    title: 'Controversy Alerts',
    value: 7,
    change: 2,
    changeLabel: 'new this week',
    trend: 'down'
  }
];

// Mock green bond spreads
export function generateGreenBondSpreads(days: number = 90): GreenBondSpread[] {
  const spreads: GreenBondSpread[] = [];
  const startDate = new Date('2025-10-01');
  let spread = -8;
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    spread += (Math.random() - 0.48) * 2;
    spread = Math.max(-25, Math.min(5, spread));
    
    spreads.push({
      date: date.toISOString().split('T')[0],
      spread: Math.round(spread * 10) / 10,
      benchmark: 0
    });
  }
  
  return spreads;
}

// Available sectors for filtering
export const SECTORS = [
  'All Sectors',
  'Technology',
  'Healthcare',
  'Financials',
  'Consumer Discretionary',
  'Industrials',
  'Materials',
  'Utilities',
  'Energy',
  'Real Estate',
  'Consumer Staples',
  'Communication Services'
];

// Available tickers for search
export const AVAILABLE_TICKERS = Object.keys(MOCK_COMPANIES);
