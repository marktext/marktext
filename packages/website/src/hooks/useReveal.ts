'use client'

import { useEffect } from 'react'

export function useReveal() {
  useEffect(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    const pending = new Set(all)

    const reveal = (el: HTMLElement) => {
      el.classList.add('in')
      pending.delete(el)
    }

    const check = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight
      pending.forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.top < vh * 0.92 && r.bottom > 0) reveal(el)
      })
    }

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        check()
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    check()
    requestAnimationFrame(check)
    const t1 = window.setTimeout(check, 250)
    const t2 = window.setTimeout(check, 700)
    window.addEventListener('load', check)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(check).catch(() => {})
    }

    let io: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              reveal(en.target as HTMLElement)
              io?.unobserve(en.target)
            }
          })
        },
        { rootMargin: '0px 0px -8% 0px' }
      )
      all.forEach((el) => io!.observe(el))
    }

    const failsafe = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.reveal:not(.in)').forEach((el) => {
        el.classList.add('in')
      })
    }, 1300)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('load', check)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(failsafe)
      io?.disconnect()
    }
  }, [])
}
