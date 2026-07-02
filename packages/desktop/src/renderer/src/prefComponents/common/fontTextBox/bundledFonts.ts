// Fonts MarkText bundles via @font-face (packages/muya/src/assets/styles/index.css).
// They are the editor/code defaults but are NOT installed system fonts, so the
// OS font-list IPC never returns them and the picker couldn't reselect them (#3021).
export const BUNDLED_PROPORTIONAL_FONTS = ['Open Sans']
export const BUNDLED_MONOSPACE_FONTS = ['DejaVu Sans Mono']

export const withBundledFonts = (systemFonts: string[], onlyMonospace = false): string[] => {
  const bundled = onlyMonospace ? BUNDLED_MONOSPACE_FONTS : BUNDLED_PROPORTIONAL_FONTS
  const missing = bundled.filter(font => !systemFonts.includes(font))
  return [...missing, ...systemFonts]
}
