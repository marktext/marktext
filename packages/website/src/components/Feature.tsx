import React, { useState, useRef, useEffect } from 'react'
import mermaid from 'mermaid'
import tableMd from '../markdowns/table.md'
import diagramMd from '../markdowns/diagram.md'
import inlineFormatsMd from '../markdowns/inlineFormats.md'
import mathFormulaMd from '../markdowns/mathFormula.md'
import codeBlockMd from '../markdowns/codeBlock.md'
import markdownToHtml from '../utils/markdownToHtml'
import 'katex/dist/katex.min.css'
import './Feature.css'

interface FeatureItem {
  title: string
  description: string
  markdown: string
}

const features: FeatureItem[] = [
  {
    title: 'Table Block',
    description: 'Support GFM table block, you can remove/add rows and columns.',
    markdown: tableMd
  },
  {
    title: 'Diagram',
    description: 'Support Flowchart, Sequence diagram, Gantt diagram, Vega chart.',
    markdown: diagramMd
  },
  {
    title: 'Inline Formats',
    description: 'Support CommonMark and GitHub Flavored Markdown Spec.',
    markdown: inlineFormatsMd
  },
  {
    title: 'Math Formula',
    description: 'Markdown extensions math expressions (KaTeX)',
    markdown: mathFormulaMd
  },
  {
    title: 'Code Block',
    description: 'Support GFM code fense, highlight by prismjs.',
    markdown: codeBlockMd
  }
]

const Feature: React.FC = () => {
  const [selectedFeature, setSelectedFeature] = useState<FeatureItem>(features[0])
  const [htmlContent, setHtmlContent] = useState<string>('')
  const muyaContainerRef = useRef<HTMLDivElement>(null)

  // 初始化 mermaid 配置
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default'
    })
  }, [])

  const renderMermaid = async () => {
    if (!muyaContainerRef.current) return

    const codes = muyaContainerRef.current.querySelectorAll('code.language-mermaid')
    codes.forEach((code) => {
      const preEle = code.parentNode as HTMLElement
      const mermaidContainer = document.createElement('div')
      mermaidContainer.textContent = code.textContent ?? ''
      mermaidContainer.classList.add('mermaid')
      preEle.replaceWith(mermaidContainer)
    })

    const divs = muyaContainerRef.current.querySelectorAll<HTMLElement>('div.mermaid')
    const unrendered = Array.from(divs).filter((d) => !d.querySelector('svg'))
    if (unrendered.length === 0) return

    try {
      await mermaid.run({ nodes: unrendered })
    } catch (error) {
      console.error('Mermaid render error:', error)
    }
  }

  useEffect(() => {
    let cancelled = false
    markdownToHtml(selectedFeature.markdown)
      .then((html) => {
        if (!cancelled) setHtmlContent(html)
      })
      .catch((error) => {
        console.error('Error generating HTML:', error)
        if (!cancelled) setHtmlContent('<p>Error rendering content</p>')
      })
    return () => {
      cancelled = true
    }
  }, [selectedFeature])

  useEffect(() => {
    if (!htmlContent) return
    if (selectedFeature.title === 'Diagram') {
      void renderMermaid()
    }
  }, [htmlContent, selectedFeature])

  const handleSelect = (feature: FeatureItem) => {
    setSelectedFeature(feature)
  }

  return (
    <div className="feature">
      <h2 className="slogan" id="features">&lt; Features /&gt;</h2>
      <div className="feature-list">
        <ul>
          {features.map((feature) => (
            <li
              key={feature.title}
              onClick={() => handleSelect(feature)}
              className={feature.title === selectedFeature.title ? 'active' : ''}
            >
              <div className="title">{feature.title}</div>
              <div className="description">{feature.description}</div>
            </li>
          ))}
        </ul>
      </div>
      <div className="feature-images">
        <div className="image-list">
          <div className="app-container">
            <div className="app-header">
              <span className="dot red"></span>
              <span className="dot orange"></span>
              <span className="dot green"></span>
              <span className="feature-name">{selectedFeature.title}</span>
            </div>
            <div
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              ref={muyaContainerRef}
            ></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Feature
