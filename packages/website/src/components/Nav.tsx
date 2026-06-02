'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { SECTIONS, hash } from '@/lib/sections'
import { useToggleTheme } from '@/hooks/useTheme'
import { useNavShrink } from '@/hooks/useNavShrink'
import Brand from './Brand'
import { GitHubIcon, MoonIcon, SunIcon } from './Icons'

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)
  const toggle = useToggleTheme()
  useNavShrink(navRef)

  return (
    <nav className="nav" id="nav" ref={navRef}>
      <Brand />
      <div className="nav-links">
        <a href={hash(SECTIONS.preview)}>Features</a>
        <a href={hash(SECTIONS.themes)}>Themes</a>
        <a href={hash(SECTIONS.extensions)}>Markdown</a>
        <Link href="/docs">Docs</Link>
        <a href={hash(SECTIONS.support)}>Support</a>
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
        <a className="icon-btn" href={DOWNLOAD.repo} {...EXT_LINK} aria-label="GitHub">
          <GitHubIcon />
        </a>
        <a className="btn btn-primary" href={DOWNLOAD.releases} {...EXT_LINK}>
          Download
        </a>
      </div>
    </nav>
  )
}
