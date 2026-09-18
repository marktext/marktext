// Copy from https://github.com/utatti/simple-pandoc/blob/master/index.js
import { spawn } from 'child_process'
import type { Readable } from 'stream'
import commandExists from 'command-exists'
import { isFile2 } from 'common/filesystem'
import { PANDOC_REFERENCE_DOC_TARGETS } from '@shared/pandoc'
import type { PandocCheckResult } from '@shared/pandoc'
import { getUserPreference } from '../app/userPreference'

// Re-exported so the menu and the unit tests can keep importing them from here.
// The definitions moved to `shared`: the renderer's preferences pane renders the
// same list to let the user pick which formats the menu offers.
export { PANDOC_EXPORT_FORMATS } from '@shared/pandoc'
export type { PandocExportFormat, PandocCheckResult } from '@shared/pandoc'

const pandocCommand = 'pandoc'

/**
 * Command to spawn.
 *
 * Order: the configured path, then `MARKTEXT_PANDOC`, then a bare `pandoc` for
 * `PATH` to resolve. Each earlier source is skipped when it is set but does not
 * point at a file, so a stale value cannot make every conversion fail when a
 * working pandoc is reachable through the next source.
 *
 * The preference is read per call rather than cached, so changing it in the
 * preferences page applies to the next conversion without a restart.
 */
export const resolvePandocCommand = (): string => {
  const configured = (getUserPreference()?.getItem<string>('pandocPath') ?? '').trim()
  if (configured && isFile2(configured)) {
    return configured
  }
  if (envPathExists()) {
    return process.env.MARKTEXT_PANDOC as string
  }
  return pandocCommand
}

/**
 * Reader to hand the document to pandoc with.
 *
 * MarkText edits GFM plus a few extensions, and pandoc's `markdown` reader
 * turns on extensions that change what the text says: `smart` curls quotes and
 * rewrites `--`, `@alice` turns into a citation, `:smile:` stays literal instead
 * of becoming an emoji, a paragraph starting with `|` becomes a line block, and
 * `# Title {#x}` loses the attribute. `gfm` reproduces what the editor shows.
 *
 * `superSubScript` is off by default, so `~x~`/`^x^` must stay literal unless
 * the user asked for sub/superscript — hence the conditional extension. Nothing
 * newer is added on purpose: pandoc 3.1.3 (Ubuntu 24.04) exits with
 * "The extension tex_math_gfm is not supported for gfm" (same for `alerts`),
 * and it already enables `tex_math_dollars` for `gfm`.
 */
export const getPandocReader = (superSubScript: boolean): string =>
  superSubScript ? 'gfm+superscript+subscript' : 'gfm'

interface PandocConverter {
  (): Promise<string>
  stream: (srcStream: NodeJS.ReadableStream) => Readable | null
}

interface PandocFn {
  (from: string, to: string, ...args: string[]): PandocConverter
  exists: () => boolean
  toFile: (
    to: string,
    outputPath: string,
    input: string,
    options?: PandocToFileOptions
  ) => Promise<PandocToFileResult>
  check: (command?: string) => Promise<PandocCheckResult>
}

const pandoc = ((from: string, to: string, ...args: string[]): PandocConverter => {
  const command = resolvePandocCommand()
  const option = ['-s', from, '-t', to].concat(args)

  const converter = ((): Promise<string> =>
    new Promise((resolve, reject) => {
      const proc = spawn(command, option)
      proc.on('error', reject)
      let data = ''
      proc.stdout.on('data', (chunk: Buffer | string) => {
        data += chunk.toString()
      })
      proc.stdout.on('end', () => resolve(data))
      proc.stdout.on('error', reject)
      proc.stdin.end()
    })) as PandocConverter

  converter.stream = (srcStream: NodeJS.ReadableStream): Readable | null => {
    const proc = spawn(command, option)
    srcStream.pipe(proc.stdin)
    return proc.stdout
  }

  return converter
}) as PandocFn

pandoc.exists = (): boolean => {
  const command = resolvePandocCommand()
  if (command !== pandocCommand) {
    return true
  }
  return commandExists.sync(pandocCommand)
}

/**
 * Run `pandoc --version` so the preferences page can tell a working path from a
 * typo. Checking that the file exists is not enough — a renamed binary, a
 * script without execute permission, or a 32-bit build on a machine without the
 * runtime all pass that test and then fail on the first export.
 *
 * `command` defaults to the resolved command, so pressing "check" with the field
 * left empty tests the same pandoc an export would use.
 */
pandoc.check = (command?: string): Promise<PandocCheckResult> => {
  const target = (command ?? '').trim() || resolvePandocCommand()
  return new Promise((resolve) => {
    let settled = false
    const done = (result: PandocCheckResult): void => {
      if (!settled) {
        settled = true
        resolve(result)
      }
    }

    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn(target, ['--version'])
    } catch (err) {
      const error = err as Error
      return done({ ok: false, error: error.message })
    }

    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })
    proc.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })
    // A missing command surfaces here (ENOENT) rather than as a non-zero exit.
    proc.on('error', (err) => done({ ok: false, error: err.message }))
    proc.on('close', (code: number | null) => {
      if (code === 0) {
        const version = stdout.split('\n')[0]?.trim()
        done({ ok: true, version: version || target })
      } else {
        done({
          ok: false,
          error: stderr.trim() || `exit code ${String(code)}`
        })
      }
    })
    proc.stdin?.on('error', () => {})
    proc.stdin?.end()
  })
}

export interface PandocToFileOptions {
  /**
   * Directory the document's relative links resolve against. Pass the folder
   * holding the source document: pandoc resolves `![](pics/a.png)` against the
   * process cwd otherwise, which is `/` in a packaged app, and a file it cannot
   * find is quietly replaced with the image's alt text while pandoc still exits
   * 0 — so docx/odt/epub come out with the pictures missing and no error.
   */
  cwd?: string
  /** Reader used to parse `input`; see `getPandocReader`. */
  reader?: string
  /** `-s`: emit a complete document instead of a body fragment. */
  standalone?: boolean
  /** `--toc`: insert a table of contents. */
  toc?: boolean
  /** `--number-sections`: number the headings. */
  numberSections?: boolean
  /**
   * `--reference-doc`: style template for the export. Ignored for writers that
   * do not take the option — see `PANDOC_REFERENCE_DOC_TARGETS`.
   */
  referenceDoc?: string
}

export interface PandocToFileResult {
  /**
   * Pandoc's stderr from a successful run: empty when it stayed quiet, and
   * otherwise the `[WARNING]` lines (an image it could not fetch, an unknown
   * extension) that exit code 0 would hide from the user.
   */
  warnings: string
}

/**
 * Arguments for a conversion to `to`, written to `outputPath`.
 *
 * Exported because the tests assert the exact argument list: the flag set is
 * what a user sees the effect of, and a wrong one (a `--reference-doc` on a
 * writer that rejects it, or a dropped `-s`) fails the export outright rather
 * than degrading it.
 */
export const buildPandocArguments = (options: {
  reader: string
  to: string
  outputPath: string
  standalone?: boolean
  toc?: boolean
  numberSections?: boolean
  referenceDoc?: string
}): string[] => {
  const {
    reader,
    to,
    outputPath,
    standalone = true,
    toc = false,
    numberSections = false,
    referenceDoc = ''
  } = options

  const args = ['-f', reader, '-t', to]
  if (standalone) {
    args.push('-s')
  }
  if (toc) {
    args.push('--toc')
  }
  if (numberSections) {
    args.push('--number-sections')
  }
  // pandoc exits 1 with "The --reference-doc option is not supported for X" on
  // every other writer, so the template only rides along when it applies.
  if (referenceDoc && PANDOC_REFERENCE_DOC_TARGETS.includes(to)) {
    args.push(`--reference-doc=${referenceDoc}`)
  }
  args.push('-o', outputPath)
  return args
}

/**
 * Convert `input` from markdown and write the result to `outputPath`.
 *
 * The streaming API above cannot serve binary targets because it decodes stdout
 * into a string, and docx/odt/epub/pptx are zip containers. The document
 * therefore goes in over stdin and the result is written by pandoc itself.
 */
pandoc.toFile = (
  to: string,
  outputPath: string,
  input: string,
  options: PandocToFileOptions = {}
): Promise<PandocToFileResult> =>
  new Promise((resolve, reject) => {
    const {
      cwd,
      reader = getPandocReader(false),
      standalone,
      toc,
      numberSections,
      referenceDoc
    } = options
    const args = buildPandocArguments({
      reader,
      to,
      outputPath,
      standalone,
      toc,
      numberSections,
      referenceDoc
    })

    const proc = spawn(resolvePandocCommand(), args, { cwd })
    let errorOutput = ''
    proc.on('error', reject)
    proc.stderr.on('data', (chunk: Buffer | string) => {
      errorOutput += chunk.toString()
    })
    // Pandoc can exit before it has drained stdin — an unknown writer fails
    // immediately — and the pipe then emits EPIPE on a document larger than the
    // pipe buffer. Unhandled, that becomes an uncaught exception in the main
    // process; the exit code and stderr still arrive through `close`.
    proc.stdin.on('error', () => {})
    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ warnings: errorOutput.trim() })
      } else {
        // pandoc reports conversion errors on stderr with exit code 1; surface
        // that text because it names the offending source position.
        reject(new Error(errorOutput.trim() || `pandoc exited with code ${String(code)}`))
      }
    })
    proc.stdin.end(input)
  })

const envPathExists = (): boolean => {
  return !!process.env.MARKTEXT_PANDOC && isFile2(process.env.MARKTEXT_PANDOC)
}

export default pandoc
