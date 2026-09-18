import { beforeEach, describe, expect, it, vi } from 'vitest'

// `menu/actions/file.ts` registers itself on `ipcMain` at module load, so the
// Electron, log, i18n and pandoc surfaces are stubbed and the registered
// handler is driven directly. Only the save dialog and the conversion itself
// are unreachable from a unit test; neither decides what the user is told.
const { handlers, showSaveDialog, fromWebContents, toFile, sent } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  showSaveDialog: vi.fn(),
  fromWebContents: vi.fn(),
  toFile: vi.fn(),
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
  app: { getPath: () => '/tmp', getVersion: () => '0.0.0' }
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

vi.mock('main_renderer/utils/pandoc', () => ({
  default: { toFile },
  PANDOC_EXPORT_FORMATS: [{ id: 'docx', label: 'Word', target: 'docx', extension: '.docx' }],
  getPandocReader: () => 'gfm'
}))

await import('main_renderer/menu/actions/file')

const FAKE_WIN = {
  id: 1,
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

const exportWith = async(): Promise<void> => {
  // The module registered this once, at import — the map must not be cleared
  // between tests or the handler goes with it.
  const handler = handlers.get('mt::response-pandoc-export')
  if (!handler) throw new Error('mt::response-pandoc-export handler was not registered')
  await handler(fakeEvent, EXPORT_PAYLOAD)
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

  // `services/notification` assigns the body to `innerHTML`, so markup in it
  // renders. DOMPurify sanitizes on the way in but keeps character references
  // as-is, which means escaping has to happen here in main — and the paths
  // pandoc quotes back come straight from the document.
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
})
