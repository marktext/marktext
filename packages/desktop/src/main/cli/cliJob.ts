import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import log from 'electron-log'
import { isFile } from 'common/filesystem'
import { isMarkdownFile } from 'common/filesystem/paths'
import type {
  CliExportOptions,
  CliJobKind,
  CliWindowJobDescriptor
} from '@shared/types/cliJob'
import { isCliWindowJobKind } from '@shared/types/cliJob'
import { PANDOC_EXPORT_FORMATS, type PandocExportFormat } from '../utils/pandoc'

/**
 * Headless CLI job mode:
 *
 *   marktext --export-pdf  <in.md...>  [-o <out.pdf|dir>]  [export options]
 *   marktext --export-html <in.md...>  [-o <out.html|dir>] [export options]
 *   marktext --export <format> <in.md...> [-o <out|dir>]   (pandoc)
 *   marktext --import <file...>        [-o <out.md|dir>]   (pandoc)
 *
 * PDF/HTML jobs render in a hidden editor window with the same pipeline as
 * File → Export and are written by the `mt::response-export` interception in
 * menu/actions/file.ts. Pandoc jobs run windowless in the main process.
 *
 * Exit codes: 0 success, 1 job failed / timed out, 2 bad command line.
 */

export interface CliJob {
  readonly kind: CliJobKind
  /** Absolute input paths, in order. */
  readonly inputs: string[]
  /** Absolute output path per input (same order). */
  readonly outputs: string[]
  readonly options: CliExportOptions
  /** Pandoc target description, for `--export <format>`. */
  readonly format?: PandocExportFormat
}

const PAGE_SIZES = ['A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid'] as const

let pendingJob: CliJob | null = null
let jobCompleted = false
/** Window jobs: normalized input path -> output path not written yet. */
const pendingOutputs = new Map<string, string>()
/** Written output paths, echoed to stdout at the end. */
const writtenOutputs: string[] = []

const writeErr = (s: string): boolean => process.stderr.write(s + '\n')
const writeOut = (s: string): boolean => process.stdout.write(s + '\n')

const failUsage = (message: string): never => {
  writeErr(`marktext: ${message}`)
  app.exit(2)
  // `app.exit` is asynchronous during startup; never continue a failed job.
  process.exit(2)
}

/** Path comparison key: Windows is case-insensitive and slash-tolerant. */
const normalizeForKey = (p: string): string =>
  process.platform === 'win32' ? path.resolve(p).replace(/\//g, '\\').toLowerCase() : path.resolve(p)

const asArray = (value: unknown): string[] => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

const positionalInputs = (args: Record<string, unknown>): string[] => {
  const positional = (args._ as string[] | undefined) ?? []
  // `arg` in permissive mode keeps unknown flags in `_`; they are not files.
  return positional.filter((p) => !p.startsWith('--'))
}

const numberOption = (args: Record<string, unknown>, flag: string): number | undefined => {
  const value = args[flag]
  if (value === undefined) return undefined
  const num = Number(value)
  if (!Number.isFinite(num)) failUsage(`${flag} expects a number, got '${String(value)}'`)
  return num
}

const parseExportOptions = (args: Record<string, unknown>): CliExportOptions => {
  const options: CliExportOptions = {}

  const pageSize = args['--page-size'] as string | undefined
  if (pageSize !== undefined) {
    const normalized = pageSize.trim().toLowerCase()
    const known = PAGE_SIZES.find((s) => s.toLowerCase() === normalized)
    if (!known) failUsage(`unknown --page-size '${pageSize}' (expected one of ${PAGE_SIZES.join(', ')})`)
    options.pageSize = known
  }
  if (args['--landscape']) options.isLandscape = true

  const margins: Array<[string, keyof CliExportOptions]> = [
    ['--margin-top', 'pageMarginTop'],
    ['--margin-right', 'pageMarginRight'],
    ['--margin-bottom', 'pageMarginBottom'],
    ['--margin-left', 'pageMarginLeft']
  ]
  for (const [flag, key] of margins) {
    const value = numberOption(args, flag)
    if (value !== undefined) {
      if (value < 0 || value > 100) failUsage(`${flag} expects millimeters between 0 and 100`)
      ;(options[key] as number) = value
    }
  }

  const theme = args['--theme'] as string | undefined
  if (theme !== undefined && theme !== 'default') options.theme = theme
  const header = args['--header'] as string | undefined
  if (header) options.header = header
  const footer = args['--footer'] as string | undefined
  if (footer) options.footer = footer
  const fontFamily = args['--font-family'] as string | undefined
  if (fontFamily && fontFamily !== 'Default') options.fontFamily = fontFamily
  const fontSize = numberOption(args, '--font-size')
  if (fontSize !== undefined) {
    if (fontSize < 6 || fontSize > 72) failUsage('--font-size expects pixels between 6 and 72')
    options.fontSize = fontSize
  }
  const lineHeight = numberOption(args, '--line-height')
  if (lineHeight !== undefined) {
    if (lineHeight < 1 || lineHeight > 3) failUsage('--line-height expects a value between 1 and 3')
    options.lineHeight = lineHeight
  }
  if (args['--auto-numbering-headings']) options.autoNumberingHeadings = true
  if (args['--show-front-matter']) options.showFrontMatter = true
  const tocTitle = args['--toc-title'] as string | undefined
  if (tocTitle !== undefined) options.tocTitle = tocTitle

  return options
}

const defaultExtension = (kind: CliJobKind, format?: PandocExportFormat): string => {
  switch (kind) {
    case 'export-pdf':
      return '.pdf'
    case 'export-html':
      return '.html'
    case 'export-pandoc':
      return format ? format.extension : '.out'
    case 'import':
      return '.md'
  }
}

const resolveOutputs = (
  kind: CliJobKind,
  inputs: string[],
  rawOutput: unknown,
  format?: PandocExportFormat
): string[] => {
  const extension = defaultExtension(kind, format)
  const output = typeof rawOutput === 'string' && rawOutput.length > 0 ? rawOutput : null

  if (inputs.length === 1) {
    if (output) return [path.resolve(output)]
    const input = inputs[0]
    return [path.join(path.dirname(input), `${path.basename(input, path.extname(input))}${extension}`)]
  }

  // Batch: `-o` names a directory, otherwise each input's own folder.
  let outDir: string | null = null
  if (output) {
    outDir = path.resolve(output)
    fs.mkdirSync(outDir, { recursive: true })
  }
  return inputs.map((input) => {
    const dir = outDir ?? path.dirname(input)
    return path.join(dir, `${path.basename(input, path.extname(input))}${extension}`)
  })
}

/**
 * Validate the parsed command line and register the CLI job. Returns `null`
 * when no job flag was given (normal GUI startup). Terminates the process
 * with exit code 2 on invalid input because a CLI caller expects a failure
 * instead of a GUI.
 */
export const prepareCliJob = (args: Record<string, unknown>): CliJob | null => {
  const pdfInputs = asArray(args['--export-pdf'])
  const htmlInputs = asArray(args['--export-html'])
  const pandocArgs = asArray(args['--export'])
  const importInputs = asArray(args['--import'])

  const kinds: Array<{ kind: CliJobKind; inputs: string[]; format?: PandocExportFormat }> = []
  if (pdfInputs.length > 0) kinds.push({ kind: 'export-pdf', inputs: pdfInputs })
  if (htmlInputs.length > 0) kinds.push({ kind: 'export-html', inputs: htmlInputs })
  if (pandocArgs.length > 0) {
    const [formatId, ...rest] = pandocArgs
    const format = PANDOC_EXPORT_FORMATS.find((f) => f.id === formatId || f.target === formatId)
    if (!format) {
      failUsage(
        `unknown export format '${formatId}' (expected one of ${PANDOC_EXPORT_FORMATS.map((f) => f.id).join(', ')})`
      )
    }
    kinds.push({ kind: 'export-pandoc', inputs: rest, format })
  }
  if (importInputs.length > 0) kinds.push({ kind: 'import', inputs: importInputs })

  if (kinds.length === 0) return null
  if (kinds.length > 1) {
    failUsage('--export-pdf, --export-html, --export and --import are mutually exclusive')
  }

  const { kind, inputs: rawInputs, format } = kinds[0]
  const inputs = [...rawInputs, ...positionalInputs(args)].map((p) => path.resolve(p))
  if (inputs.length === 0) failUsage(`--${kind === 'export-pandoc' ? 'export' : kind.replace('export-', 'export-')} requires at least one input file`)

  for (const input of inputs) {
    if (!isFile(input)) failUsage(`cannot read '${input}': no such file`)
    // A window job tab only opens for markdown files; anything else would
    // never render and hang the job until the watchdog fires.
    if (isCliWindowJobKind(kind) && !isMarkdownFile(input)) {
      failUsage(`cannot export '${input}': not a markdown file`)
    }
  }

  const job: CliJob = {
    kind,
    inputs,
    outputs: resolveOutputs(kind, inputs, args['--output'], format),
    options: isCliWindowJobKind(kind) ? parseExportOptions(args) : {},
    format
  }

  pendingJob = job
  for (let i = 0; i < inputs.length; ++i) {
    pendingOutputs.set(normalizeForKey(inputs[i]), job.outputs[i])
  }
  return job
}

/** The pending CLI job, or `null` in normal GUI mode. */
export const getCliJob = (): CliJob | null => pendingJob

/** True once the job has finished (late duplicate answers are ignored). */
export const isCliJobCompleted = (): boolean => jobCompleted

/** The descriptor handed to the renderer for window jobs, otherwise `null`. */
export const getCliWindowJobDescriptor = (): CliWindowJobDescriptor | null => {
  if (!pendingJob || !isCliWindowJobKind(pendingJob.kind)) return null
  return { kind: pendingJob.kind, inputs: pendingJob.inputs, options: pendingJob.options }
}

/** The output path belonging to a tab pathname, normalized the same way. */
export const getCliOutputFor = (tabPathname: string): string | null =>
  pendingOutputs.get(normalizeForKey(tabPathname)) ?? null

/**
 * Mark one input as written. Returns the number of inputs still pending.
 */
export const markCliOutputWritten = (tabPathname: string, outputPath: string): number => {
  pendingOutputs.delete(normalizeForKey(tabPathname))
  writtenOutputs.push(outputPath)
  return pendingOutputs.size
}

export const countPendingCliOutputs = (): number => pendingOutputs.size

const watchdogTimeout = (): number => 120000 + (pendingJob ? (pendingJob.inputs.length - 1) * 60000 : 0)

/**
 * Arm a watchdog that kills the process when the job never completes, e.g.
 * because the renderer crashed or a document failed to load. CLI callers
 * must not hang forever.
 */
export const startCliJobWatchdog = (): void => {
  if (!pendingJob) return
  const timeout = watchdogTimeout()
  const timer = setTimeout(() => {
    finishCliJob(1, `marktext: job timed out after ${timeout} ms`)
  }, timeout)
  // The watchdog alone must not keep the process alive.
  timer.unref?.()
}

/**
 * Finish the job and terminate the process. Success echoes every written
 * file to stdout; failure reports to stderr.
 */
export const finishCliJob = (code: 0 | 1, message?: string): void => {
  if (jobCompleted) return
  jobCompleted = true
  if (code === 0) {
    for (const output of writtenOutputs) writeOut(output)
    if (message) writeOut(message)
  } else if (message) {
    writeErr(message)
    log.error('Headless CLI job failed:', message)
  }
  app.exit(code)
}
