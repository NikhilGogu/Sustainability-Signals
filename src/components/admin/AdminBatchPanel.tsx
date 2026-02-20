import { useState } from 'react';
import { Button } from '../ui';
import type { DQSettings, RunProgress } from './admin-types';
import { clampInt, fmtDate, DEFAULT_SETTINGS } from './admin-utils';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface AdminBatchPanelProps {
  dqSettings: DQSettings;
  onSettingsChange: (updater: (prev: DQSettings) => DQSettings) => void;
  run: RunProgress;
  runScopeSize: number;
  runScopeLabel: string;
  selectedCount: number;
  missingDetailCount: number;
  scoredCount: number;
  allFilteredSelected: boolean;
  onRunBatch: () => void;
  onStop: () => void;
  onClearResults: () => void;
  onToggleSelectFiltered: () => void;
  onClearSelection: () => void;
  hasDqResults: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AdminBatchPanel({
  dqSettings,
  onSettingsChange,
  run,
  runScopeSize,
  runScopeLabel,
  selectedCount,
  missingDetailCount,
  scoredCount,
  allFilteredSelected,
  onRunBatch,
  onStop,
  onClearResults,
  onToggleSelectFiltered,
  onClearSelection,
  hasDqResults,
}: AdminBatchPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const runPct = run.total > 0 ? Math.round((run.completed / run.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ---- Action bar ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onRunBatch}
          disabled={run.running || runScopeSize === 0}
        >
          {run.running ? 'Running...' : `Run DQ Batch (${runScopeSize})`}
        </Button>
        <Button variant="outline" size="sm" onClick={onStop} disabled={!run.running}>
          Stop
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearResults}
          disabled={run.running || !hasDqResults}
        >
          Clear Results
        </Button>

        <span className="text-gray-300 dark:text-gray-600">|</span>

        <Button variant="ghost" size="sm" onClick={onToggleSelectFiltered}>
          {allFilteredSelected ? 'Unselect Filtered' : 'Select Filtered'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={selectedCount === 0}
        >
          Clear Selection ({selectedCount})
        </Button>

        <span className="text-gray-300 dark:text-gray-600">|</span>

        <button
          onClick={() => setShowSettings((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
            <path d="M6.5 2h3l.5 2.3 1.7 1 2.1-.8 1.5 2.6-1.6 1.5v2l1.6 1.5-1.5 2.6-2.1-.8-1.7 1L9.5 14h-3l-.5-2.3-1.7-1-2.1.8-1.5-2.6 1.6-1.5v-2L.7 4.9l1.5-2.6 2.1.8 1.7-1L6.5 2z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
          Settings
          <svg
            className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-180' : ''}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 5l3 3 3-3" />
          </svg>
        </button>
      </div>

      {/* ---- Scope summary ---- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
        <span>
          Scope: <span className="font-semibold">{runScopeSize}</span> {runScopeLabel}
        </span>
        <span>
          Selected: <span className="font-semibold">{selectedCount}</span>
        </span>
        <span>
          Scored: <span className="font-semibold">{scoredCount}</span>
        </span>
        <span>
          Missing detail: <span className="font-semibold">{missingDetailCount}</span>
        </span>
      </div>

      {/* ---- Collapsible settings ---- */}
      {showSettings && (
        <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/30 p-4 animate-fade-up">
          <div className="grid sm:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Version
              <input
                type="number"
                min={1}
                max={10}
                value={dqSettings.version}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(v)) return;
                  onSettingsChange((prev) => ({
                    ...prev,
                    version: clampInt(v, prev.version, 1, 10),
                  }));
                }}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>

            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Concurrency
              <input
                type="number"
                min={1}
                max={12}
                value={dqSettings.concurrency}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(v)) return;
                  onSettingsChange((prev) => ({
                    ...prev,
                    concurrency: clampInt(v, prev.concurrency, 1, 12),
                  }));
                }}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>

            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Max Reports
              <input
                type="number"
                min={1}
                max={2000}
                value={dqSettings.limit}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(v)) return;
                  onSettingsChange((prev) => ({
                    ...prev,
                    limit: clampInt(v, prev.limit, 1, 2000),
                  }));
                }}
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 mt-4">
              <input
                type="checkbox"
                checked={dqSettings.skipCached}
                disabled={dqSettings.forceRecompute}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onSettingsChange((prev) => ({
                    ...prev,
                    skipCached: prev.forceRecompute ? false : checked,
                  }));
                }}
                className="rounded border-gray-300 dark:border-gray-700"
              />
              Skip cached
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 mt-4">
              <input
                type="checkbox"
                checked={dqSettings.forceRecompute}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onSettingsChange((prev) => ({
                    ...prev,
                    forceRecompute: checked,
                    skipCached: checked ? false : prev.skipCached,
                  }));
                }}
                className="rounded border-gray-300 dark:border-gray-700"
              />
              Force recompute
            </label>
          </div>

          <button
            onClick={() =>
              onSettingsChange(() => ({ ...DEFAULT_SETTINGS }))
            }
            className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2"
          >
            Reset to defaults
          </button>
        </div>
      )}

      {/* ---- Progress ---- */}
      {(run.running || run.total > 0) && (
        <div className="rounded-xl border border-gray-200/70 dark:border-gray-800/60 bg-white/60 dark:bg-gray-900/40 p-4">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-2">
            <span className="font-semibold">
              Progress: {run.completed}/{run.total} ({runPct}%)
            </span>
            <span className="tabular-nums">
              cached {run.cachedHits} &middot; computed {run.success} &middot; errors{' '}
              {run.errors}
            </span>
          </div>

          <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                run.cancelled
                  ? 'bg-amber-500'
                  : run.errors > 0 && !run.running
                    ? 'bg-gradient-to-r from-sky-500 to-rose-500'
                    : 'bg-gradient-to-r from-sky-500 to-cyan-500'
              }`}
              style={{ width: `${runPct}%` }}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            {run.startedAt && <span>Started: {fmtDate(run.startedAt)}</span>}
            {run.finishedAt && <span>Finished: {fmtDate(run.finishedAt)}</span>}
            {run.cancelled && (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Cancelled
              </span>
            )}
            {run.currentReportId && (
              <span className="truncate max-w-xs">
                Processing: {run.currentReportId}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
