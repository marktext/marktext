// Bundled editor fonts are absent from the OS font list.
export const BUNDLED_PROPORTIONAL_FONTS = ['Open Sans']
export const BUNDLED_MONOSPACE_FONTS = ['DejaVu Sans Mono']

export const withBundledFonts = (systemFonts: string[], onlyMonospace = false): string[] => {
  const bundled = onlyMonospace ? BUNDLED_MONOSPACE_FONTS : BUNDLED_PROPORTIONAL_FONTS
  const missing = bundled.filter(font => !systemFonts.includes(font))
  return [...missing, ...systemFonts]
}
