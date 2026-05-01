import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * 36px-tall bordered-card button. Square at min content (icon-only) and
 * grows into a pill when given a sibling label (icon + name).
 *
 * One visual style, used wherever we need a bordered-card affordance
 * sitting on the page chrome (header chips, topbar nav triggers, profile
 * entry). Centralised so the border / hover / transition stay identical
 * across surfaces — a future visual tweak (e.g. focus ring, radius bump)
 * lands in one place.
 *
 * Sizing — by content, not by prop:
 *   `min-w-9 h-9 px-2 gap-2` is the trick that makes one component serve
 *   both icon-only and icon+label cases without a variant flag:
 *     - Icon-only (one child, ≤20px): min-width clamps to 36px. With
 *       18–20px icons, content + padding (≤36px) doesn't exceed the min,
 *       so min-width still wins and the button stays a 36×36 square.
 *     - Icon + label: the second child pushes total content past 36px,
 *       inline-flex grows to fit, gap-2 spaces the children, and the
 *       button reads as a pill.
 *
 * Composition:
 *   - Base classes own the visual identity (size, border, hover, transition).
 *   - `className` from the caller is merged via `cn` (tailwind-merge), so
 *     overrides like `rounded-full` cleanly replace the default radius
 *     instead of fighting it. Use it for positional / responsive overrides
 *     (`lg:hidden`) or shape tweaks. Avoid overriding the bordered-card
 *     identity here — if a callsite needs a different visual, add a
 *     variant prop so the divergence is intentional and documented.
 *
 * Children:
 *   - One: an icon (lucide / react-icons), Avatar, inline SVG.
 *   - Two: icon + label span. The button grows naturally into a pill.
 *
 * Accessibility:
 *   - Icon-only buttons MUST be given an `aria-label` by the caller —
 *     there's no text content for assistive tech to fall back to. Not
 *     enforced by types (HTMLButtonElement allows omission) so reviewers
 *     should sanity-check at the callsite.
 *   - `type="button"` defaults defensively. Without it, a button inside
 *     a form silently becomes a submit button — biting bug, easy fix.
 *
 * Ref forwarding:
 *   - Forwarded so callers can imperatively focus the trigger (e.g.
 *     restoring focus to the open-nav button after the drawer closes,
 *     which we don't do today but will likely want soon).
 */
const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function IconButton({ className, type = 'button', children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center min-w-9 h-9 px-2 gap-2 rounded-(--radius-s) border border-(--line) bg-(--card) text-(--ink-2) cursor-pointer transition-[background,border-color,color] duration-180 ease-in-out hover:border-(--ink-4) hover:text-(--ink)',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    )
  },
)

export default IconButton
