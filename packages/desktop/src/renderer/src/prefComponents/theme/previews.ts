import baseStyle from '@/assets/styles/index.css?inline'

const themeStyles = import.meta.glob('../../assets/themes/*.theme.css', {
  query: '?inline', import: 'default', eager: true
}) as Record<string, string>

export const themePreviewStyle = (name: string): Record<string, string> => {
  const source = baseStyle + (themeStyles[`../../assets/themes/${name}.theme.css`] ?? '')
  const variables = new Map<string, string>()
  for (const match of source.matchAll(/--(editorBgColor|editorColor|themeColor|codeBgColor)\s*:\s*([^;]+);/g)) {
    variables.set(match[1], match[2].trim())
  }
  return {
    background: variables.get('editorBgColor') ?? 'transparent',
    color: variables.get('editorColor') ?? 'inherit',
    '--preview-link': variables.get('themeColor') ?? 'currentColor',
    '--preview-code': variables.get('codeBgColor') ?? 'transparent'
  }
}
