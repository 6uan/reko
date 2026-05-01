import { useEffect, useState } from 'react'
import { LuSunDim, LuMoon } from 'react-icons/lu'
import IconButton from './IconButton'

type ThemeMode = 'light' | 'dark'

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(mode)
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('light')

  useEffect(() => {
    const initial = getInitialMode()
    setMode(initial)
    applyTheme(initial)
  }, [])

  function toggle() {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    applyTheme(next)
    window.localStorage.setItem('theme', next)
  }

  const Icon = mode === 'light' ? LuSunDim : LuMoon
  const label = mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'

  return (
    <IconButton onClick={toggle} aria-label={label} title={label}>
      <Icon size={18} />
    </IconButton>
  )
}
