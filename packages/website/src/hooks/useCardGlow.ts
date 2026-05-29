'use client'

import { useEffect, type RefObject } from 'react'

export function useCardGlow(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.card'))
    const handlers = new WeakMap<HTMLElement, (e: MouseEvent) => void>()

    cards.forEach((c) => {
      const handler = (e: MouseEvent) => {
        const r = c.getBoundingClientRect()
        c.style.setProperty('--mx', `${e.clientX - r.left}px`)
        c.style.setProperty('--my', `${e.clientY - r.top}px`)
      }
      handlers.set(c, handler)
      c.addEventListener('mousemove', handler)
    })

    return () => {
      cards.forEach((c) => {
        const h = handlers.get(c)
        if (h) c.removeEventListener('mousemove', h)
      })
    }
  }, [containerRef])
}
