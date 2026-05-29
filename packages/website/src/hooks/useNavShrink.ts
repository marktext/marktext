'use client'

import { useEffect, type RefObject } from 'react'

export function useNavShrink(navRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    let last = -1
    const onScroll = () => {
      const y = window.scrollY > 20 ? 1 : 0
      if (y === last) return
      last = y
      nav.classList.toggle('is-shrunk', y === 1)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [navRef])
}
