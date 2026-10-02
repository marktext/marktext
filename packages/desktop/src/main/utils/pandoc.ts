// Copy from https://github.com/utatti/simple-pandoc/blob/master/index.js
import { spawn } from 'child_process'
import path from 'path'
import { resolveCommand } from './resolveCommand'

const pandocCommand = 'pandoc'

/** Targets offered by "Export → Convert with Pandoc"; `label` is not translated. */
export interface PandocExportFormat {
  id: string
  label: string
  target: string
  extension: string
}

export const PANDOC_EXPORT_FORMATS: readonly PandocExportFormat[] = Object.freeze([
  { id: 'docx', label: 'Word (.docx)', target: 'docx', extension: '.docx' },
  { id: 'odt', label: 'OpenDocument (.odt)', target: 'odt', extension: '.odt' },
  { id: 'rtf', label: 'RTF (.rtf)', target: 'rtf', extension: '.rtf' },
  { id: 'epub', label: 'EPUB (.epub)', target: 'epub3', extension: '.epub' },
  { id: 'latex', label: 'LaTeX (.tex)', target: 'latex', extension: '.tex' },
  { id: 'rst', label: 'reStructuredText (.rst)', target: 'rst', extension: '.rst' },
  { id: 'org', label: 'Org mode (.org)', target: 'org', extension: '.org' },
  { id: 'mediawiki', label: 'MediaWiki (.wiki)', target: 'mediawiki', extension: '.wiki' },
  { id: 'textile', label: 'Textile (.textile)', target: 'textile', extension: '.textile' }
])

// These writers have no container to inline an image into: pandoc leaves a plain link.
export const formatLinksMedia = (target: string): boolean =>
  ['latex', 'rst', 'org', 'mediawiki', 'textile'].includes(target)

// What pandoc fetches over the network instead of opening: `https:` or its protocol-
// relative form. A path written with backslashes is a file, and mirrors like a local one.
export const isRemoteMedia = (url: string): boolean => /^(https?:)?\/\//i.test(url)

// Whether the export should carry the document's pictures along (`--extract-media`). It
// replaces a link it cannot read with the alt text, so mirror only the links that resolve: a
// saved document reads relative links from its own folder, an absolute link needs no folder,
// a never-saved one has neither, and a remote picture is downloaded instead (a failed fetch
// costs it). Its own folder needs no copy either: `C:/a` and `C:\a` are the same folder.
export const shouldMirrorMedia = (
  links: string[],
  sourceDir: string | undefined,
  outputPath: string
): boolean =>
  !links.some(isRemoteMedia) &&
  (!!sourceDir || links.every((url) => path.isAbsolute(url))) &&
  (sourceDir === undefined || path.relative(sourceDir, path.dirname(outputPath)) !== '')

/** The Preferences → Markdown toggles that map onto a pandoc reader extension. */
export interface PandocReaderOptions {
  superSubScript: boolean
  /** `false` keeps a `[^1]` literal; the readers enable `footnotes` themselves. */
  footnotes?: boolean
  /** `false` drops `$…$`; the readers enable `tex_math_dollars` themselves. */
  texMathDollars?: boolean
  /** pandoc's `tex_math_gfm`: GitHub's `` $`…`$ `` and ` ```math ` math. */
  texMathGfm?: boolean
  /** pandoc's `tex_math_single_backslash`: `\(…\)` and `\[…\]`. */
  texMathSingleBackslash?: boolean
  /** pandoc's `tex_math_double_backslash`: `\\(…\\)` and `\\[…\\]`. */
  texMathDoubleBackslash?: boolean
}

/** Every extension a reader lists, mapped to whether that reader enables it by default. */
export type ReaderExtensionDefaults = ReadonlyMap<string, boolean>

export interface PandocReaderExtensions {
  gfm: ReaderExtensionDefaults
  markdown: ReaderExtensionDefaults
}

/**
 * The reader a pandoc export parses with, from the Preferences → Markdown toggles.
 *
 * `gfm` is the reader that matches the editor, but pandoc's `gfm` carries neither
 * `tex_math_single_backslash` nor `tex_math_double_backslash` — naming one makes pandoc
 * reject the whole reader (#5566). When either is on, the reader is built from
 * `markdown`, which supports them, and every other extension is forced to gfm's own
 * default so tables, strikeout and task lists keep reading the same way.
 *
 * `tex_math_gfm` is commonmark-only: no pandoc reader carries it together with the
 * backslash extensions, so a document enabling both is read with the backslash ones and
 * the GFM math is left to the reader's default. The `tex_math_gfm` flag and the
 * `markdown` diff are both written only from `extensions`, the installed pandoc's own
 * listing; without it each reader keeps its format defaults, since pandoc rejects a
 * reader carrying a name it does not know.
 */
export const getPandocReader = (
  options: PandocReaderOptions,
  extensions?: PandocReaderExtensions | null
): string => {
  const {
    superSubScript,
    footnotes = true,
    texMathDollars = true,
    texMathGfm = false,
    texMathSingleBackslash = false,
    texMathDoubleBackslash = false
  } = options

  if (texMathSingleBackslash || texMathDoubleBackslash) {
    // `superSubScript`, `footnotes` and the three math extensions are the editor's; every
    // other extension follows gfm, including the ones gfm does not carry (which stay off).
    const desired = (name: string): boolean => {
      switch (name) {
        case 'superscript':
        case 'subscript':
          return superSubScript
        case 'footnotes':
          return footnotes
        case 'tex_math_dollars':
          return texMathDollars
        case 'tex_math_single_backslash':
          return texMathSingleBackslash
        case 'tex_math_double_backslash':
          return texMathDoubleBackslash
        default:
          return extensions?.gfm.get(name) ?? false
      }
    }
    const flags: string[] = []
    for (const [name, markdownDefault] of extensions?.markdown ?? []) {
      const want = desired(name)
      if (want && !markdownDefault) flags.push(`+${name}`)
      if (!want && markdownDefault) flags.push(`-${name}`)
    }
    // Without a listing only the math flags can be named safely; the rest keeps the
    // reader's own defaults rather than a guess at what this pandoc carries.
    if (!extensions) {
      if (!texMathDollars) flags.push('-tex_math_dollars')
      if (texMathSingleBackslash) flags.push('+tex_math_single_backslash')
      if (texMathDoubleBackslash) flags.push('+tex_math_double_backslash')
    }
    return `markdown${flags.join('')}`
  }

  const flags: string[] = []
  if (superSubScript) flags.push('+superscript+subscript')
  if (!footnotes) flags.push('-footnotes')
  if (!texMathDollars) flags.push('-tex_math_dollars')
  if (extensions?.gfm.has('tex_math_gfm')) {
    flags.push(texMathGfm ? '+tex_math_gfm' : '-tex_math_gfm')
  }
  return `gfm${flags.join('')}`
}

/**
 * The extensions a reader lists, each with whether it enables them by default, from
 * `--list-extensions=<format>`. The listing marks every line (`+tex_math_dollars`,
 * `-smart`). `null` is the answer a pandoc that cannot list gives — a spawn that fails,
 * a non-zero exit, or no line at all. It is never an empty map: that would read as "this
 * reader carries nothing" and strip the reader down to bare math flags.
 */
export const listReaderExtensions = async(
  format: string
): Promise<ReaderExtensionDefaults | null> => {
  const command = await getCommand()
  return new Promise((resolve) => {
    const proc = spawn(command, [`--list-extensions=${format}`])
    let output = ''
    proc.stdout.on('data', (chunk: Buffer | string) => {
      output += chunk.toString()
    })
    proc.stdin.on('error', () => {})
    proc.on('error', () => resolve(null))
    proc.on('close', (code: number | null) => {
      const defaults = new Map<string, boolean>()
      if (code === 0) {
        for (const line of output.split('\n')) {
          // Lines end in `\r\n` on Windows, which `.` would not cross.
          const match = line.trim().match(/^([+-])(.+)$/)
          if (match) defaults.set(match[2].trim(), match[1] === '+')
        }
      }
      resolve(defaults.size > 0 ? defaults : null)
    })
    proc.stdin.end()
  })
}

let readerExtensions: Promise<PandocReaderExtensions | null> | undefined

/**
 * Both listings, or `null` when either is unavailable. A hit is remembered — it is two
 * spawns and each export asks the same question — but a miss is not, so a pandoc
 * installed or repaired later is not stuck behind the first failure.
 */
export const getReaderExtensions = async(): Promise<PandocReaderExtensions | null> => {
  readerExtensions ??= Promise.all([
    listReaderExtensions('gfm'),
    listReaderExtensions('markdown')
  ]).then(([gfm, markdown]) => (gfm && markdown ? { gfm, markdown } : null))
  const extensions = await readerExtensions
  if (extensions === null) readerExtensions = undefined
  return extensions
}

// pandoc knows no `zh`/`zh-CN` and would warn, so Chinese takes the script subtag.
export const getPandocLanguage = (locale: string): string => {
  const [language, region = ''] = locale.trim().split(/[-_]/)
  if (language?.toLowerCase() !== 'zh') return locale
  return /^(hant|tw|hk|mo)$/i.test(region) ? 'zh-Hant' : 'zh-Hans'
}

// Windows only: the installer can be told not to touch `PATH` and a portable copy never is
// (#2751). These are the folders it writes — the package-manager shim dirs are every
// tool's business and live in `extraPathDirs`. The arguments let a spec pin both.
export const pandocLocations = (platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] => {
  if (platform !== 'win32') return []
  return [
    env.ProgramFiles && path.join(env.ProgramFiles, 'Pandoc', 'pandoc.exe'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'Pandoc', 'pandoc.exe'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Pandoc', 'pandoc.exe')
  ].filter((candidate): candidate is string => !!candidate)
}

/** Node refuses to spawn a `.bat`/`.cmd` without `shell: true` (CVE-2024-27980). */
const isBatchFile = (command: string): boolean =>
  process.platform === 'win32' && /\.(bat|cmd)$/i.test(command.trim())

const resolve = async(): Promise<string | null> => {
  const override = process.env.MARKTEXT_PANDOC
  // Naming a batch file is as unusable as naming one that is not there.
  if (override && isBatchFile(override)) return null
  return resolveCommand(pandocCommand, {
    override,
    preferred: pandocLocations(process.platform, process.env)
  })
}

let found: Promise<string> | undefined

/**
 * The one resolution `exists` and every spawn share — a bare name means PATH
 * found it, which a caller must not confuse with the miss fallback below.
 *
 * A hit is remembered: resolution costs a blocking `command -v`, and one
 * export asks three times (the gate, the media listing, the conversion). A
 * miss is not, or the notice inviting the user to install pandoc would be
 * unanswerable without a restart.
 */
const findCommand = (): Promise<string | null> => {
  found ??= resolve().then((command) => command ?? Promise.reject(new Error('pandoc missing')))
  return found.catch(() => {
    found = undefined
    return null
  })
}

/** The bare name is the fallback, so a miss still spawns and reports why. */
const getCommand = async(): Promise<string> => (await findCommand()) ?? pandocCommand

interface PandocFn {
  (from: string, to: string, ...args: string[]): Promise<string>
  exists: () => Promise<boolean>
  toFile: (
    to: string,
    outputPath: string,
    input: string,
    options?: PandocToFileOptions
  ) => Promise<PandocToFileResult>
}

const pandoc = (async(from: string, to: string, ...args: string[]): Promise<string> => {
  const command = await getCommand()
  const option = ['-s', from, '-t', to].concat(args)
  return new Promise((resolve, reject) => {
    const proc = spawn(command, option)
    proc.on('error', reject)
    let data = ''
    proc.stdout.on('data', (chunk: Buffer | string) => {
      data += chunk.toString()
    })
    proc.stdout.on('end', () => resolve(data))
    proc.stdout.on('error', reject)
    proc.stdin.end()
  })
}) as PandocFn

pandoc.exists = async(): Promise<boolean> => (await findCommand()) !== null

export interface PandocToFileOptions {
  /** Folder the document's relative links resolve against, or pandoc uses cwd. */
  cwd?: string
  /** Folder the images are read from once they are mirrored; see `mirrorMedia`. */
  resourcePath?: string
  /** Copy the document's images into the output's folder and rewrite the links. */
  mirrorMedia?: boolean
  /** Reader used to parse `input`; see `getPandocReader`. */
  reader?: string
  metadata?: Record<string, string>
}

export interface PandocToFileResult {
  /** Pandoc's stderr from a successful run — the warnings exit code 0 would hide. */
  warnings: string
}

/** Convert `input` to `outputPath`; the converter above cannot serve binary targets. */
pandoc.toFile = async(
  to: string,
  outputPath: string,
  input: string,
  options: PandocToFileOptions = {}
): Promise<PandocToFileResult> => {
  const command = await getCommand()
  return new Promise((resolve, reject) => {
    const {
      cwd,
      reader = getPandocReader({ superSubScript: false }),
      metadata = {},
      resourcePath,
      mirrorMedia
    } = options
    const option = ['-f', reader, '-t', to, '-s']
    // pandoc splits `--metadata` on the first colon only, so "Q3: plan" survives.
    for (const [key, value] of Object.entries(metadata)) {
      if (value) option.push(`--metadata=${key}:${value}`)
    }
    if (mirrorMedia) {
      // `--extract-media=.` copies every image pandoc can read — an absolute link
      // included — to the output's folder and rewrites the link to match.
      option.push('--extract-media=.')
      if (resourcePath) option.push(`--resource-path=${resourcePath}`)
    }
    option.push('-o', outputPath)
    // The links pandoc writes are relative to where it runs, so a mirrored export has
    // to run in the folder it is written to.
    const proc = spawn(command, option, { cwd: mirrorMedia ? path.dirname(outputPath) : cwd })
    let errorOutput = ''
    proc.on('error', reject)
    proc.stderr.on('data', (chunk: Buffer | string) => {
      errorOutput += chunk.toString()
    })
    // An unknown writer exits before draining stdin; the EPIPE would be uncaught.
    proc.stdin.on('error', () => {})
    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ warnings: errorOutput.trim() })
      } else {
        // stderr names the offending source position, so prefer it to the code.
        reject(new Error(errorOutput.trim() || `pandoc exited with code ${String(code)}`))
      }
    })
    proc.stdin.end(input)
  })
}

// The links pandoc found, which is what an export mirrors; raw HTML `<img>` is not listed.
export const listLinkedMedia = async(input: string, reader: string): Promise<string[]> => {
  const command = await getCommand()
  return new Promise((resolve) => {
    const proc = spawn(command, ['-f', reader, '-t', 'json'])
    let ast = ''
    proc.stdout.on('data', (chunk: Buffer | string) => {
      ast += chunk.toString()
    })
    proc.stdin.on('error', () => {})
    // A document pandoc cannot parse has nothing to mirror; the conversion says why.
    proc.on('error', () => resolve([]))
    proc.on('close', () => {
      const urls: string[] = []
      try {
        JSON.parse(ast, (_key, node: unknown) => {
          const { t, c } = (node ?? {}) as { t?: string; c?: unknown[] }
          const target = t === 'Image' ? c?.[2] : undefined
          if (Array.isArray(target) && typeof target[0] === 'string') urls.push(target[0])
          return node
        })
      } catch {
        urls.length = 0
      }
      resolve(urls)
    })
    proc.stdin.end(input)
  })
}

export default pandoc
