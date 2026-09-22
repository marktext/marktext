import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pandocSwitchState } from '@/prefComponents/general/pandoc'
import type { PandocProbe } from '@/prefComponents/general/pandoc'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = resolve(here, '../../..')
const pane = join(pkg, 'src/renderer/src/prefComponents/general/index.vue')

const INSTALLED: PandocProbe = { command: 'C:\\Program Files\\Pandoc\\pandoc.exe', onPath: false }
const ON_PATH: PandocProbe = { command: 'pandoc', onPath: true }
const MISSING: PandocProbe = { command: null, onPath: false }

/** The `<compound>` the switch sits in, so template bindings stay checked. */
const pandocBlock = (): string => {
  const src = readFileSync(pane, 'utf8')
  const title = src.indexOf('preferences.general.pandoc.title')
  return src.slice(src.lastIndexOf('<compound', title), src.indexOf('</compound>', title))
}

describe('Pandoc switch availability', () => {
  it('names the binary when pandoc sits outside PATH', () => {
    expect(pandocSwitchState(INSTALLED, false)).toEqual({
      note: 'preferences.general.pandoc.found',
      path: INSTALLED.command,
      disabled: false
    })
  })

  it('says PATH instead of naming a file when that is where pandoc came from', () => {
    expect(pandocSwitchState(ON_PATH, false)).toMatchObject({
      note: 'preferences.general.pandoc.foundOnPath',
      path: ''
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
    for (const probe of [INSTALLED, ON_PATH, MISSING]) {
      const { note } = pandocSwitchState(probe, false)
      expect(general[note.split('.').pop() as string]).toBeTypeOf('string')
    }
  })

  it('keeps the note off the switch, which dims its whole row when disabled', () => {
    const block = pandocBlock()
    const bool = block.slice(block.indexOf('<bool'))
    const switchTag = bool.slice(0, bool.indexOf('/>') + 2)

    expect(switchTag).toContain(':disable="pandocDisabled"')
    expect(switchTag).not.toContain(':notes=')
    expect(block.slice(0, block.indexOf('<template #head>'))).toContain(':notes="pandocStatus"')
  })
})
