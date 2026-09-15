import { describe, expect, it } from 'vitest'
import { getFileIconClasses } from '@/components/sideBar/fileIconClass'

describe('getFileIconClasses (#4890)', () => {
  it('gives markdown files the markdown icon even when the name starts with "Dockerfile"', () => {
    expect(getFileIconClasses('Dockerfile-Notes.md')).toContain('markdown-icon')
  })

  it('matches by extension for regular markdown files', () => {
    expect(getFileIconClasses('notes.md')).toContain('markdown-icon')
  })

  it('still matches whole-name rules for extensionless names', () => {
    expect(getFileIconClasses('Dockerfile')).toContain('docker-icon')
  })

  it('keeps the docker icon for real docker files', () => {
    expect(getFileIconClasses('app.dockerfile')).toContain('docker-icon')
  })

  it('falls back to the markdown icon for unknown extensions and empty names', () => {
    expect(getFileIconClasses('zzz.zzznope')).toContain('markdown-icon')
    expect(getFileIconClasses('')).toContain('markdown-icon')
  })
})
