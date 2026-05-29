'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { DOWNLOAD } from '@/lib/downloads'
import { useToggleTheme } from '@/hooks/useTheme'
import { GitHubIcon, MoonIcon, SearchIcon, SunIcon } from '@/components/Icons'

type Props = {
  onSearchOpen: () => void
}

export default function DocsHeader({ onSearchOpen }: Props) {
  const toggleTheme = useToggleTheme()
  const [shortcut, setShortcut] = useState<string | null>(null)

  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K')
  }, [])

  return (
    <header className="dochdr">
      <div className="dochdr-in">
        <Link className="brand" href="/">
          <img className="mark" src="/assets/logo.png" alt="MarkText logo" />
          <span>MarkText</span>
          <span className="divider" aria-hidden />
          <span className="sub">Docs</span>
        </Link>
        <button
          type="button"
          className="docnav-search"
          onClick={onSearchOpen}
          aria-label="Search docs"
        >
          <SearchIcon />
          <span className="ph">Search docs…</span>
          <span className="kbd" suppressHydrationWarning>
            {shortcut ?? '⌘K'}
          </span>
        </button>
        <div className="dochdr-right">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            <MoonIcon className="theme-icon theme-icon-dark" />
            <SunIcon className="theme-icon theme-icon-light" />
          </button>
          <a
            className="icon-btn"
            href={DOWNLOAD.repo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
          >
            <GitHubIcon />
          </a>
          <Link className="doc-cta" href="/#download">
            Download
          </Link>
        </div>
      </div>
    </header>
  )
}
