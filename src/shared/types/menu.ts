// Menu template shapes used across main↔renderer. Mirrors the Electron
// MenuItemConstructorOptions surface narrowly enough for our use without
// pulling Electron types into renderer-only consumers.

export interface MenuTemplateItem {
  id?: string | undefined
  label?: string | undefined
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio' | undefined
  accelerator?: string | undefined
  enabled?: boolean | undefined
  visible?: boolean | undefined
  checked?: boolean | undefined
  role?: string | undefined
  click?: string | undefined
  submenu?: MenuTemplateItem[] | undefined
  // Open shape — main-side menu builder occasionally tucks extra metadata in.
  [key: string]: unknown
}

export type MenuTemplate = MenuTemplateItem[]

export interface MenuPopupPosition {
  x: number
  y: number
}
