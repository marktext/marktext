// Copy from https://github.com/utatti/simple-pandoc/blob/master/index.js
import { spawn } from 'child_process'
import type { Readable } from 'stream'
import commandExists from 'command-exists'
import { isFile2 } from 'common/filesystem'

// Re-exported so the menu and the unit tests can keep importing them from here.
// The definitions moved to `shared`: the renderer's preferences pane renders the
// same list to let the user pick which formats the menu offers.
export { PANDOC_EXPORT_FORMATS } from '@shared/pandoc'
export type { PandocExportFormat } from '@shared/pandoc'

const pandocCommand = 'pandoc'

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

const getCommand = (): string => {
  if (envPathExists()) {
    return process.env.MARKTEXT_PANDOC as string
  }
  return pandocCommand
}

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
}

const pandoc = ((from: string, to: string, ...args: string[]): PandocConverter => {
  const command = getCommand()
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
  if (envPathExists()) {
    return true
  }
  return commandExists.sync(pandocCommand)
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
    const { cwd, reader = getPandocReader(false) } = options
    const option = ['-f', reader, '-t', to, '-s', '-o', outputPath]

    const proc = spawn(getCommand(), option, { cwd })
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
