/**
 * Advanced / System Health section for the profile page.
 *
 * Three panels, all collapsed behind a single toggle:
 *   1. Status — overall health indicator
 *   2. Data — activity count + detail coverage
 *   3. Recent Syncs — plain-language sync history
 */

import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { HealthData } from './api/getHealthData.server'
import { recomputeData, type RecomputeResult } from './recomputeData'

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function statusIndicator(status: HealthData['overallStatus']) {
  switch (status) {
    case 'healthy':
      return { dot: 'bg-emerald-500', label: 'Healthy', color: 'text-emerald-600 dark:text-emerald-400' }
    case 'degraded':
      return { dot: 'bg-amber-500', label: 'Warning', color: 'text-amber-600 dark:text-amber-400' }
    case 'error':
      return { dot: 'bg-red-500', label: 'Error', color: 'text-red-600 dark:text-red-400' }
  }
}

function syncStatusDot(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-emerald-500'
    case 'running':
      return 'bg-blue-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    case 'rate_limited':
      return 'bg-amber-500'
    default:
      return 'bg-(--ink-3)'
  }
}

// ── Computed Data subsection ──────────────────────────────────────

function ComputedDataSection({ data }: { data: HealthData }) {
  const router = useRouter()
  const { withStreams, withDerivedSplits, withHrZoneEfforts } = data.computedData

  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<RecomputeResult | null>(null)

  async function handleRecompute() {
    setRunning(true)
    setError(null)
    try {
      const result = await recomputeData()
      setLastResult(result)
      // Re-run the route loader so the displayed counts refresh.
      router.invalidate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recompute failed')
    } finally {
      setRunning(false)
    }
  }

  const splitsPct =
    withStreams > 0 ? Math.round((withDerivedSplits / withStreams) * 100) : 0
  const hrPct =
    withStreams > 0 ? Math.round((withHrZoneEfforts / withStreams) * 100) : 0

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-medium text-(--ink-3) uppercase tracking-wider">
          Computed Data
        </h3>
        <button
          type="button"
          onClick={handleRecompute}
          disabled={running || withStreams === 0}
          className="px-3 py-1 text-xs rounded-(--radius-s) border border-(--line) bg-(--card) text-(--ink-3) hover:text-(--ink) transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Recomputing…' : 'Recompute'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CoverageStat
          label="Splits"
          numerator={withDerivedSplits}
          denominator={withStreams}
          pct={splitsPct}
        />
        <CoverageStat
          label="HR zones"
          numerator={withHrZoneEfforts}
          denominator={withStreams}
          pct={hrPct}
        />
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-500 font-mono">
          {error}
        </p>
      )}
      {lastResult && !error && (
        <p className="mt-3 text-xs text-(--ink-3)">
          Recomputed {lastResult.splitsRows} split rows ·{' '}
          {lastResult.hrRows} HR zone rows
        </p>
      )}
    </div>
  )
}

function CoverageStat({
  label,
  numerator,
  denominator,
  pct,
}: {
  label: string
  numerator: number
  denominator: number
  pct: number
}) {
  return (
    <div>
      <span className="text-2xl font-semibold text-(--ink) tabular-nums">
        {pct}%
      </span>
      <span className="text-sm text-(--ink-3) ml-1.5">{label}</span>
      <p className="text-xs text-(--ink-3) mt-0.5">
        {numerator} of {denominator} activities
      </p>
      {denominator > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-(--line) overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export default function HealthSection({ data }: { data: HealthData }) {
  const [expanded, setExpanded] = useState(false)

  const status = statusIndicator(data.overallStatus)

  return (
    <div className="p-6 rounded-xl bg-(--card) border border-(--line) shadow-(--shadow-s)">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-(--ink-3) uppercase tracking-wider">
            Advanced
          </h2>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
        </div>
        <svg
          className={`w-4 h-4 text-(--ink-3) transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-6 space-y-6">
          {/* ── System Status ──────────────────────────────────── */}
          <div className="flex items-start gap-3">
            <span className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${status.dot}`} />
            <div>
              <p className={`text-sm font-medium ${status.color}`}>
                {status.label}
              </p>
              <p className="text-sm text-(--ink-2) mt-0.5">
                {data.statusReason}
              </p>
              {data.lastSyncAt && (
                <p className="text-xs text-(--ink-3) mt-1">
                  Last synced {timeAgo(data.lastSyncAt)}
                </p>
              )}
            </div>
          </div>

          {/* ── Your Data ──────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-medium text-(--ink-3) uppercase tracking-wider mb-3">
              Your Data
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-2xl font-semibold text-(--ink) tabular-nums">
                  {data.totalRuns}
                </span>
                <span className="text-sm text-(--ink-3) ml-1.5">
                  runs
                </span>
                {data.totalActivities > data.totalRuns && (
                  <p className="text-xs text-(--ink-3) mt-0.5">
                    {data.totalActivities} total activities
                  </p>
                )}
              </div>
              <div>
                <span className="text-2xl font-semibold text-(--ink) tabular-nums">
                  {data.detailCoveragePct}%
                </span>
                <span className="text-sm text-(--ink-3) ml-1.5">
                  detail coverage
                </span>
                <p className="text-xs text-(--ink-3) mt-0.5">
                  {data.detailSynced} of {data.totalActivities} with full data
                </p>
              </div>
            </div>

            {/* Coverage bar */}
            {data.totalActivities > 0 && (
              <div className="mt-3 h-1.5 rounded-full bg-(--line) overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${data.detailCoveragePct}%` }}
                />
              </div>
            )}
          </div>

          {/* ── Computed Data ──────────────────────────────────── */}
          <ComputedDataSection data={data} />

          {/* ── Recent Syncs ───────────────────────────────────── */}
          {data.recentSyncs.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-(--ink-3) uppercase tracking-wider mb-3">
                Recent Syncs
              </h3>
              <div className="space-y-1.5">
                {data.recentSyncs.map((sync) => (
                  <div
                    key={sync.id}
                    className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg bg-(--bg)/50"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${syncStatusDot(sync.status)}`} />
                    <span className="text-(--ink)">
                      {sync.label}
                    </span>
                    <span className="text-xs text-(--ink-3) ml-auto tabular-nums shrink-0">
                      {timeAgo(sync.finishedAt ?? sync.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
              {data.recentSyncs.some((s) => s.error) && (
                <details className="mt-2">
                  <summary className="text-xs text-red-500 cursor-pointer">
                    Show error details
                  </summary>
                  <div className="mt-1.5 space-y-1">
                    {data.recentSyncs
                      .filter((s) => s.error)
                      .map((s) => (
                        <p key={s.id} className="text-xs text-red-400 font-mono px-3 py-1.5 rounded bg-red-950/10">
                          {s.error}
                        </p>
                      ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
