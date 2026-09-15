import { EventEmitter } from 'events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.fn()

// `pandoc.ts` pulls in `command-exists`, which reaches `child_process` through a
// default import — so the mock has to expose `default` as well, or the module
// fails to evaluate and every test in this file is skipped.
vi.mock('child_process', () => {
  const spawn = (...args: unknown[]) => spawnMock(...args)
  return { default: { spawn }, spawn }
})

import pandoc, { PANDOC_EXPORT_FORMATS } from 'main_renderer/utils/pandoc'

/** Stands in for the ChildProcess that `spawn` would hand back. */
class FakeProcess extends EventEmitter {
  stdin = { end: vi.fn() }
  stderr = new EventEmitter()
}

const startProcess = (): FakeProcess => {
  const proc = new FakeProcess()
  spawnMock.mockReturnValue(proc)
  return proc
}

describe('pandoc export', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    delete process.env.MARKTEXT_PANDOC
  })

  afterEach(() => {
    delete process.env.MARKTEXT_PANDOC
  })

  describe('PANDOC_EXPORT_FORMATS', () => {
    it('has a unique id per format', () => {
      const ids = PANDOC_EXPORT_FORMATS.map((f) => f.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('gives every format a dot-prefixed extension and a pandoc target', () => {
      for (const format of PANDOC_EXPORT_FORMATS) {
        expect(format.extension.startsWith('.'), `${format.id} extension`).toBe(true)
        expect(format.extension.length, `${format.id} extension length`).toBeGreaterThan(1)
        expect(format.target.length, `${format.id} target`).toBeGreaterThan(0)
        expect(format.label.length, `${format.id} label`).toBeGreaterThan(0)
      }
    })

    it('covers the formats requested in #2103 and #3917', () => {
      const ids = PANDOC_EXPORT_FORMATS.map((f) => f.id)
      expect(ids).toContain('docx')
      expect(ids).toContain('odt')
      expect(ids).toContain('epub')
    })
  })

  describe('pandoc.toFile', () => {
    it('pipes the document over stdin and asks pandoc for a file target', async() => {
      const proc = startProcess()

      const pending = pandoc.toFile('docx', '/tmp/notes.docx', '# Title')
      proc.emit('close', 0)

      await expect(pending).resolves.toBeUndefined()
      // `-o` is what makes binary writers (docx/odt/epub/pptx) possible at all:
      // they need to seek in the output, so stdout cannot carry them.
      expect(spawnMock).toHaveBeenCalledWith('pandoc', [
        '-f',
        'markdown',
        '-t',
        'docx',
        '-s',
        '-o',
        '/tmp/notes.docx'
      ])
      expect(proc.stdin.end).toHaveBeenCalledWith('# Title')
    })

    it('forwards extra pandoc arguments after the built-in ones', async() => {
      const proc = startProcess()

      const pending = pandoc.toFile('latex', '/tmp/notes.tex', 'x', ['--toc'])
      proc.emit('close', 0)
      await pending

      const args = spawnMock.mock.calls[0]?.[1] as string[]
      expect(args.slice(-1)).toEqual(['--toc'])
    })

    it('rejects with the pandoc error text instead of the exit code', async() => {
      const proc = startProcess()

      const pending = expect(pandoc.toFile('docx', '/tmp/x.docx', 'x')).rejects.toThrow(
        'Unknown output format docx'
      )
      proc.stderr.emit('data', Buffer.from('pandoc: Unknown output format docx\n'))
      proc.emit('close', 1)
      await pending
    })

    it('falls back to the exit code when pandoc says nothing', async() => {
      const proc = startProcess()

      const pending = expect(pandoc.toFile('docx', '/tmp/x.docx', 'x')).rejects.toThrow(
        'pandoc exited with code 3'
      )
      proc.emit('close', 3)
      await pending
    })

    it('rejects when the pandoc binary cannot be spawned', async() => {
      const proc = startProcess()
      const failure = new Error('spawn pandoc ENOENT')

      const pending = expect(pandoc.toFile('docx', '/tmp/x.docx', 'x')).rejects.toThrow(
        'spawn pandoc ENOENT'
      )
      proc.emit('error', failure)
      await pending
    })
  })
})
