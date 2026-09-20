// Copy from https://github.com/utatti/simple-pandoc/blob/master/index.js
import { spawn } from 'child_process'
import path from 'path'
import type { Readable } from 'stream'
import commandExists from 'command-exists'
import { isFile2 } from 'common/filesystem'

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

// These writers have no container to inline an image into: pandoc leaves it as a
// plain link, so the pictures have to be carried along instead (see `mirrorMedia`).
export const formatLinksMedia = (target: string): boolean =>
  ['latex', 'rst', 'org', 'mediawiki', 'textile'].includes(target)

// A link that needs the network to read — `https:` or the protocol-relative and UNC
// form of the same thing. Mirroring one means downloading it, and a download that
// fails costs the picture, which pandoc replaces with its alt text.
export const isRemoteMedia = (url: string): boolean => /^(https?:)?\/\//i.test(url)

// `gfm` matches the editor and stays within what pandoc 3.1.3 accepts (no
// `tex_math_gfm`); `-footnotes` keeps a `[^1]` literal unless the editor's
// footnote preference renders it.
export const getPandocReader = (superSubScript: boolean, footnotes = true): string =>
  `gfm${superSubScript ? '+superscript+subscript' : ''}${footnotes ? '' : '-footnotes'}`

// pandoc knows no `zh`/`zh-CN`/`zh-TW` and warns about its own translation files
// for a tag it cannot resolve, so Chinese is spelled with the script subtag.
export const getPandocLanguage = (locale: string): string => {
  const [language, region = ''] = locale.trim().split(/[-_]/)
  if (language?.toLowerCase() !== 'zh') return locale
  return /^(hant|tw|hk|mo)$/i.test(region) ? 'zh-Hant' : 'zh-Hans'
}

// Windows only: the installer can be told not to touch `PATH` and a portable copy
// never is. macOS/Linux are covered by `patchEnvPath` (#2751).
const pandocLocations = (): string[] => {
  if (process.platform !== 'win32') return []
  const { env } = process
  const dirs = [
    env.ProgramFiles,
    env['ProgramFiles(x86)'],
    env.LOCALAPPDATA,
    env.ProgramData && path.join(env.ProgramData, 'chocolatey', 'bin'),
    env.USERPROFILE && path.join(env.USERPROFILE, 'scoop', 'shims'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links')
  ]
  return dirs.filter((dir): dir is string => !!dir).map((dir) => path.join(dir, 'pandoc.exe'))
}

/** Node refuses to spawn a `.bat`/`.cmd` without `shell: true` (CVE-2024-27980). */
const isBatchFile = (command: string): boolean =>
  process.platform === 'win32' && /\.(bat|cmd)$/i.test(command.trim())

const getCommand = (): string => {
  const fromEnv = process.env.MARKTEXT_PANDOC
  if (fromEnv && isFile2(fromEnv) && !isBatchFile(fromEnv)) return fromEnv
  return pandocLocations().find((candidate) => isFile2(candidate)) ?? pandocCommand
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
  const command = getCommand()
  return command !== pandocCommand || commandExists.sync(pandocCommand)
}

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

// Convert `input` from markdown to `outputPath`. The streaming API above cannot
// serve binary targets: it decodes stdout, and docx/odt/epub are zip containers.
pandoc.toFile = (
  to: string,
  outputPath: string,
  input: string,
  options: PandocToFileOptions = {}
): Promise<PandocToFileResult> =>
  new Promise((resolve, reject) => {
    const { cwd, reader = getPandocReader(false), metadata = {}, resourcePath, mirrorMedia } = options
    const option = ['-f', reader, '-t', to, '-s']
    // pandoc splits `--metadata` on the first colon only, so "Q3: plan" survives.
    for (const [key, value] of Object.entries(metadata)) {
      if (value) option.push(`--metadata=${key}:${value}`)
    }
    if (mirrorMedia) {
      // `--extract-media=.` copies every image pandoc can read to the output's folder
      // — an absolute link included — and rewrites the link to match; a document
      // without pictures is left alone.
      option.push('--extract-media=.')
      if (resourcePath) option.push(`--resource-path=${resourcePath}`)
    }
    option.push('-o', outputPath)
    // The links pandoc writes are relative to where it runs, so a mirrored export has
    // to run in the folder it is written to.
    const proc = spawn(getCommand(), option, { cwd: mirrorMedia ? path.dirname(outputPath) : cwd })
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

/** Never overwrite: a taken `report.rst` becomes `report (2).rst`. */
export const uniquePandocOutputPath = (filePath: string): string => {
  const extension = path.extname(filePath)
  const stem = path.basename(filePath, extension)
  const dir = path.dirname(filePath)
  let candidate = filePath
  for (let index = 2; isFile2(candidate); index++) {
    candidate = path.join(dir, `${stem} (${index})${extension}`)
  }
  return candidate
}

// The links pandoc found in the document, which is what an export has to mirror.
// Raw `<img>` HTML is a raw node in the AST and is not listed; pandoc links it anyway.
export const listLinkedMedia = (input: string, reader: string): Promise<string[]> =>
  new Promise((resolve) => {
    const proc = spawn(getCommand(), ['-f', reader, '-t', 'json'])
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

export default pandoc
