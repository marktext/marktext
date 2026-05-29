'use client'

import { useState, useRef, useEffect } from 'react'
import mermaid from 'mermaid'
import { markdownHtml } from '@/lib/markdown'

interface FeatureItem {
  title: string
  description: string
  key: string
}

const features: FeatureItem[] = [
  { title: 'Table Block', description: 'Support GFM table block, you can remove/add rows and columns.', key: 'table' },
  { title: 'Diagram', description: 'Support Flowchart, Sequence diagram, Gantt diagram, Vega chart.', key: 'diagram' },
  { title: 'Inline Formats', description: 'Support CommonMark and GitHub Flavored Markdown Spec.', key: 'inlineFormats' },
  { title: 'Math Formula', description: 'Markdown extensions math expressions (KaTeX)', key: 'mathFormula' },
  { title: 'Code Block', description: 'Support GFM code fence, highlight by prismjs.', key: 'codeBlock' }
]

const Feature: React.FC = () => {
  const [selectedFeature, setSelectedFeature] = useState<FeatureItem>(features[0])
  const muyaContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'default' })
  }, [])

  useEffect(() => {
    if (selectedFeature.key !== 'diagram') return
    const container = muyaContainerRef.current
    if (!container) return
    const nodes = container.querySelectorAll<HTMLElement>('div.mermaid')
    const unrendered = Array.from(nodes).filter((d) => !d.querySelector('svg'))
    if (unrendered.length === 0) return
    void mermaid.run({ nodes: unrendered }).catch((err) => console.error('Mermaid render error:', err))
  }, [selectedFeature])

  const htmlContent = markdownHtml[selectedFeature.key] ?? ''

  return (
    <div className="feature">
      <h2 className="slogan" id="features">{'< Features />'}</h2>
      <div className="feature-list">
        <ul>
          {features.map((feature) => (
            <li
              key={feature.title}
              onClick={() => setSelectedFeature(feature)}
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
              key={selectedFeature.key}
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
