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
 * `epub3`), `extension` drives the save dialog filter, and `label` is shown
 * verbatim in the menu and in the preferences check list. The labels stay in
 * English on purpose: they are format names rather than prose, and translating
 * them would add ten keys to keep in sync across every locale file for no
 * reader benefit.
 */
export const PANDOC_EXPORT_FORMATS: readonly PandocExportFormat[] = Object.freeze([
  { id: 'docx', label: 'Word (.docx)', target: 'docx', extension: '.docx' },
  { id: 'odt', label: 'OpenDocument (.odt)', target: 'odt', extension: '.odt' },
  { id: 'rtf', label: 'RTF (.rtf)', target: 'rtf', extension: '.rtf' },
  { id: 'epub', label: 'EPUB (.epub)', target: 'epub3', extension: '.epub' },
  { id: 'latex', label: 'LaTeX (.tex)', target: 'latex', extension: '.tex' },
  { id: 'rst', label: 'reStructuredText (.rst)', target: 'rst', extension: '.rst' },
  { id: 'org', label: 'Org mode (.org)', target: 'org', extension: '.org' },
  { id: 'mediawiki', label: 'MediaWiki (.wiki)', target: 'mediawiki', extension: '.wiki' },
  { id: 'textile', label: 'Textile (.textile)', target: 'textile', extension: '.textile' },
  { id: 'opml', label: 'OPML (.opml)', target: 'opml', extension: '.opml' }
])

/** Every format id, in menu order. Used as the default of `pandocExportFormats`. */
export const PANDOC_EXPORT_FORMAT_IDS: readonly string[] = Object.freeze(
  PANDOC_EXPORT_FORMATS.map((format) => format.id)
)

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
 * Formats the export menu should offer — an empty result means the whole
 * "Convert with Pandoc" entry (and its separator) is left out.
 *
 * `enabled` only counts as off when it is exactly `false`, so a preferences
 * file written before the setting existed behaves like the enabled default.
 */
export const getPandocMenuFormats = (
  enabled: boolean | undefined,
  selected?: readonly string[] | null
): PandocExportFormat[] => (enabled === false ? [] : getPandocExportFormats(selected))
