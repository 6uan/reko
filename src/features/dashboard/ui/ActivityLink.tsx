/**
 * Link to an activity's in-app detail page. Centralizes the route + visual
 * styling; the per-call-site `className` handles context (truncated table
 * cell, inline records row, etc).
 *
 * Repointing this one component switched every activity-name link across the
 * dashboard from an outbound strava.com anchor to the internal detail page.
 * For an explicit outbound link, use `StravaLink`.
 */

import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

type Props = {
  activityId: number | string
  children: ReactNode
  className?: string
}

export default function ActivityLink({ activityId, children, className = '' }: Props) {
  return (
    <Link
      to="/dashboard/activity/$id"
      params={{ id: String(activityId) }}
      className={`hover:text-(--accent) transition-colors ${className}`.trim()}
    >
      {children}
    </Link>
  )
}
