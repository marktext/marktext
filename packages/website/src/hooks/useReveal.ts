'use client'

import { useEffect } from 'react'

export function useReveal() {
  useEffect(() => {
    const all = document.querySelectorAll<HTMLElement>('.reveal')

    if (!('IntersectionObserver' in window)) {
      all.forEach((el) => el.classList.add('in'))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            ;(en.target as HTMLElement).classList.add('in')
            io.unobserve(en.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px' }
    )
    all.forEach((el) => io.observe(el))

    // Failsafe: embedded/preview environments that never trigger IO callbacks
    // still need content visible.
    const failsafe = window.setTimeout(() => {
      document
        .querySelectorAll<HTMLElement>('.reveal:not(.in)')
        .forEach((el) => el.classList.add('in'))
    }, 1300)

    return () => {
      io.disconnect()
      window.clearTimeout(failsafe)
    }
  }, [])
}
