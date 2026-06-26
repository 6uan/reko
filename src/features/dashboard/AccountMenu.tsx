/**
 * Account / preferences popover, anchored to the sidebar ProfileCard. Opens
 * upward (it lives at the bottom of the sidebar). Holds the client-side
 * run-type inclusion prefs, plus profile / logout. (Units live in the topbar.)
 *
 * Note: the run-type toggles affect the analytics tabs (which filter client
 * side from DashboardContext); the Records tab is server-pre-aggregated and
 * doesn't honor them yet.
 */

import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LuSettings2 } from 'react-icons/lu'
import RunTypeToggles from './RunTypeToggles'
import { clearSessionFn } from '@/features/auth/session'

export default function AccountMenu() {
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
            <RunTypeToggles />

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


