import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'

// End-to-end smoke for the streaming ripgrep IPC (mt::rg::start /
// mt::rg::match / mt::rg::done). Writes a small fixture tree, drives the
// search directly through window.ripgrep so we don't depend on the sidebar
// being open + focused, and asserts results stream back to the renderer.

const writeFixtureTree = (): string => {
  const dir = path.join(os.tmpdir(), 'mt-rg-' + Math.random().toString(36).slice(2, 8))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'one.md'), '# Hello\n\nmagic-needle-XYZ in body.\n')
  fs.writeFileSync(path.join(dir, 'two.md'), '# Other\n\nnothing here.\n')
  fs.writeFileSync(path.join(dir, 'three.md'), '# Third\nanother magic-needle-XYZ.\n')
  return dir
}

test.describe('Ripgrep IPC streaming', () => {
  let app: ElectronApplication
  let page: Page
  let fixtureDir: string | null = null

  test.beforeAll(async() => {
    fixtureDir = writeFixtureTree()
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close().catch(() => {})
    if (fixtureDir) {
      try {
        fs.rmSync(fixtureDir, { recursive: true, force: true })
      } catch {}
    }
  })

  test('text search streams matches and resolves', async() => {
    interface RgMatch {
      filePath: string
    }
    const matches = await page.evaluate<RgMatch[], string>((directory) => {
      return new Promise<RgMatch[]>((resolve, reject) => {
        const searchId = 'rg-test-' + Math.random().toString(36).slice(2, 8)
        const captured: RgMatch[] = []
        const offMatch = window.ripgrep.onMatch((raw) => {
          const p = raw as { searchId?: string; payload?: RgMatch }
          if (p?.searchId === searchId && p.payload) captured.push(p.payload)
        })
        const cleanup = () => offMatch()
        const offDone = window.ripgrep.onDone((raw) => {
          const p = raw as { searchId?: string }
          if (p?.searchId !== searchId) return
          cleanup()
          offDone()
          offError()
          resolve(captured)
        })
        const offError = window.ripgrep.onError((raw) => {
          const p = raw as { searchId?: string; error?: string }
          if (p?.searchId !== searchId) return
          cleanup()
          offDone()
          offError()
          reject(new Error(p.error))
        })
        window.ripgrep
          .start({
            searchId,
            mode: 'text',
            directories: [directory],
            pattern: 'magic-needle-XYZ',
            options: { isCaseSensitive: true, inclusions: ['*.md'], exclusions: [] }
          })
          .catch(reject)
      })
    }, fixtureDir as string)

    expect(matches.length).toBeGreaterThanOrEqual(2)
    const paths = matches.map((m) => m.filePath).sort()
    expect(paths.some((p) => p.endsWith('one.md'))).toBe(true)
    expect(paths.some((p) => p.endsWith('three.md'))).toBe(true)
  })

  test('file search (--files) streams paths', async() => {
    const files = await page.evaluate<string[], string>((directory) => {
      return new Promise<string[]>((resolve, reject) => {
        const searchId = 'fs-test-' + Math.random().toString(36).slice(2, 8)
        const seen: string[] = []
        const offMatch = window.ripgrep.onMatch((raw) => {
          const p = raw as { searchId?: string; payload?: unknown }
          if (p?.searchId === searchId && typeof p.payload === 'string') seen.push(p.payload)
        })
        const offDone = window.ripgrep.onDone((raw) => {
          const p = raw as { searchId?: string }
          if (p?.searchId !== searchId) return
          offMatch()
          offDone()
          offError()
          resolve(seen)
        })
        const offError = window.ripgrep.onError((raw) => {
          const p = raw as { searchId?: string; error?: string }
          if (p?.searchId !== searchId) return
          offMatch()
          offDone()
          offError()
          reject(new Error(p.error))
        })
        window.ripgrep
          .start({
            searchId,
            mode: 'files',
            directories: [directory],
            pattern: '',
            options: { inclusions: ['*.md'], exclusions: [] }
          })
          .catch(reject)
      })
    }, fixtureDir as string)

    expect(files.length).toBeGreaterThanOrEqual(3)
  })
})
