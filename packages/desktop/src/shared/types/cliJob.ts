/**
 * Headless CLI job definitions shared by the main process (validation,
 * orchestration) and the renderer (window job execution).
 */

export type CliJobKind = 'export-pdf' | 'export-html' | 'export-pandoc' | 'import'

/** Kinds rendered in a hidden editor window; the rest run windowless in main. */
export type CliWindowJobKind = Extract<CliJobKind, 'export-pdf' | 'export-html'>

/** Export options mirroring the interactive export dialog (exportSettings). */
export interface CliExportOptions {
  pageSize?: string
  isLandscape?: boolean
  pageMarginTop?: number
  pageMarginRight?: number
  pageMarginBottom?: number
  pageMarginLeft?: number
  /** `academic` | `liber` | a CSS file name in `<userData>/themes/export`. */
  theme?: string | null
  /** Center header/footer text (single-cell layout); empty means none. */
  header?: string
  footer?: string
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  autoNumberingHeadings?: boolean
  showFrontMatter?: boolean
  tocTitle?: string
}

/** The window-job descriptor handed to the renderer through the window URL. */
export interface CliWindowJobDescriptor {
  kind: CliWindowJobKind
  /** Absolute markdown paths to export, in order. */
  inputs: string[]
  options: CliExportOptions
}

export const isCliWindowJobKind = (kind: CliJobKind): kind is CliWindowJobKind =>
  kind === 'export-pdf' || kind === 'export-html'
