/**
 * Directory segments shown before the filename in the custom title bar, e.g.
 * `Users > 1 > Desktop` for `C:\Users\1\Desktop\112.md`. Must split on the
 * platform separator: the renderer used to split native Windows paths on `/`
 * (pathe), which produced no tokens and left only the filename (#5669).
 */
export const pathBreadcrumb = (pathname: string, separator: string): string[] => {
  if (!pathname) return []
  const tokens = pathname.split(separator).filter((token) => token)
  return tokens.slice(0, -1).slice(-3)
}
