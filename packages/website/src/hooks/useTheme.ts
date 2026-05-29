'use client'

import { useCallback } from 'react'
import { THEME_STORAGE_KEY } from '@/lib/sections'

type Theme = 'dark' | 'light'

export function useToggleTheme(): () => void {
  return useCallback(() => {
    const current =
      (document.documentElement.getAttribute('data-theme') as Theme | null) || 'dark'
    const next: Theme = current === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])
}
