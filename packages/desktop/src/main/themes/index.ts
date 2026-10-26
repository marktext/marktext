import path from 'path'
import fs from 'fs'
import { app, dialog, shell } from 'electron'
import log from 'electron-log'
import type { CustomThemeDescriptor, ImportCustomThemeResult } from '../../shared/types/theme'
import {
  THEME_FILE_SUFFIX,
  MAX_THEME_FILE_BYTES,
  fileIdFromFilename,
  parseThemeMetadata
} from './metadata'
import { sanitizeThemeCss } from './sanitize'

/**
 * Absolute path of the user editor-themes directory (`<userData>/themes/editor`).
 *
 * This sits alongside `<userData>/themes/export` (the existing custom export /
 * print themes), keeping editor themes and export themes cleanly separated.
 */
export const getThemesDir = (): string => path.join(app.getPath('userData'), 'themes', 'editor')

/** Create the user themes directory if it does not exist. Returns its path. */
export const ensureThemesDir = (): string => {
  const dir = getThemesDir()
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch (err) {
    log.error('Failed to create themes directory:', err)
  }
  return dir
}

/**
 * Read and describe a single `<id>.theme.css` file. Returns `null` (and logs)
 * for anything that is not a valid, regular, in-size theme file. Symlinks and
 * directories are ignored.
 */
const readDescriptor = (dir: string, filename: string): CustomThemeDescriptor | null => {
  const fileId = fileIdFromFilename(filename)
  if (!fileId) return null
  const fullPath = path.join(dir, filename)
  try {
    const stat = fs.lstatSync(fullPath)
    if (!stat.isFile()) return null
    if (stat.size > MAX_THEME_FILE_BYTES) {
      log.warn(`Skipping custom theme "${filename}": larger than ${MAX_THEME_FILE_BYTES} bytes`)
      return null
    }
    const raw = fs.readFileSync(fullPath, 'utf8')
    const meta = parseThemeMetadata(fileId, raw)
    return {
      id: `custom:${fileId}`,
      fileId,
      name: meta.name,
      type: meta.type,
      css: sanitizeThemeCss(raw)
    }
  } catch (err) {
    log.error(`Failed to read custom theme "${filename}":`, err)
    return null
  }
}

/**
 * Read and describe every valid custom theme in `<userData>/themes/editor`,
 * sorted by display name. The returned CSS is already sanitized.
 */
export const listCustomThemes = (): CustomThemeDescriptor[] => {
  const dir = ensureThemesDir()
  let entries: string[]
  try {
    entries = fs.readdirSync(dir)
  } catch (err) {
    log.error('Failed to read themes directory:', err)
    return []
  }
  const themes: CustomThemeDescriptor[] = []
  for (const entry of entries) {
    const descriptor = readDescriptor(dir, entry)
    if (descriptor) themes.push(descriptor)
  }
  themes.sort((a, b) => a.name.localeCompare(b.name))
  return themes
}

/**
 * Whether a custom theme id (`custom:<fileId>`) refers to a dark theme, per its
 * `@type` header. Lets the main process keep `nativeTheme.themeSource` correct
 * when a custom dark theme is selected.
 */
export const isDarkCustomTheme = (id: string): boolean => {
  try {
    return listCustomThemes().some((theme) => theme.id === id && theme.type === 'dark')
  } catch {
    return false
  }
}

/** Open the user themes directory in the OS file manager. */
export const openThemesFolder = async(): Promise<string> => {
  const dir = ensureThemesDir()
  return shell.openPath(dir)
}

/**
 * Prompt the user to pick a `*.theme.css` file and copy it into the themes
 * directory. The destination name is derived solely from the source basename
 * (never a caller- or header-controlled path), so traversal is not possible.
 */
export const importCustomTheme = async(): Promise<ImportCustomThemeResult> => {
  const dir = ensureThemesDir()
  let selection: Electron.OpenDialogReturnValue
  try {
    selection = await dialog.showOpenDialog({
      title: 'Import Theme',
      properties: ['openFile'],
      filters: [{ name: 'MarkText theme', extensions: ['css'] }]
    })
  } catch (err) {
    log.error('Theme import dialog failed:', err)
    return { status: 'error', message: String(err instanceof Error ? err.message : err) }
  }
  if (selection.canceled || selection.filePaths.length === 0) {
    return { status: 'cancelled' }
  }

  const source = selection.filePaths[0]
  const fileId = fileIdFromFilename(source)
  if (!fileId) {
    return {
      status: 'invalid',
      message: 'Theme files must be named "<id>.theme.css" (a lowercase id of letters, numbers, - or _).'
    }
  }

  const destFilename = `${fileId}${THEME_FILE_SUFFIX}`
  const dest = path.join(dir, destFilename)
  if (fs.existsSync(dest)) {
    return { status: 'exists', message: `A theme named "${fileId}" already exists.` }
  }

  try {
    const stat = fs.lstatSync(source)
    if (!stat.isFile() || stat.size > MAX_THEME_FILE_BYTES) {
      return {
        status: 'invalid',
        message: 'The selected file is not a regular file, or is larger than 512KB.'
      }
    }
    // COPYFILE_EXCL fails if the destination exists, closing the race between
    // the existsSync check above and the copy.
    fs.copyFileSync(source, dest, fs.constants.COPYFILE_EXCL)
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') {
      return { status: 'exists', message: `A theme named "${fileId}" already exists.` }
    }
    log.error('Failed to import theme:', err)
    return { status: 'error', message: String(err instanceof Error ? err.message : err) }
  }

  const descriptor = readDescriptor(dir, destFilename)
  if (!descriptor) {
    // Roll back the copy: a file we cannot read back would otherwise be left
    // behind to fail every future scan and to block re-importing the same id
    // (the `exists` check above would keep matching it).
    try {
      fs.unlinkSync(dest)
    } catch (err) {
      log.error(`Failed to remove unreadable imported theme "${destFilename}":`, err)
    }
    return { status: 'error', message: 'The imported theme could not be read back.' }
  }
  return { status: 'imported', theme: descriptor }
}
