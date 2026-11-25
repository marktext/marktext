import { execFileSync } from 'child_process'
import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const desktopRoot = path.join(repoRoot, 'packages/desktop')
const localesDir = path.join(desktopRoot, 'static/locales')
const sourceDir = path.join(desktopRoot, 'src')
const SOURCE_LOCALE = 'en'

type LocaleTree = { [key: string]: string | LocaleTree }

const readLocale = (tag: string): LocaleTree =>
  JSON.parse(fs.readFileSync(path.join(localesDir, `${tag}.json`), 'utf8'))

const flattenKeys = (tree: LocaleTree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([name, value]) => {
    const key = prefix ? `${prefix}.${name}` : name
    return typeof value === 'string' ? [key] : flattenKeys(value, key)
  })

const localeTags = fs
  .readdirSync(localesDir)
  .filter((file) => file.endsWith('.json') && !file.endsWith('.min.json'))
  .map((file) => path.parse(file).name)

const findKeyMismatches = (sourceKeys: string[]): string[] => {
  const expected = new Set(sourceKeys)
  return localeTags
    .filter((tag) => tag !== SOURCE_LOCALE)
    .flatMap((tag) => {
      const actual = new Set(flattenKeys(readLocale(tag)))
      const missing = sourceKeys.filter((key) => !actual.has(key))
      const extra = [...actual].filter((key) => !expected.has(key))
      return [
        ...missing.map((key) => `${tag}.json is missing "${key}"`),
        ...extra.map((key) => `${tag}.json has "${key}", which ${SOURCE_LOCALE}.json does not`)
      ]
    })
}

/**
 * Collects every quoted string in the desktop source that looks like a dotted
 * translation key. This is a text scan, not a parse: it does not care whether
 * the string reaches `t()`, so a key stored in a config object first still
 * counts as used.
 */
const collectKeyReferences = (): string[] => {
  // Resolved through the desktop package, which declares @vscode/ripgrep;
  // the workspace root does not.
  const { rgPath } = createRequire(path.join(desktopRoot, 'package.json'))('@vscode/ripgrep')
  const quotedDottedString = String.raw`['"\x60][A-Za-z][\w-]*(?:\.(?:[\w-]|\$\{[^}\x60]*\})*)+['"\x60]`
  const args = [
    '--only-matching',
    '--no-filename',
    '--no-line-number',
    '-g',
    '*.ts',
    '-g',
    '*.vue',
    '-e',
    quotedDottedString,
    sourceDir
  ]

  let output: string
  try {
    output = execFileSync(rgPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    // Exit status 1 is ripgrep's "no matches"; anything else is a real failure.
    if ((error as { status?: number }).status === 1) return []
    throw error
  }
  return [
    ...new Set(
      output
        .split(/\r?\n/)
        .filter(Boolean)
        .map((match) => match.slice(1, -1))
    )
  ]
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Template literals such as `preferences.categories.${id}` and prefixes built
 * by concatenation such as 'sideBar.move.' + reason stand for a family of
 * keys, so they match by pattern rather than by equality.
 */
const findUnusedKeys = (sourceKeys: string[]): string[] => {
  const references = collectKeyReferences()
  const exact = new Set(references)
  const patterns = references
    .filter((ref) => ref.includes('${') || ref.endsWith('.'))
    .map((ref) => {
      const body = ref
        .split(/\$\{[^}]*\}/)
        .map(escapeRegExp)
        .join('.+')
      return new RegExp(`^${body}${ref.endsWith('.') ? '' : '$'}`)
    })
  return sourceKeys.filter(
    (key) => !exact.has(key) && !patterns.some((pattern) => pattern.test(key))
  )
}

const sourceKeys = flattenKeys(readLocale(SOURCE_LOCALE))
const keyMismatches = findKeyMismatches(sourceKeys)
const unusedKeys = findUnusedKeys(sourceKeys)

if (keyMismatches.length > 0 || unusedKeys.length > 0) {
  for (const problem of keyMismatches) console.error(`✖ ${problem}`)
  for (const key of unusedKeys) {
    console.error(`✖ "${key}" is not referenced in any .ts or .vue file under packages/desktop/src`)
  }
  console.error(
    `\nLocale validation failed: ${keyMismatches.length} key mismatch(es), ${unusedKeys.length} unused key(s).` +
      '\nAlign every locale with en.json, and delete unused keys from all locale files.'
  )
  process.exit(1)
}
console.log(
  `Validated ${localeTags.length} locales: ${sourceKeys.length} keys, all present and referenced`
)

for (const tag of localeTags) {
  console.log(`Minimizing ${tag}.json`)
  // Re-serializing parsed JSON keeps non-ASCII characters literal rather than \u-escaped.
  const content = fs.readFileSync(path.join(localesDir, `${tag}.json`), 'utf8')
  fs.writeFileSync(
    path.join(localesDir, `${tag}.min.json`),
    JSON.stringify(JSON.parse(content)),
    'utf8'
  )
}
console.log('Translation files minimized successfully')
