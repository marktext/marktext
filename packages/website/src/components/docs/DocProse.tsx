'use client'

import { useEffect, useId, useRef } from 'react'

export default function DocProse({ html }: { html: string }) {
  const root = useRef<HTMLDivElement>(null)
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  useEffect(() => {
    const diagrams = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-diagram-language]') ?? [])
    if (!diagrams.length) return
    let cancelled = false
    let revision = 0
    let queue = Promise.resolve()
    const disposers: (() => void)[] = []

    function render() {
      const current = ++revision
      const dark = document.documentElement.dataset.theme !== 'light'
      // Mermaid shares configuration globally; serialize theme changes so stale
      // renders cannot overwrite diagrams from the current theme.
      queue = queue.then(async () => {
        if (cancelled || current !== revision) return
        const { renderDiagram } = await import('@/lib/render-diagram')
        if (cancelled || current !== revision) return
        for (const dispose of disposers.splice(0)) dispose()
        for (const [index, diagram] of diagrams.entries()) {
          if (cancelled || current !== revision) return
          const target = document.createElement('div')
          diagram.replaceChildren(target)
          try {
            const dispose = await renderDiagram(
              target,
              diagram.dataset.diagramLanguage ?? '',
              diagram.dataset.diagramSource ?? '',
              `diagram-${id}-${current}-${index}`,
              dark
            )
            if (cancelled || current !== revision) {
              dispose()
              return
            }
            disposers.push(dispose)
          } catch {
            if (cancelled || current !== revision) return
            diagram.textContent = 'Unable to render diagram. Expand the source below.'
            diagram.closest('figure')?.querySelector('details')?.setAttribute('open', '')
          }
        }
      })
    }

    render()
    const observer = new MutationObserver(render)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      cancelled = true
      observer.disconnect()
      for (const dispose of disposers.splice(0)) dispose()
    }
  }, [html, id])

  return <div ref={root} className="prose" dangerouslySetInnerHTML={{ __html: html }} />
}
