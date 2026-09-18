import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import {
  PANDOC_EXPORT_FORMATS,
  PANDOC_EXPORT_FORMAT_IDS,
  PANDOC_EXPORT_LOCATIONS,
  PANDOC_REFERENCE_DOC_TARGETS,
  getPandocDefaultFormat,
  getPandocExportLocation,
  isPandocExportLocation
} from '@shared/pandoc'
import { buildPandocArguments } from 'main_renderer/utils/pandoc'

const here = path.dirname(fileURLToPath(import.meta.url))
const readJson = (relative: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(here, relative), { encoding: 'utf8' }))

interface SchemaEntry {
  type?: unknown
  enum?: unknown
  default?: unknown
}

describe('pandoc settings', () => {
  describe('format list', () => {
    it('offers exactly the formats the export menu can build', () => {
      expect(PANDOC_EXPORT_FORMAT_IDS).toEqual([
        'docx',
        'html',
        'epub',
        'pptx',
        'odt',
        'rtf',
        'txt'
      ])
    })

    // MarkText renders PDF itself (File → Export → PDF). A second PDF behind the
    // same name, one that additionally needs a LaTeX engine installed, would
    // only be a way to produce a different file than the user asked for.
    it('leaves PDF to the built-in exporter', () => {
      expect(PANDOC_EXPORT_FORMAT_IDS).not.toContain('pdf')
    })

    it('maps every id to a distinct extension and writer target', () => {
      const extensions = PANDOC_EXPORT_FORMATS.map((format) => format.extension)
      expect(new Set(extensions).size).toBe(PANDOC_EXPORT_FORMATS.length)
      // epub/plain are the two whose writer name differs from the id.
      expect(PANDOC_EXPORT_FORMATS.find((f) => f.id === 'epub')?.target).toBe('epub3')
      expect(PANDOC_EXPORT_FORMATS.find((f) => f.id === 'txt')?.target).toBe('plain')
      expect(PANDOC_EXPORT_FORMATS.find((f) => f.id === 'html')?.target).toBe('html5')
    })
  })

  describe('PANDOC_REFERENCE_DOC_TARGETS', () => {
    // pandoc 3.1.3 accepts the option from every writer (all exit 0), but only
    // docx/odt/pptx do anything with it — pandoc's manual lists "docx or ODT or
    // PowerPoint". The others ignore it, so the template must not ride along.
    it('names the writers that use --reference-doc', () => {
      expect([...PANDOC_REFERENCE_DOC_TARGETS]).toEqual(['docx', 'odt', 'pptx'])
    })
  })

  describe('getPandocExportLocation', () => {
    it('keeps every declared location', () => {
      for (const location of PANDOC_EXPORT_LOCATIONS) {
        expect(getPandocExportLocation(location)).toBe(location)
      }
    })

    it('falls back to asking rather than writing somewhere surprising', () => {
      // An older preferences file, a hand-edited one, a value from a future
      // version: none of these should silently pick a directory.
      expect(getPandocExportLocation(undefined)).toBe('ask')
      expect(getPandocExportLocation(null)).toBe('ask')
      expect(getPandocExportLocation('')).toBe('ask')
      expect(getPandocExportLocation('somewhere')).toBe('ask')
      expect(getPandocExportLocation(7)).toBe('ask')
    })

    it('narrows the type only for declared values', () => {
      expect(isPandocExportLocation('folder')).toBe(true)
      expect(isPandocExportLocation('FOLDER')).toBe(false)
      expect(isPandocExportLocation(['folder'])).toBe(false)
    })
  })

  describe('getPandocDefaultFormat', () => {
    it('uses the preferred format when it is still on offer', () => {
      expect(getPandocDefaultFormat(PANDOC_EXPORT_FORMATS, 'epub')?.id).toBe('epub')
    })

    // Otherwise the save dialog would preselect a filter the menu no longer
    // shows, and "Export" would produce a format the user had just unchecked.
    it('falls back to the first format when the preferred one was unchecked', () => {
      const offered = PANDOC_EXPORT_FORMATS.filter((format) => format.id !== 'docx')
      expect(getPandocDefaultFormat(offered, 'docx')?.id).toBe('html')
    })

    it('falls back when no preference was ever written', () => {
      expect(getPandocDefaultFormat(PANDOC_EXPORT_FORMATS)?.id).toBe('docx')
      expect(getPandocDefaultFormat(PANDOC_EXPORT_FORMATS, null)?.id).toBe('docx')
      expect(getPandocDefaultFormat(PANDOC_EXPORT_FORMATS, 'gone')?.id).toBe('docx')
    })

    it('has nothing to offer when nothing is checked', () => {
      expect(getPandocDefaultFormat([], 'docx')).toBeUndefined()
    })
  })

  describe('buildPandocArguments', () => {
    const base = { reader: 'gfm', to: 'docx', outputPath: '/tmp/notes.docx' }

    it('writes a standalone document by default', () => {
      // `-s` is not cosmetic for the binary writers: without it docx/odt/epub
      // come out as fragments pandoc cannot even package.
      expect(buildPandocArguments(base)).toEqual([
        '-f',
        'gfm',
        '-t',
        'docx',
        '-s',
        '-o',
        '/tmp/notes.docx'
      ])
    })

    it('drops -s when the user asked for a fragment', () => {
      expect(buildPandocArguments({ ...base, standalone: false })).not.toContain('-s')
    })

    it('adds the table of contents and section numbering only when asked', () => {
      expect(buildPandocArguments({ ...base, toc: true })).toContain('--toc')
      expect(buildPandocArguments({ ...base, numberSections: true })).toContain(
        '--number-sections'
      )
      expect(buildPandocArguments(base)).not.toContain('--toc')
      expect(buildPandocArguments(base)).not.toContain('--number-sections')
    })

    it('passes the template through for docx, odt and pptx', () => {
      expect(buildPandocArguments({ ...base, referenceDoc: '/tpl/ref.docx' })).toContain(
        '--reference-doc=/tpl/ref.docx'
      )
      expect(
        buildPandocArguments({ ...base, to: 'odt', referenceDoc: '/tpl/ref.odt' })
      ).toContain('--reference-doc=/tpl/ref.odt')
      expect(
        buildPandocArguments({ ...base, to: 'pptx', referenceDoc: '/tpl/ref.pptx' })
      ).toContain('--reference-doc=/tpl/ref.pptx')
    })

    // A template set once in the preferences outlives switching the export to a
    // writer that ignores the option, so the flag has to be dropped silently.
    it('withholds the template from writers that ignore the option', () => {
      for (const to of PANDOC_EXPORT_FORMAT_IDS.filter(
        (id) => !PANDOC_REFERENCE_DOC_TARGETS.includes(id)
      )) {
        const args = buildPandocArguments({ ...base, to, referenceDoc: '/tpl/ref.docx' })
        expect(args.some((arg) => arg.startsWith('--reference-doc'))).toBe(false)
      }
    })

    it('ignores an empty template', () => {
      expect(buildPandocArguments({ ...base, referenceDoc: '' })).not.toContain('--reference-doc=')
    })

    it('keeps -o last so the output path is never read as a flag value', () => {
      const args = buildPandocArguments({
        ...base,
        toc: true,
        numberSections: true,
        referenceDoc: '/tpl/ref.docx'
      })
      expect(args.slice(-2)).toEqual(['-o', '/tmp/notes.docx'])
    })
  })

  describe('preference defaults', () => {
    // These three files have to agree, otherwise a user upgrading into the
    // settings screen sees different values than a fresh install.
    const schema = readJson('../../../src/main/preferences/schema.json') as Record<
      string,
      SchemaEntry
    >
    const defaultPreferences = readJson('../../../static/preference.json')

    const keys = [
      'pandocPath',
      'pandocDefaultFormat',
      'pandocExportFormats',
      'pandocExportLocation',
      'pandocExportFolder',
      'pandocStandalone',
      'pandocToc',
      'pandocNumberSections',
      'pandocReferenceDoc'
    ]

    it('declares every setting the preferences page renders', () => {
      for (const key of keys) {
        expect(schema[key], `${key} missing from schema.json`).toBeDefined()
        expect(defaultPreferences[key], `${key} missing from preference.json`).toBeDefined()
      }
    })

    it('gives each key the same default in the schema and in preference.json', () => {
      for (const key of keys) {
        expect(schema[key]?.default, `${key} default differs`).toEqual(defaultPreferences[key])
      }
    })

    it('preselects a default format that is on offer by default', () => {
      expect(PANDOC_EXPORT_FORMAT_IDS).toContain(schema.pandocDefaultFormat?.default)
    })

    it('constrains the location preference to the locations it declares', () => {
      expect(schema.pandocExportLocation?.enum).toEqual([...PANDOC_EXPORT_LOCATIONS])
    })

    it('blocks a stale template from reaching a writer that rejects it by default', () => {
      // The two settings ship separately: the template is empty, so no export
      // passes it before the user picks one.
      expect(schema.pandocReferenceDoc?.default).toBe('')
    })
  })
})
