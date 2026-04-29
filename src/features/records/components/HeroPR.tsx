/**
 * Hero PR card — the most-recently-set PR across all canonical distances.
 *
 * Left half: distance + big time + pace.
 * Right half: improvement vs previous best + runner-up.
 */

import { formatDuration } from '../../../lib/strava'
import type { Unit } from '../../../lib/activities'
import type { DistanceRecord } from '../distances'
import { formatDate, relTime, paceForDist, formatPace } from './helpers'

type Props = {
  rec: DistanceRecord
  unit: Unit
  now: Date
}

export default function HeroPR({ rec, unit, now }: Props) {
  if (!rec.best) return null
  const unitLabel = unit === 'km' ? '/km' : '/mi'
  const pace = paceForDist(rec.best.elapsedTime, rec.meters, unit)
  const prev = rec.runnerUp?.elapsedTime ?? null
  const delta = prev !== null ? prev - rec.best.elapsedTime : 0
  const pct = prev !== null && prev > 0 ? (delta / prev) * 100 : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] bg-(--card) border border-(--line) rounded-2xl overflow-hidden">
      {/* Left: distance + big time */}
      <div className="px-9 py-8 flex flex-col justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-(--accent)">
            <span className="relative inline-block w-1.75 h-1.75 rounded-full bg-(--accent)">
              <span className="absolute -inset-0.75 rounded-full border-[1.5px] border-(--accent) opacity-0 animate-[pulse-ring_2s_ease-out_infinite]" />
            </span>
            Latest PR · {relTime(rec.best.startDateLocal, now)}
          </span>
          <div className="mt-3.5 text-[18px] font-medium text-(--ink-2) tracking-tight">
            {rec.label}
          </div>
          <div className="mt-1.5 font-mono text-[64px] md:text-[76px] font-medium tabular-nums tracking-[-0.035em] text-(--ink) leading-none">
            {formatDuration(rec.best.elapsedTime)}
          </div>
          <div className="mt-3 font-mono text-[14px] tabular-nums text-(--ink-3)">
            {formatPace(pace)} {unitLabel}
          </div>
        </div>
        <div className="flex flex-col gap-1 font-mono text-[11px]">
          <span className="text-(--ink-2)">
            {formatDate(rec.best.startDateLocal)}
          </span>
          <a
            href={`https://www.strava.com/activities/${rec.best.activityId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--ink-3) hover:text-(--accent) no-underline"
          >
            {rec.best.activityName} ↗
          </a>
        </div>
      </div>

      {/* Right: improvement breakdown */}
      <div className="px-9 py-8 border-t md:border-t-0 md:border-l border-(--line) bg-(--card-2)">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.12em] text-(--ink-4) mb-4 font-medium">
          Improvement
        </h4>
        {prev !== null ? (
          <>
            <div className="flex items-baseline gap-2.5 mb-6">
              <span className="font-mono text-[28px] font-medium text-(--accent) tabular-nums tracking-[-0.02em]">
                −{formatDuration(delta)}
              </span>
              <span className="font-mono text-[13px] text-(--ink-3)">
                {pct.toFixed(1)}% faster
              </span>
            </div>
            <div className="flex justify-between items-baseline py-2.5 border-t border-(--line) font-mono text-[12px]">
              <span className="text-(--ink-4) uppercase text-[10px] tracking-widest">
                Previous best
              </span>
              <span className="text-(--ink-2) tabular-nums">
                {formatDuration(prev)}
              </span>
            </div>
            {rec.thirdBest && (
              <div className="flex justify-between items-baseline py-2.5 border-t border-(--line) font-mono text-[12px]">
                <span className="text-(--ink-4) uppercase text-[10px] tracking-widest">
                  3rd best
                </span>
                <span className="text-(--ink-2) tabular-nums">
                  {formatDuration(rec.thirdBest.elapsedTime)} ·{' '}
                  {relTime(rec.thirdBest.startDateLocal, now)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="font-mono text-[12px] text-(--ink-3)] leading-relaxed">
            First effort at this distance. Run it again and we'll track
            your improvement here.
          </div>
        )}
      </div>
    </div>
  )
}
