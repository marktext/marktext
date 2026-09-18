// Pandoc export targets.
//
// Lives in `shared` because two processes need the same ids: the main process
// builds the menu from them, and the renderer's preferences pane renders the
// check list that decides which of them are shown. The ids are also what gets
// stored in the `pandocExportFormats` preference, so renaming one silently
// drops a user's selection.

export interface PandocExportFormat {
  id: string
  label: string
  target: string
  extension: string
}

/**
 * `target` is the pandoc writer name (not always the format id — epub maps to
 * `epub3`, plain text to `plain`), `extension` drives the save dialog filter,
 * and `label` is shown verbatim in the menu and in the preferences check list.
 *
 * The labels stay in English on purpose: they are format names rather than
 * prose, and translating them would add a key per format to keep in sync across
 * every locale file for no reader benefit.
 *
 * PDF is deliberately absent. MarkText already renders PDF through Chromium
 * (`File → Export → PDF`), and a pandoc PDF needs a LaTeX engine installed on
 * top of pandoc; offering both would put two different PDFs behind one name.
 * HTML is also available natively, but as a styled copy of the editor preview —
 * pandoc's is a standalone document with its own CSS, which is a different
 * artifact rather than a duplicate.
 */
export const PANDOC_EXPORT_FORMATS: readonly PandocExportFormat[] = Object.freeze([
  { id: 'docx', label: 'Word (.docx)', target: 'docx', extension: '.docx' },
  { id: 'html', label: 'HTML (.html)', target: 'html5', extension: '.html' },
  { id: 'epub', label: 'EPUB (.epub)', target: 'epub3', extension: '.epub' },
  { id: 'pptx', label: 'PowerPoint (.pptx)', target: 'pptx', extension: '.pptx' },
  { id: 'odt', label: 'OpenDocument (.odt)', target: 'odt', extension: '.odt' },
  { id: 'rtf', label: 'RTF (.rtf)', target: 'rtf', extension: '.rtf' },
  { id: 'txt', label: 'Plain text (.txt)', target: 'plain', extension: '.txt' }
])

/** Every format id, in menu order. Used as the default of `pandocExportFormats`. */
export const PANDOC_EXPORT_FORMAT_IDS: readonly string[] = Object.freeze(
  PANDOC_EXPORT_FORMATS.map((format) => format.id)
)

/**
 * Writers that accept `--reference-doc`.
 *
 * pandoc rejects the option for any other writer, so the export cannot pass it
 * unconditionally when a template is configured.
 */
export const PANDOC_REFERENCE_DOC_TARGETS: readonly string[] = Object.freeze(['docx', 'odt'])

/**
 * Which Word template a docx export takes, in the order the preferences show
 * them: pandoc's built-in styling, the bundled reference document that mirrors
 * the editor (ruled tables, shaded code), or a file of the user's own.
 */
export type PandocDocxTemplate = 'default' | 'wysiwyg' | 'custom'

/** Valid values of `pandocDocxTemplate`, in the order the preferences show them. */
export const PANDOC_DOCX_TEMPLATES: readonly PandocDocxTemplate[] = Object.freeze([
  'default',
  'wysiwyg',
  'custom'
])

/** Where a converted file is written. */
export type PandocExportLocation = 'source' | 'ask' | 'folder'

/** Valid values of `pandocExportLocation`, in the order the preferences show them. */
export const PANDOC_EXPORT_LOCATIONS: readonly PandocExportLocation[] = Object.freeze([
  'source',
  'ask',
  'folder'
])

export const isPandocExportLocation = (value: unknown): value is PandocExportLocation =>
  typeof value === 'string' && (PANDOC_EXPORT_LOCATIONS as readonly string[]).includes(value)

/**
 * Outcome of running `pandoc --version`, as shown next to the path field in the
 * preferences page.
 */
export interface PandocCheckResult {
  /** The command was found and started successfully. */
  ok: boolean
  /** First line of `pandoc --version`, e.g. `pandoc 3.1.3`. */
  version?: string
  /** Why the check failed, ready to show to the user. */
  error?: string
}

/**
 * Where a file should go, given the `pandocExportLocation` preference.
 *
 * Anything unrecognised (an older preferences file, a hand-edited one) falls
 * back to asking, which is the only option that cannot silently write to a
 * surprising place.
 */
export const getPandocExportLocation = (value: unknown): PandocExportLocation =>
  isPandocExportLocation(value) ? value : 'ask'

/**
 * Formats to offer, given the user's `pandocExportFormats` preference.
 *
 * `undefined` means the preference was never written — an older preferences
 * file, or a hand-edited one. Fall back to every format so an upgrade cannot
 * silently empty the menu. An empty array is a deliberate "none selected" and
 * yields nothing, which is what hides the submenu.
 *
 * The result keeps `PANDOC_EXPORT_FORMATS` order rather than the stored order,
 * so the menu cannot drift into an arbitrary arrangement.
 */
export const getPandocExportFormats = (
  selected?: readonly string[] | null
): PandocExportFormat[] =>
  selected
    ? PANDOC_EXPORT_FORMATS.filter((format) => selected.includes(format.id))
    : [...PANDOC_EXPORT_FORMATS]

/**
 * Format used by default — the save dialog's filter and the entry the menu
 * marks.
 *
 * Falls back to the first format still on offer when the preference names one
 * the user has since unchecked (or a format that no longer exists), so the
 * default can never point outside the menu.
 */
export const getPandocDefaultFormat = (
  formats: readonly PandocExportFormat[],
  preferredId?: string | null
): PandocExportFormat | undefined => {
  if (preferredId) {
    const preferred = formats.find((format) => format.id === preferredId)
    if (preferred) {
      return preferred
    }
  }
  return formats[0]
}
