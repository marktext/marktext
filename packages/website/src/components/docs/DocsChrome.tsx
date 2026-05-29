'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import DocsHeader from './DocsHeader'
import DocsTabs from './DocsTabs'
import CommandPalette from './CommandPalette'
import CopyButton from './CopyButton'
import { findPageBySlug, type DocTabId } from '@/lib/docs-nav'

type Props = {
  children: React.ReactNode
}

export default function DocsChrome({ children }: Props) {
  const pathname = usePathname() ?? '/docs'
  const [paletteOpen, setPaletteOpen] = useState(false)

  const activeTab: DocTabId = useMemo(() => {
    const segments = pathname
      .replace(/^\/docs\/?/, '')
      .split('/')
      .filter(Boolean)
    const page = findPageBySlug(segments)
    return page?.tab ?? 'user'
  }, [pathname])

  useEffect(() => {
    document.documentElement.setAttribute('data-doctab', activeTab)
  }, [activeTab])

  useEffect(() => {
    document.body.classList.add('docs')
    return () => document.body.classList.remove('docs')
  }, [])

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.isComposing) return
      const mod = ev.metaKey || ev.ctrlKey
      if (mod && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault()
        setPaletteOpen((s) => !s)
        return
      }
      if (ev.key === '/') {
        const target = ev.target as HTMLElement | null
        const tag = target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
        ev.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const openPalette = useCallback(() => setPaletteOpen(true), [])

  return (
    <>
      <DocsHeader onSearchOpen={openPalette} />
      <DocsTabs activeTab={activeTab} />
      {children}
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <CopyButton />
    </>
  )
}
