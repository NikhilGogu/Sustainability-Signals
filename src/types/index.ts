/**
 * Core type definitions for SustainabilitySignals
 * These interfaces define the shape of data returned by providers
 */

// Signal represents a market or ESG signal event
export interface Signal {
  id: string;
  date: string; // ISO date string
  ticker: string;
  companyName: string;
  signal: 'positive' | 'negative' | 'neutral';
  signalType: 'momentum' | 'controversy' | 'rating_change' | 'policy' | 'disclosure';
  score: number; // -100 to +100
  notes: string;
  sector: string;
}

// Company snapshot for individual company pages
export interface CompanySnapshot {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  description: string;
  marketCap: string;
  esgScore: number; // 0-100
  environmentScore: number;
  socialScore: number;
  governanceScore: number;
  keyRisks: string[];
  keyPositives: string[];
  lastUpdated: string;
}

// Single data point for momentum/time series charts
export interface MomentumPoint {
  date: string; // ISO date string
  value: number;
  ticker?: string;
  label?: string;
}

// Sector score for heatmap display
export interface SectorScore {
  sector: string;
  esgScore: number;
  momentum: number; // -100 to +100
  riskLevel: 'low' | 'medium' | 'high';
  signalCount: number;
  topCompany: string;
}

// KPI card data structure
export interface KPIData {
  title: string;
  value: string | number;
  change: number; // percentage change
  changeLabel: string;
  trend: 'up' | 'down' | 'neutral';
}

// Green bond spread data
export interface GreenBondSpread {
  date: string;
  spread: number; // basis points
  benchmark: number;
}

// Filter options for signal queries
export interface SignalFilters {
  sector?: string;
  ticker?: string;
  signalType?: Signal['signalType'];
  dateFrom?: string;
  dateTo?: string;
  minScore?: number;
  maxScore?: number;
  sortBy?: 'date' | 'score';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

// GPT explanation response
export interface GPTExplanation {
  summary: string;
  keyPoints: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  disclaimer: string;
}

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  timestamp: string;
}

// Sustainability Report for CSRD-compliant reports
export interface SustainabilityReport {
  id: string;
  slug: string; // URL-friendly identifier, e.g. "accenture-2024"
  company: string;
  country: string;
  // GICS (Global Industry Classification Standard) classification.
  sector: string;   // GICS Sector
  industry: string; // GICS Industry Group

  // Optional source classification (legacy dataset used SASB SICS).
  sourceSector?: string;
  sourceIndustry?: string;
  pageStart: number | null;
  pageEnd: number | null;
  reportUrl: string | null;  // May be null for some historical reports
  publishedYear: number;
}
