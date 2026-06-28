/**
 * Route card — defaults to the MapLibre map and toggles to the zero-dependency
 * SVG trace. The choice persists in localStorage so it sticks across activities.
 */

import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import Card from '@/features/dashboard/ui/Card'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import RouteMap from './RouteMap'
import RouteTrace from './RouteTrace'

type View = 'map' | 'trace'

function parseView(stored: string): View | null {
  return stored === 'map' || stored === 'trace' ? stored : null
}

export default function RouteCard({
  route,
  hoverDist,
}: {
  route: { points: [number, number][]; distM: number[] }
  hoverDist: number | null
}) {
  const [view, choose] = useLocalStorageState<View>({
    key: 'reko-route-view',
    defaultValue: 'map',
    parse: parseView,
  })

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Route" />
        <div className="inline-flex p-0.5 bg-(--card-2) border border-(--line) rounded-(--radius-s) text-detail font-medium">
          <ViewBtn active={view === 'map'} onClick={() => choose('map')}>
            Map
          </ViewBtn>
          <ViewBtn active={view === 'trace'} onClick={() => choose('trace')}>
            Trace
          </ViewBtn>
        </div>
      </div>
      <div className="mt-3">
        {view === 'map' ? (
          <RouteMap
            points={route.points}
            distM={route.distM}
            hoverDist={hoverDist}
          />
        ) : (
          <RouteTrace
            points={route.points}
            distM={route.distM}
            hoverDist={hoverDist}
          />
        )}
      </div>
    </Card>
  )
}

function ViewBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-(--radius-s) cursor-pointer transition-colors ${
        active ? 'bg-(--ink) text-(--bg)' : 'text-(--ink-3) bg-transparent'
      }`}
    >
      {children}
    </button>
  )
}
