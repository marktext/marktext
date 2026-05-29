'use client'

import { useState, useRef, useEffect } from 'react'
import mermaid from 'mermaid'
import { addThemeStyle } from '@/utils/theme'
import { markdownHtml } from '@/lib/markdown'

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

const Theme: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeItem>(lightThemes[0])
  const muyaContainerRef = useRef<HTMLDivElement>(null)
  const themeHtml = markdownHtml.themes ?? ''

  useEffect(() => {
    if (!themeHtml || !muyaContainerRef.current) return
    const nodes = muyaContainerRef.current.querySelectorAll<HTMLElement>('div.mermaid')
    const unrendered = Array.from(nodes).filter((d) => !d.querySelector('svg'))
    if (unrendered.length === 0) return
    void mermaid.run({ nodes: unrendered }).catch((err) => console.error('Mermaid render error:', err))
  }, [themeHtml, currentTheme])

  const selectTheme = (theme: ThemeItem) => {
    mermaid.initialize({ theme: /dark/i.test(theme.label) ? 'dark' : 'default', startOnLoad: false })
    addThemeStyle(theme.label)
    setCurrentTheme(theme)
    if (muyaContainerRef.current) {
      const nodes = muyaContainerRef.current.querySelectorAll<HTMLElement>('div.mermaid')
      nodes.forEach((n) => {
        const original = n.getAttribute('data-source')
        if (original) n.textContent = original
        n.removeAttribute('data-processed')
      })
    }
  }

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
                onClick={() => selectTheme(theme)}
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
                onClick={() => selectTheme(theme)}
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
