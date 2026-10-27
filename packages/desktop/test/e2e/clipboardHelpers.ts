import type { ElectronApplication } from 'playwright'

type ClipboardSnapshot = Array<Record<string, Blob | Electron.ClipboardBookmark>>

export const backupClipboard = (app: ElectronApplication): Promise<void> =>
  app.evaluate(async({ clipboard }) => {
    const state = globalThis as typeof globalThis & { clipboardBackup?: ClipboardSnapshot }
    const items = await clipboard.read()
    state.clipboardBackup = []
    for (const item of items) {
      const data: ClipboardSnapshot[number] = {}
      for (const type of item.types) data[type] = await item.getType(type)
      state.clipboardBackup.push(data)
    }
  })

export const restoreClipboard = (app: ElectronApplication): Promise<void> =>
  app.evaluate(async({ clipboard, ClipboardItem }) => {
    const state = globalThis as typeof globalThis & { clipboardBackup?: ClipboardSnapshot }
    const items = state.clipboardBackup ?? []
    if (items.length) {
      await clipboard.write(items.map((data) => new ClipboardItem(data)))
    } else {
      clipboard.clear()
    }
    delete state.clipboardBackup
  })

export const readClipboardState = (app: ElectronApplication) =>
  app.evaluate(async({ clipboard, nativeImage }) => {
    const items = await clipboard.read()
    const png = items.find((item) => item.types.includes('image/png'))
    const html = items.find((item) => item.types.includes('text/html'))
    const image = png
      ? nativeImage.createFromBuffer(
        Buffer.from(await (await png.getType('image/png')).arrayBuffer())
      )
      : nativeImage.createEmpty()
    const bitmap = image.toBitmap()
    return {
      text: await clipboard.readText(),
      html: html ? await (await html.getType('text/html')).text() : '',
      formats: items.flatMap((item) => item.types),
      size: image.getSize(),
      firstAlpha: bitmap[3],
      lastAlpha: bitmap[bitmap.length - 1]
    }
  })
