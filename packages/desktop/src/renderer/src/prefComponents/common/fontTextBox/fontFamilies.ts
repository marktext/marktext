const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong'
])

export const parseFontFamilies = (value: string): string[] => {
  const families: string[] = []
  let family = ''
  let quote = ''
  let escaped = false
  for (const char of value) {
    if (escaped) {
      family += char
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else if (quote) {
      if (char === quote) quote = ''
      else family += char
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === ',') {
      if (family.trim()) families.push(family.trim())
      family = ''
    } else {
      family += char
    }
  }
  if (family.trim()) families.push(family.trim())
  return families
}

export const serializeFontFamilies = (families: string[]): string => families.map(family =>
  GENERIC_FAMILIES.has(family.toLowerCase()) ? family : JSON.stringify(family)
).join(', ')
