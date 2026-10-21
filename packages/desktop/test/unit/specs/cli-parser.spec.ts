import { describe, expect, it } from 'vitest'
import parseArgs from 'main_renderer/cli/parser'

describe('CLI parser', () => {
  it('parses --read-only without treating it as a path', () => {
    const args = parseArgs(['--read-only', 'note.md'])

    expect(args['--read-only']).toBe(true)
    expect(args._).toEqual(['note.md'])
  })
})
