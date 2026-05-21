const { expect, test } = require('@playwright/test')
const { launchElectron } = require('./helpers')

// Validates the font enumeration moved from a renderer `require('font-list')`
// to the main process via mt::fonts::list. font-list is a native module —
// CI runners may or may not have system fonts installed, so we tolerate an
// empty array but require the IPC to resolve to an array.

test('window.fonts.list reaches the main-process IPC', async() => {
  const { app, page } = await launchElectron()
  try {
    const fonts = await page.evaluate(() => window.fonts.list())
    expect(Array.isArray(fonts)).toBe(true)
    // The IPC surface itself must stay callable even when font-list returns [].
    expect(await page.evaluate(() => typeof window.fonts?.list)).toBe('function')
  } finally {
    await app.close().catch(() => {})
  }
})
