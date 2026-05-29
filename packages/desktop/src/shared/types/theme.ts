/**
 * Shapes for user-imported ("custom") themes.
 *
 * Built-in themes are compiled into the renderer bundle. Custom themes live as
 * `<fileId>.theme.css` files in `<userData>/themes`; the main process reads,
 * parses, and sanitizes them (see `src/main/themes`) and the renderer applies
 * them at runtime (see `src/renderer/src/util/customThemes.ts`).
 */

export type CustomThemeType = 'light' | 'dark'

export interface CustomThemeDescriptor {
  /** Runtime theme id, namespaced to never collide with a built-in: `custom:<fileId>`. */
  id: string
  /** Canonical file id, i.e. the `<fileId>` in `<fileId>.theme.css`. */
  fileId: string
  /** Human-readable display name (from the `@name` header, else the title-cased id). */
  name: string
  /** Light or dark; drives the `body.dark` class. Defaults to `light` when unspecified. */
  type: CustomThemeType
  /** Sanitized CSS, safe to inject (no `@import`, `@font-face`, `url()` or remote resources). */
  css: string
}

/** Outcome of an interactive "import custom theme" action. */
export interface ImportCustomThemeResult {
  status: 'imported' | 'cancelled' | 'exists' | 'invalid' | 'error'
  theme?: CustomThemeDescriptor
  message?: string
}
