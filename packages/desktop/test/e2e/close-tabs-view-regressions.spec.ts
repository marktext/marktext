import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import type * as FileSystem from 'node:fs'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  ApplicationState,
  WindowCheckpointRequest
} from '../../src/shared/types/applicationState'
import { launchElectron, makeRoomForOutline, sendIpcToRenderer } from './helpers'

let directory: string
let profile: string
let running: ElectronApplication | null = null
test.beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mt-close-view-race-'))
  profile = join(directory, 'profile')
})
test.afterEach(async() => {
  if (running) await running.close()
  running = null
  rmSync(directory, { recursive: true, force: true })
})
const state = (): ApplicationState =>
  JSON.parse(readFileSync(join(profile, 'state', 'application-state.json'), 'utf8'))
const launch = async(firstText: string, secondText: string) => {
  const first = join(directory, 'first.md')
  const second = join(directory, 'second.md')
  writeFileSync(first, firstText)
  writeFileSync(second, secondText)
  const launched = await launchElectron([first, second], {
    userDataDir: profile,
    preferences: { language: 'en', autoSave: false, openFilesInNewWindow: false },
    suppressErrorDialog: true
  })
  running = launched.app
  await expect(launched.page.locator('.tabs-container > li')).toHaveCount(2)
  return launched
}

for (const dirty of [false, true]) {
  for (const stage of ['recovery', 'metadata'] as const) {
    test(`batch close preserves edits received during ${stage} IO (dirty=${dirty})`, async() => {
      const { app, page } = await launch('First clean file', 'Second clean file')
      await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 1)
      if (dirty) {
        await page
          .getByRole('textbox', { name: 'Document', exact: true })
          .fill('Approved earlier draft')
        await expect
          .poll(() => state().session.windows[0].documents[1].content.kind)
          .toBe('recovery')
      }
      const before = state().session.windows[0]
      const firstId = before.documents[0].id
      const secondId = before.documents[1].id
      await app.evaluate(
        ({ ipcMain, dialog }, { firstId, secondId, windowId, stage }) => {
          const audit = globalThis as unknown as {
            held: boolean
            received: boolean
            release: () => void
          }
          audit.held = false
          audit.received = false
          dialog.showMessageBox = async() => ({ response: 1, checkboxChecked: false })
          const filesystem = process.getBuiltinModule('fs') as typeof FileSystem
          const rename = filesystem.rename
          filesystem.rename = ((source, target, callback) => {
            let closingTarget = false
            if (stage === 'recovery' && String(target).endsWith(`${firstId}.json`))
              closingTarget =
                JSON.parse(filesystem.readFileSync(source, 'utf8')).status === 'discarded'
            if (stage === 'metadata' && String(target).endsWith('application-state.json')) {
              const candidate = JSON.parse(
                filesystem.readFileSync(source, 'utf8')
              ) as ApplicationState
              const window = candidate.session.windows.find((entry) => entry.id === windowId)
              closingTarget =
                !!window && !window.documents.some((document) => document.id === firstId)
            }
            if (!audit.held && closingTarget) {
              audit.held = true
              audit.release = () => rename(source, target, callback)
              return
            }
            rename(source, target, callback)
          }) as typeof rename
          const handlers = (
            ipcMain as unknown as {
              _invokeHandlers: Map<string, (...args: unknown[]) => Promise<unknown>>
            }
          )._invokeHandlers
          const checkpoint = handlers.get('mt::state::checkpoint')
          if (!checkpoint) throw new Error('Missing checkpoint handler')
          handlers.set('mt::state::checkpoint', (...args) => {
            const request = args[1] as WindowCheckpointRequest
            if (
              request.dirtyContents.some(
                (update) =>
                  update.documentId === secondId &&
                  update.markdown.includes('New draft during close')
              )
            )
              audit.received = true
            return checkpoint(...args)
          })
        },
        { firstId, secondId, windowId: before.id, stage }
      )
      await page.evaluate(() => {
        const root = document.querySelector('#app') as Element & {
          __vue_app__: {
            config: {
              globalProperties: { $pinia: { _s: Map<string, { CLOSE_ALL_TABS(): void }> } }
            }
          }
        }
        root.__vue_app__.config.globalProperties.$pinia._s.get('editor')?.CLOSE_ALL_TABS()
      })
      await expect
        .poll(() => app.evaluate(() => (globalThis as unknown as { held: boolean }).held))
        .toBe(true)
      await page
        .getByRole('textbox', { name: 'Document', exact: true })
        .fill('New draft during close')
      await expect
        .poll(() => app.evaluate(() => (globalThis as unknown as { received: boolean }).received))
        .toBe(true)
      await app.evaluate(() => (globalThis as unknown as { release: () => void }).release())
      await expect
        .poll(() => {
          try {
            return JSON.parse(
              readFileSync(join(profile, 'recovery', before.id, `${secondId}.json`), 'utf8')
            ).markdown?.trim()
          } catch {
            return null
          }
        })
        .toBe('New draft during close')
      await expect
        .poll(
          () =>
            state().session.windows[0].documents.find((document) => document.id === secondId)
              ?.content.kind
        )
        .toBe('recovery')
      expect(state().session.windows[0].documents.map((document) => document.id)).toEqual([
        firstId,
        secondId
      ])
      await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
        'New draft during close'
      )
      const body = JSON.parse(
        readFileSync(join(profile, 'recovery', before.id, `${secondId}.json`), 'utf8')
      )
      expect(body.status).toBe('dirty')
      expect(body.markdown).toContain('New draft during close')
    })
  }
}

test('interaction while restore hashing is delayed preserves current outline folds', async() => {
  const markdown = '# A\n\n## B\n\n### Child\n\n## C\n'
  const { app, page } = await launch(markdown, '# Other file\n')
  await makeRoomForOutline(app, page)
  await expect(page.locator('.side-bar-toc .el-tree-node__label:visible')).toHaveText([
    'A',
    'B',
    'Child',
    'C'
  ])
  await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 1)
  await expect(page.locator('.side-bar-toc .el-tree-node__label:visible')).toHaveText([
    'Other file'
  ])
  await page.evaluate((markdown) => {
    const audit = window as unknown as { held: boolean; release: () => void; finished: boolean }
    audit.held = false
    audit.finished = false
    const digest = window.crypto.subtle.digest.bind(window.crypto.subtle)
    window.crypto.subtle.digest = async(algorithm, data) => {
      const input = new TextDecoder().decode(data as ArrayBuffer)
      if (!audit.held && input.trim() === markdown.trim()) {
        audit.held = true
        await new Promise<void>((resolve) => {
          audit.release = resolve
        })
        const result = await digest(algorithm, data)
        audit.finished = true
        return result
      }
      return digest(algorithm, data)
    }
  }, markdown)
  await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { held: boolean }).held))
    .toBe(true)
  const content = page
    .locator('.side-bar-toc .el-tree-node__content')
    .filter({ has: page.locator('.el-tree-node__label', { hasText: /^B$/ }) })
  await content.locator(':scope > .el-tree-node__expand-icon').click()
  await expect(page.locator('.side-bar-toc .el-tree-node__label:visible')).toHaveText([
    'A',
    'B',
    'C'
  ])
  await page.evaluate(() => (window as unknown as { release: () => void }).release())
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { finished: boolean }).finished))
    .toBe(true)
  await expect
    .poll(() => state().session.windows[0].documents[0].view?.collapsedOutlineKeys.length)
    .toBe(1)
  await expect(page.locator('.side-bar-toc .el-tree-node__label:visible')).toHaveText([
    'A',
    'B',
    'C'
  ])
})
