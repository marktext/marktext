import { describe, expect, it } from 'vitest'
import { acceleratorToTokens } from '@/util/accelerator'

describe('acceleratorToTokens', () => {
  it('maps modifiers to macOS symbols', () => {
    expect(acceleratorToTokens('Command+Shift+T', true)).toEqual(['⌘', '⇧', 'T'])
    expect(acceleratorToTokens('Command+Option+C', true)).toEqual(['⌘', '⌥', 'C'])
    expect(acceleratorToTokens('Command+1', true)).toEqual(['⌘', '1'])
    expect(acceleratorToTokens('CmdOrCtrl+Shift+P', true)).toEqual(['⌘', '⇧', 'P'])
  })

  it('keeps the trailing key untouched', () => {
    expect(acceleratorToTokens('Command+=', true)).toEqual(['⌘', '='])
    expect(acceleratorToTokens('Command+Option+-', true)).toEqual(['⌘', '⌥', '-'])
  })

  it('maps modifiers to words off macOS', () => {
    expect(acceleratorToTokens('Ctrl+Shift+T', false)).toEqual(['Ctrl', 'Shift', 'T'])
    expect(acceleratorToTokens('CmdOrCtrl+Alt+P', false)).toEqual(['Ctrl', 'Alt', 'P'])
  })
})
