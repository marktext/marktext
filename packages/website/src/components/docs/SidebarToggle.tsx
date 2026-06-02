'use client'

import { MenuIcon } from '@/components/Icons'
import { useSidebar } from './sidebar-context'

export default function SidebarToggle() {
  const { open, setOpen } = useSidebar()
  return (
    <button type="button" className="side-toggle" onClick={() => setOpen(!open)}>
      <MenuIcon aria-hidden />
      Browse documentation
    </button>
  )
}
