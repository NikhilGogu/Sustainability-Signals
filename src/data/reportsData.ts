import type { SustainabilityReport } from '../types';
import reportsIndexData from './reportsIndex.json';

interface ReportsIndexRow {
    id: string; // report-123
    c: string;  // Company name
    ct: string; // Country
    s: string;  // GICS Sector
    i: string;  // GICS Industry Group
    y: number | null; // Published year
    k: string;  // R2 object key
    ss?: string; // Original source sector (legacy dataset: SASB SICS)
    si?: string; // Original source industry (legacy dataset: SASB SICS)
}

const indexRows: ReportsIndexRow[] = reportsIndexData as ReportsIndexRow[];

/** Turn a company name + year into a URL-safe slug, deduplicating if needed. */
function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-z0-9]+/g, '-') // non-alphanum → dash
        .replace(/^-+|-+$/g, '');     // trim leading/trailing dashes
}

// The index is generated from the R2 upload manifest, so it only includes reports that
// exist in our bucket (no offline / missing PDFs) and does not ship issuer URLs.
const slugCounts = new Map<string, number>();
export const SUSTAINABILITY_REPORTS: SustainabilityReport[] = indexRows.map((r) => {
    const base = `${slugify(r.c)}-${r.y ?? 0}`;
    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count + 1}`;
    return {
        id: r.id,
        slug,
        company: r.c,
        country: r.ct,
        sector: r.s,
        industry: r.i,
        sourceSector: r.ss,
        sourceIndustry: r.si,
        pageStart: null,
        pageEnd: null,
        reportUrl: r.k ? `/r2/${r.k}` : null,
        publishedYear: r.y ?? 0,
    };
});

/** Lookup a report by its URL slug. */
export const REPORTS_BY_SLUG = new Map<string, SustainabilityReport>(
    SUSTAINABILITY_REPORTS.map((r) => [r.slug, r])
);

// Extract unique filter options
export const REPORT_COUNTRIES = [...new Set(SUSTAINABILITY_REPORTS.map(r => r.country))].sort();
export const REPORT_SECTORS = [...new Set(SUSTAINABILITY_REPORTS.map(r => r.sector))].sort();
export const REPORT_INDUSTRIES = [...new Set(SUSTAINABILITY_REPORTS.map(r => r.industry))].sort();
export const REPORT_YEARS = [...new Set(SUSTAINABILITY_REPORTS.map(r => r.publishedYear))].sort((a, b) => b - a);
