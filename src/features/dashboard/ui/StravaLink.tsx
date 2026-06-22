/**
 * Outbound link to an activity on strava.com. This is the original
 * `ActivityLink` body, kept as its own component now that `ActivityLink`
 * points at the in-app detail page — used for explicit "View on Strava"
 * affordances (e.g. the activity detail header).
 */

import type { ReactNode } from 'react'

type Props = {
  activityId: number | string
  children: ReactNode
  className?: string
}

export default function StravaLink({ activityId, children, className = '' }: Props) {
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
