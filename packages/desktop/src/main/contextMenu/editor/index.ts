import { Menu, MenuItem, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import {
  getCUT,
  getCOPY,
  getPASTE,
  getCopyAsRich,
  getCopyAsHtml,
  getPasteAsPlainText,
  SEPARATOR,
  getInsertBefore,
  getInsertAfter
} from './menuItems'
import { localImagePathFromSrc, openImageExternally } from './openImage'
import spellcheckMenuBuilder from './spellcheck'
import { t } from '../../i18n'

// Electron's ContextMenuParams shape we rely on. Kept narrow — the renderer
// supplies the full surface so we only annotate the fields we use.
interface ContextMenuParams {
  isEditable: boolean
  hasImageContents?: boolean
  // The right-clicked image's URL, when `hasImageContents` is set. For a local
  // image this is a `file:` URL.
  srcURL?: string
  selectionText: string
  inputFieldType?: string
  editFlags: {
    canCut: boolean
    canCopy: boolean
    canPaste: boolean
    canEditRichly: boolean
  }
  misspelledWord?: string
  dictionarySuggestions?: string[]
  // Coordinates of the context-menu request. Electron names them `x`/`y` on
  // the params (not the event); the renderer passes them through unchanged.
  x: number
  y: number
}

// Electron `webContents.on('context-menu', (event, params) => ...)` provides
// a simple event object with preventDefault — nothing on it is consumed by
// this function, so we keep the type minimal.
type ContextMenuEvent = {
  preventDefault?: () => void
  readonly defaultPrevented?: boolean
}

// Dynamically fetch menu items to ensure correct translation
const getContextItems = (): MenuItemConstructorOptions[] => [
  getInsertBefore(),
  getInsertAfter(),
  SEPARATOR,
  getCUT(),
  getCOPY(),
  getPASTE(),
  SEPARATOR,
  getCopyAsRich(),
  getCopyAsHtml(),
  getPasteAsPlainText()
]

const isInsideEditor = (params: ContextMenuParams): boolean => {
  const { isEditable, editFlags, inputFieldType } = params
  // WORKAROUND for Electron#32102: `params.spellcheckEnabled` is always false. Try to detect the editor container via other information.
  return isEditable && !inputFieldType && !!editFlags.canEditRichly
}

// An inline image is rendered `contenteditable="false"` (muya's
// inlineRenderer/renderer/image.ts), so Electron reports `isEditable: false` for
// it and `isInsideEditor` — which requires an editable target — never matches.
// Gate on the image signals instead: `canEditRichly` still ties the event to the
// editor, and `inputFieldType` rules out a real <input>.
const isEditorImage = (params: ContextMenuParams): boolean => {
  const { hasImageContents, inputFieldType, editFlags } = params
  return !!hasImageContents && !inputFieldType && !!editFlags.canEditRichly
}

export const showEditorContextMenu = (
  win: BrowserWindow,
  event: ContextMenuEvent,
  params: ContextMenuParams,
  isSpellcheckerEnabled: boolean
): void => {
  const {
    isEditable,
    hasImageContents,
    selectionText,
    editFlags,
    misspelledWord,
    dictionarySuggestions
  } = params

  // NOTE: We have to get the word suggestions from this event because `webFrame.getWordSuggestions` and
  //       `webFrame.isWordMisspelled` doesn't work on Windows (Electron#28684).

  // Make sure that the request comes from a contenteditable inside the editor container.
  if (isInsideEditor(params) && !hasImageContents) {
    const hasText = selectionText.trim().length > 0
    const canCopy = hasText && editFlags.canCut && editFlags.canCopy
    // const canPaste = hasText && editFlags.canPaste
    const isMisspelled = isEditable && !!selectionText && !!misspelledWord

    const menu = new Menu()
    if (isSpellcheckerEnabled) {
      const spellingSubmenu = spellcheckMenuBuilder(
        isMisspelled,
        misspelledWord,
        dictionarySuggestions
      )
      menu.append(
        new MenuItem({
          label: t('contextMenu.spelling'),
          submenu: spellingSubmenu as Electron.MenuItemConstructorOptions[]
        })
      )
      menu.append(new MenuItem(SEPARATOR))
    }

    const contextItems = getContextItems()
    const copyItems = [contextItems[3], contextItems[4], contextItems[8], contextItems[7]] // CUT, COPY, COPY_AS_HTML, COPY_AS_RICH
    copyItems.forEach((item) => {
      if (item) item.enabled = canCopy
    })
    contextItems.forEach((item) => {
      menu.append(new MenuItem(item))
    })
    // The original JS passes an array literal here, which Electron treats as
    // the options object. Cast to satisfy the typed overload.
    // The original JS passed an array literal — Electron tolerated it. The
    // typed overload wants an options object, so produce one explicitly.
    // `event` is intentionally unused (params carries x/y); the function
    // signature keeps it to mirror the webContents.on('context-menu', ...)
    // (event, params) shape.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    event
    menu.popup({ window: win, x: params.x, y: params.y })
  }

  // Right-clicking an image yields no menu at all: the guard above excludes
  // `hasImageContents` and nothing replaced it (#2461). Offer the one action
  // that has a system counterpart — hand the file to the associated viewer.
  if (isEditorImage(params)) {
    const pathname = localImagePathFromSrc(params.srcURL ?? '')
    // A remote or data: image has no file for the OS to open, so leave that case
    // menuless as it is today rather than showing an item that cannot work.
    if (pathname) {
      const menu = new Menu()
      menu.append(
        new MenuItem({
          label: t('contextMenu.openImage'),
          id: 'openImageMenuItem',
          click: async() => {
            await openImageExternally(pathname)
          }
        })
      )
      menu.popup({ window: win, x: params.x, y: params.y })
    }
  }
}
