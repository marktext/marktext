'use client'

import { createContext, useContext } from 'react'

type SidebarContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

export const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within <SidebarContext.Provider>')
  return ctx
}
