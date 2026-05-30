// Observation-Mode helper: decides whether an external file change should be
// auto-reloaded into the editor without surfacing a confirmation banner.
//
// An observed tab always auto-reloads (read-only live view). Otherwise the
// legacy auto-save behaviour applies: reload silently only when auto-save is
// enabled and the tab has no unsaved changes.
export function shouldAutoReload(
  tab: { isObserved?: boolean; isSaved: boolean },
  autoSave: boolean
): boolean {
  if (tab.isObserved) return true
  if (autoSave && tab.isSaved) return true
  return false
}
