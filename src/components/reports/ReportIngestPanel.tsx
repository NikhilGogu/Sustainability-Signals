import { useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import type { UploadedReport, ReportSuggestionResponse, MetadataSuggestion } from '../../utils/uploadedReports';
import { requestMetadataSuggestion, finalizeIngest } from '../../utils/uploadedReports';

interface ReportIngestPanelProps {
  onIngested: (report: UploadedReport) => void;
}

function fmtConfidence(v?: number | null): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'n/a';
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
}

function toInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function confidenceBarClass(conf?: number) {
  if (typeof conf !== 'number' || !Number.isFinite(conf)) return 'from-gray-300 to-gray-200';
  if (conf >= 0.75) return 'from-emerald-500 to-teal-500';
  if (conf >= 0.55) return 'from-amber-500 to-orange-500';
  return 'from-rose-500 to-red-500';
}

export function ReportIngestPanel({ onIngested }: ReportIngestPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ReportSuggestionResponse | null>(null);
  const [metadata, setMetadata] = useState<MetadataSuggestion | null>(null);
  const [isFullReport, setIsFullReport] = useState(false);
  const [pageStart, setPageStart] = useState<string>('1');
  const [pageEnd, setPageEnd] = useState<string>('1');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const canFinalize = Boolean(
    suggestion?.token &&
      metadata &&
      metadata.company.trim() &&
      Number.isFinite(metadata.publishedYear) &&
      confirmed &&
      !submitting
  );

  const draftConfidence = useMemo(
    () => suggestion?.metadataSuggestion?.confidence ?? suggestion?.classifier?.confidence ?? null,
    [suggestion]
  );

  const onSelectFile = async (file: File) => {
    setSelectedFile(file);
    setLoadingSuggestion(true);
    setSuggestionError(null);
    setSuggestion(null);
    setMetadata(null);
    setSubmitError(null);
    setSuccessMsg(null);
    setConfirmed(false);

    try {
      const resp = await requestMetadataSuggestion(file);
      setSuggestion(resp);
      setMetadata(resp.metadataSuggestion);
      setIsFullReport(Boolean(resp.inferredFullUpload));
      setPageStart(String(resp.suggestedRange?.start ?? 1));
      setPageEnd(String(resp.suggestedRange?.end ?? Math.max(resp.suggestedRange?.start ?? 1, 1)));
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void onSelectFile(file);
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void onSelectFile(file);
  };

  const updateMeta = <K extends keyof MetadataSuggestion>(key: K, value: MetadataSuggestion[K]) => {
    setMetadata((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
  };

  const onFinalize = async () => {
    if (!suggestion?.token || !metadata) return;
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);

    try {
      const report = await finalizeIngest({
        stageToken: suggestion.token,
        metadata: {
          ...metadata,
          publishedYear: Math.trunc(Number(metadata.publishedYear)),
        },
        metadataConfirmed: true,
        options: {
          isFullReport,
          pageStart: toInt(pageStart, suggestion.suggestedRange?.start ?? 1),
          pageEnd: toInt(pageEnd, suggestion.suggestedRange?.end ?? toInt(pageStart, 1)),
        },
      });
      onIngested(report);
      setSuccessMsg(`${report.company} (${report.publishedYear}) ingested successfully.`);
      setConfirmed(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-gray-950/70 backdrop-blur-md p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ingest New Report</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Drop a PDF to get AI-generated metadata + section range suggestions, then finalize before storage.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Select PDF
        </Button>
      </div>

      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFileChange} />

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDrop={onDrop}
        className={`mt-4 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragActive
            ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-900/20'
            : 'border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40'
        }`}
      >
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {selectedFile ? selectedFile.name : 'Drag & drop sustainability PDF here'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          PDF only. Max file size follows backend policy.
        </p>
      </div>

      {loadingSuggestion && (
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">Analyzing PDF with Workers AI...</div>
      )}
      {suggestionError && (
        <div className="mt-4 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/40 rounded-lg p-3">
          {suggestionError}
        </div>
      )}

      {suggestion && metadata && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/70 p-3 bg-gray-50/70 dark:bg-gray-900/40">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">AI Draft Confidence</div>
              <div className="text-xs font-semibold text-gray-900 dark:text-white">{fmtConfidence(draftConfidence)}</div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${confidenceBarClass(
                  typeof draftConfidence === 'number' ? draftConfidence : undefined
                )}`}
                style={{ width: typeof draftConfidence === 'number' ? `${Math.round(Math.max(0, Math.min(1, draftConfidence)) * 100)}%` : '42%' }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-full border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                Type: {suggestion.classifier?.reportType || 'unknown'}
              </span>
              <span
                className={`px-2 py-1 rounded-full border ${
                  suggestion.isSustainabilityReport
                    ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700/50 dark:text-emerald-300'
                    : 'border-rose-300 text-rose-700 dark:border-rose-700/50 dark:text-rose-300'
                }`}
              >
                Sustainability check: {suggestion.isSustainabilityReport ? 'pass' : 'review'}
              </span>
              {suggestion.duplicateCheck?.duplicateLikely ? (
                <span className="px-2 py-1 rounded-full border border-amber-300 text-amber-700 dark:border-amber-700/50 dark:text-amber-300">
                  Potential duplicate detected
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full border border-sky-300 text-sky-700 dark:border-sky-700/50 dark:text-sky-300">
                  No duplicate signal
                </span>
              )}
            </div>
            {suggestion.duplicateCheck?.existingCompanyYear && suggestion.duplicateCheck?.existingRoute && (
              <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                Existing coverage found:{' '}
                <a
                  href={suggestion.duplicateCheck.existingRoute}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:no-underline"
                >
                  {suggestion.duplicateCheck.existingRoute}
                </a>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Company
              <input
                value={metadata.company}
                onChange={(e) => updateMeta('company', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Published Year
              <input
                type="number"
                min={2000}
                max={2100}
                value={metadata.publishedYear}
                onChange={(e) => updateMeta('publishedYear', Number.parseInt(e.target.value, 10))}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Country
              <input
                value={metadata.country}
                onChange={(e) => updateMeta('country', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              GICS Sector
              <input
                value={metadata.sector}
                onChange={(e) => updateMeta('sector', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              GICS Industry Group
              <input
                value={metadata.industry}
                onChange={(e) => updateMeta('industry', e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Upload Mode
              <select
                value={isFullReport ? 'full' : 'section'}
                onChange={(e) => setIsFullReport(e.target.value === 'full')}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="full">Full annual report (extract sustainability pages)</option>
                <option value="section">Sustainability section already isolated</option>
              </select>
            </label>
          </div>

          {isFullReport && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Suggested Start Page
                <input
                  type="number"
                  min={1}
                  value={pageStart}
                  onChange={(e) => setPageStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Suggested End Page
                <input
                  type="number"
                  min={1}
                  value={pageEnd}
                  onChange={(e) => setPageEnd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </label>
            </div>
          )}

          <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I reviewed and confirm this metadata. Finalize only after verification.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={() => void onFinalize()} disabled={!canFinalize}>
              {submitting ? 'Finalizing...' : 'Finalize & Ingest'}
            </Button>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Token expires {new Date(suggestion.expiresAt).toLocaleString()}
            </div>
          </div>

          {submitError && (
            <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/40 rounded-lg p-3">
              {submitError}
            </div>
          )}
          {successMsg && (
            <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/40 rounded-lg p-3">
              {successMsg}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
