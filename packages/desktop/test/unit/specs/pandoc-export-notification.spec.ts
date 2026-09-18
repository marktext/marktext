import { beforeEach, describe, expect, it, vi } from 'vitest'

// `menu/actions/file.ts` registers itself on `ipcMain` at module load, so the
// Electron, log, i18n and pandoc surfaces are stubbed and the registered
// handler is driven directly. Only the save dialog and the conversion itself
// are unreachable from a unit test; neither decides what the user is told.
const { handlers, showSaveDialog, fromWebContents, toFile, getPandocLanguage, getPandocReader, prefGet, sent } =
  vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    showSaveDialog: vi.fn(),
    fromWebContents: vi.fn(),
    toFile: vi.fn(),
    // Stands in for the preferences store: the handler reads the docx template
    // choice (and everything else) through `getUserPreference().getItem`.
    prefGet: vi.fn(),
    // Stands in for the real mapper; `pandoc-export.spec.ts` asserts what it
    // maps, this file only asserts that the locale goes through it.
    getPandocLanguage: vi.fn((locale: string) => locale),
    // Stands in for the real reader builder for the same reason; this file only
    // asserts which preferences the handler consults.
    getPandocReader: vi.fn(() => 'gfm'),
    sent: [] as Array<{ channel: string, payload: Record<string, unknown> }>
  }))

vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener)
    },
    handle: () => {},
    emit: () => {}
  },
  dialog: { showSaveDialog },
  BrowserWindow: { fromWebContents, getAllWindows: () => [] },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  app: { getPath: () => '/tmp', getVersion: () => '0.0.0', getLocale: () => 'en-US' }
}))

vi.mock('electron-log', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('electron-updater', () => ({ autoUpdater: { on: vi.fn(), checkForUpdates: vi.fn() } }))
// `main/filesystem` reaches the native `ced` addon, whose bindings are built for
// Electron's ABI rather than the Node running the tests (see
// watcher-await-write-finish.spec.ts). Nothing here guesses an encoding.
vi.mock('ced', () => ({ default: () => 'UTF-8' }))

// Return the key instead of the text loaded off disk: the assertions are about
// which message the handler asks for, and key parity across locales is enforced
// separately by locale-validation.spec.ts.
vi.mock('main_renderer/i18n', () => ({
  t: (key: string, params?: { count?: number }) =>
    params?.count === undefined ? key : `${key}#${params.count}`
}))

vi.mock('main_renderer/app/userPreference', () => ({
  getUserPreference: () => ({ getItem: prefGet })
}))

vi.mock('main_renderer/utils/pandoc', () => ({
  default: { toFile },
  PANDOC_EXPORT_FORMATS: [{ id: 'docx', label: 'Word', target: 'docx', extension: '.docx' }],
  getPandocReader,
  getPandocLanguage
}))

await import('main_renderer/menu/actions/file')

const FAKE_WIN = {
  id: 1,
  // The window can be closed while a conversion is running, and every send has
  // to survive that.
  isDestroyed: () => false,
  webContents: {
    send: (channel: string, payload: Record<string, unknown>) => {
      sent.push({ channel, payload })
    }
  }
}
const fakeEvent = { sender: {} } as never

const EXPORT_PAYLOAD = {
  target: 'docx',
  markdown: '# Notes',
  title: 'Notes',
  pathname: '/docs/notes.md',
  superSubScript: false
}

const exportWith = async(payload: Record<string, unknown> = EXPORT_PAYLOAD): Promise<void> => {
  // The module registered this once, at import — the map must not be cleared
  // between tests or the handler goes with it.
  const handler = handlers.get('mt::response-pandoc-export')
  if (!handler) throw new Error('mt::response-pandoc-export handler was not registered')
  await handler(fakeEvent, payload)
}

const optionsOfExport = (): Record<string, unknown> => {
  const call = toFile.mock.calls[0] as [string, string, string, Record<string, unknown>]
  if (!call) throw new Error('pandoc was never asked to convert anything')
  return call[3]
}

const notification = (): { title: string, type: string, message: string } => {
  const entry = sent.find((s) => s.channel === 'mt::show-notification')
  if (!entry) throw new Error('no notification was sent')
  return entry.payload as { title: string, type: string, message: string }
}

const warningLines = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `[WARNING] Could not fetch resource pics/${i}.png`)

describe('mt::response-pandoc-export notifications', () => {
  beforeEach(() => {
    sent.length = 0
    showSaveDialog.mockReset()
    fromWebContents.mockReset()
    toFile.mockReset()
    prefGet.mockReset()

    showSaveDialog.mockResolvedValue({ filePath: '/docs/notes.docx', canceled: false })
    fromWebContents.mockReturnValue(FAKE_WIN)
    toFile.mockResolvedValue({ warnings: '' })
  })

  it('stays quiet when pandoc exits cleanly', async() => {
    await exportWith()

    expect(sent.map((s) => s.channel)).toEqual(['mt::export-success'])
  })

  // A stderr holding only a line break is truthy but summarizes to nothing; an
  // empty toast over a successful export would be worse than no toast.
  it('stays quiet when stderr holds nothing but whitespace', async() => {
    toFile.mockResolvedValue({ warnings: '\r\n\n' })

    await exportWith()

    expect(sent.map((s) => s.channel)).toEqual(['mt::export-success'])
  })

  // pandoc warns per unresolved link and still exits 0, so a document with a
  // dozen bad image paths would otherwise push a dozen-line toast over the
  // editor — the notification has no height cap.
  it('lists the first warnings and counts the ones it dropped', async() => {
    toFile.mockResolvedValue({ warnings: warningLines(12).join('\n') })

    await exportWith()

    const { type, message } = notification()
    expect(type).toBe('warning')
    expect(message.split('<br>')).toEqual([
      ...warningLines(5),
      'dialog.exportWarningMore#7'
    ])
  })

  it('breaks short warning lists into readable lines', async() => {
    toFile.mockResolvedValue({ warnings: warningLines(2).join('\n') })

    await exportWith()

    expect(notification().message).toBe(warningLines(2).join('<br>'))
  })

  // The success notice is a confirm whose click opens the file manager, so a
  // warning sent after it arrives behind a notice the user is already
  // dismissing (#5379 review).
  it('warns about dropped images before announcing success', async() => {
    toFile.mockResolvedValue({ warnings: warningLines(1).join('\n') })

    await exportWith()

    expect(sent.map((s) => s.channel)).toEqual(['mt::show-notification', 'mt::export-success'])
  })

  // `services/notification` assigns the body to `innerHTML`, so markup in it
  // renders. DOMPurify sanitizes on the way in but keeps character references
  // as-is, which means escaping has to happen here in main — and the paths
  // pandoc quotes back come straight from the document.
  // pandoc has no translation file for `zh-CN` (it carries `zh-Hans`/`zh-Hant`),
  // so a zh-CN UI was told "Could not load translations for zh-CN" over an EPUB
  // that came out correctly. The warning, the data file path it echoes back on
  // the next line and the follow-up about the untranslated term all describe
  // pandoc's own installation, and a stderr holding nothing else must not raise
  // a toast at all (#5379 review).
  it('drops pandoc complaints about its own translation data files', async() => {
    toFile.mockResolvedValue({
      warnings: [
        '[WARNING] Could not load translations for zh-CN',
        '  translations/zh.yaml: ',
        '[WARNING] The term Abstract has no translation defined.'
      ].join('\n')
    })

    await exportWith()

    expect(sent.map((s) => s.channel)).toEqual(['mt::export-success'])
  })

  it('keeps the warnings that sit beside them', async() => {
    toFile.mockResolvedValue({
      warnings: [
        '[WARNING] Could not load translations for zh-CN',
        '  translations/zh.yaml: ',
        '[WARNING] The term Abstract has no translation defined.',
        ...warningLines(1)
      ].join('\n')
    })

    await exportWith()

    expect(notification().message).toBe(warningLines(1)[0])
  })

  it('escapes HTML pandoc echoed from the document', async() => {
    toFile.mockResolvedValue({
      warnings: '[WARNING] Could not fetch resource pics/<b>a</b>.png: replacing image with description'
    })

    await exportWith()

    const { message } = notification()
    expect(message).toContain('&lt;b&gt;a&lt;/b&gt;')
    expect(message).not.toContain('<b>a</b>')
  })

  it('escapes the failure text as well', async() => {
    toFile.mockRejectedValue(new Error('pandoc: <script>alert(1)</script> is not a valid target'))

    await exportWith()

    const { type, message } = notification()
    expect(type).toBe('error')
    expect(message).toContain('&lt;script&gt;')
    expect(message).not.toContain('<script>')
  })

  // pandoc reports a failure as "pandoc: …" with the source position on the next
  // line, and the body is HTML: escaping alone left the reader with one run-on
  // line and no cap (#5379 review).
  it('breaks a multi-line pandoc failure into readable lines', async() => {
    toFile.mockRejectedValue(new Error('pandoc: \nError at "source" (line 12, column 3): boom'))

    await exportWith()

    expect(notification().message).toBe('pandoc:<br>Error at "source" (line 12, column 3): boom')
  })

  it('caps a long failure the same way as the warnings', async() => {
    toFile.mockRejectedValue(new Error(warningLines(9).join('\n')))

    await exportWith()

    expect(notification().message.split('<br>')).toEqual([
      ...warningLines(5),
      'dialog.exportWarningMore#4'
    ])
  })
})

// A standalone document needs a title and the document arrives on stdin, so
// pandoc has no file name to take one from: the EPUB went out without
// `<dc:title>` and every export printed a `[WARNING]` that this feature showed
// as an export warning (#5379 review).
describe('mt::response-pandoc-export metadata', () => {
  beforeEach(() => {
    sent.length = 0
    showSaveDialog.mockReset()
    fromWebContents.mockReset()
    toFile.mockReset()
    getPandocLanguage.mockClear()
    getPandocReader.mockClear()
    prefGet.mockReset()

    showSaveDialog.mockResolvedValue({ filePath: '/docs/notes.docx', canceled: false })
    fromWebContents.mockReturnValue(FAKE_WIN)
    toFile.mockResolvedValue({ warnings: '' })
  })

  it('passes the document title and the app locale to pandoc', async() => {
    await exportWith()

    expect(optionsOfExport().metadata).toEqual({ title: 'Notes', lang: 'en-US' })
    // Through the mapper: pandoc files Chinese under a script subtag, so the
    // locale cannot go straight to `--metadata lang` (#5379 review).
    expect(getPandocLanguage).toHaveBeenCalledWith('en-US')
    // The reader is built from the editor's toggles: no sub/superscript in the
    // payload and no preference store here, so footnotes must come out disabled
    // — plain `gfm` would parse the `[^1]` the editor shows as literal text.
    expect(getPandocReader).toHaveBeenCalledWith(false, false)
  })

  it('falls back to the file name for a document without a heading', async() => {
    await exportWith({ ...EXPORT_PAYLOAD, title: '' })

    expect(optionsOfExport().metadata).toEqual({ title: 'notes', lang: 'en-US' })
  })
})

// The window can be closed at any point: while the save dialog is up, or while
// pandoc works through a document whose remote images time out one by one.
describe('mt::response-pandoc-export without a window', () => {
  beforeEach(() => {
    sent.length = 0
    showSaveDialog.mockReset()
    fromWebContents.mockReset()
    toFile.mockReset()

    showSaveDialog.mockResolvedValue({ filePath: '/docs/notes.docx', canceled: false })
    toFile.mockResolvedValue({ warnings: '' })
  })

  it('does not start a conversion for a window closed while the dialog was open', async() => {
    fromWebContents.mockReturnValue({ ...FAKE_WIN, isDestroyed: () => true })

    await expect(exportWith()).resolves.toBeUndefined()

    expect(toFile).not.toHaveBeenCalled()
    expect(sent).toEqual([])
  })

  // `webContents.send` on a destroyed window throws "Object has been
  // destroyed", which the handler's own catch would turn into a second throw.
  it('drops the notification when the window dies during the conversion', async() => {
    let destroyed = false
    fromWebContents.mockReturnValue({ ...FAKE_WIN, isDestroyed: () => destroyed })
    toFile.mockImplementation(async() => {
      destroyed = true
      return { warnings: warningLines(1).join('\n') }
    })

    await expect(exportWith()).resolves.toBeUndefined()

    expect(sent).toEqual([])
  })
})

// The docx template choice maps onto two states of `--reference-doc`: the
// bundled editor-like template is signalled by *withholding* the option (that
// is what makes `pandoc.toFile` inject `static/pandoc-reference.docx`), while
// an explicit empty string is what holds pandoc's built-in styling back.
describe('mt::response-pandoc-export docx template choice', () => {
  beforeEach(() => {
    sent.length = 0
    showSaveDialog.mockReset()
    fromWebContents.mockReset()
    toFile.mockReset()
    prefGet.mockReset()

    showSaveDialog.mockResolvedValue({ filePath: '/docs/notes.docx', canceled: false })
    fromWebContents.mockReturnValue(FAKE_WIN)
    toFile.mockResolvedValue({ warnings: '' })
  })

  it('keeps pandoc\'s default when the choice says so', async() => {
    prefGet.mockImplementation((key: string) =>
      key === 'pandocDocxTemplate' ? 'default' : undefined
    )

    await exportWith()

    expect(optionsOfExport().referenceDoc).toBe('')
  })

  it('withholds the template so the bundled one rides along', async() => {
    prefGet.mockImplementation((key: string) =>
      key === 'pandocDocxTemplate' ? 'wysiwyg' : undefined
    )

    await exportWith()

    expect(optionsOfExport().referenceDoc).toBeUndefined()
  })

  it('passes the custom template through', async() => {
    prefGet.mockImplementation((key: string) =>
      key === 'pandocDocxTemplate'
        ? 'custom'
        : key === 'pandocReferenceDoc'
          ? ' /mine/thesis.docx '
          : undefined
    )

    await exportWith()

    expect(optionsOfExport().referenceDoc).toBe('/mine/thesis.docx')
  })

  it('treats an untouched preference as pandoc\'s default', async() => {
    await exportWith()

    expect(optionsOfExport().referenceDoc).toBe('')
  })
})
