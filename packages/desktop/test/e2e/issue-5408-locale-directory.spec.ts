import { expect, test } from '@playwright/test'
import { launchElectron } from './helpers'

// #5408: the locale directory was picked from the build mode, so a built app
// looked for `static/locales` next to Electron's own resources unless
// PERF_TESTING was set, and every main-process string fell back to its key.

test('a built app finds the locale files next to the app', async() => {
  const { app } = await launchElectron()
  try {
    const labels = await app.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()
      return menu ? menu.items.map((item) => item.label) : []
    })
    expect(labels.length).toBeGreaterThanOrEqual(5)
    // A missing locale file leaves the raw keys, e.g. `menu.file.file`.
    expect(labels.filter((label) => /^[a-z]+(\.[a-zA-Z]+)+$/.test(label))).toEqual([])
  } finally {
    await app.close()
  }
})
