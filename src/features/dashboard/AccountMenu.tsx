/**
 * Account / preferences popover, anchored to the sidebar ProfileCard. Opens
 * upward (it lives at the bottom of the sidebar). Holds client-side dashboard
 * prefs — run-type inclusion + units — plus profile / logout.
 *
 * Note: the run-type toggles affect the analytics tabs (which filter client
 * side from DashboardContext); the Records tab is server-pre-aggregated and
 * doesn't honor them yet.
 */

import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LuSettings2 } from 'react-icons/lu'
import { useDashboard } from './DashboardContext'
import { clearSessionFn } from '@/features/auth/session'

export default function AccountMenu() {
  const {
    unit,
    toggleUnit,
    includeTrail,
    setIncludeTrail,
    includeTreadmill,
    setIncludeTreadmill,
  } = useDashboard()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await clearSessionFn()
    navigate({ to: '/' })
  }

  return (
    <>
      <button
        type="button"
        aria-label="Account settings"
        title="Account settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="absolute top-1.5 right-9 w-7 h-7 inline-flex items-center justify-center rounded-md text-(--ink-3) hover:text-(--ink) hover:bg-(--card-2) transition-colors"
      >
        <LuSettings2 size={14} />
      </button>

      {open && (
        <>
          {/* Click-away backdrop. */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute bottom-full right-0 mb-2 w-60 z-50 rounded-(--radius-s) border border-(--line) bg-(--card) shadow-(--shadow-m) p-2 flex flex-col gap-0.5">
            <SectionLabel>Run types</SectionLabel>
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

            <Divider />

            <SectionLabel>Units</SectionLabel>
            <div className="flex gap-1 px-1 pb-1">
              <UnitChip active={unit === 'mi'} onClick={() => toggleUnit('mi')}>
                Miles
              </UnitChip>
              <UnitChip active={unit === 'km'} onClick={() => toggleUnit('km')}>
                Kilometers
              </UnitChip>
            </div>

            <Divider />

            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="px-2 py-1.5 rounded-md text-sm text-(--ink-2) no-underline hover:bg-(--card-2) transition-colors"
            >
              Profile & settings
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="text-left px-2 py-1.5 rounded-md text-sm text-(--ink-2) hover:bg-(--card-2) transition-colors cursor-pointer"
            >
              Log out
            </button>
          </div>
        </>
      )}
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-(--ink-4)">
      {children}
    </div>
  )
}

function Divider() {
  return <div className="my-1 border-t border-(--line)" />
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

function UnitChip({
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
      className={`flex-1 px-2 py-1 rounded-md text-xs transition-colors cursor-pointer ${
        active
          ? 'bg-(--accent-soft) text-(--ink)'
          : 'text-(--ink-3) hover:bg-(--card-2)'
      }`}
    >
      {children}
    </button>
  )
}
