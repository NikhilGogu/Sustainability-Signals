/**
 * Sustainability Reports Data
 * Real data from SRNAV - CSRD-compliant sustainability reports
 * Total: 976 unique reports from European companies
 */

import type { SustainabilityReport } from '../types';
import allReportsData from './allReports.json';

// Raw report type from JSON
interface RawReport {
    c: string;      // Company name
    ct: string;     // Country
    s: string;      // Sector
    i: string;      // Industry
    p: string | null;  // Page range (e.g., "20-40")
    u: string | null;  // Report URL (may be null for some 2022 reports)
    y: string;      // Year
}

// Helper to parse page range
function parsePageRange(pageRange: string | null): { start: number | null; end: number | null } {
    if (!pageRange) return { start: null, end: null };
    const parts = pageRange.split('-');
    return {
        start: parseInt(parts[0]) || null,
        end: parseInt(parts[1]) || null
    };
}

// Cast imported JSON data
const rawReports: RawReport[] = allReportsData as RawReport[];

// Transform raw data to typed reports
export const SUSTAINABILITY_REPORTS: SustainabilityReport[] = rawReports.map((r, idx) => {
    const pages = parsePageRange(r.p);
    return {
        id: `report-${idx + 1}`,
        company: r.c,
        country: r.ct,
        sector: r.s,
        industry: r.i,
        pageStart: pages.start,
        pageEnd: pages.end,
        reportUrl: r.u,
        publishedYear: parseInt(r.y)
    };
});

// Extract unique filter options
export const REPORT_COUNTRIES = [...new Set(SUSTAINABILITY_REPORTS.map(r => r.country))].sort();
export const REPORT_SECTORS = [...new Set(SUSTAINABILITY_REPORTS.map(r => r.sector))].sort();
export const REPORT_INDUSTRIES = [...new Set(SUSTAINABILITY_REPORTS.map(r => r.industry))].sort();
export const REPORT_YEARS = [...new Set(SUSTAINABILITY_REPORTS.map(r => r.publishedYear))].sort((a, b) => b - a);
