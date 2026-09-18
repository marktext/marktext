import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import {
  PANDOC_EXPORT_FORMATS,
  PANDOC_EXPORT_FORMAT_IDS,
  getPandocExportFormats,
  getPandocMenuFormats
} from '@shared/pandoc'

const here = path.dirname(fileURLToPath(import.meta.url))
const readJson = (relative: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(here, relative), { encoding: 'utf8' }))

interface SchemaEntry {
  type?: unknown
  default?: unknown
}

describe('pandoc export preferences', () => {
  describe('PANDOC_EXPORT_FORMAT_IDS', () => {
    it('lists every format id in menu order', () => {
      expect(PANDOC_EXPORT_FORMAT_IDS).toEqual(PANDOC_EXPORT_FORMATS.map((format) => format.id))
    })
  })

  describe('getPandocExportFormats', () => {
    it('offers every format when the preference was never written', () => {
      // A preferences file from before the setting existed: the menu must not
      // shrink just because the key is missing.
      expect(getPandocExportFormats(undefined)).toEqual([...PANDOC_EXPORT_FORMATS])
    })

    it('treats an empty selection as "none" rather than "all"', () => {
      expect(getPandocExportFormats([])).toEqual([])
    })

    it('returns the declared order, not the stored order', () => {
      const ids = getPandocExportFormats(['epub', 'docx']).map((format) => format.id)
      expect(ids).toEqual(['docx', 'epub'])
    })

    it('drops ids that no longer exist', () => {
      const ids = getPandocExportFormats(['docx', 'gone']).map((format) => format.id)
      expect(ids).toEqual(['docx'])
    })

    it('does not hand out the frozen list itself', () => {
      const formats = getPandocExportFormats(undefined)
      formats.pop()
      expect(PANDOC_EXPORT_FORMATS).toHaveLength(PANDOC_EXPORT_FORMAT_IDS.length)
    })
  })

  describe('getPandocMenuFormats', () => {
    it('offers the selected formats while the export is on', () => {
      const ids = getPandocMenuFormats(true, ['docx', 'odt']).map((format) => format.id)
      expect(ids).toEqual(['docx', 'odt'])
    })

    it('hides the menu when the export is switched off', () => {
      expect(getPandocMenuFormats(false, PANDOC_EXPORT_FORMAT_IDS)).toEqual([])
    })

    it('hides the menu when every format is unchecked', () => {
      expect(getPandocMenuFormats(true, [])).toEqual([])
    })

    it('stays enabled when the setting is absent', () => {
      // Only an explicit `false` switches the export off.
      expect(getPandocMenuFormats(undefined, undefined)).toHaveLength(
        PANDOC_EXPORT_FORMATS.length
      )
    })
  })

  describe('defaults', () => {
    // The three places that carry a default have to agree, otherwise a user
    // upgrading into the new setting gets a different menu than a new install.
    const schema = readJson('../../../src/main/preferences/schema.json') as Record<
      string,
      SchemaEntry
    >
    const defaultPreferences = readJson('../../../static/preference.json')

    it('defaults to enabled in the schema and in preference.json', () => {
      expect(schema.pandocEnabled?.default).toBe(true)
      expect(defaultPreferences.pandocEnabled).toBe(true)
    })

    it('selects every format by default in all three places', () => {
      expect(schema.pandocExportFormats?.default).toEqual([...PANDOC_EXPORT_FORMAT_IDS])
      expect(defaultPreferences.pandocExportFormats).toEqual([...PANDOC_EXPORT_FORMAT_IDS])
    })

    it('validates the format preference as a list of strings', () => {
      expect(schema.pandocExportFormats?.type).toBe('array')
    })
  })
})
