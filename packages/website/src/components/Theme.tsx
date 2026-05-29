import React, { useState, useRef, useEffect } from 'react'
import themeMd from '../markdowns/themes.md'
import mermaid from 'mermaid'
import { addThemeStyle } from '../utils/theme'
import markdownToHtml from '../utils/markdownToHtml'

import 'katex/dist/katex.min.css'
import '../themes/default.css'
import './Theme.css'

interface ThemeItem {
  name: string
  label: string
  color: string
}

const lightThemes: ThemeItem[] = [
  {
    name: 'Cadmium Light',
    label: 'light',
    color: 'rgba(33, 181, 111, 1)'
  },
  {
    name: 'Graphite Light',
    label: 'graphite',
    color: 'rgb(104, 134, 170)'
  },
  {
    name: 'Ulysses Light',
    label: 'ulysses',
    color: 'rgb(12, 139, 186)'
  }
]

const darkThemes: ThemeItem[] = [
  {
    name: 'Dark',
    label: 'dark',
    color: '#409eff'
  },
  {
    name: 'Material Dark',
    label: 'material-dark',
    color: '#f48237'
  },
  {
    name: 'One Dark',
    label: 'one-dark',
    color: '#e2c08d'
  }
]

const Theme: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeItem>(lightThemes[0])
  const [themeHtml, setThemeHtml] = useState<string>('')
  const muyaContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    markdownToHtml(themeMd)
      .then(html => {
        if (!cancelled) setThemeHtml(html)
      })
      .catch(error => {
        console.error('Error rendering theme markdown:', error)
        if (!cancelled) setThemeHtml('<p>Error rendering theme content</p>')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!themeHtml || !muyaContainerRef.current) return
    const codes = muyaContainerRef.current.querySelectorAll('code.language-mermaid')
    for (const code of codes) {
      const preEle = code.parentNode as HTMLElement
      const mermaidContainer = document.createElement('div')
      mermaidContainer.innerHTML = code.innerHTML
      mermaidContainer.classList.add('mermaid')
      preEle.replaceWith(mermaidContainer)
    }
    mermaid.init({}, muyaContainerRef.current.querySelectorAll('div.mermaid'))
  }, [themeHtml])

  const selectTheme = (theme: ThemeItem) => {
    if (/dark/i.test(theme.label)) {
      mermaid.initialize({
        theme: 'dark'
      })
    } else {
      mermaid.initialize({
        theme: 'default'
      })
    }
    addThemeStyle(theme.label)
    setCurrentTheme(theme)
  }

  return (
    <div className="theme">
      <h2 className="slogan" id="themes">&#123; Themes &#125;</h2>
      <img src={new URL('../assets/notes.image.svg', import.meta.url).href} alt="" className="bg-image" />
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
