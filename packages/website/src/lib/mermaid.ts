'use client'

import { useEffect, type DependencyList, type RefObject } from 'react'

type MermaidApi = typeof import('mermaid').default

let mermaidPromise: Promise<MermaidApi> | null = null

function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((m) => {
    m.default.initialize({ startOnLoad: false, theme: 'default' })
    return m.default
  })
  return mermaidPromise
}

export async function setMermaidTheme(theme: 'default' | 'dark'): Promise<void> {
  const mermaid = await loadMermaid()
  mermaid.initialize({ startOnLoad: false, theme })
}

export async function runMermaid(nodes: HTMLElement[]): Promise<void> {
  const unrendered = nodes.filter((n) => !n.querySelector('svg'))
  if (unrendered.length === 0) return
  const mermaid = await loadMermaid()
  try {
    await mermaid.run({ nodes: unrendered })
  } catch (err) {
    console.error('Mermaid render error:', err)
  }
}

// Re-render mermaid diagrams inside `ref` whenever `deps` change. Short-circuits
// before loading mermaid when no unrendered diagrams are present, so non-diagram
// tab switches do not pay the ~500KB bundle download.
export function useMermaidRender(
  ref: RefObject<HTMLElement | null>,
  deps: DependencyList
): void {
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const nodes = container.querySelectorAll<HTMLElement>('div.mermaid')
    const unrendered = Array.from(nodes).filter((n) => !n.querySelector('svg'))
    if (unrendered.length === 0) return
    void runMermaid(unrendered)
    // ref is stable; deps drive re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
