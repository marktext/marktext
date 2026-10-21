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
