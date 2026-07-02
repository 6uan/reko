/**
 * Floating pill over the hero's dashboard mockup — the mockup is a
 * picture of the product, so it doubles as the demo's front door.
 * Overlaid rather than wrapping: the mockup has its own interactive
 * bits (unit toggle), and a full-surface button would swallow them.
 */

import { LuPlay } from 'react-icons/lu'
import { useLaunchDemo } from '@/features/demo/useLaunchDemo'

export default function DemoMockupCta() {
  const { state, launch } = useLaunchDemo()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
      <button
        type="button"
        onClick={launch}
        disabled={state !== 'idle'}
        className="pointer-events-auto inline-flex cursor-pointer items-center gap-2 rounded-full border border-(--line) bg-(--bg-elev) px-4 py-2 text-[13px] font-medium text-(--ink) shadow-(--shadow-xl) transition-transform hover:scale-[1.03] disabled:opacity-60"
      >
        <LuPlay size={14} className="text-(--accent)" />
        {state === 'pending'
          ? 'Loading demo…'
          : state === 'unavailable'
            ? 'Demo unavailable'
            : 'Explore the live demo'}
      </button>
    </div>
  )
}
