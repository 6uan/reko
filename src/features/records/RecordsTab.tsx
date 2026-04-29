/**
 * Personal Records tab.
 *
 * Reads pre-aggregated `RecordsData` from the dashboard loader (sourced
 * from `best_efforts` joined to `activities`) and renders:
 *
 *   1. Hero PR — the most-recently-set PR across all canonical distances.
 *   2. Per-distance list — each non-hero distance as a collapsible row.
 *   3. Three accordions: progression chart, best pace by distance range,
 *      flat PR history table.
 *
 * Heavy rendering lives in `components/` — this file wires data to
 * those components and owns the empty-state + disclosure accordion.
 */

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { DISTANCE_DEFS, type RecordsData, type DistanceRecord } from './distances'
import type { DashboardRun, Unit } from '../../lib/activities'
import { parseLocalDate } from './components/helpers'
import HeroPR from './components/HeroPR'
import DistanceRow from './components/DistanceRow'
import ProgressionChart from './components/ProgressionChart'
import PaceByRange from './components/PaceByRange'
import PRHistory from './components/PRHistory'

type Props = {
  data: RecordsData
  runs: DashboardRun[]
  unit: Unit
}

// ── Disclosure (accordion) ───────────────────────────────────────

function Disclosure({
  title,
  meta,
  children,
}: {
  title: string
  meta: string
  children: React.ReactNode
}) {
  return (
    <details className="group bg-(--card) border border-(--line) rounded-2xl overflow-hidden [[open]]:border-[rgba(252,76,2,0.18)] transition-colors">
      <summary className="flex justify-between items-center px-5 py-4 cursor-pointer list-none hover:bg-(--card-2) transition-colors [&::-webkit-details-marker]:hidden">
        <span className="text-[14px] font-medium text-(--ink) tracking-tight">
          {title}
        </span>
        <span className="flex items-center gap-3 font-mono text-[11px] text-(--ink-4)">
          {meta}
          <ChevronRight
            size={12}
            className="text-(--ink-3) transition-transform duration-150 group-open:rotate-90"
          />
        </span>
      </summary>
      <div className="border-t border-(--line)">{children}</div>
    </details>
  )
}

// ── Empty-tab state ──────────────────────────────────────────────

function EmptyTab() {
  return (
    <div className="py-20 px-10 text-center border border-dashed border-(--line) rounded-2xl bg-(--card-2)">
      <div className="w-15 h-15 mx-auto mb-5 rounded-full bg-(--accent-soft) grid place-items-center text-(--accent)">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 3h14l-1.5 8h-11z" />
          <path d="M4 14h16" />
          <path d="M9 21h6" />
          <path d="M12 14v7" />
        </svg>
      </div>
      <h2 className="text-[22px] font-medium m-0 mb-2 text-(--ink) tracking-tight">
        Your records will live here.
      </h2>
      <p className="text-[14px] text-(--ink-3) mx-auto max-w-[42ch] leading-relaxed">
        Run any of the standard distances — 1K, 1 mile, 5K, 10K, half, or
        marathon — and Reko will surface your fastest effort across every
        activity automatically.
      </p>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

export default function Records({ data, runs, unit }: Props) {
  const now = useMemo(() => new Date(), [])

  // Hydrate distances against the canonical order so the list is
  // deterministic even if the loader returns them out of order.
  const distancesByKey = useMemo(() => {
    const m = new Map<string, DistanceRecord>()
    for (const d of data.distances) m.set(d.key, d)
    return m
  }, [data.distances])

  const orderedDistances = DISTANCE_DEFS.map(
    (def) =>
      distancesByKey.get(def.key) ?? {
        key: def.key,
        label: def.label,
        meters: def.meters,
        best: null,
        runnerUp: null,
        thirdBest: null,
        trend: [],
      },
  )

  // The hero is whichever distance was most recently PR'd.
  const heroDistance = useMemo(() => {
    const withBest = orderedDistances.filter((d) => d.best)
    if (withBest.length === 0) return null
    return withBest.reduce((latest, d) =>
      parseLocalDate(d.best!.startDateLocal).getTime() >
      parseLocalDate(latest.best!.startDateLocal).getTime()
        ? d
        : latest,
    )
  }, [orderedDistances])

  const totalPrs = orderedDistances.filter((d) => d.best).length

  if (totalPrs === 0) return <EmptyTab />

  const slimList = orderedDistances.filter(
    (d) => d.key !== heroDistance?.key,
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      {heroDistance && <HeroPR rec={heroDistance} unit={unit} now={now} />}

      {/* Per-distance expandable list */}
      <div className="bg-(--card) border border-(--line) rounded-2xl overflow-hidden">
        {slimList.map((rec) => (
          <DistanceRow key={rec.key} rec={rec} unit={unit} now={now} />
        ))}
      </div>

      {/* Three accordions */}
      <Disclosure
        title="Progression over time"
        meta={`${totalPrs} distance${totalPrs === 1 ? '' : 's'} tracked`}
      >
        <ProgressionChart distances={orderedDistances} />
      </Disclosure>

      <Disclosure
        title="Best pace by distance range"
        meta={`6 buckets · fastest ${unit} per bucket`}
      >
        <PaceByRange
          distances={orderedDistances}
          runs={runs}
          unit={unit}
        />
      </Disclosure>

      <Disclosure
        title="PR history"
        meta={`${totalPrs} record${totalPrs === 1 ? '' : 's'}`}
      >
        <PRHistory distances={orderedDistances} unit={unit} />
      </Disclosure>
    </div>
  )
}
