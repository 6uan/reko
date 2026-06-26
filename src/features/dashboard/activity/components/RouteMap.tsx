/**
 * MapLibre GL + OpenFreeMap route renderer (option A). Client-only: MapLibre
 * needs window/canvas, so the library is dynamic-imported inside useEffect and
 * never loads during SSR. Draws the [lng,lat] route and fits the view to it.
 * OpenFreeMap's style + tiles need no API key.
 */

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export default function RouteMap({ route }: { route: [number, number][] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || route.length < 2) return
    let cancelled = false
    let cleanup: (() => void) | undefined

    import('maplibre-gl').then(
      ({ Map: MlMap, NavigationControl, LngLatBounds }) => {
        if (cancelled || !ref.current) return
        const map = new MlMap({
          container: ref.current,
          style: STYLE_URL,
          attributionControl: { compact: true },
        })
        cleanup = () => map.remove()
        map.addControl(
          new NavigationControl({ showCompass: false }),
          'top-right',
        )
        map.on('load', () => {
          // Inlined so contextual typing validates it against addSource's
          // GeoJSON type — avoids needing the (absent) global GeoJSON namespace.
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: route },
            },
          })
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#fc5200',
              'line-width': 4,
              'line-opacity': 0.9,
            },
          })
          const bounds = route.reduce(
            (b, c) => b.extend(c),
            new LngLatBounds(route[0], route[0]),
          )
          map.fitBounds(bounds, { padding: 32, animate: false })
        })
      },
    )

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [route])

  return (
    <div
      ref={ref}
      className="h-72 w-full rounded-(--radius-m) overflow-hidden border border-(--line)"
    />
  )
}
