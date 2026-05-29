'use client'

import { useEffect } from 'react'

export function useCardGlow() {
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.card'))
    const cleanups: Array<() => void> = []

    cards.forEach((c) => {
      let raf = 0
      let pending: { x: number; y: number } | null = null

      const onMove = (e: MouseEvent) => {
        const r = c.getBoundingClientRect()
        pending = { x: e.clientX - r.left, y: e.clientY - r.top }
        if (raf) return
        raf = requestAnimationFrame(() => {
          raf = 0
          if (!pending) return
          c.style.setProperty('--mx', `${pending.x}px`)
          c.style.setProperty('--my', `${pending.y}px`)
          pending = null
        })
      }

      c.addEventListener('mousemove', onMove)
      cleanups.push(() => {
        c.removeEventListener('mousemove', onMove)
        if (raf) cancelAnimationFrame(raf)
      })
    })

    return () => cleanups.forEach((fn) => fn())
  }, [])
}
