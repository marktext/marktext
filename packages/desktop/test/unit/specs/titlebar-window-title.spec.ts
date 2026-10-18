import { describe, it, expect } from 'vitest'
import { buildWindowTitle } from '@/components/titleBar/windowTitle'

// KDE task switcher plugins that show application names derive them from the
// trailing "- AppName" of the window title; without it MarkText showed "1" for
// "Untitled-1".
describe('buildWindowTitle', () => {
  describe('on Linux/Windows', () => {
    it('appends the app name to the filename', () => {
      expect(buildWindowTitle('Untitled-1', '', false)).toBe('Untitled-1 - MarkText')
    })

    it('appends the app name after the project name', () => {
      expect(buildWindowTitle('notes.md', 'myproject', false)).toBe(
        'notes.md - myproject - MarkText'
      )
    })

    it('shows the project name when no file is open', () => {
      expect(buildWindowTitle('', 'myproject', false)).toBe('myproject - MarkText')
    })

    it('falls back to the app name when nothing is open', () => {
      expect(buildWindowTitle(undefined, '', false)).toBe('MarkText')
    })
  })

  describe('on macOS', () => {
    it('keeps the document-only title', () => {
      expect(buildWindowTitle('notes.md', 'myproject', true)).toBe('notes.md - myproject')
      expect(buildWindowTitle('Untitled-1', '', true)).toBe('Untitled-1')
      expect(buildWindowTitle(undefined, '', true)).toBe('')
    })
  })
})
