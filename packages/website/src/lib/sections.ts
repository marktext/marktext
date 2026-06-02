export const SECTIONS = {
  top: 'top',
  preview: 'preview',
  extensions: 'extensions',
  themes: 'themes',
  support: 'support',
  download: 'download'
} as const

export type SectionId = (typeof SECTIONS)[keyof typeof SECTIONS]

export const hash = (id: SectionId) => `#${id}` as const

export type RevealDelay = 'd1' | 'd2' | 'd3' | 'd4'

export function revealClass(delay?: RevealDelay, extra?: string): string {
  const base = extra ? `${extra} reveal` : 'reveal'
  return delay ? `${base} ${delay}` : base
}

export const THEME_STORAGE_KEY = 'marktext-theme'
export const DEFAULT_THEME = 'dark'
