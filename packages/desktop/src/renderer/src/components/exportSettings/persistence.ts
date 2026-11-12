// Persist export choices across dialog openings and app restarts (#2287).

export const EXPORT_SETTINGS_STORAGE_KEY = 'export-settings'

export function loadExportSettings(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(EXPORT_SETTINGS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function saveExportSettings(settings: Record<string, unknown>): void {
  try {
    localStorage.setItem(EXPORT_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable (private mode / quota); persisting export
    // options is best-effort and must never break the export flow.
  }
}

// Whether header and footer separator lines are requested. 'theme' leaves them
// to the export theme (the built-in academic and liber themes draw them, the
// default theme does not).
export type HeaderFooterSeparatorStyle = 'theme' | 'show' | 'hide'

const HEADER_FOOTER_SEPARATOR_STYLES: readonly HeaderFooterSeparatorStyle[] = [
  'theme',
  'show',
  'hide'
]

export function isHeaderFooterSeparatorStyle(value: unknown): value is HeaderFooterSeparatorStyle {
  return HEADER_FOOTER_SEPARATOR_STYLES.includes(value as HeaderFooterSeparatorStyle)
}

const ownValue = (saved: Record<string, unknown>, key: string): unknown =>
  Object.hasOwn(saved, key) ? saved[key] : undefined

/**
 * Reads the separator choice from saved export settings. A valid
 * `headerFooterSeparatorStyle` wins. Otherwise the choice comes from the
 * settings saved before that key existed: `headerFooterStyled` (default
 * `true`) only took effect while `headerFooterCustomize` (default `false`)
 * was `true`, so anything else means 'theme'.
 */
export function resolveHeaderFooterSeparatorStyle(
  saved: Record<string, unknown>
): HeaderFooterSeparatorStyle {
  const savedStyle = ownValue(saved, 'headerFooterSeparatorStyle')
  if (isHeaderFooterSeparatorStyle(savedStyle)) return savedStyle
  if (ownValue(saved, 'headerFooterCustomize') !== true) return 'theme'
  return ownValue(saved, 'headerFooterStyled') === false ? 'hide' : 'show'
}

/**
 * Maps a separator choice to the export option `headerFooterStyled`, whose
 * value selects the exporter's header/footer class: `undefined` adds none,
 * `true` adds `styled`, `false` adds `simple`.
 */
export function headerFooterStyledFor(style: HeaderFooterSeparatorStyle): boolean | undefined {
  if (style === 'theme') return undefined
  return style === 'show'
}
