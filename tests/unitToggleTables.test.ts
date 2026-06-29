/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardProvider, useDashboard } from '@/features/dashboard/DashboardContext'
import PaceTab from '@/features/dashboard/pace/components/PaceTab'
import CadenceTab from '@/features/dashboard/cadence/components/CadenceTab'
import RecordsTab from '@/features/dashboard/records/components/RecordsTab'
import type { Activity } from '@/lib/activities'
import type { DistanceRecord, RecordsData } from '@/features/dashboard/records/distances'

vi.mock('@tanstack/react-router', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  return {
    Link: ({ children }: { children?: ReactNode }) =>
      createElement('a', { href: '#' }, children),
  }
})

vi.mock('recharts', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  const chart =
    (name: string) =>
    ({ children }: { children?: ReactNode }) =>
      createElement('div', { 'data-recharts': name }, children)

  return {
    Bar: chart('Bar'),
    BarChart: chart('BarChart'),
    CartesianGrid: chart('CartesianGrid'),
    Line: chart('Line'),
    LineChart: chart('LineChart'),
    ReferenceLine: chart('ReferenceLine'),
    ResponsiveContainer: chart('ResponsiveContainer'),
    Scatter: chart('Scatter'),
    ScatterChart: chart('ScatterChart'),
    Tooltip: chart('Tooltip'),
    XAxis: chart('XAxis'),
    YAxis: chart('YAxis'),
  }
})

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const run: Activity = {
  id: 1,
  name: 'Morning Run',
  type: 'Run',
  sportType: 'Run',
  date: '2026-01-01T12:00:00Z',
  distanceMeters: 5000,
  movingTime: 1800,
  avgSpeed: 5000 / 1800,
  avgHr: 150,
  maxHr: 170,
  cadence: 180,
  elevation: 10,
  prCount: 1,
  bestEfforts: { '5k': 1800 },
  derivedBestEfforts: {},
  hrZoneEfforts: {},
}

const emptyRecords: RecordsData = { distances: [] }

const fiveKRecord: DistanceRecord = {
  key: '5k',
  label: '5K',
  meters: 5000,
  best: {
    elapsedTime: 1800,
    movingTime: 1800,
    startDateLocal: '2026-01-01 12:00:00',
    activityId: run.id,
    activityName: run.name,
  },
  runnerUp: null,
  thirdBest: null,
  trend: [{ date: '2026-01-01 12:00:00', time: 1800 }],
}

function firstBodyRowText(container: HTMLElement) {
  return container.querySelector('tbody tr')?.textContent ?? ''
}

function withDashboard(children: ReactNode, records = emptyRecords) {
  return createElement(DashboardProvider, {
    activities: [run],
    records,
    children,
  })
}

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: TestResizeObserver,
  })
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: TestResizeObserver,
  })
})

afterEach(() => cleanup())

beforeEach(() => window.localStorage.clear())

describe('unit toggles in cached tables', () => {
  it('updates Pace through the real dashboard unit context', () => {
    function PaceHarness() {
      const { runs, unit, toggleUnit } = useDashboard()
      return createElement(
        'div',
        null,
        createElement('button', { type: 'button', onClick: () => toggleUnit('km') }, 'km'),
        createElement('button', { type: 'button', onClick: () => toggleUnit('mi') }, 'mi'),
        createElement(PaceTab, { runs, unit }),
      )
    }

    const { container } = render(withDashboard(createElement(PaceHarness)))

    expect(firstBodyRowText(container)).toMatch(/9:39\s*\/mi/)

    fireEvent.click(screen.getByRole('button', { name: 'km' }))

    expect(firstBodyRowText(container)).toMatch(/6:00\s*\/km/)
    expect(firstBodyRowText(container)).not.toMatch(/9:39\s*\/km/)
  })

  it('updates the Pace table value, not just the unit suffix', () => {
    const { container, rerender } = render(
      withDashboard(createElement(PaceTab, { runs: [run], unit: 'mi' })),
    )

    expect(firstBodyRowText(container)).toMatch(/9:39\s*\/mi/)

    rerender(
      withDashboard(createElement(PaceTab, { runs: [run], unit: 'km' })),
    )

    expect(firstBodyRowText(container)).toMatch(/6:00\s*\/km/)
    expect(firstBodyRowText(container)).not.toMatch(/9:39\s*\/km/)
  })

  it('updates shared pace columns used by Cadence', () => {
    const { container, rerender } = render(
      withDashboard(createElement(CadenceTab, { runs: [run], unit: 'mi' })),
    )

    expect(firstBodyRowText(container)).toMatch(/9:39\s*\/mi/)

    rerender(
      withDashboard(createElement(CadenceTab, { runs: [run], unit: 'km' })),
    )

    expect(firstBodyRowText(container)).toMatch(/6:00\s*\/km/)
    expect(firstBodyRowText(container)).not.toMatch(/9:39\s*\/km/)
  })

  it('updates the Records effort table value, not just the unit suffix', () => {
    const records: RecordsData = { distances: [fiveKRecord] }
    const { container, rerender } = render(
      withDashboard(
        createElement(RecordsTab, { data: records, runs: [run], unit: 'mi' }),
        records,
      ),
    )

    expect(firstBodyRowText(container)).toMatch(/9:39\s*\/mi/)

    rerender(
      withDashboard(
        createElement(RecordsTab, { data: records, runs: [run], unit: 'km' }),
        records,
      ),
    )

    expect(firstBodyRowText(container)).toMatch(/6:00\s*\/km/)
    expect(firstBodyRowText(container)).not.toMatch(/9:39\s*\/km/)
  })
})
