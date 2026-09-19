/**
 * Per-document export presets via document frontmatter (#7).
 *
 * A document can carry an `export:` section in its YAML frontmatter that is
 * applied on top of the persisted export defaults when the export dialog
 * opens, so a "project" ships its own export preset:
 *
 * ```markdown
 * ---
 * title: Report
 * export:
 *   pageSize: A4
 *   isLandscape: true
 *   tocTitle: 目录
 *   showFrontMatter: false
 * ---
 * ```
 *
 * The parser is intentionally a minimal, dependency-free reader for the flat
 * `key: value` mapping shape used here — the full document frontmatter is
 * still parsed/owned by the editor engine.
 */

// The opening `---` fence of a YAML frontmatter block at the very start of
// the document (allowing a leading BOM, matched via \uFEFF).
const FRONTMATTER_REG = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

// One `key: value` line of the `export:` mapping, indented under it.
const EXPORT_ENTRY_REG = /^[ \t]+([A-Za-z][A-Za-z0-9_]*):[ \t]*(.*?)[ \t]*\r?$/

// A non-indented, non-blank, non-comment line ends the `export:` mapping.
const MAPPING_END_REG = /^[^\s#-]|^---/

const parseScalar = (raw: string): unknown => {
  // Strip a trailing YAML comment (` # note`) unless quoted.
  let value = raw.trim()
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1)
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1)
  }
  const hashIndex = value.indexOf(' #')
  if (hashIndex !== -1) {
    value = value.slice(0, hashIndex).trim()
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null' || value === '') return undefined
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return value
}

/**
 * Extracts the `export:` preset mapping from a document's frontmatter.
 * Returns `{}` when the document has no frontmatter or no export section.
 * Unknown keys are kept — the caller decides which ones to apply.
 */
export const parseExportFrontmatter = (markdown: string): Record<string, unknown> => {
  const match = FRONTMATTER_REG.exec(markdown ?? '')
  if (!match) return {}

  const lines = match[1].split(/\r?\n/)
  const preset: Record<string, unknown> = {}

  let inExport = false
  for (const line of lines) {
    if (!inExport) {
      inExport = /^export:[ \t]*\r?$/.test(line)
      continue
    }

    if (line.trim() === '' || line.trim().startsWith('#')) continue

    if (MAPPING_END_REG.test(line)) break

    const entry = EXPORT_ENTRY_REG.exec(line)
    if (entry) {
      const value = parseScalar(entry[2])
      if (value !== undefined) {
        preset[entry[1]] = value
      }
    }
  }

  return preset
}
