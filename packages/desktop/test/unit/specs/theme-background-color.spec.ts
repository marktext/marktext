import { describe, it, expect } from 'vitest'
import { getThemeBackgroundColor, railscastsThemes, oneDarkThemes } from 'common/theme'

// #3957: a dark theme used to flash white on launch because the main process
// only mapped a handful of themes to a background colour and every other theme
// fell back to white. `getThemeBackgroundColor` now covers every built-in theme
// and classifies unknown ones, so no dark theme is painted white.
describe('theme launch background colour (#3957)', () => {
  it('never returns white for a dark theme (no white flash on launch)', () => {
    for (const theme of [...railscastsThemes, ...oneDarkThemes]) {
      expect(getThemeBackgroundColor(theme).toLowerCase()).not.toBe('#ffffff')
    }
  })

  it('maps representative dark themes to their own editor background', () => {
    expect(getThemeBackgroundColor('dracula')).toBe('#282a36')
    expect(getThemeBackgroundColor('nord')).toBe('#2e3440')
    expect(getThemeBackgroundColor('tokyo-night')).toBe('#1a1b26')
    expect(getThemeBackgroundColor('dark')).toBe('#282828')
    expect(getThemeBackgroundColor('one-dark')).toBe('#282c34')
  })

  it('uses the explicit background for built-in light themes', () => {
    expect(getThemeBackgroundColor('ulysses')).toBe('#f3f3f3')
    expect(getThemeBackgroundColor('tokyo-night-light')).toBe('#d5d6db')
  })

  it('falls back to white for the default light theme and unknown themes', () => {
    for (const theme of ['light', undefined, 'no-such-theme']) {
      expect(getThemeBackgroundColor(theme as string | undefined)).toBe('#ffffff')
    }
  })
})
