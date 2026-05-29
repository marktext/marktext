'use client'

import { useState, useRef, useEffect } from 'react'
import { addThemeStyle } from '@/utils/theme'
import { markdownHtml } from '@/generated/markdown-html'
import { setMermaidTheme, runMermaid } from '@/lib/mermaid'

interface ThemeItem {
  name: string
  label: string
  color: string
}

const lightThemes: ThemeItem[] = [
  { name: 'Cadmium Light', label: 'light', color: 'rgba(33, 181, 111, 1)' },
  { name: 'Graphite Light', label: 'graphite', color: 'rgb(104, 134, 170)' },
  { name: 'Ulysses Light', label: 'ulysses', color: 'rgb(12, 139, 186)' }
]

const darkThemes: ThemeItem[] = [
  { name: 'Dark', label: 'dark', color: '#409eff' },
  { name: 'Material Dark', label: 'material-dark', color: '#f48237' },
  { name: 'One Dark', label: 'one-dark', color: '#e2c08d' }
]

const isDarkLabel = (label: string) => /dark/i.test(label)

const Theme: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeItem>(lightThemes[0])
  const muyaContainerRef = useRef<HTMLDivElement>(null)
  const themeHtml = markdownHtml.themes ?? ''
  const isDark = isDarkLabel(currentTheme.label)

  // Swap the page CSS on every theme change (light themes need this too).
  useEffect(() => {
    addThemeStyle(currentTheme.label)
  }, [currentTheme])

  // Repaint mermaid only when darkness flips: all light themes share mermaid's
  // 'default' theme and all dark themes share 'dark', so light↔light switches
  // do not need a re-render. Initial mount also runs here.
  useEffect(() => {
    const container = muyaContainerRef.current
    if (!container) return
    let cancelled = false
    void (async () => {
      await setMermaidTheme(isDark ? 'dark' : 'default')
      if (cancelled) return
      const nodes = container.querySelectorAll<HTMLElement>('div.mermaid')
      nodes.forEach((n) => {
        const src = n.getAttribute('data-source')
        if (src) n.textContent = src
        n.removeAttribute('data-processed')
      })
      await runMermaid(Array.from(nodes))
    })()
    return () => {
      cancelled = true
    }
  }, [isDark])

  return (
    <div className="theme">
      <h2 className="slogan" id="themes">{'{ Themes }'}</h2>
      <img src="/assets/notes.image.svg" alt="" className="bg-image" />
      <div className="app-container">
        <div className="app-header">
          <span className="dot red"></span>
          <span className="dot orange"></span>
          <span className="dot green"></span>
          <span className="feature-name">{currentTheme.name}</span>
        </div>
        <div dangerouslySetInnerHTML={{ __html: themeHtml }} ref={muyaContainerRef}></div>
      </div>
      <div className="theme-list">
        <div className="light-themes">
          <h5>Light themes</h5>
          <ul>
            {lightThemes.map((theme) => (
              <li
                key={theme.name}
                className={theme.name === currentTheme.name ? 'active' : ''}
                onClick={() => setCurrentTheme(theme)}
              >
                <span style={{ background: theme.color, boxShadow: `0 3px 12px 0 ${theme.color}` }}></span>
                <span>{theme.name}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="dark-themes">
          <h5>Dark themes</h5>
          <ul>
            {darkThemes.map((theme) => (
              <li
                key={theme.name}
                className={theme.name === currentTheme.name ? 'active' : ''}
                onClick={() => setCurrentTheme(theme)}
              >
                <span style={{ background: theme.color, boxShadow: `0 3px 12px 0 ${theme.color}` }}></span>
                <span>{theme.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Theme
