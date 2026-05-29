'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { DOWNLOAD } from '@/lib/downloads'
import { SECTIONS } from '@/lib/sections'
import { useToggleTheme } from '@/hooks/useTheme'
import { useNavShrink } from '@/hooks/useNavShrink'
import { GitHubIcon, MoonIcon, SunIcon } from './Icons'

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)
  const toggle = useToggleTheme()
  useNavShrink(navRef)

  return (
    <nav className="nav" id="nav" ref={navRef}>
      <a className="brand" href={SECTIONS.top}>
        <img className="mark" src="/assets/logo.png" alt="MarkText logo" width={28} height={28} />
        MarkText
      </a>
      <div className="nav-links">
        <a href={SECTIONS.preview}>Features</a>
        <a href={SECTIONS.themes}>Themes</a>
        <a href={SECTIONS.extensions}>Markdown</a>
        <Link href="/docs">Docs</Link>
        <a href={SECTIONS.support}>Support</a>
      </div>
      <div className="nav-right">
        <button
          type="button"
          className="icon-btn"
          id="themeToggle"
          aria-label="Toggle theme"
          title="Toggle theme"
          onClick={toggle}
        >
          <MoonIcon className="theme-moon" />
          <SunIcon className="theme-sun" />
        </button>
        <a className="icon-btn" href={DOWNLOAD.repo} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <GitHubIcon />
        </a>
        <a className="btn btn-primary" href={SECTIONS.download}>
          Download
        </a>
      </div>
    </nav>
  )
}
