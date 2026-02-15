import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { Helmet } from 'react-helmet-async';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { REPORTS_BY_SLUG } from '../data/reportsData';
import { ChatSidebar } from '../components/reports/ChatSidebar';
import { DQLoadingOverlay } from '../components/reports/DQLoadingOverlay';
import { EntityExtractionPanel, type EntityExtractionResponse } from '../components/reports/EntityExtractionPanel';
import { getEsgBertSummary, type EsgBertReportSummary } from '../utils/esgBert';
import type { ChatMessage } from '../components/reports/ChatSidebar';
import type { SustainabilityReport } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

/* ───────────────── DQ types & helpers ───────────────── */

type DisclosureQualityBand = 'high' | 'medium' | 'low';

interface DisclosureQualitySubscores {
    completeness: number;
    consistency: number;
    assurance: number;
    transparency: number;
}

interface DisclosureQualityScore {
    version: number;
    generatedAt: string;
    report: { id: string; key: string; company: string; year: number | null };
    score: number;
    band: DisclosureQualityBand;
    subscores: DisclosureQualitySubscores;
    features: Record<string, boolean>;
    evidence: Record<string, string[]>;
    evidenceQuotes?: Record<string, Array<{ text: string; page: number | null; heading: string | null }>>;
    featureCount?: number;
    featureTotal?: number;
    featureDepth?: Record<string, { occurrences: number; pages: number }>;
    recommendations?: string[];
    topicProfile?: {
        model?: string;
        evidence_blocks_classified?: number;
        esg_relevant_blocks?: number;
        by_pillar?: { E: number; S: number; G: number };
        by_category?: Record<string, number>;
    };
    quantitativeProfile?: {
        percentageCount: number;
        tableRows: number;
        kpiNumbers: number;
        distinctYears: number;
        numericDensity: number;
    };
    method?: Record<string, unknown>;
}

function dqBandStyles(band: DisclosureQualityBand | null) {
    if (band === 'high') return { accent: 'text-emerald-600 dark:text-emerald-400', pill: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40', ring: 'ring-emerald-500/20', gradient: 'from-emerald-500 to-teal-500' };
    if (band === 'medium') return { accent: 'text-amber-600 dark:text-amber-400', pill: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40', ring: 'ring-amber-500/20', gradient: 'from-amber-500 to-orange-500' };
    return { accent: 'text-rose-600 dark:text-rose-400', pill: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40', ring: 'ring-rose-500/20', gradient: 'from-rose-500 to-pink-500' };
}

function clamp01(v: number) { return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function fmtShortDate(iso: string) {
    try { const d = new Date(iso); if (!Number.isFinite(d.getTime())) return iso; return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }); } catch { return iso; }
}

function cleanEvidenceText(raw: string): string {
    let s = raw;
    s = s.replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '');
    s = s.replace(/\u00ad/g, '');
    s = s.replace(/\u00a0/g, ' ');
    s = s.replace(/\ufb01/g, 'fi').replace(/\ufb02/g, 'fl').replace(/\ufb00/g, 'ff').replace(/\ufb03/g, 'ffi').replace(/\ufb04/g, 'ffl');
    s = s.replace(/[\u25a0\u25a1\u25aa\u25ab\u25cf\u25cb\u25c6\u25c7\u25ba\u25b8\u25b6\u25c0\u25be\u25bc\u25b2\u25b3\u25b7\u25c1\u2605\u2606\u2726\u2727\u2729\u272a-\u2749\u2b1b\u2b1c\u2610-\u2612]/g, '');
    s = s.replace(/[\u2190-\u21ff\u27f5-\u27f7]/g, ' - ');
    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    s = s.replace(/\[([^\]]*)\]\(\s*\)/g, '$1');
    s = s.replace(/^\s*#{1,6}\s*$/gm, '');
    s = s.replace(/^[\s|]*[-:]{3,}(\s*\|\s*[-:]{3,})+[\s|]*$/gm, '');
    s = s.replace(/^\s*\|[\s|]*$/gm, '');
    s = s.replace(/^\s*\|\s+/gm, '').replace(/\s+\|\s*$/gm, '');
    s = s.replace(/\|{2,}/g, ' | ');
    s = s.replace(/^-{3,}\s*$/gm, '');
    s = s.replace(/^\s*Page\s+\d+\s*[:.]?\s*$/gim, '');
    s = s.replace(/\[\.\.\.(?:truncated|snipped)\.\.\.\]\s*/gi, '');
    s = s.replace(/\s*\.\.\.\s*$/g, '');
    s = s.replace(/[ \t]+/g, ' ').replace(/ *\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    return s.trim();
}

/* ───────────────── DQ Radar chart ───────────────── */

function DisclosureQualityRadar({ score, band, subscores }: { score: number; band: DisclosureQualityBand | null; subscores: DisclosureQualitySubscores }) {
    const s = dqBandStyles(band);
    const [hovered, setHovered] = useState<string | null>(null);
    const cx = 170, cy = 130, r = 80;
    const A = { x: cx, y: cy - r }, B = { x: cx + r, y: cy }, C = { x: cx, y: cy + r }, D = { x: cx - r, y: cy };
    const center = { x: cx, y: cy };
    const tA = clamp01(subscores.completeness / 100), tB = clamp01(subscores.consistency / 100), tC = clamp01(subscores.assurance / 100), tD = clamp01((subscores.transparency ?? 0) / 100);
    const pA = { x: lerp(center.x, A.x, tA), y: lerp(center.y, A.y, tA) };
    const pB = { x: lerp(center.x, B.x, tB), y: lerp(center.y, B.y, tB) };
    const pC = { x: lerp(center.x, C.x, tC), y: lerp(center.y, C.y, tC) };
    const pD = { x: lerp(center.x, D.x, tD), y: lerp(center.y, D.y, tD) };
    const outer = `${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`;
    const qColors = {
        completeness: { fill: '#10b981', fillDark: '#059669' },
        consistency:  { fill: '#0ea5e9', fillDark: '#0284c7' },
        assurance:    { fill: '#f59e0b', fillDark: '#d97706' },
        transparency: { fill: '#8b5cf6', fillDark: '#7c3aed' },
    };
    const quadrants = [
        { key: 'completeness', points: `${center.x},${center.y} ${A.x},${A.y} ${B.x},${B.y}`, valuePoints: `${center.x},${center.y} ${pA.x},${pA.y} ${pB.x},${pB.y}`, color: qColors.completeness, value: subscores.completeness },
        { key: 'consistency',  points: `${center.x},${center.y} ${B.x},${B.y} ${C.x},${C.y}`, valuePoints: `${center.x},${center.y} ${pB.x},${pB.y} ${pC.x},${pC.y}`, color: qColors.consistency,  value: subscores.consistency },
        { key: 'assurance',    points: `${center.x},${center.y} ${C.x},${C.y} ${D.x},${D.y}`, valuePoints: `${center.x},${center.y} ${pC.x},${pC.y} ${pD.x},${pD.y}`, color: qColors.assurance,    value: subscores.assurance },
        { key: 'transparency', points: `${center.x},${center.y} ${D.x},${D.y} ${A.x},${A.y}`, valuePoints: `${center.x},${center.y} ${pD.x},${pD.y} ${pA.x},${pA.y}`, color: qColors.transparency, value: subscores.transparency ?? 0 },
    ];

    return (
        <div className={`relative rounded-2xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border border-gray-200/60 dark:border-gray-800/60 p-4 ring-1 ${s.ring}`}>
            <svg viewBox="0 0 340 270" className="w-full h-auto" aria-label="Disclosure Quality radar chart">
                <defs>
                    {quadrants.map((q) => (
                        <linearGradient key={`grad-${q.key}`} id={`dqFill-${q.key}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={q.color.fill} stopOpacity={hovered === q.key ? 0.55 : 0.30} />
                            <stop offset="100%" stopColor={q.color.fillDark} stopOpacity={hovered === q.key ? 0.35 : 0.10} />
                        </linearGradient>
                    ))}
                    <filter id="dqGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <polygon points={outer} fill="none" stroke="rgba(148,163,184,0.50)" strokeWidth="1.5" />
                {[0.25, 0.5, 0.75].map((t) => {
                    const gA = { x: lerp(center.x, A.x, t), y: lerp(center.y, A.y, t) };
                    const gB = { x: lerp(center.x, B.x, t), y: lerp(center.y, B.y, t) };
                    const gC = { x: lerp(center.x, C.x, t), y: lerp(center.y, C.y, t) };
                    const gD = { x: lerp(center.x, D.x, t), y: lerp(center.y, D.y, t) };
                    return <polygon key={t} points={`${gA.x},${gA.y} ${gB.x},${gB.y} ${gC.x},${gC.y} ${gD.x},${gD.y}`} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="0.75" strokeDasharray={t === 0.5 ? '4 2' : 'none'} />;
                })}
                <line x1={center.x} y1={center.y} x2={A.x} y2={A.y} stroke="rgba(148,163,184,0.20)" strokeWidth="0.75" />
                <line x1={center.x} y1={center.y} x2={B.x} y2={B.y} stroke="rgba(148,163,184,0.20)" strokeWidth="0.75" />
                <line x1={center.x} y1={center.y} x2={C.x} y2={C.y} stroke="rgba(148,163,184,0.20)" strokeWidth="0.75" />
                <line x1={center.x} y1={center.y} x2={D.x} y2={D.y} stroke="rgba(148,163,184,0.20)" strokeWidth="0.75" />
                {quadrants.map((q) => (
                    <polygon key={q.key} points={q.valuePoints} fill={`url(#dqFill-${q.key})`} stroke={q.color.fill} strokeWidth={hovered === q.key ? 2.5 : 1.5} strokeOpacity={hovered === q.key ? 1 : 0.6} style={{ transition: 'all 0.2s ease', cursor: 'pointer' }} filter={hovered === q.key ? 'url(#dqGlow)' : undefined} onMouseEnter={() => setHovered(q.key)} onMouseLeave={() => setHovered(null)} />
                ))}
                {[{ p: pA, color: qColors.completeness.fill }, { p: pB, color: qColors.consistency.fill }, { p: pC, color: qColors.assurance.fill }, { p: pD, color: qColors.transparency.fill }].map((d, i) => (
                    <circle key={i} cx={d.p.x} cy={d.p.y} r="3.5" fill={d.color} stroke="white" strokeWidth="1.5" />
                ))}
                <text x={A.x} y={A.y - 14} textAnchor="middle" fontSize="10" fontWeight="700" fill={hovered === 'completeness' ? qColors.completeness.fill : 'currentColor'} className="text-gray-600 dark:text-gray-300" style={{ transition: 'fill 0.2s' }}>Completeness</text>
                <text x={A.x} y={A.y - 3} textAnchor="middle" fontSize="8" fontWeight="600" fill={qColors.completeness.fill} opacity="0.8">{Math.round(subscores.completeness)}</text>
                <text x={B.x + 10} y={B.y - 3} textAnchor="start" fontSize="10" fontWeight="700" fill={hovered === 'consistency' ? qColors.consistency.fill : 'currentColor'} className="text-gray-600 dark:text-gray-300" style={{ transition: 'fill 0.2s' }}>Consistency</text>
                <text x={B.x + 10} y={B.y + 10} textAnchor="start" fontSize="8" fontWeight="600" fill={qColors.consistency.fill} opacity="0.8">{Math.round(subscores.consistency)}</text>
                <text x={C.x} y={C.y + 16} textAnchor="middle" fontSize="10" fontWeight="700" fill={hovered === 'assurance' ? qColors.assurance.fill : 'currentColor'} className="text-gray-600 dark:text-gray-300" style={{ transition: 'fill 0.2s' }}>Assurance</text>
                <text x={C.x} y={C.y + 28} textAnchor="middle" fontSize="8" fontWeight="600" fill={qColors.assurance.fill} opacity="0.8">{Math.round(subscores.assurance)}</text>
                <text x={D.x - 10} y={D.y - 3} textAnchor="end" fontSize="10" fontWeight="700" fill={hovered === 'transparency' ? qColors.transparency.fill : 'currentColor'} className="text-gray-600 dark:text-gray-300" style={{ transition: 'fill 0.2s' }}>Transparency</text>
                <text x={D.x - 10} y={D.y + 10} textAnchor="end" fontSize="8" fontWeight="600" fill={qColors.transparency.fill} opacity="0.8">{Math.round(subscores.transparency ?? 0)}</text>
                <text x={center.x} y={center.y - 6} textAnchor="middle" fontSize="32" fontWeight="800" fill="currentColor" className={s.accent}>{Math.round(score)}</text>
                <text x={center.x} y={center.y + 12} textAnchor="middle" fontSize="8" fontWeight="600" letterSpacing="0.05em" fill="currentColor" className="text-gray-400 dark:text-gray-500">DISCLOSURE QUALITY</text>
            </svg>
        </div>
    );
}

// Module-level cache so DQ scores survive navigation without re-fetching.
const dqCacheByReport = new Map<string, DisclosureQualityScore>();

// Module-level cache for entity extraction results.
const entityCacheByReport = new Map<string, EntityExtractionResponse>();

// Module-level cache for ESG-BERT report summaries.
const bertCacheByReport = new Map<string, EsgBertReportSummary | null>();

/* ───────────────── Signals categories constant ───────────────── */

type ChipDef = { label: string; found: boolean; key: string };

const SIGNAL_CATEGORIES = (f: Record<string, boolean>): Array<{ title: string; chips: ChipDef[] }> => [
    { title: 'Frameworks & Standards', chips: [
        { label: 'ESRS', found: !!f['framework_esrs'], key: 'framework_esrs' }, { label: 'CSRD', found: !!f['framework_csrd'], key: 'framework_csrd' }, { label: 'GRI', found: !!f['framework_gri'], key: 'framework_gri' }, { label: 'GRI Index', found: !!f['gri_content_index'], key: 'gri_content_index' }, { label: 'SASB', found: !!f['framework_sasb'], key: 'framework_sasb' }, { label: 'TCFD', found: !!f['framework_tcfd'], key: 'framework_tcfd' }, { label: 'ISSB', found: !!f['framework_issb'], key: 'framework_issb' }, { label: 'EU Taxonomy', found: !!f['framework_eu_taxonomy'], key: 'framework_eu_taxonomy' }, { label: 'TNFD', found: !!f['framework_tnfd'], key: 'framework_tnfd' }, { label: 'CDP', found: !!f['framework_cdp'], key: 'framework_cdp' }, { label: 'SDGs', found: !!f['framework_sdgs'], key: 'framework_sdgs' },
    ] },
    { title: 'Climate & Emissions', chips: [
        { label: 'Scope 1', found: !!f['scope_1'], key: 'scope_1' }, { label: 'Scope 2', found: !!f['scope_2'], key: 'scope_2' }, { label: 'Scope 3', found: !!f['scope_3'], key: 'scope_3' }, { label: 'Scope 3 categories', found: !!f['scope3_categories'], key: 'scope3_categories' }, { label: 'Location/Market-based', found: !!f['scope2_method'], key: 'scope2_method' }, { label: 'GHG Protocol', found: !!f['ghg_protocol'], key: 'ghg_protocol' }, { label: 'Emissions data', found: !!f['emissions_numbers'], key: 'emissions_numbers' }, { label: 'Emissions intensity', found: !!f['emissions_intensity'], key: 'emissions_intensity' }, { label: 'Climate scenarios', found: !!f['climate_scenario'], key: 'climate_scenario' }, { label: 'Carbon pricing', found: !!f['carbon_pricing'], key: 'carbon_pricing' },
    ] },
    { title: 'Targets & Strategy', chips: [
        { label: 'Net zero', found: !!f['net_zero'], key: 'net_zero' }, { label: 'SBTi', found: !!f['sbti'], key: 'sbti' }, { label: 'Paris alignment', found: !!f['paris_agreement'], key: 'paris_agreement' }, { label: 'Transition plan', found: !!f['transition_plan'], key: 'transition_plan' }, { label: 'Quantitative targets', found: !!f['quantitative_targets'], key: 'quantitative_targets' }, { label: 'Interim targets', found: !!f['interim_targets'], key: 'interim_targets' }, { label: 'Progress tracking', found: !!f['target_progress'], key: 'target_progress' },
    ] },
    { title: 'Environment', chips: [
        { label: 'Energy', found: !!f['energy'], key: 'energy' }, { label: 'Renewables', found: !!f['renewable_energy'], key: 'renewable_energy' }, { label: 'Water', found: !!f['water'], key: 'water' }, { label: 'Waste', found: !!f['waste'], key: 'waste' }, { label: 'Biodiversity', found: !!f['biodiversity'], key: 'biodiversity' }, { label: 'Circular economy', found: !!f['circular_economy'], key: 'circular_economy' }, { label: 'Pollution', found: !!f['pollution'], key: 'pollution' },
    ] },
    { title: 'Social', chips: [
        { label: 'Workforce', found: !!f['workforce'], key: 'workforce' }, { label: 'Health & Safety', found: !!f['safety'], key: 'safety' }, { label: 'Diversity & Inclusion', found: !!f['diversity'], key: 'diversity' }, { label: 'Human rights', found: !!f['human_rights'], key: 'human_rights' }, { label: 'Training', found: !!f['training'], key: 'training' }, { label: 'Stakeholders', found: !!f['stakeholder_engagement'], key: 'stakeholder_engagement' }, { label: 'Wellbeing', found: !!f['health_wellbeing'], key: 'health_wellbeing' }, { label: 'Employee turnover', found: !!f['employee_turnover'], key: 'employee_turnover' }, { label: 'Community', found: !!f['community_investment'], key: 'community_investment' }, { label: 'Living wage', found: !!f['living_wage'], key: 'living_wage' }, { label: 'Just transition', found: !!f['just_transition'], key: 'just_transition' },
    ] },
    { title: 'Governance & Integrity', chips: [
        { label: 'Board oversight', found: !!f['board_oversight'], key: 'board_oversight' }, { label: 'Sustainability committee', found: !!f['sustainability_committee'], key: 'sustainability_committee' }, { label: 'Audit committee', found: !!f['audit_committee'], key: 'audit_committee' }, { label: 'Internal control', found: !!f['internal_control'], key: 'internal_control' }, { label: 'Risk management', found: !!f['risk_management'], key: 'risk_management' }, { label: 'ESG remuneration', found: !!f['esg_remuneration'], key: 'esg_remuneration' }, { label: 'Whistleblower', found: !!f['whistleblower'], key: 'whistleblower' }, { label: 'Anti-corruption', found: !!f['anti_corruption'], key: 'anti_corruption' }, { label: 'Data privacy', found: !!f['data_privacy'], key: 'data_privacy' }, { label: 'Tax transparency', found: !!f['tax_transparency'], key: 'tax_transparency' },
    ] },
    { title: 'Assurance', chips: [
        { label: 'Reasonable assurance', found: !!f['assurance_reasonable'], key: 'assurance_reasonable' }, { label: 'Limited assurance', found: !!f['assurance_limited'], key: 'assurance_limited' }, { label: 'ISAE 3000/3410', found: !!f['assurance_isae'], key: 'assurance_isae' }, { label: 'AA1000', found: !!f['assurance_aa1000'], key: 'assurance_aa1000' }, { label: 'Named provider', found: !!f['named_assurance_provider'], key: 'named_assurance_provider' }, { label: 'Assurance scope', found: !!f['assurance_scope'], key: 'assurance_scope' },
    ] },
    { title: 'Disclosure Quality', chips: [
        { label: 'Double materiality', found: !!f['double_materiality'], key: 'double_materiality' }, { label: 'Materiality matrix', found: !!f['materiality_matrix'], key: 'materiality_matrix' }, { label: 'IRO analysis', found: !!f['iro_analysis'], key: 'iro_analysis' }, { label: 'Methodology', found: !!f['methodology'], key: 'methodology' }, { label: 'Reporting boundary', found: !!f['boundary'], key: 'boundary' }, { label: 'Data quality', found: !!f['data_quality'], key: 'data_quality' }, { label: 'Forward-looking', found: !!f['forward_looking'], key: 'forward_looking' }, { label: 'Transition plan', found: !!f['transition_plan'], key: 'transition_plan' }, { label: 'Base year', found: !!f['base_year'], key: 'base_year' }, { label: 'Limitations', found: !!f['limitations'], key: 'limitations' }, { label: 'Restatement', found: !!f['restatement'], key: 'restatement' }, { label: 'Financial connectivity', found: !!f['connectivity_financial'], key: 'connectivity_financial' }, { label: 'ESRS data points', found: !!f['esrs_datapoints'], key: 'esrs_datapoints' },
    ] },
];

const EVIDENCE_ITEMS: Array<{ label: string; key: string; category: string }> = [
    { label: 'ESRS', key: 'framework_esrs', category: 'Frameworks' }, { label: 'CSRD', key: 'framework_csrd', category: 'Frameworks' }, { label: 'EU Taxonomy', key: 'framework_eu_taxonomy', category: 'Frameworks' }, { label: 'GRI', key: 'framework_gri', category: 'Frameworks' }, { label: 'GRI Content Index', key: 'gri_content_index', category: 'Frameworks' }, { label: 'TCFD', key: 'framework_tcfd', category: 'Frameworks' }, { label: 'TNFD', key: 'framework_tnfd', category: 'Frameworks' }, { label: 'SDGs', key: 'framework_sdgs', category: 'Frameworks' },
    { label: 'Double materiality', key: 'double_materiality', category: 'Materiality & Scope' }, { label: 'Materiality matrix', key: 'materiality_matrix', category: 'Materiality & Scope' }, { label: 'IRO analysis', key: 'iro_analysis', category: 'Materiality & Scope' }, { label: 'Value chain', key: 'value_chain', category: 'Materiality & Scope' },
    { label: 'Scope 1', key: 'scope_1', category: 'Emissions' }, { label: 'Scope 2', key: 'scope_2', category: 'Emissions' }, { label: 'Scope 3', key: 'scope_3', category: 'Emissions' }, { label: 'Scope 3 categories', key: 'scope3_categories', category: 'Emissions' }, { label: 'Scope 2 methods', key: 'scope2_method', category: 'Emissions' }, { label: 'GHG Protocol', key: 'ghg_protocol', category: 'Emissions' }, { label: 'Emissions data', key: 'emissions_numbers', category: 'Emissions' }, { label: 'Emissions intensity', key: 'emissions_intensity', category: 'Emissions' },
    { label: 'Net zero', key: 'net_zero', category: 'Targets & Strategy' }, { label: 'SBTi', key: 'sbti', category: 'Targets & Strategy' }, { label: 'Transition plan', key: 'transition_plan', category: 'Targets & Strategy' }, { label: 'Paris Agreement', key: 'paris_agreement', category: 'Targets & Strategy' }, { label: 'Quantitative targets', key: 'quantitative_targets', category: 'Targets & Strategy' }, { label: 'Interim targets', key: 'interim_targets', category: 'Targets & Strategy' }, { label: 'Target progress', key: 'target_progress', category: 'Targets & Strategy' },
    { label: 'Climate scenarios', key: 'climate_scenario', category: 'Climate & Environment' }, { label: 'Carbon pricing', key: 'carbon_pricing', category: 'Climate & Environment' }, { label: 'Renewable energy', key: 'renewable_energy', category: 'Climate & Environment' }, { label: 'Biodiversity', key: 'biodiversity', category: 'Climate & Environment' }, { label: 'Circular economy', key: 'circular_economy', category: 'Climate & Environment' }, { label: 'Pollution', key: 'pollution', category: 'Climate & Environment' }, { label: 'Energy', key: 'energy', category: 'Climate & Environment' }, { label: 'Water', key: 'water', category: 'Climate & Environment' }, { label: 'Waste', key: 'waste', category: 'Climate & Environment' },
    { label: 'Human rights', key: 'human_rights', category: 'Social' }, { label: 'Stakeholder engagement', key: 'stakeholder_engagement', category: 'Social' }, { label: 'Training', key: 'training', category: 'Social' }, { label: 'Health & Wellbeing', key: 'health_wellbeing', category: 'Social' }, { label: 'Employee turnover', key: 'employee_turnover', category: 'Social' }, { label: 'Diversity', key: 'diversity', category: 'Social' }, { label: 'Workforce', key: 'workforce', category: 'Social' }, { label: 'Safety', key: 'safety', category: 'Social' },
    { label: 'Assurance', key: 'assurance_any', category: 'Assurance' }, { label: 'Named provider', key: 'named_assurance_provider', category: 'Assurance' }, { label: 'Assurance scope', key: 'assurance_scope', category: 'Assurance' },
    { label: 'Methodology', key: 'methodology', category: 'Quality & Controls' }, { label: 'Boundary', key: 'boundary', category: 'Quality & Controls' }, { label: 'Data quality', key: 'data_quality', category: 'Quality & Controls' }, { label: 'Forward-looking', key: 'forward_looking', category: 'Quality & Controls' }, { label: 'Limitations', key: 'limitations', category: 'Quality & Controls' }, { label: 'Financial connectivity', key: 'connectivity_financial', category: 'Quality & Controls' }, { label: 'ESRS data points', key: 'esrs_datapoints', category: 'Quality & Controls' },
    { label: 'ESG remuneration', key: 'esg_remuneration', category: 'Governance' }, { label: 'Whistleblower', key: 'whistleblower', category: 'Governance' }, { label: 'Anti-corruption', key: 'anti_corruption', category: 'Governance' }, { label: 'Board oversight', key: 'board_oversight', category: 'Governance' }, { label: 'Sustainability committee', key: 'sustainability_committee', category: 'Governance' },
];

/* ───────────────── Entry ───────────────── */

export function CompanyReport() {
    const { reportId } = useParams<{ reportId: string }>();

    const report = useMemo(
        () => REPORTS_BY_SLUG.get(reportId ?? '') ?? null,
        [reportId]
    );

    if (!report) {
        return (
            <>
                <Helmet><title>Disclosure Not Found | Sustainability Signals</title></Helmet>
                <div role="alert" className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                    <svg aria-hidden="true" className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h1 className="text-xl font-bold text-gray-700 dark:text-gray-300">Report not found</h1>
                    <Link
                        to="/reports"
                        className="text-brand-600 dark:text-brand-400 hover:underline font-medium text-sm"
                    >
                        &larr; Back to Coverage
                    </Link>
                </div>
            </>
        );
    }

    return <ReportView report={report} />;
}

/* ───────────────── Report View ───────────────── */

function ReportView({ report }: { report: SustainabilityReport }) {
    /* ── PDF state ── */
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.2);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'scroll' | 'single'>('scroll');
    const [docMode, setDocMode] = useState<'range' | 'full'>('range');
    const [docKey, setDocKey] = useState(0);
    const viewerRef = useRef<HTMLDivElement>(null);
    const [viewerWidth, setViewerWidth] = useState(0);
    const [pageRatio, setPageRatio] = useState(11 / 8.5);
    const pageContainerRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
    const pageVisibilityRef = useRef<Map<number, number>>(new Map());
    const rafRef = useRef<number | null>(null);
    const currentPageRef = useRef(currentPage);
    const annotationLinksByPageRef = useRef<Map<number, Map<string, { dest: unknown; url: string | null; action: string | null }>>>(new Map());
    const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
    const contextCacheRef = useRef<Map<string, string>>(new Map());

    /* ── Chat state ── */
    const [chatOpen, setChatOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoadingChat, setIsLoadingChat] = useState(false);

    /* ── DQ state ── */
    const [dqOpen, setDqOpen] = useState(false);
    const [dqLoading, setDqLoading] = useState(false);
    const [dqComputing, setDqComputing] = useState(false);
    const [dqError, setDqError] = useState<string | null>(null);
    const [dqData, setDqData] = useState<DisclosureQualityScore | null>(null);
    const evidenceDetailsInitRef = useRef(new Set<string>());

    /* â”€â”€ LangExtract entities state â”€â”€ */
    const [entitiesOpen, setEntitiesOpen] = useState(false);
    const [entitiesLoading, setEntitiesLoading] = useState(false);
    const [entitiesComputing, setEntitiesComputing] = useState(false);
    const [entitiesError, setEntitiesError] = useState<string | null>(null);
    const [entitiesData, setEntitiesData] = useState<EntityExtractionResponse | null>(null);

    const [bertLoading, setBertLoading] = useState(false);
    const [bertError, setBertError] = useState<string | null>(null);
    const [bertSummary, setBertSummary] = useState<EsgBertReportSummary | null>(null);

    const currentUrl = report.reportUrl || null;
    const reportKey = useMemo(() => {
        const u = report?.reportUrl || '';
        if (u.startsWith('/r2/')) return u.slice('/r2/'.length);
        return null;
    }, [report?.reportUrl]);

    // Hydrate module-level caches on report change.
    useEffect(() => {
        if (!report?.id) return;
        const cachedDq = dqCacheByReport.get(report.id);
        if (cachedDq) setDqData(cachedDq);
        const cachedEntities = entityCacheByReport.get(report.id);
        if (cachedEntities) setEntitiesData(cachedEntities);
        if (bertCacheByReport.has(report.id)) setBertSummary(bertCacheByReport.get(report.id) ?? null);
    }, [report?.id]);

    /* ── DQ: fetch cached score ── */
    const refreshDisclosureQuality = useCallback(async (signal: AbortSignal) => {
        if (!report?.id) return;
        const url = `/score/disclosure-quality?reportId=${encodeURIComponent(report.id)}&version=1&refine=1&_ts=${Date.now()}`;
        const res = await fetch(url, { method: 'GET', signal, cache: 'no-store' });
        if (res.status === 404) return;
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            if (data && typeof data === 'object' && 'error' in data) { const errVal = (data as Record<string, unknown>).error; if (typeof errVal === 'string' && errVal.trim()) msg = errVal.trim(); else if (errVal != null) msg = String(errVal); }
            throw new Error(msg);
        }
        if (!data || typeof data !== 'object') throw new Error('Invalid Disclosure Quality response');
        const incoming = data as DisclosureQualityScore;
        setDqData(incoming);
        dqCacheByReport.set(report.id, incoming);
    }, [report?.id]);

    // Entities: fetch cached extraction (or cached:false sentinel).
    const refreshEntityExtraction = useCallback(async (signal: AbortSignal) => {
        if (!report?.id) return;
        const url = `/score/entity-extract?reportId=${encodeURIComponent(report.id)}&_ts=${Date.now()}`;
        const res = await fetch(url, { method: 'GET', signal, cache: 'no-store' });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            if (data && typeof data === 'object' && 'error' in data) {
                const errVal = (data as Record<string, unknown>).error;
                if (typeof errVal === 'string' && errVal.trim()) msg = errVal.trim();
                else if (errVal != null) msg = String(errVal);
            }
            throw new Error(msg);
        }
        if (!data || typeof data !== 'object') throw new Error('Invalid Entity Extraction response');
        const incoming = data as EntityExtractionResponse;
        setEntitiesData(incoming);
        entityCacheByReport.set(report.id, incoming);
    }, [report?.id]);

    const refreshEntitiesNow = useCallback(() => {
        const controller = new AbortController();
        setEntitiesLoading(true);
        setEntitiesError(null);
        void refreshEntityExtraction(controller.signal)
            .catch((e) => { if (controller.signal.aborted) return; setEntitiesError(e instanceof Error ? e.message : String(e)); })
            .finally(() => { if (controller.signal.aborted) return; setEntitiesLoading(false); });
    }, [refreshEntityExtraction]);

    /* ── DQ: auto-fetch when panel opens ── */
    useEffect(() => {
        if (!dqOpen || !report?.id) return;
        const needsFetch = !dqData;
        const needsRefinement = dqData && (typeof (dqData.method as Record<string, unknown>)?.evidenceRefinedByAI !== 'number' || ((dqData.method as Record<string, unknown>)?.evidenceRefinedByAI as number) === 0);
        if (!needsFetch && !needsRefinement) { setDqLoading(false); return; }
        const controller = new AbortController();
        if (needsFetch) setDqLoading(true);
        setDqError(null);
        void refreshDisclosureQuality(controller.signal)
            .catch((e) => { if (controller.signal.aborted) return; if (needsFetch) setDqError(e instanceof Error ? e.message : String(e)); })
            .finally(() => { if (controller.signal.aborted) return; setDqLoading(false); });
        return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dqOpen, report?.id]);

    /* ── DQ: persist to module cache ── */
    useEffect(() => { if (dqData && report?.id) dqCacheByReport.set(report.id, dqData); }, [dqData, report?.id]);

    // Entities: auto-fetch when panel opens.
    useEffect(() => {
        if (!entitiesOpen || !report?.id) return;
        const needsFetch = !entitiesData;
        if (!needsFetch) { setEntitiesLoading(false); return; }
        const controller = new AbortController();
        setEntitiesLoading(true);
        setEntitiesError(null);
        void refreshEntityExtraction(controller.signal)
            .catch((e) => { if (controller.signal.aborted) return; setEntitiesError(e instanceof Error ? e.message : String(e)); })
            .finally(() => { if (controller.signal.aborted) return; setEntitiesLoading(false); });
        return () => controller.abort();
    }, [entitiesOpen, report?.id, entitiesData, refreshEntityExtraction]);

    // Entities: persist to module cache.
    useEffect(() => { if (entitiesData && report?.id) entityCacheByReport.set(report.id, entitiesData); }, [entitiesData, report?.id]);

    // ESG-BERT: load report summary when Entities panel opens (static dataset).
    useEffect(() => {
        if (!entitiesOpen || !report?.id) return;
        if (bertCacheByReport.has(report.id)) { setBertLoading(false); setBertError(null); setBertSummary(bertCacheByReport.get(report.id) ?? null); return; }

        let cancelled = false;
        setBertLoading(true);
        setBertError(null);
        void getEsgBertSummary(report.id)
            .then((s) => {
                if (cancelled) return;
                setBertSummary(s);
                bertCacheByReport.set(report.id, s);
            })
            .catch((e) => {
                if (cancelled) return;
                setBertError(e instanceof Error ? e.message : String(e));
                setBertSummary(null);
                bertCacheByReport.set(report.id, null);
            })
            .finally(() => { if (cancelled) return; setBertLoading(false); });

        return () => { cancelled = true; };
    }, [entitiesOpen, report?.id]);

    /* ── DQ: compute score (client-side text extraction + POST) ── */
    const computeDisclosureQuality = useCallback(async () => {
        if (!report?.id || !reportKey) return;
        setDqComputing(true);
        setDqError(null);
        try {
            const postScore = async (body: Record<string, unknown>): Promise<DisclosureQualityScore> => {
                const res = await fetch('/score/disclosure-quality', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const raw = await res.text();
                let data: unknown = null;
                try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
                if (!res.ok) {
                    const rawTrim = raw?.trim();
                    let msg = rawTrim ? rawTrim.slice(0, 300) : `HTTP ${res.status}`;
                    if (rawTrim && /<!doctype|<html/i.test(rawTrim)) msg = `HTTP ${res.status}`;
                    if (data && typeof data === 'object' && 'error' in data) {
                        const errVal = (data as Record<string, unknown>).error;
                        if (typeof errVal === 'string' && errVal.trim()) msg = errVal.trim();
                        else if (errVal != null) msg = String(errVal);
                    }
                    throw new Error(msg);
                }
                if (!data || typeof data !== 'object') throw new Error('Invalid Disclosure Quality response');
                return data as DisclosureQualityScore;
            };

            const extractFullText = async (): Promise<string> => {
                if (!pdfDocument || !numPages) return '';
                const cacheKey = `${report.id}:dq:all:${numPages}`;
                const cached = contextCacheRef.current.get(cacheKey);
                if (cached) return cached;

                const MAX_CHARS = 700_000;
                let out = '';
                for (let p = 1; p <= numPages; p++) {
                    const page = await pdfDocument.getPage(p);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item) => 'str' in item ? item.str : '').join(' ');
                    out += `Page ${p}:\n${pageText}\n\n`;
                    if (out.length >= MAX_CHARS) { out = out.slice(0, MAX_CHARS) + '\n\n[Context truncated]\n'; break; }
                    if (p % 8 === 0) await new Promise((r) => setTimeout(r, 0));
                }
                if (out) contextCacheRef.current.set(cacheKey, out);
                return out;
            };

            const baseBody = {
                meta: { reportId: report.id, reportKey, company: report.company, publishedYear: report.publishedYear },
                options: { version: 1, force: true, store: true },
            };

            let computed: DisclosureQualityScore;
            try {
                // Preferred path: server-side markdown cache/PDF conversion.
                computed = await postScore(baseBody);
            } catch (firstErr) {
                const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
                const retryable = /\bHTTP\s5\d\d\b|toMarkdown|Workers AI|Markdown was empty|timed out|fetch failed/i.test(msg);
                if (!retryable) throw firstErr;

                // Fallback: local PDF extraction + one retry.
                const extractedFullText = await extractFullText().catch(() => '');
                if (!extractedFullText) throw firstErr;
                computed = await postScore({ ...baseBody, text: extractedFullText });
            }

            setDqData(computed);
            if (report.id) dqCacheByReport.set(report.id, computed);
        } catch (e) { setDqError(e instanceof Error ? e.message : String(e)); }
        finally { setDqComputing(false); }
    }, [numPages, pdfDocument, report?.id, report?.company, report?.publishedYear, reportKey]);

    // Entities: compute extraction (server-side + optional local fallback)
    const computeEntityExtraction = useCallback(async () => {
        if (!report?.id || !reportKey) return;
        setEntitiesComputing(true);
        setEntitiesError(null);
        try {
            const postExtract = async (body: Record<string, unknown>): Promise<EntityExtractionResponse> => {
                const res = await fetch('/score/entity-extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const raw = await res.text();
                let data: unknown = null;
                try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
                if (!res.ok) {
                    const rawTrim = raw?.trim();
                    let msg = rawTrim ? rawTrim.slice(0, 300) : `HTTP ${res.status}`;
                    if (rawTrim && /<!doctype|<html/i.test(rawTrim)) msg = `HTTP ${res.status}`;
                    if (data && typeof data === 'object' && 'error' in data) {
                        const errVal = (data as Record<string, unknown>).error;
                        if (typeof errVal === 'string' && errVal.trim()) msg = errVal.trim();
                        else if (errVal != null) msg = String(errVal);
                    }
                    throw new Error(msg);
                }
                if (!data || typeof data !== 'object') throw new Error('Invalid Entity Extraction response');
                return data as EntityExtractionResponse;
            };

            const extractFullText = async (): Promise<string> => {
                if (!pdfDocument || !numPages) return '';
                const cacheKey = `${report.id}:entities:all:${numPages}`;
                const cached = contextCacheRef.current.get(cacheKey);
                if (cached) return cached;

                const MAX_CHARS = 700_000;
                let out = '';
                for (let p = 1; p <= numPages; p++) {
                    const page = await pdfDocument.getPage(p);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item) => 'str' in item ? item.str : '').join(' ');
                    out += `Page ${p}:\n${pageText}\n\n`;
                    if (out.length >= MAX_CHARS) { out = out.slice(0, MAX_CHARS) + '\n\n[Context truncated]\n'; break; }
                    if (p % 8 === 0) await new Promise((r) => setTimeout(r, 0));
                }
                if (out) contextCacheRef.current.set(cacheKey, out);
                return out;
            };

            const baseBody = {
                reportId: report.id,
                reportKey,
                force: true,
            };

            let computed: EntityExtractionResponse;
            try {
                // Preferred path: server-side markdown cache/PDF conversion.
                computed = await postExtract(baseBody);
            } catch (firstErr) {
                const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
                const retryable = /\bHTTP\s5\d\d\b|toMarkdown|Workers AI|PDF conversion|timed out|fetch failed/i.test(msg);
                if (!retryable) throw firstErr;

                // Fallback: local PDF extraction + one retry (uses the endpoint's `text` override).
                const extractedFullText = await extractFullText().catch(() => '');
                if (!extractedFullText) throw firstErr;
                computed = await postExtract({ ...baseBody, text: extractedFullText });
            }

            setEntitiesData(computed);
            entityCacheByReport.set(report.id, computed);
        } catch (e) {
            setEntitiesError(e instanceof Error ? e.message : String(e));
        } finally {
            setEntitiesComputing(false);
        }
    }, [numPages, pdfDocument, report?.id, reportKey]);

    /* ── Chat: text extraction for context ── */
    const pagesToExtract = useMemo(() => {
        if (!numPages) return [1];
        const windowSize = 3;
        const from = Math.max(1, currentPage - windowSize);
        const to = Math.min(numPages, currentPage + windowSize);
        const pages = new Set<number>([1]);
        for (let p = from; p <= to; p++) pages.add(p);
        return Array.from(pages).sort((a, b) => a - b);
    }, [currentPage, numPages]);

    const extractTextFromPages = useCallback(async () => {
        if (!pdfDocument) return '';
        const cacheKey = `${report?.id || 'unknown'}:${pagesToExtract.join(',')}`;
        const cached = contextCacheRef.current.get(cacheKey);
        if (cached) return cached;
        let extractedText = '';
        try {
            for (const p of pagesToExtract) {
                const page = await pdfDocument.getPage(p);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item) => 'str' in item ? item.str : '').join(' ');
                extractedText += `Page ${p}:\n${pageText}\n\n`;
            }
        } catch { /* ignore */ }
        const MAX_CHARS = 120_000;
        if (extractedText.length > MAX_CHARS) extractedText = extractedText.slice(0, MAX_CHARS) + '\n\n[Context truncated]\n';
        contextCacheRef.current.set(cacheKey, extractedText);
        return extractedText;
    }, [pdfDocument, pagesToExtract, report?.id]);

    /* ── Chat: send message ── */
    const handleSendMessage = useCallback(async (content: string) => {
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content };
        const nextConversation = [...messages, userMsg];
        setMessages(nextConversation);
        setIsLoadingChat(true);
        try {
            const context = await extractTextFromPages();
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: nextConversation.map(m => ({ role: m.role, content: m.content })),
                    context,
                    meta: {
                        reportId: report?.id,
                        reportKey: report?.reportUrl?.startsWith('/r2/') ? report.reportUrl.slice('/r2/'.length) : null,
                        company: report?.company,
                        publishedYear: report?.publishedYear,
                        currentPage,
                        numPages,
                    },
                }),
            });
            if (!response.ok) {
                let errorMessage = `API Error (${response.status})`;
                try { const errorData = await response.json(); if (errorData.error) errorMessage = errorData.error; }
                catch { const text = await response.text(); if (response.status === 404 && text.includes('DOCTYPE')) errorMessage = 'Backend function not found.'; else errorMessage = text || response.statusText; }
                throw new Error(errorMessage);
            }
            const data = await response.json();
            const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
            setMessages(prev => [...prev, errorMsg]);
        } finally { setIsLoadingChat(false); }
    }, [messages, extractTextFromPages, report?.id, report?.reportUrl, report?.company, report?.publishedYear, currentPage, numPages]);

    useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

    /* ── viewer width tracking ── */
    useEffect(() => {
        const el = viewerRef.current;
        if (!el) return;
        const update = () => setViewerWidth(el.clientWidth);
        update();
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => update());
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const onDocumentLoadSuccess = useCallback((pdf: pdfjs.PDFDocumentProxy) => {
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoading(false);
        setError(null);
        setPdfDocument(pdf);
        annotationLinksByPageRef.current.clear();

        (async () => {
            try {
                const page1 = await pdf.getPage(1);
                const vp = page1.getViewport({ scale: 1 });
                const ratio = vp.height / vp.width;
                if (Number.isFinite(ratio) && ratio > 0) setPageRatio(ratio);
            } catch { /* ignore */ }
        })();
    }, []);

    const basePageWidth = useMemo(() => {
        const max = 920;
        const w = viewerWidth || (typeof window !== 'undefined' ? window.innerWidth : 0);
        const padding = w < 640 ? 24 : 48;
        return Math.max(320, Math.floor(Math.min(max, Math.max(0, w - padding))));
    }, [viewerWidth]);

    const pageWidth = useMemo(() => Math.floor(basePageWidth * scale), [basePageWidth, scale]);
    const estimatedPageHeight = useMemo(() => Math.floor(pageWidth * pageRatio), [pageWidth, pageRatio]);
    const documentOptions = useMemo(
        () => (docMode === 'full' ? { disableRange: true, disableStream: true } : {}),
        [docMode]
    );

    const onDocumentLoadError = useCallback((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load PDF';

        // Retry once without range/streaming; some PDFs or range responses can break PDF.js.
        if (docMode === 'range') {
            setDocMode('full');
            setDocKey((k) => k + 1);
            setError(null);
            setLoading(true);
            return;
        }

        setError(msg);
        setLoading(false);
    }, [docMode]);

    const retryLoad = () => {
        setError(null);
        setLoading(true);
        setDocMode('range');
        setDocKey((k) => k + 1);
    };

    /* ── scroll-mode page tracking ── */
    useEffect(() => {
        if (viewMode !== 'scroll') return;
        const root = viewerRef.current;
        if (!root || numPages <= 0) return;

        pageVisibilityRef.current.clear();
        if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const el = entry.target as HTMLElement;
                    const p = Number(el.dataset.page);
                    if (!Number.isFinite(p)) continue;
                    if (entry.isIntersecting && entry.intersectionRatio > 0) pageVisibilityRef.current.set(p, entry.intersectionRatio);
                    else pageVisibilityRef.current.delete(p);
                }
                if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                    let best = currentPageRef.current;
                    let bestR = 0;
                    pageVisibilityRef.current.forEach((ratio, p) => { if (ratio > bestR) { bestR = ratio; best = p; } });
                    if (best !== currentPageRef.current) setCurrentPage(best);
                });
            },
            { root, rootMargin: '800px 0px 800px 0px', threshold: [0, 0.05, 0.15, 0.3, 0.5] }
        );

        pageContainerRefs.current.forEach((el) => { if (el) observer.observe(el); });
        return () => { observer.disconnect(); if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    }, [viewMode, numPages, pageWidth]);

    const scrollToPage = useCallback((page: number, behavior: ScrollBehavior = 'smooth') => {
        const el = pageContainerRefs.current.get(page);
        if (!el) return;

        try {
            el.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
        } catch {
            // Older browsers (notably some iOS Safari versions) can throw when
            // passed an options object.
            try {
                el.scrollIntoView();
            } catch {
                const root = viewerRef.current;
                if (!root) return;

                const elRect = el.getBoundingClientRect();
                const rootRect = root.getBoundingClientRect();
                const top = root.scrollTop + (elRect.top - rootRect.top);

                try {
                    root.scrollTo({ top, behavior });
                } catch {
                    root.scrollTop = top;
                }
            }
        }
    }, []);

    const goToPage = useCallback(
        (p: number, behavior: ScrollBehavior = 'smooth') => {
            const endPage = numPages > 0 ? numPages : 1;
            const clamped = Math.max(1, Math.min(endPage, p));
            setCurrentPage(clamped);

            if (viewMode === 'scroll') {
                // Smooth scrolling very long distances can be unstable on mobile.
                const distance = Math.abs(clamped - currentPageRef.current);
                const effectiveBehavior = behavior === 'smooth' && distance > 6 ? 'auto' : behavior;
                requestAnimationFrame(() => scrollToPage(clamped, effectiveBehavior));
            }
        },
        [viewMode, numPages, scrollToPage]
    );

    const onDocumentItemClick = useCallback((args: { pageNumber?: number; pageIndex?: number }) => {
        const pageNumber = Number(args?.pageNumber);
        const pageFromNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : null;

        const pageIndex = Number(args?.pageIndex);
        const pageFromIndex = Number.isFinite(pageIndex) && pageIndex >= 0 ? pageIndex + 1 : null;

        const targetPage = pageFromNumber ?? pageFromIndex;
        if (!targetPage) return;
        goToPage(targetPage, 'auto');
    }, [goToPage]);

    // Fallback for PDFs whose internal annotations do not route reliably via react-pdf's onItemClick.
    useEffect(() => {
        const root = viewerRef.current;
        if (!root || !pdfDocument) return;

        const parseDestNameToPage = (destName: string): number | null => {
            const s = destName.trim();
            if (!s) return null;

            const patterns = [
                /^p(?:age)?[_\-\s]*(\d+)$/i,
                /^#?page[_\-\s]*(\d+)$/i,
                /(\d+)$/,
            ];
            for (const rx of patterns) {
                const m = rx.exec(s);
                if (!m) continue;
                const n = Number.parseInt(m[1], 10);
                if (Number.isFinite(n) && n > 0) return n;
            }
            return null;
        };

        const parsePageFromHref = (rawHref: string): number | null => {
            if (!rawHref) return null;

            let hash = '';
            if (rawHref.startsWith('#')) {
                hash = rawHref.slice(1);
            } else {
                try {
                    hash = new URL(rawHref, window.location.href).hash.replace(/^#/, '');
                } catch {
                    return null;
                }
            }
            if (!hash) return null;

            let decodedHash = hash;
            try {
                decodedHash = decodeURIComponent(hash);
            } catch {
                // Keep original hash if decoding fails.
            }

            const normalized = decodedHash.startsWith('?') ? decodedHash.slice(1) : decodedHash;
            const params = new URLSearchParams(normalized);

            const fromPageParam = Number.parseInt(params.get('page') || '', 10);
            if (Number.isFinite(fromPageParam) && fromPageParam > 0) return fromPageParam;

            const namedDest = params.get('nameddest') || '';
            if (namedDest) {
                const fromNamedDest = parseDestNameToPage(namedDest);
                if (fromNamedDest) return fromNamedDest;
            }

            // PDF.js often writes named destinations directly in the hash, e.g. "#p45".
            if (normalized && !normalized.includes('=')) {
                const fromPlainName = parseDestNameToPage(normalized);
                if (fromPlainName) return fromPlainName;
            }

            const m = /(?:^|[?&])page=(\d+)/i.exec(normalized);
            if (m) {
                const n = Number.parseInt(m[1], 10);
                if (Number.isFinite(n) && n > 0) return n;
            }

            const namedDestMatch = /(?:^|[?&])nameddest=([^&]+)/i.exec(normalized);
            if (namedDestMatch) {
                const fromNamedDest = parseDestNameToPage(namedDestMatch[1]);
                if (fromNamedDest) return fromNamedDest;
            }

            return null;
        };

        const explicitDestToPageNumber = async (explicitDest: unknown) => {
            if (!Array.isArray(explicitDest) || explicitDest.length < 1) return null;

            const destRef = explicitDest[0] as unknown;
            if (destRef && typeof destRef === 'object') {
                try {
                    return (await pdfDocument.getPageIndex(destRef as never)) + 1;
                } catch {
                    return null;
                }
            }

            if (Number.isInteger(destRef)) {
                return (destRef as number) + 1;
            }

            return null;
        };

        const loadPageLinkMap = async (sourcePage: number) => {
            const cached = annotationLinksByPageRef.current.get(sourcePage);
            if (cached) return cached;

            const page = await pdfDocument.getPage(sourcePage);
            const annotations = await page.getAnnotations();
            const map = new Map<string, { dest: unknown; url: string | null; action: string | null }>();

            for (const ann of annotations) {
                if (!ann || ann.subtype !== 'Link') continue;
                map.set(String(ann.id || ''), {
                    dest: (ann as { dest?: unknown }).dest ?? null,
                    url: typeof (ann as { url?: unknown }).url === 'string' ? (ann as { url: string }).url : null,
                    action: typeof (ann as { action?: unknown }).action === 'string' ? (ann as { action: string }).action : null,
                });
            }

            annotationLinksByPageRef.current.set(sourcePage, map);
            return map;
        };

        const getLinkMeta = (
            map: Map<string, { dest: unknown; url: string | null; action: string | null }>,
            annotationId: string
        ) => {
            if (!annotationId) return undefined;
            const exact = map.get(annotationId);
            if (exact) return exact;
            for (const [id, meta] of map.entries()) {
                if (!id) continue;
                if (id.endsWith(annotationId) || annotationId.endsWith(id)) {
                    return meta;
                }
            }
            return undefined;
        };

        const resolveInternalTarget = async (sourcePage: number, annotationId: string, rawHref: string) => {
            const fromHref = parsePageFromHref(rawHref);
            if (fromHref) return fromHref;

            if (!annotationId) return null;

            let linkMeta: { dest: unknown; url: string | null; action: string | null } | undefined;
            try {
                const map = await loadPageLinkMap(sourcePage);
                linkMeta = getLinkMeta(map, annotationId);
            } catch {
                linkMeta = undefined;
            }
            if (!linkMeta) return null;

            if (Array.isArray(linkMeta.dest)) {
                const fromArray = await explicitDestToPageNumber(linkMeta.dest);
                if (fromArray) return fromArray;
            }

            if (typeof linkMeta.dest === 'string') {
                const explicit = await pdfDocument.getDestination(linkMeta.dest).catch(() => null);
                const fromNamedDest = await explicitDestToPageNumber(explicit);
                if (fromNamedDest) return fromNamedDest;

                const fromBrokenName = parseDestNameToPage(linkMeta.dest);
                if (fromBrokenName) return fromBrokenName;
            }

            if (linkMeta.url) {
                const fromUrl = parsePageFromHref(linkMeta.url);
                if (fromUrl) return fromUrl;
            }

            if (linkMeta.action) {
                const action = linkMeta.action.toLowerCase();
                if (action === 'nextpage') return currentPageRef.current + 1;
                if (action === 'prevpage' || action === 'previouspage') return currentPageRef.current - 1;
                if (action === 'firstpage') return 1;
                if (action === 'lastpage') return numPages;
            }

            return null;
        };

        const onClickCapture = (evt: MouseEvent) => {
            const targetNode = evt.target;
            const targetElement = targetNode instanceof Element
                ? targetNode
                : targetNode instanceof Node
                    ? targetNode.parentElement
                    : null;
            if (!targetElement) return;

            const anchor = targetElement.closest('.annotationLayer a') as HTMLAnchorElement | null;
            if (!anchor) return;

            const linkContainer = anchor.closest('[data-internal-link], .linkAnnotation') as HTMLElement | null;
            const rawHref = anchor.getAttribute('href') || '';
            const looksSameDocPageLink = !!parsePageFromHref(rawHref);
            const isInternal = !!linkContainer?.hasAttribute('data-internal-link') || looksSameDocPageLink;
            if (!isInternal) return;

            evt.preventDefault();
            evt.stopPropagation();

            const pageHost = anchor.closest('[data-page]') as HTMLElement | null;
            const sourcePageRaw = Number.parseInt(pageHost?.dataset.page || '', 10);
            const sourcePage = Number.isFinite(sourcePageRaw) && sourcePageRaw > 0 ? sourcePageRaw : currentPageRef.current;

            const annotationId =
                anchor.getAttribute('data-element-id')
                || linkContainer?.getAttribute('data-annotation-id')
                || '';

            void resolveInternalTarget(sourcePage, annotationId, rawHref).then((targetPage) => {
                if (targetPage) {
                    goToPage(targetPage, 'auto');
                    return;
                }

                if (typeof anchor.onclick === 'function') {
                    try {
                        anchor.onclick.call(anchor, evt);
                    } catch {
                        // Ignore.
                    }
                }
            });
        };

        root.addEventListener('click', onClickCapture, true);
        return () => root.removeEventListener('click', onClickCapture, true);
    }, [goToPage, numPages, pdfDocument, report.id]);

    const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

    /* ── keyboard shortcuts ── */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            switch (e.key) {
                case 'ArrowLeft': e.preventDefault(); goToPage(currentPage - 1); break;
                case 'ArrowRight': e.preventDefault(); goToPage(currentPage + 1); break;
                case 'Home': e.preventDefault(); goToPage(1); break;
                case 'End': e.preventDefault(); goToPage(numPages); break;
                case '+': case '=': if (e.ctrlKey || e.metaKey) { e.preventDefault(); setScale((s) => Math.min(3, s + 0.1)); } break;
                case '-': if (e.ctrlKey || e.metaKey) { e.preventDefault(); setScale((s) => Math.max(0.5, s - 0.1)); } break;
                case '0': if (e.ctrlKey || e.metaKey) { e.preventDefault(); setScale(1.2); } break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, numPages, goToPage]);

    /* ── sidebar tab state ── */
    const [sidebarTab, setSidebarTab] = useState<'info' | 'dq' | 'entities'>('info');

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <Helmet>
                <title>{`${report.company} – ${report.publishedYear} Disclosure Quality & Evidence | Sustainability Signals`}</title>
            </Helmet>

            <a href="#report-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-brand-700 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-brand-500 focus:text-sm focus:font-semibold">
                Skip to report content
            </a>

            {/* ── Header bar ── */}
            <header className="sticky top-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800" role="banner">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14 gap-4">
                        {/* Left: back + company info */}
                        <div className="flex items-center gap-3 min-w-0">
                            <Link to="/reports" className="shrink-0 p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" aria-label="Back to Coverage">
                                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </Link>
                            <div className="min-w-0">
                                <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">{report.company}</h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{report.sector} &middot; {report.country} &middot; {report.publishedYear}</p>
                            </div>
                        </div>

                        {/* Right: PDF controls + DQ + Chat toggles */}
                        {currentUrl && numPages > 0 && (
                            <nav aria-label="PDF controls" className="flex items-center gap-2">
                                {/* Page nav */}
                                <div className="hidden sm:flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300" role="group" aria-label="Page navigation">
                                    <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page" className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none">
                                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                    </button>
                                    <span className="font-medium tabular-nums" aria-live="polite" aria-atomic="true"><span className="sr-only">Page </span>{currentPage}<span className="sr-only"> of </span><span aria-hidden="true"> / </span>{numPages}</span>
                                    <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages} aria-label="Next page" className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none">
                                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>

                                {/* Zoom */}
                                <div className="hidden md:flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-2 ml-1" role="group" aria-label="Zoom controls">
                                    <button onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} aria-label="Zoom out" className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none">
                                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                                    </button>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums w-10 text-center" aria-live="polite" aria-atomic="true" aria-label={`Zoom level ${Math.round(scale * 100)} percent`}>{Math.round(scale * 100)}%</span>
                                    <button onClick={() => setScale((s) => Math.min(3, s + 0.1))} aria-label="Zoom in" className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none">
                                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </button>
                                </div>

                                {/* View mode */}
                                <div className="hidden lg:flex items-center gap-0.5 border-l border-gray-200 dark:border-gray-700 pl-2 ml-1" role="radiogroup" aria-label="View mode">
                                    <button onClick={() => setViewMode('scroll')} role="radio" aria-checked={viewMode === 'scroll'} aria-label="Scroll view" className={`p-1.5 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${viewMode === 'scroll' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                    </button>
                                    <button onClick={() => setViewMode('single')} role="radio" aria-checked={viewMode === 'single'} aria-label="Single page view" className={`p-1.5 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${viewMode === 'single' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </button>
                                </div>

                                 <div className="border-l border-gray-200 dark:border-gray-700 pl-2 ml-1" />
 
                                 {/* Entities toggle */}
                                 <button
                                     onClick={() => { setEntitiesOpen(!entitiesOpen); if (!entitiesOpen) setSidebarTab('entities'); }}
                                     className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 border ${entitiesOpen || sidebarTab === 'entities' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                     title="LangExtract Entities"
                                 >
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10" />
                                     </svg>
                                     <span className="font-medium text-sm hidden sm:inline">Entities</span>
                                     {(entitiesLoading || entitiesComputing) ? (
                                         <span className="w-3.5 h-3.5 border-2 border-emerald-200 border-t-emerald-700 dark:border-emerald-800 dark:border-t-emerald-200 rounded-full animate-spin" aria-hidden="true" />
                                     ) : (entitiesData && entitiesData.cached === true && entitiesData.entities) ? (
                                         <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-extrabold border bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40">
                                             {entitiesData.summary?.total_entities ?? entitiesData.entities.length}
                                         </span>
                                     ) : (
                                         <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">&mdash;</span>
                                     )}
                                 </button>

                                 {/* DQ toggle */}
                                 <button
                                     onClick={() => { setDqOpen(!dqOpen); if (!dqOpen) setSidebarTab('dq'); }}
                                     className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 border ${dqOpen || sidebarTab === 'dq' ? 'bg-gray-50 border-gray-200 text-gray-900 dark:bg-gray-900 dark:border-gray-800 dark:text-white' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                     title="Disclosure Quality"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 5-3 9-7 9s-7-4-7-9V7l7-4z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                                    </svg>
                                    <span className="font-medium text-sm hidden sm:inline">Quality</span>
                                    {(dqLoading || dqComputing) ? (
                                        <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 dark:border-gray-600 dark:border-t-gray-200 rounded-full animate-spin" aria-hidden="true" />
                                    ) : dqData ? (
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-extrabold border ${dqBandStyles(dqData.band).pill}`}>{Math.round(dqData.score)}</span>
                                    ) : (
                                        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">&mdash;</span>
                                    )}
                                </button>

                                {/* Chat toggle */}
                                <button
                                    onClick={() => setChatOpen(!chatOpen)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 border ${chatOpen ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/30 dark:border-brand-800 dark:text-brand-400' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                    <span className="font-medium text-sm">Ask AI</span>
                                </button>

                                {/* External link */}
                                <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none" aria-label={`Open ${report.company} PDF in new tab`}>
                                    <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                            </nav>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Main content ── */}
            <div className="flex flex-col lg:flex-row max-w-[1600px] mx-auto relative">
                {/* Sidebar: company metadata + DQ */}
                <aside aria-label="Report details" className="lg:w-80 xl:w-96 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto flex flex-col">
                    {/* Tab switcher */}
                    <div className="flex border-b border-gray-200 dark:border-gray-800 shrink-0">
                        <button onClick={() => setSidebarTab('info')} className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${sidebarTab === 'info' ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            Report Info
                        </button>
                        <button onClick={() => { setSidebarTab('entities'); if (!entitiesOpen) setEntitiesOpen(true); }} className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${sidebarTab === 'entities' ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            Entities
                            {entitiesData && entitiesData.cached === true && entitiesData.entities && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40">
                                    {entitiesData.summary?.total_entities ?? entitiesData.entities.length}
                                </span>
                            )}
                        </button>
                        <button onClick={() => { setSidebarTab('dq'); if (!dqOpen) setDqOpen(true); }} className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${sidebarTab === 'dq' ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            Disclosure Quality
                            {dqData && <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border ${dqBandStyles(dqData.band).pill}`}>{Math.round(dqData.score)}</span>}
                        </button>
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {sidebarTab === 'info' && (
                            <div className="space-y-5">
                                <div>
                                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">{report.company}</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{report.publishedYear} Sustainability Report</p>
                                </div>
                                <dl className="space-y-3 text-sm">
                                    <MetaRow label="Country" value={report.country} />
                                    <MetaRow label="GICS Sector" value={report.sector} />
                                    <MetaRow label="Industry Group" value={report.industry} />
                                    {report.sourceSector && report.sourceSector !== report.sector && <MetaRow label="Source Sector" value={report.sourceSector} />}
                                    {report.sourceIndustry && report.sourceIndustry !== report.industry && <MetaRow label="Source Industry" value={report.sourceIndustry} />}
                                    {numPages > 0 && <MetaRow label="Pages" value={String(numPages)} />}
                                </dl>
                                {currentUrl && (
                                    <a href={currentUrl} target="_blank" rel="noopener noreferrer" aria-label={`Download ${report.company} sustainability report PDF`} className="inline-flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none focus-visible:rounded">
                                        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                                        Download PDF
                                    </a>
                                )}
                            </div>
                        )}

                        {sidebarTab === 'entities' && (
                            <EntityExtractionPanel
                                loading={entitiesLoading}
                                computing={entitiesComputing}
                                error={entitiesError}
                                data={entitiesData}
                                bertLoading={bertLoading}
                                bertError={bertError}
                                bertSummary={bertSummary}
                                canCompute={Boolean(reportKey)}
                                onCompute={() => void computeEntityExtraction()}
                                onRefresh={() => refreshEntitiesNow()}
                                onGoToPage={(p) => goToPage(p, 'auto')}
                            />
                        )}

                        {sidebarTab === 'dq' && (
                            <div className="space-y-5">
                                {dqError && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">{dqError}</div>
                                )}

                                {dqLoading && !dqData ? (
                                    <DQLoadingOverlay isComputing={false} />
                                ) : dqComputing ? (
                                    <DQLoadingOverlay isComputing={true} />
                                ) : dqData ? (
                                    <>
                                        <DisclosureQualityRadar score={dqData.score} band={dqData.band} subscores={dqData.subscores} />

                                        {/* Subscores */}
                                        <div className="space-y-3">
                                            {([
                                                { label: 'Completeness', value: dqData.subscores.completeness, bar: 'from-emerald-500 to-teal-500', desc: 'Breadth and depth of ESG topics covered' },
                                                { label: 'Consistency', value: dqData.subscores.consistency, bar: 'from-sky-500 to-blue-600', desc: 'Methodological rigor, data quality & comparability' },
                                                { label: 'Assurance', value: dqData.subscores.assurance, bar: 'from-amber-500 to-orange-500', desc: 'External verification scope and standards' },
                                                { label: 'Transparency', value: dqData.subscores.transparency ?? 0, bar: 'from-violet-500 to-purple-600', desc: 'Forward-looking disclosures, stakeholder orientation' },
                                            ]).map((row) => (
                                                <div key={row.label} className="rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-3">
                                                    <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                                        <span>{row.label}</span>
                                                        <span className={`font-bold ${Math.round(row.value) >= 75 ? 'text-emerald-600 dark:text-emerald-400' : Math.round(row.value) >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{Math.round(row.value)}/100</span>
                                                    </div>
                                                    <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
                                                        <div className={`h-full bg-gradient-to-r ${row.bar} transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, Math.round(row.value)))}%` }} />
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{row.desc}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* FinBERT-9 topic profile (optional) */}
                                        {dqData.topicProfile && typeof dqData.topicProfile.evidence_blocks_classified === 'number' && dqData.topicProfile.evidence_blocks_classified > 0 ? (
                                            <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-gradient-to-br from-violet-50/60 via-white to-white dark:from-violet-900/10 dark:via-gray-950 dark:to-gray-950 p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-xs font-extrabold text-gray-900 dark:text-white">FinBERT-9 Topic Profile</div>
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/40">
                                                                {dqData.topicProfile.model || 'finbert-esg-9'}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                                                            Classified a sample of evidence blocks: {dqData.topicProfile.esg_relevant_blocks ?? 0} ESG-relevant of {dqData.topicProfile.evidence_blocks_classified} total.
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Pillar breakdown */}
                                                <div className="mt-3 grid grid-cols-3 gap-2">
                                                    {(['E', 'S', 'G'] as const).map((p) => (
                                                        <div key={p} className="rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-2.5 text-center">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${p === 'E'
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40'
                                                                : p === 'S'
                                                                    ? 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/40'
                                                                    : 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/40'
                                                                }`}
                                                            >
                                                                {p}
                                                            </span>
                                                            <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white tabular-nums">{dqData.topicProfile?.by_pillar?.[p] ?? 0}</div>
                                                            <div className="text-[10px] text-gray-400 dark:text-gray-500">blocks</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Category breakdown */}
                                                {dqData.topicProfile.by_category && Object.keys(dqData.topicProfile.by_category).length > 0 ? (
                                                    <details className="mt-3">
                                                        <summary className="cursor-pointer select-none text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                                                            Category breakdown ({Object.keys(dqData.topicProfile.by_category).length} categories)
                                                        </summary>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {Object.entries(dqData.topicProfile.by_category)
                                                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                                                .map(([cat, count]) => (
                                                                    <span key={cat} className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/60 text-[11px] text-gray-700 dark:text-gray-200">
                                                                        <span className="font-semibold">{cat}</span>
                                                                        <span className="text-gray-400 dark:text-gray-500 ml-1">{count as number}</span>
                                                                    </span>
                                                                ))}
                                                        </div>
                                                    </details>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        {/* Recommendations */}
                                        {dqData.recommendations && dqData.recommendations.length > 0 && (
                                            <details className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4" open>
                                                <summary className="cursor-pointer select-none text-xs font-semibold text-amber-800 dark:text-amber-300">Improvement Areas ({dqData.recommendations.length})</summary>
                                                <ul className="mt-2 space-y-1.5">
                                                    {dqData.recommendations.map((rec, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300/80">
                                                            <span className="text-amber-500 mt-0.5 flex-shrink-0">&rarr;</span>
                                                            <span>{rec}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </details>
                                        )}

                                        {/* Signals */}
                                        <div>
                                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">
                                                Signals Found {dqData.featureCount != null && dqData.featureTotal != null && <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({dqData.featureCount}/{dqData.featureTotal} indicators)</span>}
                                            </div>
                                            {SIGNAL_CATEGORIES(dqData.features || {}).map((cat) => {
                                                const foundChips = cat.chips.filter((c) => c.found);
                                                const missingChips = cat.chips.filter((c) => !c.found);
                                                if (foundChips.length === 0 && missingChips.length === 0) return null;
                                                const coveragePct = Math.round((foundChips.length / cat.chips.length) * 100);
                                                const fd = dqData.featureDepth || {};
                                                return (
                                                    <div key={cat.title} className="mb-3">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{cat.title}</div>
                                                            <div className={`text-[10px] font-bold ${coveragePct >= 70 ? 'text-emerald-500' : coveragePct >= 40 ? 'text-amber-500' : 'text-gray-400'}`}>{coveragePct}%</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {foundChips.map((c) => {
                                                                const depth = fd[c.key];
                                                                const depthLabel = depth && depth.pages >= 5 ? '●●●' : depth && depth.pages >= 3 ? '●●' : depth && depth.pages >= 1 ? '●' : '';
                                                                return (
                                                                    <span key={c.label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300" title={depth ? `Found ${depth.occurrences}x across ${depth.pages} page(s)` : undefined}>
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                                        {c.label}
                                                                        {depthLabel && <span className="text-[8px] text-emerald-500 dark:text-emerald-400 ml-0.5">{depthLabel}</span>}
                                                                    </span>
                                                                );
                                                            })}
                                                            {missingChips.map((c) => (
                                                                <span key={c.label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-gray-50 dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-800/40 text-gray-400 dark:text-gray-600">{c.label}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Evidence */}
                                        <details className="rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-4">
                                            <summary className="cursor-pointer select-none text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                                Evidence Highlights
                                                {(dqData.method as Record<string, unknown>)?.evidenceRefinedByAI ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">AI-refined</span> : null}
                                            </summary>
                                            <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-200">
                                                {(() => {
                                                    const ev = dqData.evidence || {};
                                                    const evq = dqData.evidenceQuotes || null;
                                                    const fd = dqData.featureDepth || {};
                                                    const blocks = EVIDENCE_ITEMS.map((it) => {
                                                        const quotesRaw = evq?.[it.key] && Array.isArray(evq[it.key]) ? evq[it.key] : null;
                                                        const quotes = quotesRaw
                                                            ? quotesRaw.map((q) => ({ text: typeof q?.text === 'string' ? q.text : String(q?.text ?? ''), page: typeof q?.page === 'number' && Number.isFinite(q.page) ? q.page : null, heading: typeof q?.heading === 'string' && q.heading.trim() ? q.heading.trim() : null })).filter((q) => q.text.trim().length > 0)
                                                            : (Array.isArray(ev[it.key]) ? ev[it.key] : []).map((sn) => ({ text: typeof sn === 'string' ? sn : String(sn ?? ''), page: null, heading: null })).filter((q) => q.text.trim().length > 0);
                                                        const depth = fd[it.key];
                                                        return { ...it, quotes, depth };
                                                    }).filter((it) => it.quotes.length > 0);

                                                    if (blocks.length === 0) return <div className="text-xs text-gray-500 dark:text-gray-400">No evidence snippets cached for this report yet.</div>;

                                                    const grouped = new Map<string, typeof blocks>();
                                                    for (const b of blocks) { const list = grouped.get(b.category) || []; list.push(b); grouped.set(b.category, list); }

                                                    return Array.from(grouped.entries()).map(([category, items]) => (
                                                        <details key={category} className="group" ref={(el) => { if (el && !evidenceDetailsInitRef.current.has(category)) { evidenceDetailsInitRef.current.add(category); el.open = items.length <= 4; } }}>
                                                            <summary className="cursor-pointer select-none text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                                                                {category} <span className="font-normal text-gray-400">({items.length} signals with evidence)</span>
                                                            </summary>
                                                            <div className="space-y-2.5 mb-3">
                                                                {items.map((b) => (
                                                                    <div key={b.key} className="rounded-lg border border-gray-200/50 dark:border-gray-800/50 overflow-hidden">
                                                                        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/80 dark:bg-gray-900/80 border-b border-gray-200/40 dark:border-gray-800/40">
                                                                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{b.label}</span>
                                                                            {b.depth && <span className="text-[10px] text-gray-400 dark:text-gray-500">{b.depth.occurrences}x found &middot; {b.depth.pages} page{b.depth.pages !== 1 ? 's' : ''}</span>}
                                                                        </div>
                                                                        <div className="p-2 space-y-2">
                                                                            {b.quotes.slice(0, 3).map((q, idx) => {
                                                                                const text = cleanEvidenceText(q.text);
                                                                                const heading = q.heading ? cleanEvidenceText(q.heading) : null;
                                                                                const paras = text.split(/\n{2,}/g).map((p: string) => p.trim()).filter(Boolean);
                                                                                return (
                                                                                    <div key={idx} className="p-2.5 rounded-lg bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800/60 text-xs leading-relaxed break-words">
                                                                                        {(q.page || heading) && (
                                                                                            <div className="flex items-center gap-2 mb-1.5 min-w-0">
                                                                                                {q.page ? (
                                                                                                     <button onClick={() => goToPage(q.page!, 'auto')} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 cursor-pointer transition-colors flex-shrink-0" title={`Navigate to page ${q.page}`}>
                                                                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                                                                                        p.{q.page}
                                                                                                    </button>
                                                                                                ) : null}
                                                                                                {heading ? <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 truncate">{heading}</span> : null}
                                                                                            </div>
                                                                                        )}
                                                                                        {(paras.length ? paras : [text]).map((p: string, pi: number) => (
                                                                                            <p key={pi} className={`whitespace-pre-wrap text-gray-600 dark:text-gray-300 ${pi ? 'mt-1.5' : ''}`}>{p}</p>
                                                                                        ))}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    ));
                                                })()}
                                            </div>
                                        </details>

                                        {/* About */}
                                        <div className="rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/50 p-4 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed space-y-1.5">
                                            <p className="font-semibold text-gray-600 dark:text-gray-300">About this score</p>
                                            <p>Disclosure Quality is computed from 60+ pattern-based indicators found in the report text (v4.1, rule-based). It measures reporting completeness, methodological consistency, transparency, and external assurance — not the underlying truth of claims. Evidence highlights are refined via Cloudflare Workers AI.</p>
                                            <p className="font-medium">Weights: Completeness 35% · Consistency 25% · Assurance 20% · Transparency 20%</p>
                                            {dqData.featureCount != null && dqData.featureTotal != null && <p>{dqData.featureCount} of {dqData.featureTotal} indicators detected. Depth indicators (●) show how many pages each signal appears on.</p>}
                                        </div>
                                    </>
                                ) : (
                                    /* Not scored yet */
                                    <div className="rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-950 p-5">
                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Not scored yet</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">Generate a score for this report. The first run may take longer if the PDF needs to be converted to text.</div>
                                        <div className="mt-4 flex items-center gap-2">
                                            <button
                                                onClick={() => void computeDisclosureQuality()}
                                                disabled={dqComputing || !reportKey}
                                                className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {dqComputing ? 'Computing...' : 'Compute Score'}
                                            </button>
                                            <button
                                                onClick={() => { const controller = new AbortController(); setDqLoading(true); setDqError(null); void refreshDisclosureQuality(controller.signal).catch((e) => setDqError(e instanceof Error ? e.message : String(e))).finally(() => setDqLoading(false)); }}
                                                className="px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                            >
                                                Refresh
                                            </button>
                                        </div>
                                        {!reportKey && <div className="mt-3 text-xs text-red-600 dark:text-red-400">Missing report key. Please reopen the report.</div>}
                                    </div>
                                )}

                                {/* DQ Footer */}
                                <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800/60">
                                    <button
                                        onClick={() => { const controller = new AbortController(); setDqLoading(true); setDqError(null); void refreshDisclosureQuality(controller.signal).catch((e) => setDqError(e instanceof Error ? e.message : String(e))).finally(() => setDqLoading(false)); }}
                                        className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                                    >
                                        Refresh
                                    </button>
                                    {dqData?.generatedAt && <div className="text-[11px] text-gray-500 dark:text-gray-400">Updated {fmtShortDate(dqData.generatedAt)}</div>}
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* PDF viewer */}
                <main id="report-content" className="flex-1 min-w-0" aria-label={`${report.company} disclosure viewer`}>
                    {!currentUrl ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500" role="status">
                            <svg aria-hidden="true" className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-sm font-medium">PDF not available for this report</p>
                        </div>
                    ) : (
                        <div
                            ref={viewerRef}
                            className="overflow-auto bg-gray-100 dark:bg-gray-950"
                            style={{ height: 'calc(100vh - 3.5rem)' }}
                        >
                            <Document
                                key={`${report.id}:${docMode}:${docKey}`}
                                file={currentUrl}
                                options={documentOptions}
                                onItemClick={onDocumentItemClick}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading={null}
                                error={null}
                                className="flex flex-col items-center py-4 gap-4"
                            >
                                {loading && (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3" role="status" aria-live="polite">
                                        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" aria-hidden="true" />
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading report&hellip;</p>
                                    </div>
                                )}
                                {error && (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6" role="alert">
                                        <svg aria-hidden="true" className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Failed to load PDF</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">{error}</p>
                                        <div className="mt-4 flex items-center gap-2">
                                            <button
                                                onClick={retryLoad}
                                                className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                                            >
                                                Retry
                                            </button>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {docMode === 'full' ? 'Tried full download mode.' : 'Tried range mode.'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {!loading && !error && viewMode === 'scroll' && pages.map((p) => {
                                    const shouldRender = Math.abs(p - currentPage) <= 4;

                                    const placeholder = (
                                        <div
                                            style={{ width: pageWidth, height: estimatedPageHeight }}
                                            className="bg-white shadow-lg rounded-sm overflow-hidden border border-gray-200/70 dark:border-gray-800/60 flex items-center justify-center"
                                        >
                                            <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                                Page {p}
                                            </div>
                                        </div>
                                    );

                                    return (
                                        <div
                                            key={p}
                                            ref={(el) => {
                                                if (el) pageContainerRefs.current.set(p, el);
                                                else pageContainerRefs.current.delete(p);
                                            }}
                                            data-page={p}
                                            role="region"
                                            aria-label={`Page ${p} of ${numPages}`}
                                            className="w-full flex justify-center"
                                            style={{ minHeight: estimatedPageHeight }}
                                        >
                                            {shouldRender ? (
                                                <Page
                                                    pageNumber={p}
                                                    width={pageWidth}
                                                    className="shadow-lg rounded-sm overflow-hidden bg-white"
                                                    renderAnnotationLayer
                                                    renderTextLayer
                                                    loading={placeholder}
                                                    error={
                                                        <div
                                                            style={{ width: pageWidth, height: estimatedPageHeight }}
                                                            className="bg-white shadow-lg rounded-sm overflow-hidden border border-red-200 dark:border-red-900/30 flex items-center justify-center"
                                                        >
                                                            <div className="text-xs text-red-700 dark:text-red-300 font-semibold">
                                                                Failed to render page {p}
                                                            </div>
                                                        </div>
                                                    }
                                                />
                                            ) : (
                                                placeholder
                                            )}
                                        </div>
                                    );
                                })}
                                {!loading && !error && viewMode === 'single' && (
                                    <div
                                        role="region"
                                        aria-label={`Page ${currentPage} of ${numPages}`}
                                        className="w-full flex justify-center"
                                        style={{ minHeight: estimatedPageHeight }}
                                    >
                                        <Page
                                            key={currentPage}
                                            pageNumber={currentPage}
                                            width={pageWidth}
                                            className="shadow-lg rounded-sm overflow-hidden bg-white"
                                            renderAnnotationLayer
                                            renderTextLayer
                                            loading={
                                                <div
                                                    style={{ width: pageWidth, height: estimatedPageHeight }}
                                                    className="bg-white shadow-lg rounded-sm overflow-hidden border border-gray-200/70 dark:border-gray-800/60 flex items-center justify-center"
                                                >
                                                    <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                                        Loading page {currentPage}...
                                                    </div>
                                                </div>
                                            }
                                            error={
                                                <div
                                                    style={{ width: pageWidth, height: estimatedPageHeight }}
                                                    className="bg-white shadow-lg rounded-sm overflow-hidden border border-red-200 dark:border-red-900/30 flex items-center justify-center"
                                                >
                                                    <div className="text-xs text-red-700 dark:text-red-300 font-semibold">
                                                        Failed to render page {currentPage}
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </div>
                                )}
                            </Document>
                        </div>
                    )}
                </main>

                {/* Chat Sidebar */}
                <ChatSidebar
                    isOpen={chatOpen}
                    onToggle={() => setChatOpen(!chatOpen)}
                    onClearHistory={() => setMessages([])}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isLoading={isLoadingChat}
                />
            </div>
        </div>
    );
}

/* ── tiny helper ── */
function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
            <dd className="text-gray-900 dark:text-white font-medium text-right m-0">{value}</dd>
        </div>
    );
}
