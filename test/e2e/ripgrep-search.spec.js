const fs = require('fs')
const os = require('os')
const path = require('path')
const { expect, test } = require('@playwright/test')
const { launchElectron } = require('./helpers')

// End-to-end smoke for the streaming ripgrep IPC (mt::rg::start /
// mt::rg::match / mt::rg::done). Writes a small fixture tree, drives the
// search directly through window.ripgrep so we don't depend on the sidebar
// being open + focused, and asserts results stream back to the renderer.

const writeFixtureTree = () => {
  const dir = path.join(os.tmpdir(), 'mt-rg-' + Math.random().toString(36).slice(2, 8))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'one.md'), '# Hello\n\nmagic-needle-XYZ in body.\n')
  fs.writeFileSync(path.join(dir, 'two.md'), '# Other\n\nnothing here.\n')
  fs.writeFileSync(path.join(dir, 'three.md'), '# Third\nanother magic-needle-XYZ.\n')
  return dir
}

test.describe('Ripgrep IPC streaming', () => {
  let app = null
  let page = null
  let fixtureDir = null

  test.beforeAll(async() => {
    fixtureDir = writeFixtureTree()
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close().catch(() => {})
    if (fixtureDir) try { fs.rmSync(fixtureDir, { recursive: true, force: true }) } catch {}
  })

  test('text search streams matches and resolves', async() => {
    const matches = await page.evaluate((directory) => {
      return new Promise((resolve, reject) => {
        const searchId = 'rg-test-' + Math.random().toString(36).slice(2, 8)
        const captured = []
        const offMatch = window.ripgrep.onMatch((p) => {
          if (p?.searchId === searchId) captured.push(p.payload)
        })
        const cleanup = () => offMatch()
        const offDone = window.ripgrep.onDone((p) => {
          if (p?.searchId !== searchId) return
          cleanup(); offDone(); offError()
          resolve(captured)
        })
        const offError = window.ripgrep.onError((p) => {
          if (p?.searchId !== searchId) return
          cleanup(); offDone(); offError()
          reject(new Error(p.error))
        })
        window.ripgrep.start({
          searchId,
          mode: 'text',
          directories: [directory],
          pattern: 'magic-needle-XYZ',
          options: { isCaseSensitive: true, inclusions: ['*.md'], exclusions: [] }
        }).catch(reject)
      })
    }, fixtureDir)

    expect(matches.length).toBeGreaterThanOrEqual(2)
    const paths = matches.map((m) => m.filePath).sort()
    expect(paths.some((p) => p.endsWith('one.md'))).toBe(true)
    expect(paths.some((p) => p.endsWith('three.md'))).toBe(true)
  })

  test('file search (--files) streams paths', async() => {
    const files = await page.evaluate((directory) => {
      return new Promise((resolve, reject) => {
        const searchId = 'fs-test-' + Math.random().toString(36).slice(2, 8)
        const seen = []
        const offMatch = window.ripgrep.onMatch((p) => {
          if (p?.searchId === searchId && typeof p.payload === 'string') seen.push(p.payload)
        })
        const offDone = window.ripgrep.onDone((p) => {
          if (p?.searchId !== searchId) return
          offMatch(); offDone(); offError()
          resolve(seen)
        })
        const offError = window.ripgrep.onError((p) => {
          if (p?.searchId !== searchId) return
          offMatch(); offDone(); offError()
          reject(new Error(p.error))
        })
        window.ripgrep.start({
          searchId,
          mode: 'files',
          directories: [directory],
          pattern: '',
          options: { inclusions: ['*.md'], exclusions: [] }
        }).catch(reject)
      })
    }, fixtureDir)

    expect(files.length).toBeGreaterThanOrEqual(3)
  })
})
