/**
 * Conditional class composition for Tailwind, in the shadcn/ui style.
 *
 *   cn('base', condition && 'extra', { 'is-active': isActive }, props.className)
 *
 * Two layers, both load-bearing:
 *
 *   clsx — handles falsy / arrays / objects so callers can write naturally
 *   without `${a ? 'x' : ''} ${b ? 'y' : ''}` ladders. Safe for any
 *   className soup, not just Tailwind.
 *
 *   tailwind-merge — resolves Tailwind conflicts by *last-wins semantics*,
 *   not just string concat. `cn('p-4', 'p-6')` → `'p-6'`. Without this,
 *   passing `className="rounded-full"` to a component whose base classes
 *   include `rounded-[var(--radius-s)]` produces both classes in the
 *   output and the visual "winner" is whichever Tailwind happened to
 *   generate later in its CSS — flaky and surprising. twMerge looks at
 *   the conflict groups (border-radius, padding, etc.) and drops earlier
 *   classes from the same group.
 *
 * Anti-pattern: don't pre-flatten with template strings before passing
 * to cn — twMerge can only deconflict tokens it can see as separate
 * arguments. `cn(\`p-4 \${props.className}\`)` still merges, but
 * `cn('p-4', props.className)` is clearer about intent.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
