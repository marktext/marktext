'use client'

import { useCallback, useEffect, useState } from 'react'

const KEY = 'marktext-theme'
export type Theme = 'dark' | 'light'

export function useTheme(): [Theme, (next: Theme) => void, () => void] {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme | null) || 'dark'
    setThemeState(current)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* ignore */
    }
    setThemeState(next)
  }, [])

  const toggle = useCallback(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme | null) || 'dark'
    setTheme(current === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  return [theme, setTheme, toggle]
}
