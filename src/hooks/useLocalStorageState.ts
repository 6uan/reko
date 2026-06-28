import { useCallback, useEffect, useState } from 'react'

type LocalStorageStateOptions<T> = {
  key: string
  defaultValue: T
  parse: (stored: string) => T | null
  serialize?: (value: T) => string
}

function defaultSerialize(value: unknown): string {
  return String(value)
}

/**
 * Hydration-safe localStorage state.
 *
 * The first render always uses `defaultValue`, so server HTML and the browser's
 * hydration pass match. Stored preferences are read after mount.
 */
export function useLocalStorageState<T>({
  key,
  defaultValue,
  parse,
  serialize = defaultSerialize,
}: LocalStorageStateOptions<T>): [T, (next: T) => void] {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(key)
      if (stored === null) return

      const parsed = parse(stored)
      if (parsed !== null) setValue(parsed)
    } catch {
      // Storage can be disabled or unavailable; the default remains usable.
    }
  }, [key, parse])

  const setStoredValue = useCallback(
    (next: T) => {
      setValue(next)

      if (typeof window === 'undefined') return

      try {
        window.localStorage.setItem(key, serialize(next))
      } catch {
        // Keep in-memory state even when persistence fails.
      }
    },
    [key, serialize],
  )

  return [value, setStoredValue]
}
