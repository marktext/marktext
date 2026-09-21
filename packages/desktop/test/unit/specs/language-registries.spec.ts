import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getSupportedLanguages } from '../../../src/common/i18n'
import { getLanguageOptions } from '../../../src/renderer/src/prefComponents/general/config'
import { MUYA_LOCALES } from '../../../src/renderer/src/util/muyaLocale'

/**
 * Adding a UI language means editing several lists that nothing else ties
 * together, and they have drifted twice: `nl` reached the desktop but never the
 * engine locale map (#5499, English editor UI for Dutch users), and `ru` reached
 * both but not `electronLanguages` (#5496), which strips the Chromium/AppKit
 * Russian resources out of packaged builds — the regression #5132 fixed.
 *
 * Each `it` below names the file to edit when it fails.
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
  const supported = getSupportedLanguages()

  it('has a non-empty set of supported languages to check', () => {
    expect(supported.length).toBeGreaterThan(0)
  })

  it('ships a locale file for every supported language (static/locales/<tag>.json)', () => {
    expect([...localeFileTags()].sort()).toEqual([...supported].sort())
  })

  it('offers every supported language in Preferences (prefComponents/general/config.ts)', () => {
    const offered = getLanguageOptions().map(option => option.value)
    expect([...offered].sort()).toEqual([...supported].sort())
  })

  it('maps every supported language to an engine locale (util/muyaLocale.ts)', () => {
    expect(Object.keys(MUYA_LOCALES).sort()).toEqual([...supported].sort())
  })

  describe('packaged Electron locale resources (electron-builder.yml)', () => {
    const electronLanguages = readElectronLanguages()

    it('still finds the electronLanguages block', () => {
      expect(electronLanguages.length).toBeGreaterThan(0)
    })

    it('keeps a resource for every supported language', () => {
      // `pt` has no bare entry — Electron ships pt-BR/pt-PT — so match on the
      // primary subtag rather than requiring the exact tag.
      const covered = new Set(electronLanguages.map(primarySubtag))
      const missing = supported.filter(tag => !covered.has(primarySubtag(tag)))
      expect(
        missing,
        '\n  Add these to electronLanguages in electron-builder.yml, or the packaged' +
          '\n  app drops their .pak/.lproj resources and OS-provided UI stays English:' +
          `\n    ${missing.join(', ')}\n`
      ).toEqual([])
    })

    it('keeps no resource for a language that was dropped', () => {
      const supportedPrimaries = new Set(supported.map(primarySubtag))
      const stale = electronLanguages.filter(tag => !supportedPrimaries.has(primarySubtag(tag)))
      expect(stale, `\n  electronLanguages entries with no matching UI language: ${stale.join(', ')}\n`).toEqual([])
    })
  })
})
