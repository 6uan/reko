/**
 * Trail / Treadmill run-type inclusion toggles, shared by the desktop
 * AccountMenu popover and the mobile nav drawer. Reads/writes the client-side
 * prefs in DashboardContext (localStorage-backed); flipping one re-filters the
 * analytics tabs instantly.
 */

import { useDashboard } from './DashboardContext'

export default function RunTypeToggles() {
  const {
    includeTrail,
    setIncludeTrail,
    includeTreadmill,
    setIncludeTreadmill,
  } = useDashboard()

  return (
    <div className="flex flex-col gap-0.5">
      <ToggleRow
        label="Trail runs"
        checked={includeTrail}
        onChange={setIncludeTrail}
      />
      <ToggleRow
        label="Treadmill runs"
        checked={includeTreadmill}
        onChange={setIncludeTreadmill}
      />
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-(--ink-2) hover:bg-(--card-2) transition-colors cursor-pointer"
    >
      <span>{label}</span>
      <span
        className={`relative inline-block w-7 h-4 rounded-full transition-colors ${
          checked ? 'bg-(--accent)' : 'bg-(--line)'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-3' : ''
          }`}
        />
      </span>
    </button>
  )
}
