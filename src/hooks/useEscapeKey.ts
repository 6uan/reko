import { useEffect } from 'react'

/**
 * Call `onEscape` when the Escape key is pressed, but only while
 * `active` is true. Cleans up the listener when deactivated or
 * unmounted.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onEscape])
}
