import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() }
}))

vi.mock('../../../src/main/config', () => ({ isOsx: false }))

import { setLanguages } from '../../../src/main/spellchecker'

const setSpellCheckerLanguages = vi.fn()

const makeWindow = (availableSpellCheckerLanguages: string[]): BrowserWindow =>
  ({
    webContents: {
      session: {
        availableSpellCheckerLanguages,
        isSpellCheckerEnabled: vi.fn(() => true),
        setSpellCheckerLanguages
      }
    }
  }) as unknown as BrowserWindow

describe('main spellchecker setLanguages', () => {
  beforeEach(() => {
    setSpellCheckerLanguages.mockClear()
  })

  it('deduplicates selected languages before passing them to Electron', () => {
    setLanguages(makeWindow(['en-US', 'en-GB']), ['en-US', 'en-GB', 'en-US'])

    expect(setSpellCheckerLanguages).toHaveBeenCalledWith(['en-US', 'en-GB'])
  })

  it('rejects an empty language list', () => {
    expect(() => setLanguages(makeWindow(['en-US']), [])).toThrow(
      'Expected at least one language for spell checker.'
    )
    expect(setSpellCheckerLanguages).not.toHaveBeenCalled()
  })

  it('rejects a language that Electron does not advertise', () => {
    expect(() => setLanguages(makeWindow(['en-US']), ['en-US', 'xx-XX'])).toThrow(
      'Spell checker language is unavailable: xx-XX'
    )
    expect(setSpellCheckerLanguages).not.toHaveBeenCalled()
  })
})
