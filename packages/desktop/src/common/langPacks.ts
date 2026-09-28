import fs from 'fs'
import path from 'path'

/**
 * Language-pack plugin support.
 *
 * Two drop-in shapes, both scanned from registered directories:
 *
 * 1. Flat file  `<dir>/<id>.json`
 *    Same tree as `static/locales/en.json`. Optional `$meta` and `muya` keys
 *    are extracted and never shown as UI strings.
 *
 * 2. Folder pack  `<dir>/<name>/`
 *    `manifest.json`  — id / name / nativeName / author / version
 *    `messages.json`  (or `<id>.json`) — translation tree
 *    `muya.json`      — optional editor-engine strings
 *
 * Later directories override earlier ones for the same id, so a user pack can
 * replace a built-in translation without touching the install.
 */

export type LanguagePackSource = 'builtin' | 'user' | 'cwd'

export interface LanguagePackMeta {
  id: string
  name: string
  nativeName: string
  author?: string
  version?: string
  source: LanguagePackSource
  dir: string
  hasMuya: boolean
}

export interface LanguagePack extends LanguagePackMeta {
  messages: Record<string, unknown>
  muya?: Record<string, string>
}

export interface LanguageCatalogEntry {
  id: string
  name: string
  nativeName: string
  author?: string
  version?: string
  source: LanguagePackSource
  hasMuya: boolean
}

const LOCALE_ID_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i

const packs = new Map<string, LanguagePack>()

export function isLocaleId(id: string): boolean {
  return LOCALE_ID_RE.test(id)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function extractMuya(value: unknown): Record<string, string> | undefined {
  if (!isPlainObject(value)) return undefined
  // Accept either `{ resource: { ... } }` (ILocale shape) or a flat map.
  const source = isPlainObject(value.resource) ? value.resource : value
  const resource: Record<string, string> = {}
  for (const [key, val] of Object.entries(source)) {
    if (typeof val === 'string' && val) resource[key] = val
  }
  return Object.keys(resource).length ? resource : undefined
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown
    return isPlainObject(raw) ? raw : null
  } catch {
    return null
  }
}

/**
 * Accepts a flat locale tree (optionally with `$meta` / `muya`) and splits it
 * into the parts the app cares about. Invalid shapes return null so a broken
 * drop-in never poisons the registry.
 */
export function parseFlatLanguageFile(
  filePath: string,
  source: LanguagePackSource
): LanguagePack | null {
  const raw = readJsonFile(filePath)
  if (!raw) return null

  const idFromFile = path.basename(filePath, '.json').replace(/\.min$/i, '')
  const metaRaw = isPlainObject(raw.$meta) ? raw.$meta : {}
  const id = asOptionalString(metaRaw.id) ?? idFromFile
  if (!isLocaleId(id)) return null
  if (asOptionalString(metaRaw.id) && asOptionalString(metaRaw.id) !== idFromFile) {
    // $meta.id must agree with the filename so discovery stays predictable.
    return null
  }

  const muya = extractMuya(raw.muya)
  const messages: Record<string, unknown> = { ...raw }
  delete messages.$meta
  delete messages.muya

  return {
    id,
    name: asOptionalString(metaRaw.name) ?? id,
    nativeName: asOptionalString(metaRaw.nativeName) ?? asOptionalString(metaRaw.name) ?? id,
    author: asOptionalString(metaRaw.author),
    version: asOptionalString(metaRaw.version),
    source,
    dir: path.dirname(filePath),
    hasMuya: !!muya,
    messages,
    muya
  }
}

export function parseLanguagePackFolder(
  folderPath: string,
  source: LanguagePackSource
): LanguagePack | null {
  const manifest = readJsonFile(path.join(folderPath, 'manifest.json'))
  if (!manifest) return null

  const id = asOptionalString(manifest.id) ?? path.basename(folderPath)
  if (!isLocaleId(id)) return null

  const messageCandidates = [
    path.join(folderPath, 'messages.json'),
    path.join(folderPath, `${id}.json`)
  ]
  let messagesRaw: Record<string, unknown> | null = null
  for (const candidate of messageCandidates) {
    if (fs.existsSync(candidate)) {
      messagesRaw = readJsonFile(candidate)
      if (messagesRaw) break
    }
  }
  if (!messagesRaw) return null

  // A messages.json may still carry $meta / muya; prefer the dedicated files.
  const messagesPath = messageCandidates.find(candidate => fs.existsSync(candidate))
  const fromMessages = messagesPath ? parseFlatLanguageFile(messagesPath, source) : null
  const muya =
    extractMuya(readJsonFile(path.join(folderPath, 'muya.json'))) ?? fromMessages?.muya

  const messages: Record<string, unknown> = { ...messagesRaw }
  delete messages.$meta
  delete messages.muya

  return {
    id,
    name: asOptionalString(manifest.name) ?? id,
    nativeName: asOptionalString(manifest.nativeName) ?? asOptionalString(manifest.name) ?? id,
    author: asOptionalString(manifest.author),
    version: asOptionalString(manifest.version),
    source,
    dir: folderPath,
    hasMuya: !!muya,
    messages,
    muya
  }
}

/**
 * Scans one directory for flat `*.json` locale files and folder packs.
 * `*.min.json` is ignored — it is a build artifact of the built-in locales.
 */
export function scanLanguagePackDir(
  directory: string,
  source: LanguagePackSource
): LanguagePack[] {
  if (!directory || !fs.existsSync(directory)) return []

  const found: LanguagePack[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const pack = parseLanguagePackFolder(path.join(directory, entry.name), source)
      if (pack) found.push(pack)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    if (entry.name.endsWith('.min.json')) continue
    if (entry.name === 'manifest.json' || entry.name === 'messages.json') continue

    const pack = parseFlatLanguageFile(path.join(directory, entry.name), source)
    if (pack) found.push(pack)
  }

  return found
}

/** Registers packs from one directory. Later packs win for the same id. */
export function registerLanguagePacksFromDir(
  directory: string,
  source: LanguagePackSource
): LanguagePack[] {
  const loaded = scanLanguagePackDir(directory, source)
  for (const pack of loaded) {
    packs.set(pack.id, pack)
  }
  return loaded
}

/**
 * Replaces the registry with packs from the given directories, in order.
 * Use this at startup so a refresh cannot leave deleted packs behind.
 */
export function reloadLanguagePacks(
  dirs: Array<{ directory: string; source: LanguagePackSource }>
): LanguagePack[] {
  packs.clear()
  const all: LanguagePack[] = []
  for (const { directory, source } of dirs) {
    all.push(...registerLanguagePacksFromDir(directory, source))
  }
  return all
}

export function getLanguagePack(id: string): LanguagePack | undefined {
  return packs.get(id)
}

export function getLanguageCatalog(): LanguageCatalogEntry[] {
  return [...packs.values()]
    .map(({ id, name, nativeName, author, version, source, hasMuya }) => ({
      id,
      name,
      nativeName,
      author,
      version,
      source,
      hasMuya
    }))
    .sort((a, b) => {
      // Built-ins first (stable order by id), then plugins — easier to scan in UI.
      if (a.source === 'builtin' && b.source !== 'builtin') return -1
      if (a.source !== 'builtin' && b.source === 'builtin') return 1
      return a.id.localeCompare(b.id)
    })
}

export function getSupportedLanguageIds(): string[] {
  return getLanguageCatalog().map(entry => entry.id)
}

export function getBuiltinLanguageIds(): string[] {
  return getLanguageCatalog()
    .filter(entry => entry.source === 'builtin')
    .map(entry => entry.id)
}

export function isLanguageRegistered(id: string): boolean {
  return packs.has(id)
}

export function getMuyaResource(id: string): Record<string, string> | undefined {
  return packs.get(id)?.muya
}

export function clearLanguagePacks(): void {
  packs.clear()
}
