/** Split on the native separator so Windows paths produce separate breadcrumbs. */
export const pathBreadcrumb = (pathname: string, separator: string): string[] => {
  if (!pathname) return []
  const tokens = pathname.split(separator).filter((token) => token)
  return tokens.slice(0, -1).slice(-3)
}
