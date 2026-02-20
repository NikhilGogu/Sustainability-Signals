import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Seo } from '../components/seo';
import { Button, PageHero } from '../components/ui';
import {
  AdminAnalytics,
  AdminBatchPanel,
  AdminDepthAnalysis,
  AdminDiagnostics,
  AdminReportsTable,
} from '../components/admin';
import type {
  AdminReport,
  AdminTab,
  DQEntry,
  DQFilterValue,
  DQSettings,
  EntityFilterValue,
  EntityStatus,
  RunErrorRow,
  RunProgress,
} from '../components/admin/admin-types';
import {
  BATCH_ENDPOINT_LIMIT,
  DEFAULT_SETTINGS,
  DQ_SETTINGS_STORAGE,
  EMPTY_PROGRESS,
  clampInt,
  emptyEntry,
  fetchWithRetry,
  hasNumericScore,
  mergeReports,
  normalizeSearchText,
  parseHttpError,
  reportSearchBlob,
  runPool,
  sleep,
  splitChunks,
  toNum,
  toScore,
} from '../components/admin/admin-utils';
import type { UploadedReport } from '../utils/uploadedReports';
import {
  deleteUploadedReport,
  fetchUploadedReports,
} from '../utils/uploadedReports';

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'reports',
    label: 'Reports',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="12" height="12" rx="2" />
        <path d="M2 6h12M6 6v8" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 13V8M7 13V5M11 13V3M15 13V7" />
      </svg>
    ),
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="5" />
        <path d="M8 5v3l2 2" />
      </svg>
    ),
  },
  {
    id: 'depth-analysis',
    label: 'Depth Analysis',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 14l4-5 3 3 5-8" />
        <path d="M10 3h4v4" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Login gate constants                                               */
/* ------------------------------------------------------------------ */

const ADMIN_SESSION_KEY = 'ss_admin_authenticated';

// SHA-256 hash of the admin password, injected at build time via VITE_ADMIN_PASSWORD_HASH.
// Generate with: echo -n 'yourpassword' | sha256sum
const ADMIN_PASSWORD_HASH = (import.meta.env.VITE_ADMIN_PASSWORD_HASH || '').trim();

async function verifyPassword(input: string): Promise<boolean> {
  if (!ADMIN_PASSWORD_HASH) return false;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex === ADMIN_PASSWORD_HASH.toLowerCase();
}

/* ------------------------------------------------------------------ */
/*  Login screen                                                       */
/* ------------------------------------------------------------------ */

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = await verifyPassword(value);
    if (valid) {
      try { sessionStorage.setItem(ADMIN_SESSION_KEY, '1'); } catch { /* no-op */ }
      onSuccess();
    } else {
      setError(true);
      setValue('');
      inputRef.current?.focus();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-brand-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-brand-950/20 px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-3xl border border-gray-200/60 dark:border-gray-800/60 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-2xl shadow-gray-200/50 dark:shadow-black/40 p-8">

          {/* Logo / Icon */}
          <div className="mb-7 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 dark:from-brand-600 dark:to-brand-800 shadow-lg shadow-brand-500/30 dark:shadow-brand-700/30 mb-5">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7a4.5 4.5 0 00-9 0v3.5M5 10.5h14a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0119 21.5H5a1.5 1.5 0 01-1.5-1.5v-8A1.5 1.5 0 015 10.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Admin Console</h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 font-medium">Sustainability Signals</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPw ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setError(false); }}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800/60 transition-all outline-none focus:ring-2 ${
                    error
                      ? 'border-rose-400 dark:border-rose-600 ring-2 ring-rose-400/40 dark:ring-rose-600/40'
                      : 'border-gray-200 dark:border-gray-700 focus:border-brand-400 dark:focus:border-brand-500 focus:ring-brand-400/20 dark:focus:ring-brand-500/20'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {error && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Incorrect password. Try again.
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!value}
              className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 transition-all shadow-md shadow-brand-600/20 hover:shadow-brand-500/30 active:scale-[0.98]"
            >
              Sign in
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-5 text-center text-xs text-gray-400 dark:text-gray-600">
          Access restricted to authorized administrators
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Admin() {
  /* ---- Session auth gate ---- */
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'; } catch { return false; }
  });

  if (!authenticated) {
    return <AdminLogin onSuccess={() => setAuthenticated(true)} />;
  }

  return <AdminInner />;
}

/* ------------------------------------------------------------------ */
/*  Inner component (only renders once authenticated)                 */
/* ------------------------------------------------------------------ */

function AdminInner() {
  /* ---- DQ settings ---- */
  const [dqSettings, setDqSettings] = useState<DQSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const raw = sessionStorage.getItem(DQ_SETTINGS_STORAGE);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw) as Partial<DQSettings>;
      const next: DQSettings = {
        version: clampInt(toNum(parsed.version) ?? DEFAULT_SETTINGS.version, DEFAULT_SETTINGS.version, 1, 10),
        concurrency: clampInt(toNum(parsed.concurrency) ?? DEFAULT_SETTINGS.concurrency, DEFAULT_SETTINGS.concurrency, 1, 12),
        limit: clampInt(toNum(parsed.limit) ?? DEFAULT_SETTINGS.limit, DEFAULT_SETTINGS.limit, 1, 2000),
        skipCached: parsed.skipCached === undefined ? DEFAULT_SETTINGS.skipCached : Boolean(parsed.skipCached),
        forceRecompute: parsed.forceRecompute === undefined ? DEFAULT_SETTINGS.forceRecompute : Boolean(parsed.forceRecompute),
      };
      if (next.forceRecompute) next.skipCached = false;
      return next;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  /* ---- Core state ---- */
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dqById, setDqById] = useState<Record<string, DQEntry>>({});
  const [run, setRun] = useState<RunProgress>({ ...EMPTY_PROGRESS });
  const [runInfo, setRunInfo] = useState<string | null>(null);
  const [runErrors, setRunErrors] = useState<RunErrorRow[]>([]);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailComputingId, setDetailComputingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<string | null>(null);

  /* ---- Entity status + DQ/Entity filters ---- */
  const [entityById, setEntityById] = useState<Record<string, EntityStatus>>({});
  const [dqFilter, setDqFilter] = useState<DQFilterValue>('all');
  const [entityFilter, setEntityFilter] = useState<EntityFilterValue>('all');

  const runTokenRef = useRef(0);
  const controllersRef = useRef<Set<AbortController>>(new Set());

  /* ---- Persist settings ---- */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(DQ_SETTINGS_STORAGE, JSON.stringify(dqSettings));
    } catch {
      // no-op
    }
  }, [dqSettings]);

  /* ---- Cleanup on unmount ---- */
  useEffect(() => {
    const ctrls = controllersRef.current;
    return () => {
      runTokenRef.current += 1;
      for (const c of ctrls) c.abort();
      ctrls.clear();
    };
  }, []);

  /* ---- Refresh reports ---- */
  const refreshReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    let uploaded: UploadedReport[] = [];
    let uploadError: string | null = null;

    try {
      uploaded = await fetchUploadedReports({ all: true, limit: 1000 });
    } catch (err) {
      uploadError = err instanceof Error ? err.message : String(err);
    }

    const next = mergeReports(uploaded);
    setReports(next);

    const validIds = new Set(next.map((r) => r.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
    setActiveDetailId((prev) => (prev && validIds.has(prev) ? prev : null));
    setDqById((prev) => {
      const out: Record<string, DQEntry> = {};
      for (const [id, entry] of Object.entries(prev)) {
        if (validIds.has(id)) out[id] = entry;
      }
      return out;
    });

    if (uploadError) {
      setLoadError(`Could not load uploaded reports (${uploadError}). Loaded index reports only.`);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshReports();
  }, [refreshReports]);

  /* ---- Fetch entity extraction cache status ---- */
  useEffect(() => {
    if (reports.length === 0) return;
    const ctrl = new AbortController();

    (async () => {
      const ids = reports.map((r) => r.id);
      const BATCH = 200;
      const map: Record<string, EntityStatus> = {};

      for (let i = 0; i < ids.length; i += BATCH) {
        if (ctrl.signal.aborted) return;
        const batch = ids.slice(i, i + BATCH);
        try {
          const res = await fetch('/score/entity-extract-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportIds: batch }),
            signal: ctrl.signal,
          });
          if (!res.ok) continue;
          const payload = (await res.json()) as { results?: Record<string, boolean> };
          const results = payload.results ?? {};
          for (const id of batch) {
            map[id] = results[id] ? 'done' : 'none';
          }
        } catch {
          // skip
        }
      }

      if (!ctrl.signal.aborted) setEntityById(map);
    })();

    return () => { ctrl.abort(); };
  }, [reports]);

  /* ---- Search / filtering ---- */
  const searchTokens = useMemo(() => {
    const normalized = normalizeSearchText(searchQuery);
    if (!normalized) return [];
    return normalized.split(/\s+/).filter(Boolean);
  }, [searchQuery]);

  const filtered = useMemo(() => {
    let result = searchTokens.length === 0 ? reports : reports.filter((r) => {
      const haystack = reportSearchBlob(r);
      return searchTokens.every((t) => haystack.includes(t));
    });

    // DQ filter
    if (dqFilter !== 'all') {
      result = result.filter((r) => {
        const entry = dqById[r.id];
        const scored = entry?.summary && typeof entry.summary.score === 'number';
        if (dqFilter === 'scored') return scored;
        return !scored;
      });
    }

    // Entity filter
    if (entityFilter !== 'all') {
      result = result.filter((r) => {
        const es = entityById[r.id] ?? 'unknown';
        if (entityFilter === 'done') return es === 'done';
        return es !== 'done';
      });
    }

    return result;
  }, [reports, searchTokens, dqFilter, entityFilter, dqById, entityById]);

  /* ---- Selection ---- */
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedReports = useMemo(
    () => reports.filter((r) => selectedSet.has(r.id)),
    [reports, selectedSet],
  );

  const allFilteredSelected = useMemo(
    () => filtered.length > 0 && filtered.every((r) => selectedSet.has(r.id)),
    [filtered, selectedSet],
  );

  /* ---- Run scope ---- */
  const runScopeBase = selectedReports.length > 0 ? selectedReports : filtered;
  const runScope = useMemo(() => {
    const limit = clampInt(dqSettings.limit, DEFAULT_SETTINGS.limit, 1, 2000);
    return runScopeBase.slice(0, limit);
  }, [dqSettings.limit, runScopeBase]);

  const runScopeLabel = selectedReports.length > 0 ? 'selected' : 'filtered';

  /* ---- Scored summary ---- */
  const scoredRows = useMemo(
    () =>
      runScope.flatMap((r) => {
        const entry = dqById[r.id];
        const summary = entry?.summary;
        if (!hasNumericScore(summary)) return [];
        return [{ report: r, summary, detail: entry?.detail ?? null }];
      }),
    [dqById, runScope],
  );

  const missingDetailCount = useMemo(
    () => scoredRows.filter((r) => r.detail === null).length,
    [scoredRows],
  );

  /* ---- Callbacks ---- */
  const toggleSelectReport = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleSelectFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const fSet = new Set(filtered.map((r) => r.id));
      const isAll = filtered.every((r) => prev.includes(r.id));
      if (isAll) return prev.filter((id) => !fSet.has(id));
      const next = new Set(prev);
      for (const r of filtered) next.add(r.id);
      return Array.from(next);
    });
  }, [filtered]);

  const clearResults = useCallback(() => {
    if (run.running) return;
    setDqById({});
    setRun({ ...EMPTY_PROGRESS });
    setRunErrors([]);
    setRunInfo(null);
    setDetailError(null);
    setActiveDetailId(null);
  }, [run.running]);

  const stopRun = useCallback(() => {
    runTokenRef.current += 1;
    for (const c of controllersRef.current) c.abort();
    controllersRef.current.clear();
    setRun((prev) => ({
      ...prev,
      running: false,
      cancelled: true,
      finishedAt: new Date().toISOString(),
      currentReportId: null,
    }));
    setRunInfo('Batch run stopped.');
  }, []);

  /* ---- Run batch ---- */
  const runBatch = useCallback(async () => {
    const targets = runScope.filter((r) => r.reportKey?.trim());
    if (targets.length === 0) {
      setRunInfo('No reports in the current run scope.');
      return;
    }

    const token = runTokenRef.current + 1;
    runTokenRef.current = token;
    for (const c of controllersRef.current) c.abort();
    controllersRef.current.clear();

    setRunInfo(null);
    setRunErrors([]);
    setDetailError(null);

    setRun({
      running: true,
      total: targets.length,
      completed: 0,
      queued: targets.length,
      cachedHits: 0,
      success: 0,
      errors: 0,
      cancelled: false,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      currentReportId: null,
    });

    setDqById((prev) => {
      const next = { ...prev };
      for (const r of targets) {
        const row = next[r.id] ?? emptyEntry();
        next[r.id] = { ...row, status: 'queued', error: null, updatedAt: new Date().toISOString() };
      }
      return next;
    });

    let completed = 0;
    let cachedHits = 0;
    let success = 0;
    let errors = 0;
    let queue = targets;

    try {
      // ---- Cache pre-check ----
      if (dqSettings.skipCached && !dqSettings.forceRecompute) {
        const reportById = new Map(targets.map((r) => [r.id, r]));
        const cachedIds = new Set<string>();
        const cachedScores: Record<string, ReturnType<typeof toScore>> = {};

        for (const chunk of splitChunks(targets.map((r) => r.id), BATCH_ENDPOINT_LIMIT)) {
          if (token !== runTokenRef.current) return;
          const ctrl = new AbortController();
          controllersRef.current.add(ctrl);

          let results: Record<string, unknown> = {};
          try {
            const res = await fetchWithRetry(
              '/score/disclosure-quality-batch',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportIds: chunk, version: dqSettings.version, summaryOnly: true }),
              },
              { retries: 3, baseDelayMs: 2000, timeoutMs: 30_000, signal: ctrl.signal },
            );
            if (!res.ok) throw new Error(await parseHttpError(res));
            const payload = (await res.json()) as { results?: unknown };
            const obj = payload.results;
            results = (obj && typeof obj === 'object' ? obj : {}) as Record<string, unknown>;
          } finally {
            controllersRef.current.delete(ctrl);
          }

          for (const id of chunk) {
            const report = reportById.get(id);
            if (!report) continue;
            const score = toScore(results[id], report);
            if (!score) continue;
            cachedIds.add(id);
            cachedScores[id] = score;
          }
        }

        if (token !== runTokenRef.current) return;

        queue = targets.filter((r) => !cachedIds.has(r.id));
        cachedHits = cachedIds.size;
        completed = cachedHits;

        setDqById((prev) => {
          const next = { ...prev };
          for (const [id, score] of Object.entries(cachedScores)) {
            if (!score) continue;
            const row = next[id] ?? emptyEntry();
            next[id] = { ...row, status: 'cached', summary: score, error: null, updatedAt: new Date().toISOString() };
          }
          return next;
        });

        setRun((prev) => ({ ...prev, completed, cachedHits, queued: queue.length }));
      }

      if (token !== runTokenRef.current) return;

      // ---- Concurrent scoring ----
      const concurrency = clampInt(dqSettings.concurrency, DEFAULT_SETTINGS.concurrency, 1, 12);

      // Circuit breaker: halt batch after too many consecutive errors
      const CIRCUIT_BREAKER_THRESHOLD = 5;
      let consecutiveErrors = 0;

      await runPool(queue, concurrency, async (report, index) => {
        if (token !== runTokenRef.current) return;

        // Circuit breaker: too many consecutive errors → stop processing
        if (consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
          if (token === runTokenRef.current) {
            completed += 1;
            errors += 1;
            setDqById((prev) => {
              const row = prev[report.id] ?? emptyEntry();
              return { ...prev, [report.id]: { ...row, status: 'error', error: 'Skipped (circuit breaker: too many consecutive errors)', updatedAt: new Date().toISOString() } };
            });
            setRun((prev) => ({ ...prev, completed, cachedHits, success, errors }));
          }
          return;
        }

        // Inter-request delay — increase delay after errors to reduce pressure
        const baseDelay = 800;
        const errorDelay = consecutiveErrors > 0 ? Math.min(consecutiveErrors * 1500, 8000) : 0;
        if (index > 0) await sleep(baseDelay + errorDelay);

        setRun((prev) => ({ ...prev, currentReportId: report.id }));
        setDqById((prev) => {
          const row = prev[report.id] ?? emptyEntry();
          return { ...prev, [report.id]: { ...row, status: 'running', error: null, updatedAt: new Date().toISOString() } };
        });

        const ctrl = new AbortController();
        controllersRef.current.add(ctrl);

        try {
          const res = await fetchWithRetry(
            '/score/disclosure-quality',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                meta: {
                  reportId: report.id,
                  reportKey: report.reportKey,
                  company: report.company,
                  publishedYear: report.publishedYear,
                },
                options: {
                  version: dqSettings.version,
                  force: dqSettings.forceRecompute,
                  store: true,
                },
              }),
            },
            { retries: 2, baseDelayMs: 3000, timeoutMs: 180_000, signal: ctrl.signal },
          );
          if (!res.ok) throw new Error(await parseHttpError(res));

          const payload = (await res.json()) as unknown;
          const score = toScore(payload, report);
          if (!score) throw new Error(`Invalid score payload for ${report.id}`);

          success += 1;
          completed += 1;
          consecutiveErrors = 0; // Reset circuit breaker on success

          setDqById((prev) => {
            const row = prev[report.id] ?? emptyEntry();
            return {
              ...prev,
              [report.id]: { ...row, status: 'computed', summary: score, detail: score, error: null, updatedAt: new Date().toISOString() },
            };
          });
        } catch (err) {
          if (ctrl.signal.aborted || token !== runTokenRef.current) return;
          errors += 1;
          completed += 1;
          consecutiveErrors += 1;
          const isAbort = err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError');
          const msg = isAbort
            ? `Request timed out for ${report.company || report.id}`
            : err instanceof Error ? err.message : String(err);
          setDqById((prev) => {
            const row = prev[report.id] ?? emptyEntry();
            return { ...prev, [report.id]: { ...row, status: 'error', error: msg, updatedAt: new Date().toISOString() } };
          });
          setRunErrors((prev) => [...prev, { reportId: report.id, company: report.company, message: msg }].slice(-40));
        } finally {
          controllersRef.current.delete(ctrl);
          if (token === runTokenRef.current) {
            setRun((prev) => ({ ...prev, completed, cachedHits, success, errors }));
          }
        }
      });

      if (token !== runTokenRef.current) return;
      setRun((prev) => ({ ...prev, running: false, finishedAt: new Date().toISOString(), currentReportId: null }));

      if (consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
        setRunInfo(`Batch halted: ${CIRCUIT_BREAKER_THRESHOLD} consecutive errors (circuit breaker). ${errors} total error(s), ${success} scored.`);
      } else if (errors > 0) {
        setRunInfo(`Batch finished with ${errors} error(s).`);
      } else if (cachedHits > 0 && success === 0) {
        setRunInfo('All reports already had cached scores.');
      } else {
        setRunInfo('Batch finished successfully.');
      }
    } catch (err) {
      if (token !== runTokenRef.current) return;
      setRun((prev) => ({ ...prev, running: false, finishedAt: new Date().toISOString(), currentReportId: null }));
      setRunInfo(err instanceof Error ? err.message : String(err));
    }
  }, [dqSettings, runScope]);

  /* ---- Load detail (auto-computes if not cached) ---- */
  const loadDetail = useCallback(
    async (report: AdminReport) => {
      setActiveDetailId(report.id);
      setDetailError(null);

      const cached = dqById[report.id]?.detail;
      if (cached) return;

      setDetailLoadingId(report.id);
      const ctrl = new AbortController();
      controllersRef.current.add(ctrl);

      try {
        /* ---- Step 1: try to GET the cached score ---- */
        // refine=1 triggers AI evidence refinement + FinBERT topic profiling server-side,
        // which can take 60-90s — use a generous timeout to avoid false timeouts.
        const url = `/score/disclosure-quality?reportId=${encodeURIComponent(report.id)}&version=${dqSettings.version}&refine=1&_ts=${Date.now()}`;
        const getRes = await fetchWithRetry(
          url,
          { method: 'GET', cache: 'no-store' },
          { retries: 2, baseDelayMs: 2000, timeoutMs: 120_000, signal: ctrl.signal },
        );

        if (getRes.ok) {
          /* Cached score found — use it */
          const payload = (await getRes.json()) as unknown;
          const score = toScore(payload, report);
          if (!score) throw new Error(`Detailed score is unavailable for ${report.id}`);

          setDqById((prev) => {
            const row = prev[report.id] ?? emptyEntry();
            return {
              ...prev,
              [report.id]: {
                ...row,
                status: 'cached',
                summary: score,
                detail: score,
                error: null,
                updatedAt: new Date().toISOString(),
              },
            };
          });
          return;
        }

        /* ---- Step 2: not cached (404) — auto-compute via POST ---- */
        if (getRes.status !== 404) {
          throw new Error(await parseHttpError(getRes));
        }

        if (!report.reportKey?.trim()) {
          throw new Error('Report has no PDF key — cannot compute DQ score.');
        }

        /* Show computing state */
        setDetailComputingId(report.id);
        setDqById((prev) => {
          const row = prev[report.id] ?? emptyEntry();
          return {
            ...prev,
            [report.id]: { ...row, status: 'running', error: null, updatedAt: new Date().toISOString() },
          };
        });

        const postRes = await fetchWithRetry(
          '/score/disclosure-quality',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meta: {
                reportId: report.id,
                reportKey: report.reportKey,
                company: report.company,
                publishedYear: report.publishedYear,
              },
              options: {
                version: dqSettings.version,
                force: false,
                store: true,
              },
            }),
          },
          { retries: 2, baseDelayMs: 3000, timeoutMs: 180_000, signal: ctrl.signal },
        );

        if (!postRes.ok) throw new Error(await parseHttpError(postRes));

        const payload = (await postRes.json()) as unknown;
        const score = toScore(payload, report);
        if (!score) throw new Error(`Invalid score payload for ${report.id}`);

        setDqById((prev) => {
          const row = prev[report.id] ?? emptyEntry();
          return {
            ...prev,
            [report.id]: {
              ...row,
              status: 'computed',
              summary: score,
              detail: score,
              error: null,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      } catch (err) {
        if (!ctrl.signal.aborted) {
          const isAbort = err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError');
          const msg = isAbort
            ? `Request timed out — the server took too long to respond. Please try again.`
            : err instanceof Error ? err.message : String(err);
          setDetailError(msg);
          setDqById((prev) => {
            const row = prev[report.id] ?? emptyEntry();
            return {
              ...prev,
              [report.id]: { ...row, status: 'error', error: msg, updatedAt: new Date().toISOString() },
            };
          });
        }
      } finally {
        controllersRef.current.delete(ctrl);
        setDetailLoadingId((prev) => (prev === report.id ? null : prev));
        setDetailComputingId((prev) => (prev === report.id ? null : prev));
      }
    },
    [dqById, dqSettings.version],
  );

  /* ---- Load detail + auto-navigate to diagnostics ---- */
  const loadAndInspect = useCallback(
    async (report: AdminReport) => {
      await loadDetail(report);
      setActiveTab('diagnostics');
    },
    [loadDetail],
  );

  /* ---- Delete ---- */
  const onDelete = useCallback(
    async (report: AdminReport) => {
      if (!report.canDelete) {
        setDeleteError('Only uploaded reports can be deleted.');
        return;
      }
      const ok = window.confirm(
        `Delete "${report.company} (${report.publishedYear})"? This removes the PDF and cached artifacts.`,
      );
      if (!ok) return;

      setBusyDeleteId(report.id);
      setDeleteError(null);
      setDeleteInfo(null);

      try {
        const result = await deleteUploadedReport({ reportId: report.id });
        setSelectedIds((prev) => prev.filter((id) => id !== report.id));
        setDqById((prev) => {
          const next = { ...prev };
          delete next[report.id];
          return next;
        });
        setActiveDetailId((prev) => (prev === report.id ? null : prev));
        setDeleteInfo(`Deleted ${report.company} (${report.publishedYear}) — ${result.deletedCount} objects removed.`);
        await refreshReports();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyDeleteId(null);
      }
    },
    [refreshReports],
  );

  /* ---- Navigate to diagnostics when clicking Inspect on a row ---- */
  const handleViewDiagnostics = useCallback((report: AdminReport) => {
    setActiveDetailId(report.id);
    setActiveTab('diagnostics');
  }, []);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <>
      <Seo
        title="Admin DQ Lineage Console | Sustainability Signals"
        description="Admin console for report loading, batch DQ scoring, regex-depth diagnostics, and evidence-line provenance."
        path="https://admin.sustainabilitysignals.com/"
        noindex
      />

      <PageHero
        label="Admin Console"
        tone="signal"
        title={
          <>
            DQ Lineage <span className="gradient-text">Workbench</span>
          </>
        }
        description="Load reports, score Disclosure Quality at scale, and deep-inspect regex depth and evidence provenance."
      />

      <section className="cv-auto max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="glass-panel-strong rounded-2xl shadow-xl overflow-hidden">
          {/* ================================================================ */}
          {/*  Auth & Search Toolbar                                           */}
          {/* ================================================================ */}
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/30">
            <div className="grid xl:grid-cols-[1fr_auto] gap-4 items-end">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Search
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Company, ID, key, country, sector, year..."
                  className="mt-1.5 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
                />
                <span className="mt-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {loading
                    ? 'Loading reports...'
                    : searchTokens.length > 0
                      ? `${filtered.length} of ${reports.length} reports`
                      : `${reports.length} reports loaded`}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void refreshReports()} disabled={loading}>
                  {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} disabled={loading || !searchQuery.trim()}>
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/*  Tab navigation                                                  */}
          {/* ================================================================ */}
          <div className="border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/20 dark:bg-gray-900/15">
            <nav className="flex px-5 sm:px-6 gap-0.5" aria-label="Admin tabs">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors
                      ${
                        isActive
                          ? 'border-brand-600 text-brand-700 dark:text-brand-400 dark:border-brand-500'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.id === 'reports' && (run.running || detailComputingId) && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                    {tab.id === 'diagnostics' && activeDetailId && dqById[activeDetailId]?.detail && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                    {tab.id === 'analytics' && scoredRows.length > 0 && (
                      <span className="ml-1 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] px-1.5 py-0.5 font-bold tabular-nums">
                        {scoredRows.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ================================================================ */}
          {/*  Alert banners (shared)                                          */}
          {/* ================================================================ */}
          <div className="px-5 sm:px-6 pt-5 space-y-2">
            {loadError && (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/40 rounded-lg p-3">
                {loadError}
              </div>
            )}
            {runInfo && (
              <div className="text-xs text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20 border border-sky-200/70 dark:border-sky-800/40 rounded-lg p-3">
                {runInfo}
              </div>
            )}
            {deleteError && (
              <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/40 rounded-lg p-3">
                {deleteError}
              </div>
            )}
            {deleteInfo && (
              <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/40 rounded-lg p-3">
                {deleteInfo}
              </div>
            )}
            {detailError && (
              <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/40 rounded-lg p-3">
                Detail error: {detailError}
              </div>
            )}
            {runErrors.length > 0 && (
              <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200/70 dark:border-rose-800/40 rounded-lg p-3">
                <p className="font-semibold mb-1">Recent batch errors ({runErrors.length})</p>
                <div className="space-y-1">
                  {runErrors.slice(-6).map((row) => (
                    <p key={`${row.reportId}:${row.message}`}>
                      {row.company} ({row.reportId}): {row.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/*  Tab content                                                     */}
          {/* ================================================================ */}
          <div className="p-5 sm:p-6">
            {/* ---- REPORTS TAB ---- */}
            {activeTab === 'reports' && (
              <div className="space-y-5">
                <AdminBatchPanel
                  dqSettings={dqSettings}
                  onSettingsChange={setDqSettings}
                  run={run}
                  runScopeSize={runScope.length}
                  runScopeLabel={runScopeLabel}
                  selectedCount={selectedIds.length}
                  missingDetailCount={missingDetailCount}
                  scoredCount={scoredRows.length}
                  allFilteredSelected={allFilteredSelected}
                  onRunBatch={() => void runBatch()}
                  onStop={stopRun}
                  onClearResults={clearResults}
                  onToggleSelectFiltered={toggleSelectFiltered}
                  onClearSelection={() => setSelectedIds([])}
                  hasDqResults={Object.keys(dqById).length > 0}
                />

                <AdminReportsTable
                  filtered={filtered}
                  dqById={dqById}
                  entityById={entityById}
                  selectedSet={selectedSet}
                  allFilteredSelected={allFilteredSelected}
                  activeDetailId={activeDetailId}
                  detailLoadingId={detailLoadingId}
                  detailComputingId={detailComputingId}
                  busyDeleteId={busyDeleteId}
                  dqFilter={dqFilter}
                  entityFilter={entityFilter}
                  onDQFilterChange={setDqFilter}
                  onEntityFilterChange={setEntityFilter}
                  onToggleSelect={toggleSelectReport}
                  onToggleSelectAll={toggleSelectFiltered}
                  onLoadDetail={(r) => void loadDetail(r)}
                  onLoadAndInspect={(r) => void loadAndInspect(r)}
                  onDelete={(r) => void onDelete(r)}
                  onViewDiagnostics={handleViewDiagnostics}
                />
              </div>
            )}

            {/* ---- ANALYTICS TAB ---- */}
            {activeTab === 'analytics' && (
              <AdminAnalytics runScope={runScope} dqById={dqById} />
            )}

            {/* ---- DIAGNOSTICS TAB ---- */}
            {activeTab === 'diagnostics' && (
              <AdminDiagnostics
                reports={reports}
                dqById={dqById}
                activeReportId={activeDetailId}
                onSelectReport={setActiveDetailId}
              />
            )}

            {/* ---- DEPTH ANALYSIS TAB ---- */}
            {activeTab === 'depth-analysis' && (
              <AdminDepthAnalysis runScope={runScope} dqById={dqById} />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
