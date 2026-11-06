import { tmpdir } from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import { describe, expect, it } from 'vitest'
import parseArgs, { userArguments } from 'main_renderer/cli/parser'

describe('CLI parser', () => {
  it('excludes the Electron entry directory so it cannot suppress session restore', () => {
    expect(userArguments(['electron', '/app', '--user-data-dir', '/profile'], true)).toEqual([
      '--user-data-dir',
      '/profile'
    ])
    expect(
      userArguments(
        ['electron', '--inspect=0', '--remote-debugging-port=0', '/app', '/notes'],
        true,
        '/app'
      )
    ).toEqual(['--inspect=0', '--remote-debugging-port=0', '/notes'])
    expect(userArguments(['marktext', '/notes'], false)).toEqual(['/notes'])
  })
  it('parses --read-only without treating it as a path', () => {
    const args = parseArgs(['--read-only', 'note.md'])

    expect(args['--read-only']).toBe(true)
    expect(args._).toEqual(['note.md'])
  })
  it('turns file:// URIs from desktop entries into paths (#5843)', () => {
    const pathname = path.join(tmpdir(), 'My Notes', 'café.md')

    expect(parseArgs([pathToFileURL(pathname).href, 'note.md'])._).toEqual([pathname, 'note.md'])
  })
  it.skipIf(process.platform === 'win32')('keeps a file:// URI with a remote host as given', () => {
    expect(parseArgs(['file://host/note.md'])._).toEqual(['file://host/note.md'])
  })
  it('parses --export-pdf with an optional output path', () => {
    const args = parseArgs(['--export-pdf', 'note.md', '-o', 'out/note.pdf'])

    expect(args['--export-pdf']).toEqual(['note.md'])
    expect(args['--output']).toBe('out/note.pdf')
    expect(args._).toEqual([])
  })
  it('accepts --export-pdf without an output path', () => {
    const args = parseArgs(['--export-pdf', 'note.md'])

    expect(args['--export-pdf']).toEqual(['note.md'])
    expect(args['--output']).toBeUndefined()
  })
  it('parses a batch of inputs', () => {
    // `arg` collects only repeated flags into an array; the extra batch
    // inputs are positional and land in `_` (merged by prepareCliJob).
    const args = parseArgs(['--export-html', 'a.md', 'b.md', 'c.md'])

    expect(args['--export-html']).toEqual(['a.md'])
    expect(args._).toEqual(['b.md', 'c.md'])
  })
  it('parses --export with a format followed by inputs', () => {
    const args = parseArgs(['--export', 'docx', 'a.md', 'b.md'])

    expect(args['--export']).toEqual(['docx'])
    expect(args._).toEqual(['a.md', 'b.md'])
  })
  it('parses --import and the export option flags', () => {
    const args = parseArgs(['--import', 'spec.docx'])
    expect(args['--import']).toEqual(['spec.docx'])

    const options = parseArgs([
      '--export-pdf',
      'a.md',
      '--page-size',
      'A3',
      '--landscape',
      '--margin-top',
      '25',
      '--theme',
      'academic',
      '--header',
      'Confidential',
      '--font-size',
      '12',
      '--auto-numbering-headings'
    ])
    expect(options['--page-size']).toBe('A3')
    expect(options['--landscape']).toBe(true)
    expect(options['--margin-top']).toBe(25)
    expect(options['--theme']).toBe('academic')
    expect(options['--header']).toBe('Confidential')
    expect(options['--font-size']).toBe(12)
    expect(options['--auto-numbering-headings']).toBe(true)
  })
})
