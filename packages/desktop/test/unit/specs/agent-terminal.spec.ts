import { describe, it, expect, afterEach } from 'vitest'
import { shellBaseName } from '../../../src/main/agent/terminal/ptyManager'
import {
  clearTerminalFocus,
  isTerminalFocused,
  setTerminalFocused
} from '../../../src/main/agent/terminal/terminalFocus'
import { claimEditorShortcut } from '../../../src/main/keyboard/terminalFocusGate'
import { terminalColors } from '@/agent/terminalTheme'

describe('terminal shortcut gate', () => {
  it('keeps editor shortcuts while the terminal is not focused', () => {
    expect(claimEditorShortcut(false, 'edit.copy')).toBe(true)
    expect(claimEditorShortcut(false, 'file.save')).toBe(true)
  })

  it('lets the terminal take keys and still toggles the panel', () => {
    expect(claimEditorShortcut(true, 'edit.copy')).toBe(false)
    expect(claimEditorShortcut(true, 'edit.undo')).toBe(false)
    expect(claimEditorShortcut(true, 'view.toggle-terminal')).toBe(true)
  })
})

describe('terminal focus flag', () => {
  afterEach(() => {
    clearTerminalFocus(7)
  })

  it('tracks one window', () => {
    expect(isTerminalFocused(7)).toBe(false)
    setTerminalFocused(7, true)
    expect(isTerminalFocused(7)).toBe(true)
    setTerminalFocused(7, false)
    expect(isTerminalFocused(7)).toBe(false)
  })
})

describe('terminal theme', () => {
  it('reads the editor colors and falls back when a variable is empty', () => {
    const theme = terminalColors((name) => name === '--editorBgColor' ? '  #111 ' : '')
    expect(theme.background).toBe('#111')
    expect(theme.cursorAccent).toBe('#111')
    expect(theme.foreground).toBe('#333333')
    expect(theme.cursor).toBe('#21b56f')
  })
})

describe('shell tab label', () => {
  it('keeps only the program name', () => {
    expect(shellBaseName('/usr/bin/zsh')).toBe('zsh')
    expect(shellBaseName('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')).toBe('powershell.exe')
  })
})
