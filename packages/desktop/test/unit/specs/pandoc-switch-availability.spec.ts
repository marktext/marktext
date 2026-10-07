import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pandocSwitchState } from '@/prefComponents/general/pandoc'
import type { PandocCommandInfo } from '@shared/types/pandoc'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = resolve(here, '../../..')

const INSTALLED: PandocCommandInfo = { command: 'C:\\Program Files\\Pandoc\\pandoc.exe' }
const MISSING: PandocCommandInfo = { command: null }

describe('Pandoc switch availability', () => {
  it('names the binary when pandoc sits outside PATH', () => {
    expect(pandocSwitchState(INSTALLED, false)).toEqual({
      note: 'preferences.general.pandoc.found',
      path: INSTALLED.command,
      disabled: false
    })
  })

  it('greys out a switch that would only open a menu pandoc cannot serve', () => {
    expect(pandocSwitchState(MISSING, false)).toMatchObject({
      note: 'preferences.general.pandoc.notFound',
      disabled: true
    })
  })

  it('leaves an enabled switch reachable, so the menu can still be turned off', () => {
    expect(pandocSwitchState(MISSING, true).disabled).toBe(false)
  })

  it('claims nothing and greys nothing before the answer arrives', () => {
    expect(pandocSwitchState(null, false)).toEqual({ note: '', path: '', disabled: false })
  })

  it('only refers to messages the locale files define', () => {
    const messages = JSON.parse(readFileSync(join(pkg, 'static/locales/en.json'), 'utf8'))
    const general = messages.preferences.general.pandoc as Record<string, string>
    for (const probe of [INSTALLED, MISSING]) {
      const { note } = pandocSwitchState(probe, false)
      expect(general[note.split('.').pop() as string]).toBeTypeOf('string')
    }
  })

  // The pane reads these straight from the locale file, where `pandocSwitchState` cannot vouch
  // for them; a missing one renders as its own key.
  it('defines the messages the pane reads on its own', () => {
    const messages = JSON.parse(readFileSync(join(pkg, 'static/locales/en.json'), 'utf8'))
    const general = messages.preferences.general.pandoc as Record<string, string>
    for (const key of ['title', 'description', 'detailedDescription', 'recheck']) {
      expect(general[key]).toBeTypeOf('string')
    }
  })
})
