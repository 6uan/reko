/**
 * Link out to a Strava activity. Centralizes the URL pattern + safe-link
 * attributes; visual styling stays per-call-site since the link appears
 * in different contexts (truncated table cell, inline records row, etc).
 */

import type { ReactNode } from 'react'

type Props = {
  activityId: number | string
  children: ReactNode
  className?: string
}

export default function ActivityLink({ activityId, children, className = '' }: Props) {
  return (
    <a
      href={`https://www.strava.com/activities/${activityId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`hover:text-(--accent) transition-colors ${className}`.trim()}
    >
      {children}
    </a>
  )
}
