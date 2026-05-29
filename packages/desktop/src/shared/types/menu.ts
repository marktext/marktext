// Menu template shapes used across main↔renderer. Mirrors the Electron
// MenuItemConstructorOptions surface narrowly enough for our use without
// pulling Electron types into renderer-only consumers.

export interface MenuTemplateItem {
  id?: string
  label?: string
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio'
  accelerator?: string
  enabled?: boolean
  visible?: boolean
  checked?: boolean
  role?: string
  click?: string
  submenu?: MenuTemplateItem[]
  // Open shape — main-side menu builder occasionally tucks extra metadata in.
  [key: string]: unknown
}

export type MenuTemplate = MenuTemplateItem[]

export interface MenuPopupPosition {
  x: number
  y: number
}
