import { rename as fsRename, ensureDir as fsEnsureDir } from 'fs-extra'
import path from 'path'
import {
  BrowserWindow,
  app,
  dialog,
  shell,
  ipcMain,
  type IpcMainEvent,
  type MenuItem
} from 'electron'
import log from 'electron-log'
import { isDirectory, isFile, exists } from 'common/filesystem'
import { MARKDOWN_EXTENSIONS, isDangerousExecutableFile, isMarkdownFile } from 'common/filesystem/paths'
import { checkUpdates, userSetting } from './marktext'
import { showTabBar } from './view'
import { COMMANDS } from '../../commands'
import type { CommandManager } from '../../commands'
import { EXTENSION_HASN, PANDOC_EXTENSIONS, URL_REG } from '../../config'
import { normalizeAndResolvePath, resolveLocalLinkTarget, writeFile } from '../../filesystem'
import { writeMarkdownFile } from '../../filesystem/markdown'
import { getPath, getRecommendTitleFromMarkdownString } from '../../utils'
import pandoc, {
  PANDOC_EXPORT_FORMATS,
  getPandocLanguage,
  getPandocReader
} from '../../utils/pandoc'
import {
  getPandocDefaultFormat,
  getPandocExportFormats,
  getPandocExportLocation
} from '@shared/pandoc'
import type { PandocExportFormat, PandocExportLocation } from '@shared/pandoc'
import { getUserPreference } from '../../app/userPreference'
import { t } from '../../i18n'
import type { PandocExportPayload, TabOptions, UnsavedFile } from '@shared/types/files'

type Win = BrowserWindow | null | undefined

interface PageOptions {
  pageSize?: string
  pageSizeWidth?: number
  pageSizeHeight?: number
  isLandscape?: boolean
}

// TODO(refactor): "save" and "save as" should be moved to the editor window (editor.js) and
// the renderer should communicate only with the editor window for file relevant stuff.
// E.g. "mt::save-tabs" --> "mt::window-save-tabs$wid:<windowId>"

const getExportExtensionFilter = (type: string): Electron.FileFilter[] | undefined => {
  if (type === 'pdf') {
    return [
      {
        name: 'Portable Document Format',
        extensions: ['pdf']
      }
    ]
  } else if (type === 'styledHtml') {
    return [
      {
        name: 'Hypertext Markup Language',
        extensions: ['html']
      }
    ]
  }

  // Allow all extensions.
  return undefined
}

const getPdfPageOptions = (options?: PageOptions): Record<string, unknown> => {
  if (!options) {
    return {}
  }

  const { pageSize, pageSizeWidth, pageSizeHeight, isLandscape } = options
  if (pageSize === 'custom' && pageSizeWidth && pageSizeHeight) {
    return {
      // Note: mm to microns
      pageSize: { height: pageSizeHeight * 1000, width: pageSizeWidth * 1000 },
      landscape: !!isLandscape
    }
  } else {
    return { pageSize, landscape: !!isLandscape }
  }
}

interface ExportPayload {
  type: string
  content?: string
  pathname?: string
  title?: string
  pageOptions?: PageOptions
}

/**
 * Send to a window's renderer unless the window is already gone.
 *
 * An export awaits the save dialog and then the conversion itself, and a pandoc
 * run can take tens of seconds (it blocks on every remote image it cannot
 * reach). Closing the window meanwhile is normal, and `webContents.send` on a
 * destroyed window throws "Object has been destroyed" — from an export's own
 * `catch` that would throw a second time from inside the error handler, losing
 * the failure message as well. The file itself is already written by then, so
 * the notification is all that is dropped.
 */
const sendToWindow = (win: BrowserWindow, channel: string, ...args: unknown[]): void => {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, ...args)
  }
}

// Handle the export response from renderer process.
const handleResponseForExport = async(e: IpcMainEvent, payload: ExportPayload): Promise<void> => {
  const { type, content, pathname, title, pageOptions } = payload
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }
  const extension = (EXTENSION_HASN as Record<string, string>)[type]
  const dirname = pathname ? path.dirname(pathname) : getPath('documents')
  let nakedFilename = pathname ? path.basename(pathname, '.md') : title
  if (!nakedFilename) {
    nakedFilename = 'Untitled'
  }

  const defaultPath = path.join(dirname, `${nakedFilename}${extension}`)
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath,
    filters: getExportExtensionFilter(type)
  })

  if (win.isDestroyed()) {
    // The window went away while the dialog was open: there is no renderer to
    // export for, and nothing has been written yet.
    return
  }

  if (filePath && !canceled) {
    try {
      if (type === 'pdf') {
        // Build a clickable bookmark/outline tree from the document's h1-h6
        // headings so exported PDFs have a navigation pane (#2989). The outline
        // is derived from the tagged-PDF structure tree, so generateTaggedPDF is
        // required — generateDocumentOutline alone produces no outline.
        const options: Electron.PrintToPDFOptions = {
          printBackground: true,
          generateTaggedPDF: true,
          generateDocumentOutline: true
        }
        Object.assign(options, getPdfPageOptions(pageOptions))
        const data = await win.webContents.printToPDF(options)
        removePrintServiceFromWindow(win)
        await writeFile(filePath, data, extension!, 'binary')
      } else {
        if (!content) {
          throw new Error('No HTML content found.')
        }
        await writeFile(filePath, content, extension!, 'utf8')
      }
      sendToWindow(win, 'mt::export-success', { type, filePath })
    } catch (err) {
      log.error('Error while exporting:', err)
      const ERROR_MSG =
        (err instanceof Error && err.message) || `Error happened when export ${filePath}`
      sendToWindow(win, 'mt::show-notification', {
        title: 'Export failure',
        type: 'error',
        message: ERROR_MSG
      })
    }
  } else {
    // User canceled save dialog
    if (type === 'pdf') {
      removePrintServiceFromWindow(win)
    }
  }
}

/**
 * Notifications render their message as HTML, and pandoc echoes text taken from
 * the document (image paths, extension names) into its diagnostics, so escape
 * before it reaches the notification's innerHTML.
 */
const escapeNotificationText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * How many warning lines the notification lists before it summarizes the rest.
 * pandoc emits one per link it could not resolve, so a document with a handful
 * of bad image paths would otherwise grow the toast past the editor.
 */
const MAX_PANDOC_WARNING_LINES = 5

/**
 * Whether pandoc's line is about its own translation data files rather than the
 * document.
 *
 * `getPandocLanguage` keeps the common case from happening at all, but pandoc
 * ships translations for a fixed list of languages: a locale outside it (`sw`,
 * `tl`) still makes the writer report the file it could not load and then the
 * term it could not look up, as two lines with the path echoed on the second.
 * Neither says anything about the document, neither can be acted on from the
 * editor, and an untranslated "Abstract" heading is not a reason to put a
 * warning over a file that was written correctly. The full stderr still reaches
 * the log.
 */
const isPandocTranslationWarning = (lines: string[], index: number): boolean => {
  const line = lines[index] ?? ''
  const couldNotLoad = '[WARNING] Could not load translations for '
  if (line.startsWith(couldNotLoad)) {
    return true
  }
  if (/^\[WARNING\] The term .+ has no translation defined\.$/.test(line)) {
    return true
  }
  // The data file whose lookup failed, on the line after the warning about it.
  return (
    /^translations\/\S+\.ya?ml:/.test(line) && (lines[index - 1] ?? '').startsWith(couldNotLoad)
  )
}

/**
 * pandoc reports every unresolved link on its own line and still exits 0, so a
 * document with fifty of them produces fifty lines. Show the first few and say
 * how many were dropped; the full text reaches the log either way.
 */
const summarizePandocWarnings = (warnings: string): string => {
  const lines = warnings
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  // Filtered before the cap, so lines pandoc never should have printed do not
  // eat into the five the user gets to see — and so a stderr holding nothing
  // else summarizes to nothing, which keeps the toast away entirely.
  const relevant = lines.filter((_, index) => !isPandocTranslationWarning(lines, index))

  const shown = relevant.slice(0, MAX_PANDOC_WARNING_LINES).map(escapeNotificationText)
  const hidden = relevant.length - MAX_PANDOC_WARNING_LINES
  if (hidden > 0) {
    shown.push(escapeNotificationText(t('dialog.exportWarningMore', { count: hidden })))
  }

  // The body is HTML, so pandoc's line-per-warning output would collapse into a
  // single paragraph without the explicit breaks.
  return shown.join('<br>')
}

/**
 * "notes.docx", "notes (2).docx", … — never an existing file.
 *
 * The automatic export locations write without asking, and a conversion is a
 * derived file: replacing an earlier one the user may still be working from is
 * not what clicking a menu entry promises.
 */
/**
 * Flatten a document title into something every filesystem accepts as a file
 * name. For an unsaved document the first heading names the output, and a
 * heading such as "Q1/Q2 report" would otherwise turn the output path into a
 * subfolder pandoc cannot write to (ENOENT) — the save dialog would have let
 * the user fix it, the automatic locations cannot (#5379 review).
 */
const sanitizeFilename = (name: string): string =>
  name.replace(/[/\\:*?"<>|]/g, '-').trim() || 'Untitled'

const uniquePandocOutputPath = async(
  dir: string,
  nakedFilename: string,
  extension: string
): Promise<string> => {
  const candidate = path.join(dir, `${nakedFilename}${extension}`)
  // `exists` is async, so a bare `!exists(candidate)` tests a Promise — always
  // truthy-negated, the numbering below never runs and the second export of a
  // document silently overwrites the first (#5379 review).
  if (!(await exists(candidate))) {
    return candidate
  }
  for (let index = 2; index < 1000; index++) {
    const numbered = path.join(dir, `${nakedFilename} (${index})${extension}`)
    if (!(await exists(numbered))) {
      return numbered
    }
  }
  return candidate
}

/**
 * Where the converted file is written, or `null` when the user cancels.
 *
 * `ask` is the save dialog. `source` writes beside the document being exported
 * and `folder` into the folder set in the preferences; neither can fall back on
 * anything — a document that has never been saved has no folder of its own, and
 * the folder mode needs a folder — so an incomplete configuration asks rather
 * than guessing.
 */
const resolvePandocOutputPath = async(
  win: BrowserWindow,
  options: {
    format: PandocExportFormat
    nakedFilename: string
    sourceDir?: string
    location: PandocExportLocation
    folder: string
  }
): Promise<string | null> => {
  const { format, nakedFilename, sourceDir, location, folder } = options
  const targetDir = location === 'source' ? sourceDir : location === 'folder' ? folder : undefined

  if (targetDir) {
    // The folder may have been moved or deleted since it was chosen; recreating
    // it is friendlier than failing the export with ENOENT.
    await fsEnsureDir(targetDir)
    return await uniquePandocOutputPath(targetDir, nakedFilename, format.extension)
  }

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(
      sourceDir ?? getPath('documents'),
      `${nakedFilename}${format.extension}`
    ),
    filters: [{ name: format.label, extensions: [format.extension.slice(1)] }]
  })

  if (canceled || !filePath) {
    return null
  }
  return filePath
}

const handleResponseForPandocExport = async(
  e: IpcMainEvent,
  payload: PandocExportPayload
): Promise<void> => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }

  const format = PANDOC_EXPORT_FORMATS.find((f) => f.id === payload.target)
  if (!format) {
    log.error(`Unknown pandoc export target: ${payload.target}`)
    return
  }

  const preferences = getUserPreference()
  const { markdown, title, pathname, superSubScript } = payload
  // Relative links resolve against the folder holding the document, so it is
  // needed by both the export location and the conversion itself.
  const sourceDir = pathname ? path.dirname(pathname) : undefined
  // Strip whatever extension the source file carries so "notes.md" becomes
  // "notes.docx" rather than "notes.md.docx"; the sanitizer keeps a heading
  // reused as a file name from carrying path separators into the output path.
  const nakedFilename = sanitizeFilename(
    (pathname ? path.basename(pathname, path.extname(pathname)) : title) || 'Untitled'
  )

  // The location resolution runs inside the try: `folder` mode recreates the
  // target directory first, and a volume that is no longer mounted (or a path
  // whose parent is a regular file) rejects with EACCES/ENOTDIR — the catch
  // below is what turns that into the error toast, so the rejection must not
  // escape the handler and leave a click with no reaction at all (#5379
  // review).
  let filePath: string | null = null
  try {
    filePath = await resolvePandocOutputPath(win, {
      format,
      nakedFilename,
      sourceDir,
      location: getPandocExportLocation(preferences?.getItem('pandocExportLocation')),
      folder: (preferences?.getItem<string>('pandocExportFolder') ?? '').trim()
    })

    if (!filePath || win.isDestroyed()) {
      // Cancelled, or the window was closed while the dialog was open — either
      // way there is nothing left to convert for.
      return
    }

    // The document comes in over stdin, so pandoc resolves its relative links
    // against the process cwd unless the source folder is passed along — and a
    // link it cannot resolve only produces a warning on stderr while pandoc still
    // exits 0.
    const cwd = sourceDir

    // Which Word template the docx export takes: pandoc's built-in one, the
    // bundled look-like-the-editor one, or a file of the user's own. The bundled
    // one is signalled by withholding a template — that is what makes `toFile`
    // inject `static/pandoc-reference.docx` — while an explicit `''` is what
    // keeps pandoc's default, so the three choices map onto those two states.
    const docxTemplate = preferences?.getItem<string>('pandocDocxTemplate') ?? 'default'

    const { warnings } = await pandoc.toFile(format.target, filePath, markdown, {
      cwd,
      reader: getPandocReader(
        superSubScript === true,
        // `gfm` enables footnotes on its own, but the editor only renders them
        // when the preference says so — a `[^1]` shown as literal text must not
        // turn into a real footnote in the file (#5379 review).
        preferences?.getItem<boolean>('footnote') === true
      ),
      // Standalone defaults to on, so only an explicit `false` turns it off —
      // a preferences file written before the option existed behaves as before.
      standalone: preferences?.getItem<boolean>('pandocStandalone') !== false,
      toc: preferences?.getItem<boolean>('pandocToc') === true,
      numberSections: preferences?.getItem<boolean>('pandocNumberSections') === true,
      referenceDoc:
        docxTemplate === 'wysiwyg'
          ? undefined
          : docxTemplate === 'custom'
            ? (preferences?.getItem<string>('pandocReferenceDoc') ?? '').trim()
            : '',
      metadata: {
        // A standalone document wants a title and pandoc cannot take one off a
        // document that arrives on stdin: EPUB then ships with no `<dc:title>`
        // and prints a `[WARNING]` on every export, which would turn the export
        // warning this feature exists to show into background noise. The title
        // the renderer sent is what names the file, so it is also what the file
        // should call itself; an untitled document falls back to the file name.
        title: title || nakedFilename,
        // The spawn environment's locale reaches the file as the string "C"
        // (`<dc:language>C</dc:language>`); the app's own locale is the one the
        // user is actually reading the UI in. It goes through the mapper because
        // pandoc only carries Chinese under a script subtag — see
        // `getPandocLanguage`.
        lang: getPandocLanguage(app.getLocale())
      }
    })

    // Exit code 0 does not mean the conversion was clean: pandoc warns on
    // stderr about images it could not fetch and replaces them with their alt
    // text. Say so, otherwise the export looks perfect. The guard tests the
    // summary rather than `warnings`: a stderr holding only a newline is truthy
    // but has nothing to show. The warning goes out before the success notice,
    // because that notice offers to open the file manager and a click would
    // otherwise dismiss the warning unread.
    const message = summarizePandocWarnings(warnings)
    if (message) {
      log.warn(`pandoc export warnings for ${filePath}:`, warnings)
      sendToWindow(win, 'mt::show-notification', {
        title: t('dialog.exportWarning'),
        type: 'warning',
        message
      })
    }
    sendToWindow(win, 'mt::export-success', { type: format.id, filePath })
  } catch (err) {
    log.error('Error while exporting with pandoc:', err)
    const ERROR_MSG =
      (err instanceof Error && err.message) || `Error happened when export ${filePath}`
    // pandoc failures are routinely multi-line ("pandoc: …" then
    // "Error at \"source\" (line 12, column 3): …"), and the notification body
    // is HTML: without the same breaking and capping the warnings get, the
    // position of the error would collapse into one run-on line.
    sendToWindow(win, 'mt::show-notification', {
      title: t('dialog.exportWarning'),
      type: 'error',
      message: summarizePandocWarnings(ERROR_MSG)
    })
  }
}

const handleResponseForPrint = async(e: IpcMainEvent): Promise<void> => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }
  win.webContents.print({ printBackground: true }, () => {
    removePrintServiceFromWindow(win)
  })
}

const handleResponseForSave = async(
  e: IpcMainEvent,
  id: string,
  filename: string,
  pathname: string | undefined,
  markdown: string,
  options: UnsavedFile['options'],
  defaultPath?: string
): Promise<string | void> => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return Promise.resolve()
  }
  let recommendFilename = getRecommendTitleFromMarkdownString(markdown)
  if (!recommendFilename) {
    recommendFilename = filename || 'Untitled'
  }

  // If the file doesn't exist on disk add it to the recently used documents later
  // and execute file from filesystem watcher for a short time. The file may exists
  // on disk nevertheless but is already tracked by MarkText.
  const alreadyExistOnDisk = !!pathname

  let filePath = pathname

  if (!filePath) {
    const { filePath: dialogPath, canceled } = await dialog.showSaveDialog(win, {
      defaultPath: path.join(defaultPath || getPath('documents'), `${recommendFilename}.md`)
    })

    if (dialogPath && !canceled) {
      filePath = dialogPath
    }
  }

  // Save dialog canceled by user - no error.
  if (!filePath) {
    return Promise.resolve()
  }

  filePath = path.resolve(filePath)
  const extension = path.extname(filePath) || '.md'
  filePath = !filePath.endsWith(extension) ? (filePath += extension) : filePath
  // The original JS passed `win` here; writeMarkdownFile only takes 3 args
  // (the 4th was silently ignored). Drop it explicitly under strict mode.
  // The IPC `SaveOptions` has every field optional, but writeMarkdownFile
  // requires the strict `MarkdownDocumentOptions` shape — the renderer always
  // populates every field for the unsaved-file dialog payload, so the cast
  // is safe at this seam.
  return writeMarkdownFile(filePath, markdown, options as Parameters<typeof writeMarkdownFile>[2])
    .then(() => {
      if (!alreadyExistOnDisk) {
        ipcMain.emit('window-add-file-path', win.id, filePath)
        ipcMain.emit('menu-add-recently-used', filePath)

        const newFilename = path.basename(filePath!)
        win.webContents.send('mt::set-pathname', { id, pathname: filePath, filename: newFilename })
      } else {
        ipcMain.emit('window-file-saved', win.id, filePath)
        win.webContents.send('mt::tab-saved', id)
      }
      return id
    })
    .catch((err: unknown) => {
      log.error('Error while saving:', err)
      const msg = err instanceof Error ? err.message : String(err)
      win.webContents.send('mt::tab-save-failure', id, msg)
    })
}

const showUnsavedFilesMessage = async(
  win: BrowserWindow,
  files: UnsavedFile[]
): Promise<{ needSave: boolean } | null> => {
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: [t('dialog.save'), t('dialog.dontSave'), t('dialog.cancel')],
    defaultId: 0,
    message: t('dialog.saveChanges', {
      count: files.length,
      type: files.length === 1 ? t('dialog.file') : t('dialog.files'),
      files: files.map((f) => f.filename).join('\n')
    }),
    detail: t('dialog.changesWillBeLost'),
    cancelId: 2,
    noLink: true
  })

  switch (response) {
    case 0:
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ needSave: true })
        })
      })
    case 1:
      return { needSave: false }
    default:
      return null
  }
}

const noticePandocNotFound = (win: BrowserWindow, titleKey = 'dialog.importWarning'): void => {
  win.webContents.send('mt::pandoc-not-exists', {
    title: t(titleKey),
    type: 'warning',
    message: t('dialog.installPandoc'),
    time: 10000
  })
}

const openPandocFile = async(windowId: number, pathname: string): Promise<void> => {
  try {
    const converter = pandoc(pathname, 'markdown')
    const data = await converter()
    ipcMain.emit('app-open-markdown-by-id', windowId, data)
  } catch (err) {
    log.error('Error while converting file:', err)
  }
}

const removePrintServiceFromWindow = (win: BrowserWindow): void => {
  // remove print service content and restore GUI
  sendToWindow(win, 'mt::print-service-clearup')
}

// --- events -----------------------------------

ipcMain.on('mt::save-tabs', (e, unsavedFiles: UnsavedFile[]) => {
  Promise.all(
    unsavedFiles.map((file) =>
      handleResponseForSave(
        e,
        file.id,
        file.filename,
        file.pathname,
        file.markdown,
        file.options,
        file.defaultPath
      )
    )
  ).catch(log.error)
})

ipcMain.on('mt::save-and-close-tabs', async(e, unsavedFiles: UnsavedFile[]) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }
  const userResult = await showUnsavedFilesMessage(win, unsavedFiles)
  if (!userResult) {
    return
  }

  const { needSave } = userResult
  if (needSave) {
    Promise.all(
      unsavedFiles.map((file) =>
        handleResponseForSave(
          e,
          file.id,
          file.filename,
          file.pathname,
          file.markdown,
          file.options,
          file.defaultPath
        )
      )
    )
      .then((arr) => {
        const tabIds = arr.filter((id): id is string => id != null)
        win.webContents.send('mt::force-close-tabs-by-id', tabIds)
      })
      .catch((err: unknown) => {
        log.error('Error while save all:', err)
      })
  } else {
    const tabIds = unsavedFiles.map((f) => f.id)
    win.webContents.send('mt::force-close-tabs-by-id', tabIds)
  }
})

ipcMain.on(
  'mt::response-file-save-as',
  async(
    e: IpcMainEvent,
    id: string,
    filename: string,
    pathname: string | undefined,
    markdown: string,
    options: UnsavedFile['options'],
    defaultPath?: string
  ) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) {
      return
    }
    let recommendFilename = getRecommendTitleFromMarkdownString(markdown)
    if (!recommendFilename) {
      recommendFilename = filename || 'Untitled'
    }

    // If the file doesn't exist on disk add it to the recently used documents later
    // and execute file from filesystem watcher for a short time. The file may exists
    // on disk nevertheless but is already tracked by MarkText.
    const alreadyExistOnDisk = !!pathname

    let { filePath, canceled } = await dialog.showSaveDialog(win, {
      defaultPath:
        pathname || path.join(defaultPath || getPath('documents'), `${recommendFilename}.md`)
    })

    if (filePath && !canceled) {
      filePath = path.resolve(filePath)
      writeMarkdownFile(filePath, markdown, options as Parameters<typeof writeMarkdownFile>[2])
        .then(() => {
          if (!alreadyExistOnDisk) {
            ipcMain.emit('window-add-file-path', win.id, filePath)
            ipcMain.emit('menu-add-recently-used', filePath)

            const newFilename = path.basename(filePath!)
            win.webContents.send('mt::set-pathname', {
              id,
              pathname: filePath,
              filename: newFilename
            })
          } else if (pathname !== filePath) {
            // Update window file list and watcher.
            ipcMain.emit('window-change-file-path', win.id, filePath, pathname)

            const newFilename = path.basename(filePath!)
            win.webContents.send('mt::set-pathname', {
              id,
              pathname: filePath,
              filename: newFilename
            })
          } else {
            ipcMain.emit('window-file-saved', win.id, filePath)
            win.webContents.send('mt::tab-saved', id)
          }
        })
        .catch((err: unknown) => {
          log.error('Error while save as:', err)
          const msg = err instanceof Error ? err.message : String(err)
          win.webContents.send('mt::tab-save-failure', id, msg)
        })
    }
  }
)

ipcMain.on('mt::close-window-confirm', async(e, unsavedFiles: UnsavedFile[]) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }
  const userResult = await showUnsavedFilesMessage(win, unsavedFiles)
  if (!userResult) {
    return
  }

  const { needSave } = userResult
  if (needSave) {
    Promise.all(
      unsavedFiles.map((file) =>
        handleResponseForSave(
          e,
          file.id,
          file.filename,
          file.pathname,
          file.markdown,
          file.options,
          file.defaultPath
        )
      )
    )
      .then(() => {
        ipcMain.emit('window-close-by-id', win.id)
      })
      .catch((err: unknown) => {
        log.error('Error while saving before quit:', err)

        const msg = err instanceof Error ? err.message : String(err)
        // Notify user about the problem.
        dialog
          .showMessageBox(win, {
            type: 'error',
            buttons: [t('dialog.close'), t('dialog.keepOpen')],
            message: t('dialog.saveFailure'),
            detail: msg
          })
          .then(({ response }) => {
            if (win.id && response === 0) {
              ipcMain.emit('window-close-by-id', win.id)
            }
          })
      })
  } else {
    ipcMain.emit('window-close-by-id', win.id)
  }
})

ipcMain.on('mt::response-file-save', handleResponseForSave as Parameters<typeof ipcMain.on>[1])

ipcMain.on('mt::response-export', handleResponseForExport as Parameters<typeof ipcMain.on>[1])

ipcMain.on(
  'mt::response-pandoc-export',
  handleResponseForPandocExport as Parameters<typeof ipcMain.on>[1]
)

ipcMain.on('mt::response-print', handleResponseForPrint as Parameters<typeof ipcMain.on>[1])

ipcMain.on('mt::window::drop', async(e, fileList: string[]) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }
  for (const file of fileList) {
    if (isMarkdownFile(file)) {
      openFileOrFolder(win, file)
      continue
    }

    // Try to import the file
    if (PANDOC_EXTENSIONS.some((ext: string) => file.endsWith(ext))) {
      const existsPandoc = pandoc.exists()
      if (!existsPandoc) {
        noticePandocNotFound(win)
      } else {
        openPandocFile(win.id, file)
      }
      break
    }
  }
})

interface RenamePayload {
  id: string
  pathname: string
  newPathname: string
}

ipcMain.on('mt::rename', async(e, { id, pathname, newPathname }: RenamePayload) => {
  if (pathname === newPathname) return
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }

  const doRename = (): void => {
    fsRename(pathname, newPathname, (err: NodeJS.ErrnoException | null) => {
      if (err) {
        log.error(`mt::rename: Cannot rename "${pathname}" to "${newPathname}".\n${err.stack}`)
        return
      }

      ipcMain.emit('window-change-file-path', win.id, newPathname, pathname)
      e.sender.send('mt::set-pathname', {
        id,
        pathname: newPathname,
        filename: path.basename(newPathname)
      })
    })
  }

  if (!(await exists(newPathname))) {
    doRename()
  } else {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: [t('dialog.replace'), t('dialog.cancel')],
      defaultId: 1,
      message: t('dialog.fileExists', { filename: path.basename(newPathname) }),
      cancelId: 1,
      noLink: true
    })

    if (response === 0) {
      doRename()
    }
  }
})

ipcMain.on(
  'mt::response-file-move-to',
  async(e, { id, pathname }: { id: string; pathname: string }) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) {
      return
    }
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      buttonLabel: 'Move to',
      nameFieldLabel: 'Filename:',
      defaultPath: pathname
    })

    if (filePath && !canceled) {
      fsRename(pathname, filePath, (err: NodeJS.ErrnoException | null) => {
        if (err) {
          log.error(`mt::rename: Cannot rename "${pathname}" to "${filePath}".\n${err.stack}`)
          return
        }

        ipcMain.emit('window-change-file-path', win.id, filePath, pathname)
        e.sender.send('mt::set-pathname', {
          id,
          pathname: filePath,
          filename: path.basename(filePath)
        })
      })
    }
  }
)

ipcMain.on('mt::ask-for-open-project-in-sidebar', async(e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }
  const { filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  })

  if (filePaths && filePaths[0]) {
    const resolvedPath = normalizeAndResolvePath(filePaths[0])
    ipcMain.emit('app-open-directory-by-id', win.id, resolvedPath, true)
  }
})

interface FormatLinkPayload {
  data: { href?: string; text?: string }
  dirname?: string
}

ipcMain.on('mt::format-link-click', async(e, { data, dirname }: FormatLinkPayload) => {
  if (!data || (!data.href && !data.text)) {
    return
  }
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }

  const rawUrl = data.href || data.text!
  const urlCandidate = rawUrl.replace(/^<(.+)>$/, '$1') // Replace any <> CommonMark #489
  if (urlCandidate === rawUrl) {
    // No <> found, no spaces should be allowed
    if (/\s/.test(rawUrl)) {
      win.webContents.send('mt::show-notification', {
        title: 'Links cannot contain spaces',
        type: 'error',
        message:
          'Either URI encode: <code>My%20Link.md</code> <br> or wrap it in brackets: <br> <code><./My Link.md></code>. <br> See CommonMark #488 for details.'
      })
      return
    }
  }

  if (URL_REG.test(urlCandidate)) {
    shell.openExternal(urlCandidate)
    return
  } else if (/^[a-z0-9]+:\/\//i.test(urlCandidate)) {
    // Prevent other URLs.
    return
  }

  const { pathname, anchor } = resolveLocalLinkTarget(urlCandidate, dirname ?? '')
  if (pathname) {
    if (isMarkdownFile(pathname)) {
      const innerWin = BrowserWindow.fromWebContents(e.sender)
      if (innerWin) {
        openFileOrFolder(innerWin, pathname, { anchor })
      }
    } else {
      // A link in an untrusted document could point at a co-located script or
      // executable; opening it via the OS shell would run code silently (#3575).
      if (isDangerousExecutableFile(pathname)) {
        const { response } = await dialog.showMessageBox(win, {
          type: 'warning',
          buttons: [t('dialog.cancel'), t('dialog.openAnyway')],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
          title: t('dialog.unsafeFileTitle'),
          message: t('dialog.unsafeFileMessage'),
          detail: t('dialog.unsafeFileDetail', { name: path.basename(pathname) })
        })
        if (response !== 1) {
          return
        }
      }
      shell.openPath(pathname)
    }
  }
})

// --- commands -------------------------------------

ipcMain.on('mt::cmd-open-file', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  openFile(win)
})

ipcMain.on('mt::cmd-new-editor-window', () => {
  newEditorWindow()
})

ipcMain.on('mt::cmd-open-folder', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  openFolder(win)
})

ipcMain.on('mt::cmd-close-window', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win) {
    win.close()
  }
})

ipcMain.on('mt::cmd-import-file', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win) {
    importFile(win)
  }
})

// --- menu -------------------------------------

export const exportFile = (win: Win, type: string): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::show-export-dialog', type)
  }
}

/**
 * Convert the current document with pandoc and write the chosen format.
 *
 * This cannot ride on `exportFile`: that path renders HTML/PDF inside the
 * renderer, whereas pandoc wants the markdown source and a file target (binary
 * writers need `-o`, see `pandoc.toFile`). The renderer replies with the
 * markdown over `mt::response-pandoc-export`.
 *
 * `target` is a format id from the submenu. Omitting it exports the format the
 * user marked as the default, which is what a caller that is not the submenu
 * (an accelerator, a command) can use.
 */
export const exportWithPandoc = (win: Win, target?: string): void => {
  if (!win || !win.webContents) {
    return
  }

  const preferences = getUserPreference()
  const formats = getPandocExportFormats(preferences?.getItem<string[]>('pandocExportFormats'))
  const format = target
    ? formats.find((f) => f.id === target)
    : getPandocDefaultFormat(formats, preferences?.getItem<string>('pandocDefaultFormat'))

  // Empty when every format is unchecked, which hides the menu entry — so this
  // only catches a caller that did not go through it.
  if (!format) {
    if (target) {
      log.warn(`Ignoring pandoc export request for "${target}": not offered by the preferences.`)
    }
    return
  }

  if (!pandoc.exists()) {
    noticePandocNotFound(win, 'dialog.exportWarning')
    return
  }
  win.webContents.send('mt::export-with-pandoc', format.id)
}

export const importFile = async(win: BrowserWindow | null): Promise<void> => {
  if (!win) {
    return
  }
  // The menu entry is greyed out while no pandoc can be run; this keeps a stale
  // window from importing anyway.
  const existsPandoc = pandoc.exists()

  if (!existsPandoc) {
    noticePandocNotFound(win)
    return
  }

  const { filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      {
        name: 'All Files',
        extensions: [...PANDOC_EXTENSIONS]
      }
    ]
  })

  if (filePaths && filePaths[0]) {
    openPandocFile(win.id, filePaths[0])
  }
}

export const printDocument = (win: Win): void => {
  if (win) {
    win.webContents.send('mt::show-export-dialog', 'print')
  }
}

export const openFile = async(win: BrowserWindow | null): Promise<void> => {
  if (!win) {
    return
  }
  const { filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Markdown document',
        extensions: [...MARKDOWN_EXTENSIONS]
      }
    ]
  })

  if (Array.isArray(filePaths) && filePaths.length > 0) {
    ipcMain.emit('app-open-files-by-id', win.id, filePaths)
  }
}

export const openFolder = async(win: BrowserWindow | null): Promise<void> => {
  if (!win) {
    return
  }
  const { filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  })

  if (filePaths && filePaths[0]) {
    openFileOrFolder(win, filePaths[0])
  }
}

export const openFileOrFolder = (
  win: BrowserWindow,
  pathname: string,
  options: TabOptions = {}
): void => {
  const resolvedPath = normalizeAndResolvePath(pathname)
  if (isFile(resolvedPath)) {
    ipcMain.emit('app-open-file-by-id', win.id, resolvedPath, options)
  } else if (isDirectory(resolvedPath)) {
    ipcMain.emit('app-open-directory-by-id', win.id, resolvedPath)
  } else {
    console.error(`[ERROR] Cannot open unknown file: "${resolvedPath}"`)
  }
}

export const newBlankTab = (win: Win): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::new-untitled-tab')
    showTabBar(win)
  }
}

export const newEditorWindow = (): void => {
  ipcMain.emit('app-create-editor-window')
}

export const closeTab = (win: Win): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-close-tab')
  }
}

export const closeWindow = (win: Win): void => {
  if (win) {
    win.close()
  }
}

export const save = (win: Win): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-ask-file-save')
  }
}

export const saveAs = (win: Win): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-ask-file-save-as')
  }
}

export const exportPDF = (win: Win): void => {
  if (win && win.webContents) {
    exportFile(win, 'pdf')
  }
}

export const autoSave = (menuItem: MenuItem, _browserWindow: BrowserWindow | undefined): void => {
  const { checked } = menuItem
  ipcMain.emit('set-user-preference', { autoSave: checked })
}

export const moveTo = (win: Win): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-move-file')
  }
}

export const rename = (win: Win): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-rename-file')
  }
}

export const clearRecentlyUsed = (): void => {
  ipcMain.emit('menu-clear-recently-used')
}

// --- Commands -------------------------------------------------------------

export const loadFileCommands = (commandManager: CommandManager): void => {
  commandManager.add(COMMANDS.FILE_CHECK_UPDATE, checkUpdates)
  commandManager.add(COMMANDS.FILE_CLOSE_TAB, closeTab)
  commandManager.add(COMMANDS.FILE_CLOSE_WINDOW, closeWindow)
  commandManager.add(COMMANDS.FILE_EXPORT_FILE, exportFile)
  commandManager.add(COMMANDS.FILE_IMPORT_FILE, importFile)
  commandManager.add(COMMANDS.FILE_MOVE_FILE, moveTo)
  commandManager.add(COMMANDS.FILE_NEW_FILE, newEditorWindow)
  commandManager.add(COMMANDS.FILE_NEW_TAB, newBlankTab)
  commandManager.add(COMMANDS.FILE_OPEN_FILE, openFile)
  commandManager.add(COMMANDS.FILE_OPEN_FOLDER, openFolder)
  commandManager.add(COMMANDS.FILE_PREFERENCES, userSetting)
  commandManager.add(COMMANDS.FILE_PRINT, printDocument)
  commandManager.add(COMMANDS.FILE_QUIT, app.quit)
  commandManager.add(COMMANDS.FILE_RENAME_FILE, rename)
  commandManager.add(COMMANDS.FILE_SAVE, save)
  commandManager.add(COMMANDS.FILE_SAVE_AS, saveAs)
  commandManager.add(COMMANDS.FILE_EXPORT_FILE_PDF, exportPDF)
}
