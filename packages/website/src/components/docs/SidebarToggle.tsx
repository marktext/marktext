'use client'

import { useEffect } from 'react'
import { MenuIcon } from '@/components/Icons'

export default function SidebarToggle() {
  useEffect(() => {
    const side = document.getElementById('docSide')
    if (!side) return
    function onSideClick(ev: MouseEvent) {
      const target = ev.target as HTMLElement | null
      if (target?.closest('.side-link')) side!.classList.remove('open')
    }
    side.addEventListener('click', onSideClick)
    return () => side.removeEventListener('click', onSideClick)
  }, [])

  function onToggle() {
    document.getElementById('docSide')?.classList.toggle('open')
  }

  return (
    <button type="button" className="side-toggle" onClick={onToggle}>
      <MenuIcon aria-hidden />
      Browse documentation
    </button>
  )
}
