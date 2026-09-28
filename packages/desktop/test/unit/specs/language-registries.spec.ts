import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  getBuiltinLanguages,
  getLanguageCatalogEntries,
  getSupportedLanguages,
  setLocalesDirectory
} from '../../../src/common/i18n'
import {
  getLanguageOptions,
  setLanguageCatalog
} from '../../../src/renderer/src/prefComponents/general/config'
import { MUYA_LOCALES } from '../../../src/renderer/src/util/muyaLocale'

/**
 * Adding a built-in UI language means editing several lists that nothing else
 * ties together, and they have drifted twice: `nl` reached the desktop but
 * never the engine locale map (#5499, English editor UI for Dutch users), and
 * `ru` reached both but not `electronLanguages` (#5496), which strips the
 * Chromium/AppKit Russian resources out of packaged builds — the regression
 * #5132 fixed.
 *
 * Drop-in language packs (see docs/i18n/LANGUAGE_PACKS.md) are intentionally
 * NOT required to appear in MUYA_LOCALES or electronLanguages: they fall back
 * to English for engine chrome and ship no OS locale resources. Those checks
 * therefore pin the **built-in** set only.
 */

const DESKTOP_ROOT = path.join(__dirname, '../../..')
const LOCALES_DIR = path.join(DESKTOP_ROOT, 'static/locales')
const BUILDER_CONFIG = path.join(DESKTOP_ROOT, 'electron-builder.yml')

const localeFileTags = (): string[] =>
  fs
    .readdirSync(LOCALES_DIR)
    .filter(f => f.endsWith('.json') && !f.endsWith('.min.json'))
    .map(f => f.replace('.json', ''))

/**
 * Reads the `electronLanguages:` block out of electron-builder.yml.
 *
 * Hand-parsed rather than via js-yaml: no YAML parser is a declared dependency
 * of this package, and picking up the copy electron-builder hoists into
 * node_modules would be a phantom dependency (the failure mode of #5159).
 * The block is a flat list of scalars, so recognising `  - value` lines and
 * skipping comments is enough.
 */
const readElectronLanguages = (): string[] => {
  const lines = fs.readFileSync(BUILDER_CONFIG, 'utf8').split('\n')
  const start = lines.findIndex(line => line.startsWith('electronLanguages:'))
  if (start === -1) return []

  const values: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^\s*#/.test(line) || line.trim() === '') continue
    const entry = /^\s+-\s+(\S+)\s*$/.exec(line)
    if (!entry) break
    values.push(entry[1]!)
  }
  return values
}

// macOS .lproj bundles spell the region with an underscore, Windows/Linux .pak
// files with a hyphen; electron-builder.yml carries both spellings.
const primarySubtag = (tag: string): string => tag.replace('_', '-').split('-')[0]!.toLowerCase()

describe('language registries agree', () => {
  // Populate the registry from the real built-in locales directory the way
  // main/globalSetting.ts does at startup, so these checks see discovered ids
  // rather than a hardcoded fallback list.
  setLocalesDirectory(LOCALES_DIR)
  const builtin = getBuiltinLanguages()
  const supported = getSupportedLanguages()

  it('has a non-empty set of supported languages to check', () => {
    expect(supported.length).toBeGreaterThan(0)
    expect(builtin.length).toBeGreaterThan(0)
  })

  it('ships a locale file for every built-in language (static/locales/<tag>.json)', () => {
    expect([...localeFileTags()].sort()).toEqual([...builtin].sort())
  })

  it('offers every supported language in Preferences (prefComponents/general/config.ts)', () => {
    // Feed the dynamic catalog (built-ins + any registered packs) the same way
    // startup does, then require the select options to track it exactly.
    setLanguageCatalog(getLanguageCatalogEntries())
    const offered = getLanguageOptions().map(option => option.value)
    expect([...offered].sort()).toEqual([...supported].sort())
  })

  it('maps every built-in language to an engine locale (util/muyaLocale.ts)', () => {
    // Packs may omit engine strings and fall back to English (#5499); built-ins
    // must not, or the editor UI stays English under a translated chrome.
    expect(Object.keys(MUYA_LOCALES).sort()).toEqual([...builtin].sort())
  })

  describe('packaged Electron locale resources (electron-builder.yml)', () => {
    const electronLanguages = readElectronLanguages()

    it('still finds the electronLanguages block', () => {
      expect(electronLanguages.length).toBeGreaterThan(0)
    })

    it('keeps a resource for every built-in language', () => {
      // `pt` has no bare entry — Electron ships pt-BR/pt-PT — so match on the
      // primary subtag rather than requiring the exact tag.
      const covered = new Set(electronLanguages.map(primarySubtag))
      const missing = builtin.filter(tag => !covered.has(primarySubtag(tag)))
      expect(
        missing,
        '\n  Add these to electronLanguages in electron-builder.yml, or the packaged' +
          '\n  app drops their .pak/.lproj resources and OS-provided UI stays English:' +
          `\n    ${missing.join(', ')}\n`
      ).toEqual([])
    })

    it('keeps no resource for a built-in language that was dropped', () => {
      const supportedPrimaries = new Set(builtin.map(primarySubtag))
      const stale = electronLanguages.filter(tag => !supportedPrimaries.has(primarySubtag(tag)))
      expect(stale, `\n  electronLanguages entries with no matching UI language: ${stale.join(', ')}\n`).toEqual([])
    })
  })
})
