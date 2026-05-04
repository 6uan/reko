/**
 * Chart container — wraps Recharts' ResponsiveContainer with a fixed-
 * height div and handles the "width(-1) / height(-1)" warning that
 * fires when the container isn't laid out yet (tab mounts, hidden
 * parents, etc.).
 *
 * Two-pronged fix:
 *  1. Defer rendering until the wrapper has positive dimensions (ResizeObserver).
 *  2. Pass `initialDimension` so ResponsiveContainer never starts at {-1,-1}.
 *
 *   <ChartContainer height={200}>
 *     <BarChart data={data}>…</BarChart>
 *   </ChartContainer>
 */

import { useState, useEffect, useRef, type ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

type Props = {
  children: ReactElement
  height?: number
  className?: string
}

export default function ChartContainer({ children, height = 200, className = 'mt-3' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // If already visible, capture dimensions immediately.
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      setDims({ width: el.clientWidth, height: el.clientHeight })
      return
    }

    // Otherwise wait for layout via ResizeObserver.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height: h } = entry.contentRect
      if (width > 0 && h > 0) {
        setDims({ width, height: h })
        observer.disconnect()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={className} style={{ height }}>
      {dims && (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={dims}
        >
          {children}
        </ResponsiveContainer>
      )}
    </div>
  )
}
