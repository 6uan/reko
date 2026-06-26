/**
 * Route card — defaults to the MapLibre map and toggles to the zero-dependency
 * SVG trace. The choice persists in localStorage so it sticks across activities.
 */

import { useState } from 'react'
import Card from '@/features/dashboard/ui/Card'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import RouteMap from './RouteMap'
import RouteTrace from './RouteTrace'

type View = 'map' | 'trace'

export default function RouteCard({ route }: { route: [number, number][] }) {
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('reko-route-view') as View) || 'map'
    }
    return 'map'
  })

  const choose = (v: View) => {
    setView(v)
    if (typeof window !== 'undefined') localStorage.setItem('reko-route-view', v)
  }

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
          <RouteMap route={route} />
        ) : (
          <RouteTrace route={route} />
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
