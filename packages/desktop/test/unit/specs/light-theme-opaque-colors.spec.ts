import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// #4466: the light-theme editor TEXT colors used a semi-transparent alpha
// channel (`rgba(0,0,0,0.7)` …). Alpha-composited text forces Chromium into
// grayscale antialiasing, so body text rendered aliased / thinner on FHD
// (96 dpi) displays. Keep the light-theme editor text colors opaque so font
// rendering stays crisp. (Translucent overlays — selection / highlight — keep
// their alpha and are intentionally not covered here.)
const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(
  resolve(here, '../../../src/renderer/src/assets/styles/index.css'),
  'utf8'
)

const TEXT_COLOR_VARS = [
  '--editorColor',
  '--editorColor80',
  '--editorColor60',
  '--editorColor50',
  '--editorColor40',
  '--editorColor30',
  '--editorColor10',
  '--editorColor04'
]

describe('light-theme editor text colors are opaque (#4466)', () => {
  for (const name of TEXT_COLOR_VARS) {
    it(`${name} has no alpha channel`, () => {
      const match = css.match(new RegExp(`${name}:\\s*([^;]+);`))
      expect(match, `${name} declaration not found`).toBeTruthy()
      const value = match![1].trim()
      expect(value, `${name} = ${value}`).not.toMatch(/rgba|hsla|\/\s*[\d.]+\s*\)/i)
    })
  }
})
