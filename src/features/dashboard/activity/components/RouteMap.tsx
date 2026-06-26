/**
 * MapLibre GL + OpenFreeMap route renderer (option A). Client-only: MapLibre
 * needs window/canvas, so the library is dynamic-imported inside useEffect and
 * never loads during SSR. Draws the [lng,lat] route, fits the view to it, and
 * moves a marker to the hovered position as the user scrubs a chart.
 */

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { nearestIndex } from './routeUtils'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

type Props = {
  points: [number, number][]
  distM: number[]
  hoverDist: number | null
}

export default function RouteMap({ points, distM, hoverDist }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('maplibre-gl').Map | null>(null)
  const markerRef = useRef<import('maplibre-gl').Marker | null>(null)

  useEffect(() => {
    if (!ref.current || points.length < 2) return
    let cancelled = false

    import('maplibre-gl').then(
      ({ Map: MapCtor, NavigationControl, LngLatBounds, Marker }) => {
        if (cancelled || !ref.current) return
        const map = new MapCtor({
          container: ref.current,
          style: STYLE_URL,
          attributionControl: { compact: true },
        })
        mapRef.current = map

        const el = document.createElement('div')
        el.style.width = '14px'
        el.style.height = '14px'
        el.style.borderRadius = '9999px'
        el.style.background = '#fc5200'
        el.style.border = '2px solid #fff'
        el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.25)'
        markerRef.current = new Marker({ element: el })

        map.addControl(
          new NavigationControl({ showCompass: false }),
          'top-right',
        )
        map.on('load', () => {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: points },
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
          const bounds = points.reduce(
            (b, c) => b.extend(c),
            new LngLatBounds(points[0], points[0]),
          )
          map.fitBounds(bounds, { padding: 32, animate: false })
        })
      },
    )

    return () => {
      cancelled = true
      markerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [points])

  // Move/show the hover marker as the user scrubs a chart.
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    if (hoverDist == null || distM.length === 0) {
      marker.remove()
      return
    }
    marker.setLngLat(points[nearestIndex(distM, hoverDist)]).addTo(map)
  }, [hoverDist, points, distM])

  return (
    <div
      ref={ref}
      className="aspect-square w-full rounded-(--radius-m) overflow-hidden border border-(--line)"
    />
  )
}
