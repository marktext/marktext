'use client'

import { useEffect, type RefObject } from 'react'

export function useTilt(
  stageRef: RefObject<HTMLElement | null>,
  winRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const stage = stageRef.current
    const win = winRef.current
    if (!stage || !win) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(hover: none)').matches) return

    let raf: number | null = null

    const onMove = (e: MouseEvent) => {
      const r = stage.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        win.style.transform = `rotateX(${-py * 3.5}deg) rotateY(${px * 4}deg) translateY(-2px)`
      })
    }
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf)
      win.style.transform = ''
    }

    stage.addEventListener('mousemove', onMove)
    stage.addEventListener('mouseleave', onLeave)
    return () => {
      stage.removeEventListener('mousemove', onMove)
      stage.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [stageRef, winRef])
}
