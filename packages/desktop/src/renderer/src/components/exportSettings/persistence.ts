// Persists the export dialog's options across sessions (#2287). The dialog's
// options were component-local refs with hardcoded defaults, so every restart
// (and every dialog open) reset them. We store the chosen values in
// localStorage — the same renderer-side persistence the sidebar width uses —
// and restore them when the dialog opens.

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
