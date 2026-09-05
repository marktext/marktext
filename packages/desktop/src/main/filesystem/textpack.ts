import { createHash, randomUUID } from 'crypto'
import { fileURLToPath } from 'url'
import fs from 'fs'
import fsPromises from 'fs/promises'
import os from 'os'
import path from 'path'
import { pipeline } from 'stream/promises'
import yauzl, { type Entry, type ZipFile } from 'yauzl'
import yazl from 'yazl'
import type { LineEnding, MarkdownDocument, SaveOptions } from '@shared/types/files'
import { loadMarkdownFile, writeMarkdownFile } from './markdown'

export const TEXTPACK_LIMITS = Object.freeze({
  entries: 10_000,
  entryBytes: 512 * 1024 * 1024,
  totalBytes: 2 * 1024 * 1024 * 1024,
  infoBytes: 1024 * 1024,
  textBytes: 64 * 1024 * 1024,
  compressionRatio: 1000
})

const MARKDOWN_TYPE = 'net.daringfireball.markdown'
const SESSION_ROOT = path.join(os.tmpdir(), 'marktext-textpack-sessions')
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

export interface TextPackConversionOptions {
  /** Internal policy only; embed is reserved and intentionally not implemented. */
  remoteImages: 'preserve' | 'embed'
}

const DEFAULT_CONVERSION_OPTIONS: Readonly<TextPackConversionOptions> = Object.freeze({
  remoteImages: 'preserve'
})

interface TextPackSession {
  physicalPath: string
  workspacePath: string
  textEntryName: string
  sourceRevision: { size: number; mtimeMs: number } | null
  references: number
  dirtyResources: boolean
}

interface TextPackManifest {
  version: 1
  physicalPath: string
  textEntryName: string
  sourceRevision: { size: number; mtimeMs: number } | null
  pid: number
  dirtyResources: boolean
  updatedAt: string
}

interface PendingTextPackReload {
  token: string
  key: string
  physicalPath: string
  workspacePath: string
  textEntryName: string
  sourceRevision: { size: number; mtimeMs: number }
  baseWorkspacePath: string
}

interface MarkdownDestination {
  start: number
  end: number
  value: string
  image?: boolean
  html?: boolean
}

const sessions = new Map<string, TextPackSession>()
const saveQueues = new Map<string, Promise<void>>()
const pendingReloads = new Map<string, PendingTextPackReload>()

const findClosingBracket = (text: string, start: number): number => {
  let depth = 1
  for (let index = start; index < text.length; index++) {
    if (text[index] === '\\') {
      index++
    } else if (text[index] === '[') {
      depth++
    } else if (text[index] === ']' && --depth === 0) {
      return index
    }
  }
  return -1
}

const readDestination = (
  text: string,
  start: number,
  lineEnd: number
): MarkdownDestination | null => {
  while (start < lineEnd && /\s/.test(text[start])) start++
  if (start >= lineEnd) return null
  if (text[start] === '<') {
    const end = text.indexOf('>', start + 1)
    return end >= 0 && end < lineEnd
      ? { start: start + 1, end, value: text.slice(start + 1, end) }
      : null
  }
  let depth = 0
  for (let index = start; index < lineEnd; index++) {
    const char = text[index]
    if (char === '\\') {
      index++
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      if (depth === 0) return { start, end: index, value: text.slice(start, index) }
      depth--
    } else if (/\s/.test(char) && depth === 0) {
      return { start, end: index, value: text.slice(start, index) }
    }
  }
  return start < lineEnd ? { start, end: lineEnd, value: text.slice(start, lineEnd) } : null
}

export const findMarkdownDestinations = (markdown: string): MarkdownDestination[] => {
  // Keep source offsets while excluding non-rendered HTML contents.
  markdown = markdown.replace(/<!--[\s\S]*?(?:-->|$)|<(script|style|pre|code)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (value) => value.replace(/[^\r\n]/g, ' '))
  const destinations: MarkdownDestination[] = []
  const imageReferences = new Set<string>()
  const definitions = new Map<number, string>()
  const normalizeLabel = (label: string): string => label.trim().replace(/\s+/g, ' ').toLowerCase()
  let inFence = false
  let fenceMarker = ''
  let offset = 0
  let skipUntil = 0
  for (const lineWithEnding of markdown.match(/.*(?:\r?\n|$)/g) ?? []) {
    if (!lineWithEnding) continue
    const line = lineWithEnding.replace(/\r?\n$/, '')
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1] ?? ''
    if (marker) {
      if (!inFence) {
        inFence = true
        fenceMarker = marker
      } else if (marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length && line.trim() === marker) {
        inFence = false
      }
      offset += lineWithEnding.length
      continue
    }
    if (!inFence) {
      let index = Math.max(0, skipUntil - offset)
      const definition = index === 0 ? /^ {0,3}\[[^\]]+\]:\s*/.exec(line) : null
      if (definition) {
        const destination = readDestination(line, definition[0].length, line.length)
        if (destination) {
          definitions.set(offset + destination.start, normalizeLabel(definition[0].slice(definition[0].indexOf('[') + 1, definition[0].lastIndexOf(']'))))
          destinations.push({
            ...destination,
            start: offset + destination.start,
            end: offset + destination.end
          })
        }
      }
      while (index < line.length) {
        if (line[index] === '\\') {
          index += 2
          continue
        }
        if (line[index] === '<') {
          const tag = /^<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(markdown.slice(offset + index))
          if (tag) {
            const src = [...tag[0].matchAll(/\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].find((attribute) => attribute[1].toLowerCase() === 'src')
            if (src) {
              const value = src[2] ?? src[3] ?? src[4] ?? ''
              const start = offset + index + src.index + src[0].indexOf('=') + 1
              const prefix = /^\s*["']?/.exec(markdown.slice(start))?.[0].length ?? 0
              destinations.push({ start: start + prefix, end: start + prefix + value.length, value, image: true, html: true })
            }
            skipUntil = offset + index + tag[0].length
            index += tag[0].length
            continue
          }
        }
        if (line[index] === '`') {
          const ticks = /^`+/.exec(line.slice(index))?.[0] ?? '`'
          const end = line.indexOf(ticks, index + ticks.length)
          index = end < 0 ? index + ticks.length : end + ticks.length
          continue
        }
        const bracket =
          line[index] === '['
            ? index
            : line[index] === '!' && line[index + 1] === '['
              ? index + 1
              : -1
        if (bracket < 0) {
          index++
          continue
        }
        const close = findClosingBracket(line, bracket + 1)
        if (close < 0) break
        let open = close + 1
        while (open < line.length && /\s/.test(line[open])) open++
        if (line[open] === '(') {
          const destination = readDestination(line, open + 1, line.length)
          if (destination) {
            destinations.push({
              ...destination,
              image: line[index] === '!',
              start: offset + destination.start,
              end: offset + destination.end
            })
          }
        } else if (line[index] === '!') {
          const reference = /^\[([^\]]*)\]/.exec(line.slice(open))
          imageReferences.add(normalizeLabel(reference?.[1] || line.slice(bracket + 1, close)))
        }
        index = close + 1
      }
    }
    offset += lineWithEnding.length
  }
  for (const destination of destinations) {
    const label = definitions.get(destination.start)
    if (label && imageReferences.has(label)) destination.image = true
  }
  return destinations.filter(
    (item, index, all) => all.findIndex((other) => other.start === item.start) === index
  )
}

const rewriteDestinations = async(
  markdown: string,
  rewrite: (value: string, destination: MarkdownDestination) => Promise<string | null>
): Promise<string> => {
  const replacements: Array<MarkdownDestination & { replacement: string }> = []
  for (const destination of findMarkdownDestinations(markdown)) {
    const replacement = await rewrite(destination.value, destination)
    if (replacement && replacement !== destination.value) { replacements.push({ ...destination, replacement }) }
  }
  for (const item of replacements.sort((a, b) => b.start - a.start)) {
    markdown = markdown.slice(0, item.start) + item.replacement + markdown.slice(item.end)
  }
  return markdown
}

const isExternalDestination = (value: string): boolean =>
  !value || value.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')

const packageLocalResources = async(
  markdown: string,
  sourceDirectory: string | undefined,
  workspacePath: string
): Promise<string> => {
  const copied = new Map<string, string>()
  const usedNames = new Set((await fsPromises.readdir(path.join(workspacePath, 'assets'))).map((name) => name.toLowerCase()))
  const missing: string[] = []
  const rewritten = await rewriteDestinations(markdown, async(rawValue, destination) => {
    const value = destination.html
      ? rawValue.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
        const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' }
        if (named[entity.toLowerCase()]) return named[entity.toLowerCase()]
        const code = entity.toLowerCase().startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10)
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
      })
      : rawValue.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~\\])/g, '$1')
    if (destination.image && /^data:/i.test(value)) {
      const match = /^data:image\/(png|jpe?g|gif|webp|svg\+xml|bmp|avif|x-icon);base64,([\s\S]+)$/i.exec(value)
      if (!match) throw new Error('Unsupported or invalid embedded image data URL.')
      const encoded = match[2].replace(/\s/g, '')
      if (encoded.length > Math.ceil(TEXTPACK_LIMITS.entryBytes / 3) * 4) throw new Error('Embedded image exceeds the TextPack resource size limit.')
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 === 1) throw new Error('Invalid Base64 image data.')
      const bytes = Buffer.from(encoded, 'base64')
      if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) throw new Error('Invalid Base64 image data.')
      const ext = ({ jpeg: 'jpg', 'svg+xml': 'svg', 'x-icon': 'ico' } as Record<string, string>)[match[1].toLowerCase()] ?? match[1].toLowerCase()
      const name = `${createHash('sha256').update(bytes).digest('hex')}.${ext}`
      const target = path.join(workspacePath, 'assets', name)
      if (usedNames.has(name.toLowerCase())) {
        const existing = await fsPromises.readFile(target)
        if (!existing.equals(bytes)) throw new Error('Embedded image resource name collision.')
      } else {
        await fsPromises.writeFile(target, bytes, { flag: 'wx' })
        usedNames.add(name.toLowerCase())
      }
      return `assets/${name}`
    }
    // Never turn a normal save into a network request (including //host URLs).
    if (/^https?:\/\//i.test(value) || value.startsWith('//')) return null
    const absoluteImage = destination.image && (path.isAbsolute(value) || /^file:/i.test(value))
    if (!absoluteImage && isExternalDestination(value)) return null
    let decoded: string
    try {
      decoded = /^file:/i.test(value) ? fileURLToPath(value) : decodeURIComponent(value.split(/[?#]/)[0])
    } catch {
      throw new Error('Invalid local resource path in TextPack conversion.')
    }
    if (path.isAbsolute(decoded) && !destination.image) return null
    if (!path.isAbsolute(decoded) && !sourceDirectory) throw new Error('Cannot resolve a relative resource in an untitled document. Save the Markdown beside its resources first.')
    const source = path.isAbsolute(decoded) ? path.resolve(decoded) : path.resolve(sourceDirectory as string, decoded)
    const sourceKey = process.platform === 'win32' ? source.toLowerCase() : source
    const suffixMatch = /^file:/i.test(value) ? new URL(value).hash : value.match(/[?#].*$/)?.[0] ?? ''
    const known = copied.get(sourceKey)
    if (known) return known + suffixMatch
    let filename = [...path.basename(source)]
      .map((char) => (char.charCodeAt(0) < 32 || /[<>:"/\\|?*\s]/.test(char) ? '-' : char))
      .join('')
    if (!filename) filename = 'resource'
    const extension = path.extname(filename)
    const stem = path.basename(filename, extension)
    let suffix = 2
    while (usedNames.has(filename.toLowerCase())) filename = `${stem}-${suffix++}${extension}`
    try {
      const stat = await fsPromises.stat(source)
      if (!stat.isFile() || stat.size > TEXTPACK_LIMITS.entryBytes) throw new Error('Invalid or oversized resource')
      await fsPromises.copyFile(source, path.join(workspacePath, 'assets', filename))
    } catch {
      missing.push(value)
      return null
    }
    const packaged = `assets/${filename}`
    copied.set(sourceKey, packaged)
    usedNames.add(filename.toLowerCase())
    return packaged + suffixMatch
  })
  if (missing.length) {
    throw new Error(
      `Cannot create TextPack because local resources are missing: ${missing.join(', ')}`
    )
  }
  return rewritten
}

const sessionKey = (pathname: string): string => {
  const resolved = path.resolve(pathname)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

const manifestPath = (workspacePath: string): string =>
  path.join(path.dirname(workspacePath), 'manifest.json')

const writeManifest = async(session: TextPackSession): Promise<void> => {
  const manifest: TextPackManifest = {
    version: 1,
    physicalPath: session.physicalPath,
    textEntryName: session.textEntryName,
    sourceRevision: session.sourceRevision,
    pid: process.pid,
    dirtyResources: session.dirtyResources,
    updatedAt: new Date().toISOString()
  }
  await fsPromises.writeFile(
    manifestPath(session.workspacePath),
    JSON.stringify(manifest, null, 2),
    'utf8'
  )
}

const isProcessRunning = (pid: number): boolean => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const findRecoverySession = async(physicalPath: string): Promise<TextPackSession | null> => {
  const directories = await fsPromises
    .readdir(SESSION_ROOT, { withFileTypes: true })
    .catch(() => [])
  for (const directory of directories) {
    if (!directory.isDirectory()) continue
    const workspacePath = path.join(SESSION_ROOT, directory.name, 'content')
    try {
      const manifest = JSON.parse(
        await fsPromises.readFile(manifestPath(workspacePath), 'utf8')
      ) as Partial<TextPackManifest>
      if (
        manifest.version !== 1 ||
        typeof manifest.physicalPath !== 'string' ||
        sessionKey(manifest.physicalPath) !== sessionKey(physicalPath) ||
        typeof manifest.textEntryName !== 'string' ||
        isProcessRunning(Number(manifest.pid))
      ) { continue }
      validateTextPackEntryName(manifest.textEntryName)
      await fsPromises.access(path.join(workspacePath, manifest.textEntryName))
      const session: TextPackSession = {
        physicalPath: path.resolve(physicalPath),
        workspacePath,
        textEntryName: manifest.textEntryName,
        sourceRevision: manifest.sourceRevision ?? null,
        references: 1,
        dirtyResources: !!manifest.dirtyResources
      }
      await writeManifest(session)
      return session
    } catch {
      // Ignore incomplete or corrupt recovery candidates.
    }
  }
  return null
}

const openZip = (pathname: string): Promise<ZipFile> =>
  new Promise((resolve, reject) => {
    yauzl.open(
      pathname,
      { lazyEntries: true, autoClose: false, decodeStrings: true, strictFileNames: true },
      (error, zipfile) =>
        error || !zipfile ? reject(error ?? new Error('Invalid ZIP archive.')) : resolve(zipfile)
    )
  })

const openEntryStream = (zipfile: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> =>
  new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) =>
      error || !stream ? reject(error ?? new Error('Unable to read ZIP entry.')) : resolve(stream)
    )
  })

export const validateTextPackEntryName = (name: string): string => {
  if (
    !name ||
    name.includes('\0') ||
    name.includes('\\') ||
    name.startsWith('/') ||
    /^[a-z]:/i.test(name)
  ) {
    throw new Error(`Unsafe TextPack entry path: ${JSON.stringify(name)}.`)
  }
  const isDirectory = name.endsWith('/')
  const parts = name
    .split('/')
    .filter((part, index, all) => (!(isDirectory && index === all.length - 1)))
  const invalidPart = (part: string): boolean =>
    !part ||
    part === '.' ||
    part === '..' ||
    WINDOWS_DEVICE_NAME.test(part) ||
    /[<>:"|?*]/.test(part) ||
    /[ .]$/.test(part)
  if (!parts.length || parts.some(invalidPart)) {
    throw new Error(`Unsafe TextPack entry path: ${JSON.stringify(name)}.`)
  }
  return parts.join('/') + (isDirectory ? '/' : '')
}

const isSymbolicLinkEntry = (entry: Entry): boolean => {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff
  return (unixMode & 0xf000) === 0xa000
}

const extractArchive = async(archivePath: string, workspacePath: string): Promise<string> => {
  const zipfile = await openZip(archivePath)
  const names = new Set<string>()
  const rootTextEntries: string[] = []
  let infoEntry = ''
  let entryCount = 0
  let totalBytes = 0

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: unknown): void => {
        zipfile.close()
        reject(error)
      }
      zipfile.once('error', fail)
      zipfile.once('end', resolve)
      zipfile.on('entry', (entry: Entry) => {
        ;(async() => {
          const name = validateTextPackEntryName(entry.fileName)
          const foldedName = name.normalize('NFC').toLocaleLowerCase('en-US')
          if (names.has(foldedName)) throw new Error(`Duplicate TextPack entry: ${name}.`)
          names.add(foldedName)
          if (++entryCount > TEXTPACK_LIMITS.entries) { throw new Error('TextPack entry limit exceeded.') }
          if ((entry.generalPurposeBitFlag & 1) !== 0) { throw new Error(`Encrypted TextPack entries are not supported: ${name}.`) }
          if (isSymbolicLinkEntry(entry)) { throw new Error(`TextPack links are not supported: ${name}.`) }
          if (entry.uncompressedSize > TEXTPACK_LIMITS.entryBytes) { throw new Error(`TextPack entry is too large: ${name}.`) }
          totalBytes += entry.uncompressedSize
          if (totalBytes > TEXTPACK_LIMITS.totalBytes) { throw new Error('TextPack expanded-size limit exceeded.') }
          if (
            entry.compressedSize > 0 &&
            entry.uncompressedSize / entry.compressedSize > TEXTPACK_LIMITS.compressionRatio
          ) {
            throw new Error(`Suspicious TextPack compression ratio: ${name}.`)
          }
          if (name.toLowerCase() === 'info.json') {
            if (entry.uncompressedSize > TEXTPACK_LIMITS.infoBytes) { throw new Error('TextPack info.json is too large.') }
            infoEntry = name
          } else if (!name.includes('/') && /^text\.[^./]+$/i.test(name)) {
            if (entry.uncompressedSize > TEXTPACK_LIMITS.textBytes) { throw new Error('TextPack document text is too large.') }
            rootTextEntries.push(name)
          }

          const destination = path.resolve(workspacePath, ...name.replace(/\/$/, '').split('/'))
          const relative = path.relative(workspacePath, destination)
          if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error(`TextPack entry escapes its workspace: ${name}.`)
          }
          if (name.endsWith('/')) {
            await fsPromises.mkdir(destination, { recursive: true })
          } else {
            await fsPromises.mkdir(path.dirname(destination), { recursive: true })
            const source = await openEntryStream(zipfile, entry)
            await pipeline(source, fs.createWriteStream(destination, { flags: 'wx' }))
          }
          zipfile.readEntry()
        })().catch(fail)
      })
      zipfile.readEntry()
    })
  } finally {
    zipfile.close()
  }

  if (!infoEntry || infoEntry !== 'info.json') { throw new Error('TextPack must contain lowercase info.json at its root.') }
  if (rootTextEntries.length !== 1) { throw new Error('TextPack must contain exactly one text.* file at its root.') }

  const metadataText = await fsPromises.readFile(path.join(workspacePath, infoEntry), 'utf8')
  let metadata: unknown
  try {
    metadata = JSON.parse(metadataText.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('TextPack info.json is not valid JSON.')
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) { throw new Error('TextPack info.json must contain an object.') }
  const info = metadata as Record<string, unknown>
  if (info.version !== 1 && info.version !== 2) { throw new Error(`Unsupported TextPack version: ${String(info.version)}.`) }
  if (info.type !== undefined && info.type !== MARKDOWN_TYPE) { throw new Error(`Unsupported TextPack document type: ${String(info.type)}.`) }

  const textBytes = await fsPromises.readFile(path.join(workspacePath, rootTextEntries[0]))
  new TextDecoder('utf-8', { fatal: true }).decode(textBytes)
  return rootTextEntries[0]
}

const removeWorkspace = async(workspacePath: string): Promise<void> => {
  const relative = path.relative(SESSION_ROOT, workspacePath)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return
  await fsPromises.rm(path.dirname(workspacePath), { recursive: true, force: true })
}

const retireWorkspace = async(workspacePath: string): Promise<void> => {
  // Stop this superseded workspace from becoming a recovery candidate immediately,
  // but leave its assets alive briefly while the renderer switches resource roots.
  await fsPromises.rm(manifestPath(workspacePath), { force: true })
  const timer = setTimeout(() => {
    removeWorkspace(workspacePath).catch(() => undefined)
  }, 10_000)
  timer.unref()
}

const revisionsMatch = (
  left: { size: number; mtimeMs: number } | null,
  right: { size: number; mtimeMs: number } | null
): boolean => !!left && !!right && left.size === right.size && left.mtimeMs === right.mtimeMs

const discardPendingReloads = async(key: string, exceptToken?: string): Promise<void> => {
  const removals: Promise<void>[] = []
  for (const [token, candidate] of pendingReloads) {
    if (candidate.key === key && token !== exceptToken) {
      pendingReloads.delete(token)
      removals.push(removeWorkspace(candidate.workspacePath))
    }
  }
  await Promise.all(removals)
}

export const prepareTextPackReload = async(
  pathname: string,
  preferredEol: LineEnding,
  trimTrailingNewline = 2,
  autoNormalizeLineEndings = false
): Promise<MarkdownDocument> => {
  const physicalPath = path.resolve(pathname)
  const key = sessionKey(physicalPath)
  const activeSession = sessions.get(key)
  if (!activeSession) {
    return loadTextPackFile(
      physicalPath,
      preferredEol,
      false,
      trimTrailingNewline,
      autoNormalizeLineEndings,
      false
    )
  }

  await discardPendingReloads(key)
  const workspacePath = path.join(SESSION_ROOT, randomUUID(), 'content')
  await fsPromises.mkdir(workspacePath, { recursive: true })
  try {
    const before = await fsPromises.stat(physicalPath)
    const textEntryName = await extractArchive(physicalPath, workspacePath)
    const after = await fsPromises.stat(physicalPath)
    const sourceRevision = { size: after.size, mtimeMs: after.mtimeMs }
    if (!revisionsMatch({ size: before.size, mtimeMs: before.mtimeMs }, sourceRevision)) {
      throw new Error('The TextPack changed again while MarkText was reading it.')
    }
    const doc = await loadMarkdownFile(
      path.join(workspacePath, textEntryName),
      preferredEol,
      false,
      trimTrailingNewline,
      autoNormalizeLineEndings
    )
    const token = randomUUID()
    pendingReloads.set(token, {
      token,
      key,
      physicalPath,
      workspacePath,
      textEntryName,
      sourceRevision,
      baseWorkspacePath: activeSession.workspacePath
    })
    return {
      ...doc,
      filename: path.basename(physicalPath),
      pathname: physicalPath,
      encoding: { encoding: 'utf8', isBom: false },
      documentKind: 'textpack',
      resourcePath: workspacePath,
      reloadToken: token
    }
  } catch (error) {
    await removeWorkspace(workspacePath)
    throw error
  }
}

export const resolveTextPackReload = async(
  pathname: string,
  token: string,
  accept: boolean
): Promise<{ accepted: boolean; resourcePath?: string }> => {
  const key = sessionKey(pathname)
  const candidate = pendingReloads.get(token)
  if (!candidate || candidate.key !== key) {
    throw new Error('The pending TextPack reload is no longer available.')
  }
  pendingReloads.delete(token)
  if (!accept) {
    await removeWorkspace(candidate.workspacePath)
    return { accepted: false }
  }

  const activeSession = sessions.get(key)
  if (!activeSession) {
    await removeWorkspace(candidate.workspacePath)
    throw new Error('The TextPack session is no longer available.')
  }
  if (activeSession.workspacePath !== candidate.baseWorkspacePath) {
    if (revisionsMatch(activeSession.sourceRevision, candidate.sourceRevision)) {
      await removeWorkspace(candidate.workspacePath)
      return { accepted: true, resourcePath: activeSession.workspacePath }
    }
    await removeWorkspace(candidate.workspacePath)
    throw new Error('A newer TextPack version has already been loaded.')
  }

  const currentStat = await fsPromises.stat(candidate.physicalPath)
  if (
    !revisionsMatch(
      { size: currentStat.size, mtimeMs: currentStat.mtimeMs },
      candidate.sourceRevision
    )
  ) {
    await removeWorkspace(candidate.workspacePath)
    throw new Error('The TextPack changed again before it could be reloaded.')
  }

  const replacement: TextPackSession = {
    physicalPath: candidate.physicalPath,
    workspacePath: candidate.workspacePath,
    textEntryName: candidate.textEntryName,
    sourceRevision: candidate.sourceRevision,
    references: activeSession.references,
    dirtyResources: false
  }
  sessions.set(key, replacement)
  await writeManifest(replacement)
  await retireWorkspace(activeSession.workspacePath)
  await discardPendingReloads(key)
  return { accepted: true, resourcePath: replacement.workspacePath }
}

export const loadTextPackFile = async(
  pathname: string,
  preferredEol: LineEnding,
  _autoGuessEncoding = true,
  trimTrailingNewline = 2,
  autoNormalizeLineEndings = false,
  establishSession = true
): Promise<MarkdownDocument> => {
  const physicalPath = path.resolve(pathname)
  const activeSession = sessions.get(sessionKey(physicalPath))
  if (establishSession && activeSession) {
    activeSession.references++
    const doc = await loadMarkdownFile(
      path.join(activeSession.workspacePath, activeSession.textEntryName),
      preferredEol,
      false,
      trimTrailingNewline,
      autoNormalizeLineEndings
    )
    return {
      ...doc,
      filename: path.basename(physicalPath),
      pathname: physicalPath,
      encoding: { encoding: 'utf8', isBom: false },
      documentKind: 'textpack',
      resourcePath: activeSession.workspacePath
    }
  }
  if (establishSession) {
    const recovered = await findRecoverySession(physicalPath)
    if (recovered) {
      sessions.set(sessionKey(physicalPath), recovered)
      const doc = await loadMarkdownFile(
        path.join(recovered.workspacePath, recovered.textEntryName),
        preferredEol,
        false,
        trimTrailingNewline,
        autoNormalizeLineEndings
      )
      return {
        ...doc,
        filename: path.basename(physicalPath),
        pathname: physicalPath,
        encoding: { encoding: 'utf8', isBom: false },
        documentKind: 'textpack',
        resourcePath: recovered.workspacePath
      }
    }
  }
  const workspacePath = path.join(SESSION_ROOT, randomUUID(), 'content')
  await fsPromises.mkdir(workspacePath, { recursive: true })
  let textEntryName: string
  try {
    textEntryName = await extractArchive(physicalPath, workspacePath)
  } catch (error) {
    await removeWorkspace(workspacePath)
    throw error
  }
  const previous = sessions.get(sessionKey(physicalPath))
  try {
    const doc = await loadMarkdownFile(
      path.join(workspacePath, textEntryName),
      preferredEol,
      false,
      trimTrailingNewline,
      autoNormalizeLineEndings
    )
    if (establishSession) {
      const stat = await fsPromises.stat(physicalPath)
      const session: TextPackSession = {
        physicalPath,
        workspacePath,
        textEntryName,
        sourceRevision: { size: stat.size, mtimeMs: stat.mtimeMs },
        references: 1,
        dirtyResources: false
      }
      sessions.set(sessionKey(physicalPath), session)
      await writeManifest(session)
      if (previous) await removeWorkspace(previous.workspacePath)
    }
    return {
      ...doc,
      filename: path.basename(physicalPath),
      pathname: physicalPath,
      encoding: { encoding: 'utf8', isBom: false },
      documentKind: 'textpack',
      resourcePath: establishSession ? workspacePath : (previous?.workspacePath ?? '')
    }
  } finally {
    if (!establishSession) await removeWorkspace(workspacePath)
  }
}

const listWorkspaceFiles = async(root: string, current = root): Promise<string[]> => {
  const files: string[] = []
  for (const item of await fsPromises.readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, item.name)
    if (item.isSymbolicLink()) throw new Error(`TextPack workspace contains a link: ${item.name}.`)
    if (item.isDirectory()) files.push(...(await listWorkspaceFiles(root, absolute)))
    else if (item.isFile()) files.push(path.relative(root, absolute).split(path.sep).join('/'))
  }
  return files.sort()
}

const buildArchive = async(workspacePath: string, outputPath: string): Promise<void> => {
  const zipfile = new yazl.ZipFile()
  for (const relative of await listWorkspaceFiles(workspacePath)) {
    zipfile.addFile(path.join(workspacePath, ...relative.split('/')), relative, { compress: true })
  }
  const output = fs.createWriteStream(outputPath, { flags: 'wx' })
  zipfile.end()
  await pipeline(zipfile.outputStream, output)
  const handle = await fsPromises.open(outputPath, 'r+')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

const createTextPackSession = async(targetPath: string): Promise<TextPackSession> => {
  const workspacePath = path.join(SESSION_ROOT, randomUUID(), 'content')
  await fsPromises.mkdir(path.join(workspacePath, 'assets'), { recursive: true })
  await fsPromises.writeFile(
    path.join(workspacePath, 'info.json'),
    JSON.stringify(
      {
        version: 2,
        type: MARKDOWN_TYPE,
        transient: false,
        creatorIdentifier: 'com.github.marktext.marktext'
      },
      null,
      2
    ) + '\n',
    'utf8'
  )
  return {
    physicalPath: path.resolve(targetPath),
    workspacePath,
    textEntryName: 'text.md',
    sourceRevision: null,
    references: 1,
    dirtyResources: false
  }
}

const replaceArchive = async(tempPath: string, targetPath: string): Promise<void> => {
  await fsPromises.rename(tempPath, targetPath)
}

const queueSave = (key: string, task: () => Promise<void>): Promise<void> => {
  const pending = (saveQueues.get(key) ?? Promise.resolve()).catch(() => undefined).then(task)
  saveQueues.set(key, pending)
  return pending.finally(() => {
    if (saveQueues.get(key) === pending) saveQueues.delete(key)
  })
}

export const writeTextPackFile = async(
  targetPath: string,
  markdown: string,
  _options: SaveOptions,
  sourcePath?: string,
  conversionOptions: TextPackConversionOptions = DEFAULT_CONVERSION_OPTIONS
): Promise<{ documentKind: 'textpack'; resourcePath: string; markdown: string }> => {
  if (conversionOptions.remoteImages !== 'preserve') {
    throw new Error('TextPack remote image embedding is not implemented. Use the preserve policy.')
  }
  const resolvedTarget = path.resolve(targetPath)
  const targetKey = sessionKey(resolvedTarget)
  const sourceKey = sourcePath ? sessionKey(sourcePath) : targetKey
  let session = sessions.get(sourceKey)
  let savedMarkdown = markdown
  if (!session) {
    session = await createTextPackSession(resolvedTarget)
    try {
      if (!sourcePath || !sourcePath.toLowerCase().endsWith('.textpack')) {
        savedMarkdown = await packageLocalResources(
          markdown,
          sourcePath ? path.dirname(sourcePath) : undefined,
          session.workspacePath
        )
      }
    } catch (error) {
      await removeWorkspace(session.workspacePath)
      throw error
    }
  }

  await queueSave(targetKey, async() => {
    if (sourceKey === targetKey && session!.sourceRevision) {
      const stat = await fsPromises.stat(resolvedTarget)
      if (
        stat.size !== session!.sourceRevision.size ||
        stat.mtimeMs !== session!.sourceRevision.mtimeMs
      ) {
        throw new Error(
          'The TextPack changed on disk. Reload it or use Save As to keep both versions.'
        )
      }
    }
    await fsPromises.writeFile(
      path.join(session!.workspacePath, session!.textEntryName),
      savedMarkdown,
      'utf8'
    )
    const tempPath = path.join(
      path.dirname(resolvedTarget),
      `.${path.basename(resolvedTarget)}.${randomUUID()}.tmp`
    )
    try {
      await buildArchive(session!.workspacePath, tempPath)
      const validationPath = path.join(SESSION_ROOT, randomUUID(), 'content')
      await fsPromises.mkdir(validationPath, { recursive: true })
      try {
        await extractArchive(tempPath, validationPath)
      } finally {
        await removeWorkspace(validationPath)
      }
      await replaceArchive(tempPath, resolvedTarget)
      const stat = await fsPromises.stat(resolvedTarget)
      session!.sourceRevision = { size: stat.size, mtimeMs: stat.mtimeMs }
      session!.dirtyResources = false
      await writeManifest(session!)
    } finally {
      await fsPromises.rm(tempPath, { force: true })
    }
  })

  if (sourceKey !== targetKey) sessions.delete(sourceKey)
  session.physicalPath = resolvedTarget
  sessions.set(targetKey, session)
  await writeManifest(session)
  return { documentKind: 'textpack', resourcePath: session.workspacePath, markdown: savedMarkdown }
}

export const exportTextPackToMarkdown = async(
  sourcePath: string,
  targetPath: string,
  markdown: string,
  options: SaveOptions
): Promise<{ documentKind: 'markdown'; resourcePath: string; markdown: string }> => {
  const session = sessions.get(sessionKey(sourcePath))
  if (!session) {
    throw new Error(
      'The TextPack session is no longer available. Reopen the document and try again.'
    )
  }
  const targetDirectory = path.dirname(targetPath)
  const assetFolderName = `${path.basename(targetPath, path.extname(targetPath))}.assets`
  const targetAssets = path.join(targetDirectory, assetFolderName)
  const sourceAssets = path.join(session.workspacePath, 'assets')
  let exportedAssets = false
  try {
    const sourceStat = await fsPromises.stat(sourceAssets).catch(() => null)
    if (sourceStat?.isDirectory()) {
      try {
        await fsPromises.access(targetAssets)
        throw new Error(`The resource folder already exists: ${targetAssets}`)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      await fsPromises.cp(sourceAssets, targetAssets, { recursive: true, errorOnExist: true })
      exportedAssets = true
    }
    const exportedMarkdown = await rewriteDestinations(markdown, async(value) => {
      const normalized = value.replace(/\\/g, '/')
      return normalized.startsWith('assets/') ? `${assetFolderName}/${normalized.slice(7)}` : null
    })
    await writeMarkdownFile(
      targetPath,
      exportedMarkdown,
      options as Parameters<typeof writeMarkdownFile>[2]
    )
    return { documentKind: 'markdown', resourcePath: targetDirectory, markdown: exportedMarkdown }
  } catch (error) {
    if (exportedAssets) await fsPromises.rm(targetAssets, { recursive: true, force: true })
    throw error
  }
}

export const closeTextPackSession = async(pathname: string): Promise<void> => {
  const key = sessionKey(pathname)
  const session = sessions.get(key)
  if (!session) {
    await discardPendingReloads(key)
    return
  }
  session.references--
  if (session.references > 0) return
  sessions.delete(key)
  await discardPendingReloads(key)
  await removeWorkspace(session.workspacePath)
}

export const moveTextPackSession = (oldPathname: string, newPathname: string): void => {
  const oldKey = sessionKey(oldPathname)
  const session = sessions.get(oldKey)
  if (!session) return
  sessions.delete(oldKey)
  session.physicalPath = path.resolve(newPathname)
  sessions.set(sessionKey(newPathname), session)
  writeManifest(session).catch(() => undefined)
}

export const markTextPackResourcesDirty = (pathname: string): void => {
  const session = sessions.get(sessionKey(pathname))
  if (!session) return
  session.dirtyResources = true
  writeManifest(session).catch(() => undefined)
}

export const cleanupStaleTextPackSessions = async(
  now = Date.now(),
  cleanMaxAgeMs = 7 * 24 * 60 * 60 * 1000
): Promise<void> => {
  const directories = await fsPromises
    .readdir(SESSION_ROOT, { withFileTypes: true })
    .catch(() => [])
  for (const directory of directories) {
    if (!directory.isDirectory()) continue
    const sessionPath = path.join(SESSION_ROOT, directory.name)
    try {
      const workspacePath = path.join(sessionPath, 'content')
      const manifest = JSON.parse(
        await fsPromises.readFile(manifestPath(workspacePath), 'utf8')
      ) as Partial<TextPackManifest>
      const updatedAt = Date.parse(String(manifest.updatedAt))
      if (
        manifest.version === 1 &&
        !manifest.dirtyResources &&
        !isProcessRunning(Number(manifest.pid)) &&
        Number.isFinite(updatedAt) &&
        now - updatedAt > cleanMaxAgeMs
      ) {
        await fsPromises.rm(sessionPath, { recursive: true, force: true })
      }
    } catch {
      const stat = await fsPromises.stat(sessionPath).catch(() => null)
      if (stat && now - stat.mtimeMs > cleanMaxAgeMs) {
        await fsPromises.rm(sessionPath, { recursive: true, force: true })
      }
    }
  }
}
