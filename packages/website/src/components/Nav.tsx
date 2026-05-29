'use client'

import { useRef } from 'react'
import { DOWNLOAD } from '@/lib/downloads'
import { useTheme } from '@/hooks/useTheme'
import { useNavShrink } from '@/hooks/useNavShrink'
import { GitHubIcon, MoonIcon, SunIcon } from './Icons'

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)
  const [theme, , toggle] = useTheme()
  useNavShrink(navRef)

  return (
    <nav className="nav" id="nav" ref={navRef}>
      <a className="brand" href="#top">
        <img className="mark" src="/assets/logo.png" alt="MarkText logo" />
        MarkText
      </a>
      <div className="nav-links">
        <a href="#preview">Features</a>
        <a href="#themes">Themes</a>
        <a href="#extensions">Markdown</a>
        <a href="#support">Support</a>
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
          {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
        </button>
        <a className="icon-btn" href={DOWNLOAD.repo} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <GitHubIcon />
        </a>
        <a className="btn btn-primary" href="#download">
          Download
        </a>
      </div>
    </nav>
  )
}
