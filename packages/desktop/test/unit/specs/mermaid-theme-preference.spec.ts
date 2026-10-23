import { describe, expect, it } from 'vitest'
import { resolveMermaidTheme } from '../../../src/common/theme'

describe('resolveMermaidTheme', () => {
  it('uses the light theme setting for light MarkText themes', () => {
    expect(resolveMermaidTheme('light', 'forest', 'dark')).toBe('forest')
    expect(resolveMermaidTheme('graphite', 'forest', 'dark')).toBe('forest')
  })

  it('uses the dark theme setting for dark MarkText themes', () => {
    expect(resolveMermaidTheme('dark', 'forest', 'dark')).toBe('dark')
    expect(resolveMermaidTheme('dracula', 'forest', 'dark')).toBe('dark')
  })

  it('falls back to the light setting for unknown themes', () => {
    expect(resolveMermaidTheme(undefined, 'forest', 'dark')).toBe('forest')
  })
})
