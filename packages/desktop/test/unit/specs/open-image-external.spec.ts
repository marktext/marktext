import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { localImagePathFromSrc, openImageExternally } from 'main_renderer/contextMenu/editor/openImage'
import { showEditorContextMenu } from 'main_renderer/contextMenu/editor'

// #2461 — right-clicking an image offered no way to open it outside MarkText;
// `showEditorContextMenu` required `!hasImageContents`, so images got no menu at
// all. The new item hands a LOCAL image to the OS's associated viewer. The src
// comes from an untrusted document, so `isImageFile`'s extension whitelist is
// what stops "Open Image" from becoming `shell.openPath` on a co-located script
// or executable — the hole #3575 closed for markdown links.

const { openPath, appended, popups, logError } = vi.hoisted(() => ({
  openPath: vi.fn(async() => ''),
  appended: [] as Record<string, unknown>[],
  popups: [] as Record<string, unknown>[],
  logError: vi.fn()
}))

vi.mock('electron', () => ({
  shell: { openPath },
  Menu: class {
    append(item: Record<string, unknown>) {
      appended.push(item)
    }

    popup(options: Record<string, unknown>) {
      popups.push(options)
    }
  },
  MenuItem: class {
    constructor(options: Record<string, unknown>) {
      Object.assign(this, options)
    }
  }
}))
vi.mock('electron-log', () => ({ default: { error: logError, info: vi.fn() } }))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))
vi.mock('main_renderer/contextMenu/editor/spellcheck', () => ({ default: () => [] }))

let dir: string
let pngPath: string
let scriptPath: string

const fileUrl = (p: string): string => pathToFileURL(p).href

const editorParams = (over: Record<string, unknown> = {}) => ({
  isEditable: true,
  selectionText: '',
  inputFieldType: undefined,
  editFlags: { canCut: true, canCopy: true, canPaste: true, canEditRichly: true },
  x: 10,
  y: 20,
  ...over
})

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mt-open-image-'))
  pngPath = join(dir, 'photo.png')
  scriptPath = join(dir, 'payload.js')
  writeFileSync(pngPath, 'not really a png')
  writeFileSync(scriptPath, 'console.log("pwned")')
  writeFileSync(join(dir, 'note.md'), '# note')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  openPath.mockClear()
  logError.mockClear()
  appended.length = 0
  popups.length = 0
})

describe('#2461 — localImagePathFromSrc', () => {
  it('resolves a file: URL to an existing image path', () => {
    expect(localImagePathFromSrc(fileUrl(pngPath))).toBe(pngPath)
  })

  it('ignores the cache-buster muya appends to the rendered src', () => {
    // The engine renders `photo.png?mucache=mu-4` so "Reload Images" can bypass
    // the cache; the query has to be dropped before the extension check, or it
    // would see `.png?mucache=mu-4` and refuse a perfectly good image.
    expect(localImagePathFromSrc(`${fileUrl(pngPath)}?mucache=mu-4`)).toBe(pngPath)
  })

  it('rejects a file: URL whose extension is not an image', () => {
    // The #3575 case: a document could point an image src at a co-located
    // script, which the OS would execute rather than display.
    expect(localImagePathFromSrc(fileUrl(scriptPath))).toBeNull()
    expect(localImagePathFromSrc(fileUrl(join(dir, 'note.md')))).toBeNull()
  })

  it('rejects an image extension that does not exist on disk', () => {
    expect(localImagePathFromSrc(fileUrl(join(dir, 'missing.png')))).toBeNull()
  })

  it('rejects remote, data: and malformed sources', () => {
    expect(localImagePathFromSrc('https://example.com/pic.png')).toBeNull()
    expect(localImagePathFromSrc('http://example.com/pic.png')).toBeNull()
    expect(
      localImagePathFromSrc('data:image/png;base64,iVBORw0KGgo=')
    ).toBeNull()
    expect(localImagePathFromSrc('')).toBeNull()
    expect(localImagePathFromSrc('file://')).toBeNull()
    expect(localImagePathFromSrc('photo.png')).toBeNull()
  })
})

describe('#2461 — openImageExternally', () => {
  it('hands the path to the OS', async() => {
    await openImageExternally(pngPath)
    expect(openPath).toHaveBeenCalledWith(pngPath)
    expect(logError).not.toHaveBeenCalled()
  })

  it('logs when the OS reports no application for the format', async() => {
    openPath.mockResolvedValueOnce('No application is registered to handle this file type.')
    await openImageExternally(pngPath)
    expect(logError).toHaveBeenCalled()
  })
})

describe('#2461 — editor context menu on an image', () => {
  const show = (params: Record<string, unknown>) =>
    showEditorContextMenu(
      {} as never,
      {} as never,
      params as never,
      false
    )

  it('offers "Open Image" for a local image and opens it on click', async() => {
    // Measured in-app: muya renders the image `contenteditable="false"`, so
    // Electron reports isEditable false here. The gate must not require it, or
    // the item never appears.
    show(
      editorParams({
        isEditable: false,
        hasImageContents: true,
        mediaType: 'image',
        srcURL: `${fileUrl(pngPath)}?mucache=mu-4`
      })
    )

    expect(popups).toHaveLength(1)
    expect(appended).toHaveLength(1)
    expect(appended[0].label).toBe('contextMenu.openImage')
    expect(openPath).not.toHaveBeenCalled()

    await (appended[0].click as () => Promise<void>)()
    expect(openPath).toHaveBeenCalledWith(pngPath)
  })

  it('stays menuless for a remote image, which has no file to open', () => {
    show(
      editorParams({
        isEditable: false,
        hasImageContents: true,
        srcURL: 'https://example.com/pic.png'
      })
    )

    expect(popups).toHaveLength(0)
    expect(appended).toHaveLength(0)
    expect(openPath).not.toHaveBeenCalled()
  })

  it('does not offer "Open Image" for text, and still shows the text menu', () => {
    show(editorParams({ isEditable: true, hasImageContents: false, srcURL: '' }))

    expect(popups).toHaveLength(1)
    expect(appended.map((i) => i.label)).not.toContain('contextMenu.openImage')
    expect(appended.length).toBeGreaterThan(1)
  })
})
