import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'

// The renderer SpellChecker reads `isOsx` from `@/util` (a top-level import
// binding) and reaches Electron through `window.electron.ipcRenderer.invoke`.
// We mock `@/util` per test to flip the platform branch, and stub the
// contextBridge `window.electron` surface the class touches.
const win = window as unknown as {
  electron?: { ipcRenderer: { invoke: Mock } }
}

const loadSpellChecker = async(isOsx: boolean) => {
  vi.resetModules()
  vi.doMock('@/util', () => ({ isOsx }))
  return (await import('../../../src/renderer/src/spellchecker/index')).SpellChecker
}

describe('renderer SpellChecker.switchLanguage', () => {
  let invoke: Mock

  beforeEach(() => {
    invoke = vi.fn(() => Promise.resolve(true))
    win.electron = { ipcRenderer: { invoke } }
  })

  afterEach(() => {
    delete win.electron
    vi.doUnmock('@/util')
  })

  it('invokes the IPC channel once and records the new language (non-macOS, enabled)', async() => {
    const SpellChecker = await loadSpellChecker(false)
    const checker = new SpellChecker(true, 'en-US')

    const result = await checker.switchLanguage('de-DE')

    expect(result).toBe(true)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith('mt::spellchecker-switch-language', 'de-DE')
    expect(checker.lang).toBe('de-DE')
    expect(checker.currentSpellcheckerLanguage).toBe('de-DE')
  })

  it('short-circuits to true on macOS without touching IPC', async() => {
    const SpellChecker = await loadSpellChecker(true)
    const checker = new SpellChecker(true, 'en-US')

    const result = await checker.switchLanguage('de-DE')

    expect(result).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
    // The OS spell checker auto-detects language, so the stored language is
    // left untouched.
    expect(checker.currentSpellcheckerLanguage).toBe('en-US')
  })

  it('returns false without IPC when the spell checker is disabled (non-macOS)', async() => {
    const SpellChecker = await loadSpellChecker(false)
    const checker = new SpellChecker(false, 'en-US')

    const result = await checker.switchLanguage('de-DE')

    expect(result).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
    expect(checker.currentSpellcheckerLanguage).toBe('en-US')
  })

  it('throws on an empty language when enabled (non-macOS) and never invokes IPC', async() => {
    const SpellChecker = await loadSpellChecker(false)
    const checker = new SpellChecker(true, 'en-US')

    await expect(checker.switchLanguage('')).rejects.toThrow(
      'Expected non-empty language for spell checker.'
    )
    expect(invoke).not.toHaveBeenCalled()
  })
})
