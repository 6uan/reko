import { useEffect } from 'react'

/**
 * Lock body scroll while `active` is true. Restores the previous
 * overflow value on cleanup. Useful for fullscreen drawers / modals
 * where the underlying page shouldn't scroll (iOS especially leaks
 * scroll otherwise).
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}
