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

// `gfm` matches the editor within what pandoc 3.1.3 accepts (no `tex_math_gfm`);
// `-footnotes` keeps a `[^1]` literal unless the editor's preference renders it.
export const getPandocReader = (superSubScript: boolean, footnotes = true): string =>
  `gfm${superSubScript ? '+superscript+subscript' : ''}${footnotes ? '' : '-footnotes'}`

// pandoc knows no `zh`/`zh-CN` and would warn, so Chinese takes the script subtag.
export const getPandocLanguage = (locale: string): string => {
  const [language, region = ''] = locale.trim().split(/[-_]/)
  if (language?.toLowerCase() !== 'zh') return locale
  return /^(hant|tw|hk|mo)$/i.test(region) ? 'zh-Hant' : 'zh-Hans'
}

// Windows only: the installer can be told not to touch `PATH` and a portable copy never is
// (`patchEnvPath` covers macOS/Linux, #2751). The folder it writes is the one that check
// cannot reach; the shims on `PATH` (chocolatey, scoop, winget) only set the order. The
// arguments let a spec pin both.
export const pandocLocations = (platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] => {
  if (platform !== 'win32') return []
  return [
    env.ProgramFiles && path.join(env.ProgramFiles, 'Pandoc', 'pandoc.exe'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'Pandoc', 'pandoc.exe'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Pandoc', 'pandoc.exe'),
    env.ProgramData && path.join(env.ProgramData, 'chocolatey', 'bin', 'pandoc.exe'),
    env.USERPROFILE && path.join(env.USERPROFILE, 'scoop', 'shims', 'pandoc.exe'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'pandoc.exe')
  ].filter((candidate): candidate is string => !!candidate)
}

/** Node refuses to spawn a `.bat`/`.cmd` without `shell: true` (CVE-2024-27980). */
const isBatchFile = (command: string): boolean =>
  process.platform === 'win32' && /\.(bat|cmd)$/i.test(command.trim())

/** Where pandoc may sit besides PATH, most specific first. */
const preferredLocations = (): string[] => {
  const fromEnv = process.env.MARKTEXT_PANDOC
  const locations = pandocLocations(process.platform, process.env)
  return (fromEnv ? [fromEnv, ...locations] : locations).filter(
    (candidate) => !isBatchFile(candidate)
  )
}

/** The bare name is the fallback, so a miss still spawns and reports why. */
const getCommand = async(): Promise<string> =>
  (await resolveCommand(pandocCommand, { preferred: preferredLocations() })) ?? pandocCommand

interface PandocConverter {
  (): Promise<string>
}

interface PandocFn {
  (from: string, to: string, ...args: string[]): PandocConverter
  exists: () => Promise<boolean>
  toFile: (
    to: string,
    outputPath: string,
    input: string,
    options?: PandocToFileOptions
  ) => Promise<PandocToFileResult>
}

const pandoc = ((from: string, to: string, ...args: string[]): PandocConverter => {
  const option = ['-s', from, '-t', to].concat(args)

  return (async(): Promise<string> => {
    const command = await getCommand()
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
  }) as PandocConverter
}) as PandocFn

pandoc.exists = async(): Promise<boolean> =>
  (await resolveCommand(pandocCommand, { preferred: preferredLocations() })) !== null

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
    const { cwd, reader = getPandocReader(false), metadata = {}, resourcePath, mirrorMedia } = options
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
