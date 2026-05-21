const fs = require('fs')
const os = require('os')
const path = require('path')
const { expect, test } = require('@playwright/test')
const { launchElectron } = require('./helpers')

// Validates the Web Crypto hashing + mt::fs::* IPC path that replaced
// renderer-side `crypto.createHash` / `fs.writeFile`. We don't simulate a real
// drag-and-drop (DnD with file paths from outside the page is fragile under
// xvfb), but we exercise the same primitives the drag handler uses:
// readFile → SHA-1 via Web Crypto → ensureDir → copy.

// 1x1 transparent PNG
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

test('Web Crypto hash + mt::fs::copy reproduces the dropped-image flow', async() => {
  const workdir = path.join(os.tmpdir(), 'mt-img-' + Math.random().toString(36).slice(2, 8))
  fs.mkdirSync(workdir, { recursive: true })
  const sourceImage = path.join(workdir, 'pixel.png')
  fs.writeFileSync(sourceImage, Buffer.from(TINY_PNG_B64, 'base64'))
  const outDir = path.join(workdir, 'images-out')

  const { app, page } = await launchElectron()
  try {
    const written = await page.evaluate(async({ source, target }) => {
      const buf = await window.fileUtils.readFile(source)
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
      const digest = await crypto.subtle.digest('SHA-1', bytes)
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const ext = window.path.extname(source)
      const dest = window.path.join(target, `${hex}${ext}`)
      await window.fileUtils.ensureDir(target)
      await window.fileUtils.copy(source, dest)
      return dest
    }, { source: sourceImage, target: outDir })

    expect(fs.existsSync(written)).toBe(true)
    expect(written).toMatch(/[0-9a-f]{40}\.png$/)
    // Content-addressed: same source must produce identical hash.
    expect(fs.readFileSync(written).equals(fs.readFileSync(sourceImage))).toBe(true)
  } finally {
    await app.close().catch(() => {})
    try { fs.rmSync(workdir, { recursive: true, force: true }) } catch {}
  }
})
