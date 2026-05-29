import { describe, it, expect } from 'vitest'
import { getNativeThemeSource, isDarkApplicationTheme } from 'main_renderer/app/nativeTheme'
import { oneDarkThemes, railscastsThemes } from 'common/theme'

describe('Native theme source', () => {
  it('follows the system when configured to do so', () => {
    expect(getNativeThemeSource({ followSystemTheme: true, theme: 'dark' })).to.equal('system')
    expect(getNativeThemeSource({ followSystemTheme: true, theme: 'light' })).to.equal('system')
  })

  it('uses dark native menus for dark MarkText themes', () => {
    for (const theme of ['dark', 'dracula', 'nord', 'rose-pine', 'kanagawa', 'cyberdream']) {
      expect(isDarkApplicationTheme(theme)).to.equal(true)
      expect(getNativeThemeSource({ followSystemTheme: false, theme })).to.equal('dark')
    }
  })

  it('uses the shared MarkText dark theme classification', () => {
    for (const theme of [...railscastsThemes, ...oneDarkThemes]) {
      expect(isDarkApplicationTheme(theme)).to.equal(true)
      expect(getNativeThemeSource({ followSystemTheme: false, theme })).to.equal('dark')
    }
  })

  it('uses light native menus for light MarkText themes', () => {
    for (const theme of ['light', 'graphite', 'ulysses', 'tokyo-night-light', 'unknown-theme']) {
      expect(isDarkApplicationTheme(theme)).to.equal(false)
      expect(getNativeThemeSource({ followSystemTheme: false, theme })).to.equal('light')
    }
  })
})
