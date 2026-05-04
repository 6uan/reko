/**
 * Chart container — wraps Recharts' ResponsiveContainer with a fixed-
 * height div and handles the "width(-1) / height(-1)" warning that
 * fires when the container isn't laid out yet (tab mounts, hidden
 * parents, etc.).
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
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // If already visible, render immediately.
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      setReady(true)
      return
    }

    // Otherwise wait for layout via ResizeObserver.
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setReady(true)
        observer.disconnect()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={className} style={{ height }}>
      {ready && (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  )
}
