import type { CustomThemeDescriptor } from '@shared/types/theme'

/**
 * In-memory registry of user-imported ("custom") themes for the renderer.
 *
 * Built-in themes are compiled into the bundle and handled by the switch in
 * `addThemeStyle`. Custom themes are read and sanitized by the main process and
 * fetched here over IPC, then applied via `addThemeStyle`'s default branch.
 */
const registry = new Map<string, CustomThemeDescriptor>()

/** Replace the registry contents with the given descriptors. */
export const setCustomThemes = (themes: CustomThemeDescriptor[]): void => {
  registry.clear()
  for (const theme of themes) registry.set(theme.id, theme)
}

/** Look up a custom theme by its runtime id (e.g. `custom:my-theme`). */
export const getCustomTheme = (id: string): CustomThemeDescriptor | undefined => registry.get(id)

/** Every custom theme currently in the registry, sorted by display name. */
export const getCustomThemes = (): CustomThemeDescriptor[] =>
  [...registry.values()].sort((a, b) => a.name.localeCompare(b.name))

/**
 * Fetch the custom themes from the main process and populate the registry.
 * Returns the loaded descriptors (empty on failure).
 */
export const loadCustomThemes = async(): Promise<CustomThemeDescriptor[]> => {
  try {
    const themes = await window.themes.listCustom()
    setCustomThemes(themes)
    return themes
  } catch {
    return []
  }
}
