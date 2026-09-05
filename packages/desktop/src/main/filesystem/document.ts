import path from 'path'
import { isDirectory2 } from 'common/filesystem'
import { hasTextPackExtension, isDocumentFile } from 'common/filesystem/paths'
import type { LineEnding, MarkdownDocument, SaveOptions } from '@shared/types/files'
import { normalizeAndResolvePath } from '.'
import { loadMarkdownFile, writeMarkdownFile } from './markdown'
import {
  exportTextPackToMarkdown,
  loadTextPackFile,
  prepareTextPackReload,
  writeTextPackFile
} from './textpack'

export const normalizeDocumentPath = (
  pathname: string
): { isDir: boolean; path: string } | null => {
  const isDir = isDirectory2(pathname)
  if (!isDir && !isDocumentFile(pathname)) return null
  const resolved = normalizeAndResolvePath(pathname)
  return resolved ? { isDir, path: resolved } : null
}

export const loadDocumentFile = async(
  pathname: string,
  preferredEol: LineEnding,
  autoGuessEncoding = true,
  trimTrailingNewline = 2,
  autoNormalizeLineEndings = false
): Promise<MarkdownDocument> => {
  if (hasTextPackExtension(pathname)) {
    return loadTextPackFile(
      pathname,
      preferredEol,
      autoGuessEncoding,
      trimTrailingNewline,
      autoNormalizeLineEndings
    )
  }
  const doc = await loadMarkdownFile(
    pathname,
    preferredEol,
    autoGuessEncoding,
    trimTrailingNewline,
    autoNormalizeLineEndings
  )
  return {
    ...doc,
    encoding: { encoding: doc.encoding.encoding, isBom: !!doc.encoding.isBom },
    documentKind: 'markdown',
    resourcePath: path.dirname(pathname)
  }
}

export const inspectDocumentFile = async(
  pathname: string,
  preferredEol: LineEnding,
  autoGuessEncoding = true,
  trimTrailingNewline = 2,
  autoNormalizeLineEndings = false,
  prepareReload = false
): Promise<MarkdownDocument> => {
  if (hasTextPackExtension(pathname)) {
    if (prepareReload) {
      return prepareTextPackReload(
        pathname,
        preferredEol,
        trimTrailingNewline,
        autoNormalizeLineEndings
      )
    }
    return loadTextPackFile(
      pathname,
      preferredEol,
      autoGuessEncoding,
      trimTrailingNewline,
      autoNormalizeLineEndings,
      false
    )
  }
  return loadDocumentFile(
    pathname,
    preferredEol,
    autoGuessEncoding,
    trimTrailingNewline,
    autoNormalizeLineEndings
  )
}

export const writeDocumentFile = async(
  pathname: string,
  markdown: string,
  options: SaveOptions,
  sourcePath?: string
): Promise<{
  documentKind: 'markdown' | 'textpack'
  resourcePath: string
  markdown?: string
}> => {
  if (hasTextPackExtension(pathname)) {
    return writeTextPackFile(pathname, markdown, options, sourcePath)
  }
  if (sourcePath && hasTextPackExtension(sourcePath)) {
    return exportTextPackToMarkdown(sourcePath, pathname, markdown, options)
  }
  // The IPC `SaveOptions` has every field optional, but writeMarkdownFile
  // requires the strict `MarkdownDocumentOptions` shape — the renderer always
  // populates every field for the unsaved-file dialog payload, so the cast
  // is safe at this seam.
  await writeMarkdownFile(pathname, markdown, options as Parameters<typeof writeMarkdownFile>[2])
  return { documentKind: 'markdown', resourcePath: path.dirname(pathname) }
}
