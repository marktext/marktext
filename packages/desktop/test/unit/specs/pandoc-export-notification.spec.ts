import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PandocUtils from 'main_renderer/utils/pandoc'

// `menu/actions/file.ts` registers on `ipcMain` at load, so the handler is driven here.
const { handlers, showSaveDialog, fromWebContents, toFile, listLinkedMedia, sent } = vi.hoisted(
  () => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    showSaveDialog: vi.fn(),
    fromWebContents: vi.fn(),
    toFile: vi.fn(),
    listLinkedMedia: vi.fn(),
    sent: [] as Array<{ channel: string, payload: Record<string, unknown> }>
  })
)

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
// `main/filesystem` reaches the native `ced` addon, built for Electron's ABI, not this Node.
vi.mock('ced', () => ({ default: () => 'UTF-8' }))

// The key instead of the text off disk: the assertions are about the message asked for.
vi.mock('main_renderer/i18n', () => ({
  t: (key: string, params?: Record<string, number | string>) =>
    params ? `${key}#${Object.values(params).join(',')}` : key,
  getCurrentLanguage: () => 'en'
}))

vi.mock('main_renderer/utils/pandoc', async(importOriginal) => {
  // The mirror rule is kept as the real one: it is part of what this spec pins.
  const actual = await importOriginal<typeof PandocUtils>()
  return {
    default: { toFile },
    PANDOC_EXPORT_FORMATS: [
      { id: 'docx', label: 'Word', target: 'docx', extension: '.docx' },
      { id: 'epub', label: 'EPUB', target: 'epub3', extension: '.epub' },
      { id: 'rst', label: 'RST', target: 'rst', extension: '.rst' }
    ],
    getPandocReader: () => 'gfm',
    getPandocLanguage: (locale: string) => locale,
    formatLinksMedia: (target: string) => target === 'rst',
    listLinkedMedia,
    shouldMirrorMedia: actual.shouldMirrorMedia
  }
})

await import('main_renderer/menu/actions/file')

const FAKE_WIN = {
  id: 1,
  isDestroyed: () => false,
  webContents: {
    send: (channel: string, payload: Record<string, unknown>) => {
      sent.push({ channel, payload })
    }
  }
}

const EXPORT_PAYLOAD = {
  target: 'docx',
  markdown: '# Notes',
  title: 'Notes',
  pathname: '/docs/notes.md',
  superSubScript: false,
  footnote: false
}

const exportWith = async(
  target = 'docx',
  payload: Partial<typeof EXPORT_PAYLOAD> = {}
): Promise<void> => {
  const handler = handlers.get('mt::response-pandoc-export')
  if (!handler) throw new Error('mt::response-pandoc-export handler was not registered')
  await handler({ sender: {} } as never, { ...EXPORT_PAYLOAD, ...payload, target })
}

const channelsSent = (): string[] => sent.map((s) => s.channel)

const notification = (): { title: string, type: string, message: string } => {
  const entry = sent.find((s) => s.channel === 'mt::show-notification')
  if (!entry) throw new Error('no notification was sent')
  return entry.payload as { title: string, type: string, message: string }
}

const optionsOfLastExport = (): Record<string, unknown> =>
  toFile.mock.calls.at(-1)?.[3] as Record<string, unknown>

const metadataOfLastExport = (): Record<string, string> =>
  optionsOfLastExport().metadata as Record<string, string>

const warningLines = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `[WARNING] Could not fetch resource pics/${i}.png`)

describe('mt::response-pandoc-export notifications', () => {
  beforeEach(() => {
    sent.length = 0
    showSaveDialog.mockReset()
    fromWebContents.mockReset()
    toFile.mockReset()
    listLinkedMedia.mockReset()
    listLinkedMedia.mockResolvedValue([])

    showSaveDialog.mockResolvedValue({ filePath: '/out/notes.docx', canceled: false })
    fromWebContents.mockReturnValue(FAKE_WIN)
    toFile.mockResolvedValue({ warnings: '' })
  })

  // A line break alone is truthy yet summarizes to nothing; warnings go first (#5379).
  it('stays quiet when there is nothing to report, and warns before the success notice', async() => {
    await exportWith()
    expect(channelsSent()).toEqual(['mt::export-success'])

    sent.length = 0
    toFile.mockResolvedValue({ warnings: '\r\n\n' })
    await exportWith()
    expect(channelsSent()).toEqual(['mt::export-success'])

    sent.length = 0
    toFile.mockResolvedValue({ warnings: warningLines(1).join('\n') })
    await exportWith()
    expect(channelsSent()).toEqual(['mt::show-notification', 'mt::export-success'])
  })

  // pandoc warns per unresolved link and the notification has no height cap.
  it('lists the first warnings, counts the rest and breaks them into lines', async() => {
    toFile.mockResolvedValue({ warnings: warningLines(12).join('\n') })
    await exportWith()

    const { type, message } = notification()
    expect(type).toBe('warning')
    expect(message.split('<br>')).toEqual([...warningLines(5), 'dialog.exportWarningMore#7'])

    sent.length = 0
    toFile.mockResolvedValue({ warnings: warningLines(2).join('\n') })
    await exportWith()
    expect(notification().message).toBe(warningLines(2).join('<br>'))
  })

  // The body is `innerHTML` and DOMPurify keeps references, so escaping happens in main.
  it('escapes the HTML pandoc echoes back, and titles a failure as a failure', async() => {
    toFile.mockResolvedValue({
      warnings: '[WARNING] Could not fetch resource pics/<b>a</b>.png: replacing image with description'
    })
    await exportWith()

    const warned = notification().message
    expect(warned).toContain('&lt;b&gt;a&lt;/b&gt;')
    expect(warned).not.toContain('<b>a</b>')

    sent.length = 0
    toFile.mockRejectedValue(new Error('pandoc: <script>alert(1)</script> is not a valid target'))
    await exportWith()

    const failure = notification()
    expect(failure.title).toBe('editor.export.failed#Word')
    expect(failure.type).toBe('error')
    expect(failure.message).toContain('&lt;script&gt;')
    expect(failure.message).not.toContain('<script>')

    sent.length = 0
    toFile.mockRejectedValue(new Error('\r\n  '))
    await exportWith()

    expect(notification().message.length).toBeGreaterThan(0)
  })

  // The images stay links whether or not they were copied: the answer is the format (#5379).
  it('marks the formats that keep images as links', async() => {
    await exportWith('rst')
    expect(sent.find((s) => s.channel === 'mt::export-success')?.payload.linksMedia).toBe(true)

    sent.length = 0
    await exportWith('docx')
    expect(sent.find((s) => s.channel === 'mt::export-success')?.payload.linksMedia).toBe(false)
  })

  // A mirrored picture is one pandoc reads from disk, and a failed download costs one.
  it('mirrors the pictures unless the document also links remote media', async() => {
    await exportWith('rst')
    expect(optionsOfLastExport()).toMatchObject({ mirrorMedia: true, resourcePath: '/docs' })

    listLinkedMedia.mockResolvedValue(['pics/a.png', 'https://example.com/b.png'])
    await exportWith('rst')
    expect(optionsOfLastExport()).toMatchObject({ mirrorMedia: false })

    listLinkedMedia.mockResolvedValue(['pics/a.png'])
    await exportWith('docx')
    expect(optionsOfLastExport()).toMatchObject({ mirrorMedia: false })
  })

  // A never-saved document has no folder for `pics/a.png`, and a mirrored link is rewritten to
  // a file pandoc never found: the picture becomes its alt text, where the link would survive.
  it('leaves the links of a never-saved document alone, mirroring the absolute ones', async() => {
    listLinkedMedia.mockResolvedValue(['pics/a.png'])
    await exportWith('rst', { pathname: '' })
    expect(optionsOfLastExport()).toMatchObject({ mirrorMedia: false })

    listLinkedMedia.mockResolvedValue([path.resolve('/docs/pics/a.png')])
    await exportWith('rst', { pathname: '' })
    expect(optionsOfLastExport()).toMatchObject({ mirrorMedia: true })
  })

  // EPUB takes `title` for its title page; `lang` must be the app's, not the spawn locale.
  it('gives EPUB the title metadata and passes the app language', async() => {
    await exportWith('epub')
    expect(metadataOfLastExport()).toMatchObject({ title: 'Notes', lang: 'en' })

    toFile.mockClear()
    await exportWith('docx')
    expect(metadataOfLastExport()).not.toHaveProperty('title')
    expect(metadataOfLastExport().lang).toBe('en')
  })
})
