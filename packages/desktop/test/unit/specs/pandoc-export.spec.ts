import { EventEmitter } from 'events'
import path from 'path'
import { fileURLToPath } from 'url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.fn()

// `pandoc.ts` pulls in `command-exists`, which reaches `child_process` through a
// default import — so the mock has to expose `default` as well, or the module
// fails to evaluate and every test in this file is skipped.
vi.mock('child_process', () => {
  const spawn = (...args: unknown[]) => spawnMock(...args)
  return { default: { spawn }, spawn }
})

import pandoc, {
  PANDOC_EXPORT_FORMATS,
  getPandocLanguage,
  getPandocReader
} from 'main_renderer/utils/pandoc'

/** Stands in for the ChildProcess that `spawn` would hand back. */
class FakeProcess extends EventEmitter {
  // `stdin` is an emitter too: `toFile` has to survive the EPIPE the pipe
  // reports when pandoc exits before draining it.
  stdin = Object.assign(new EventEmitter(), { end: vi.fn() })
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  kill = vi.fn()
}

const startProcess = (): FakeProcess => {
  const proc = new FakeProcess()
  spawnMock.mockReturnValue(proc)
  return proc
}

const argsOfLastSpawn = (): string[] => {
  const { calls } = spawnMock.mock
  return calls[calls.length - 1]?.[1] as string[]
}

const optionsOfLastSpawn = (): unknown => {
  const { calls } = spawnMock.mock
  return calls[calls.length - 1]?.[2]
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
    it('covers the formats requested in #2103 and #3917', () => {
      const ids = PANDOC_EXPORT_FORMATS.map((f) => f.id)
      expect(ids).toContain('docx')
      expect(ids).toContain('odt')
      expect(ids).toContain('epub')
    })
  })

  describe('getPandocReader', () => {
    // pandoc's `markdown` reader turns on extensions that change what the text
    // says (`smart` quotes, citations, line blocks), so the export has to parse
    // with the dialect MarkText edits (#5379).
    it('reads GFM by default, because `~x~`/`^x^` are literal by default', () => {
      expect(getPandocReader(false)).toBe('gfm')
    })

    it('adds sub/superscript only when the preference asks for it', () => {
      expect(getPandocReader(true)).toBe('gfm+superscript+subscript')
    })

    // Pandoc 3.1.3 (Ubuntu 24.04) exits with "The extension tex_math_gfm is not
    // supported for gfm"; anything newer must not be named here.
    it('names no extension beyond the ones pandoc 3.1.3 accepts', () => {
      expect(getPandocReader(true)).not.toMatch(/tex_math_gfm|alerts/)
    })

    // `gfm` switches `footnotes` on unconditionally while the editor only
    // renders them when the `footnote` preference says so (#5379 review); the
    // combined form is valid pandoc syntax and `gfm-footnotes` keeps `[^1]`
    // as the literal text the editor shows.
    it('drops footnotes when the editor does not render them', () => {
      expect(getPandocReader(false, false)).toBe('gfm-footnotes')
      expect(getPandocReader(true, false)).toBe('gfm+superscript+subscript-footnotes')
      expect(getPandocReader(false, true)).toBe('gfm')
      expect(getPandocReader(true, true)).toBe('gfm+superscript+subscript')
    })
  })

  describe('getPandocLanguage', () => {
    // pandoc looks the tag up in the `translations/` data files inside its own
    // binary, where Chinese is filed under the script subtag: it ships
    // `zh-Hans`/`zh-Hant` and no `zh`, `zh-CN` or `zh-TW`. Passing `zh-CN`
    // through made every export print "Could not load translations …" on a file
    // that came out fine (#5379 review).
    it('rewrites the Chinese region tags to the script subtag pandoc carries', () => {
      expect(getPandocLanguage('zh-CN')).toBe('zh-Hans')
      expect(getPandocLanguage('zh-SG')).toBe('zh-Hans')
      expect(getPandocLanguage('zh-TW')).toBe('zh-Hant')
      expect(getPandocLanguage('zh-HK')).toBe('zh-Hant')
      expect(getPandocLanguage('zh-MO')).toBe('zh-Hant')
      // A bare `zh` resolves to `translations/zh.yaml`, which does not exist
      // either; simplified is what the tag overwhelmingly means.
      expect(getPandocLanguage('zh')).toBe('zh-Hans')
    })

    it('keeps a script subtag the locale already carries', () => {
      expect(getPandocLanguage('zh-Hans')).toBe('zh-Hans')
      expect(getPandocLanguage('zh-Hant-TW')).toBe('zh-Hant')
      expect(getPandocLanguage('zh-Hans-CN')).toBe('zh-Hans')
    })

    // Everything else has a translation file, so the tag reaches the file's
    // `<dc:language>` exactly as the OS reports it.
    it('passes every other locale through unchanged', () => {
      expect(getPandocLanguage('en-US')).toBe('en-US')
      expect(getPandocLanguage('pt-BR')).toBe('pt-BR')
      expect(getPandocLanguage('ja')).toBe('ja')
      expect(getPandocLanguage('de')).toBe('de')
    })
  })

  describe('pandoc.toFile', () => {
    it('pipes the document over stdin and asks pandoc for a file target', async() => {
      const proc = startProcess()

      const pending = pandoc.toFile('docx', '/tmp/notes.docx', '# Title')
      proc.emit('close', 0)

      await expect(pending).resolves.toEqual({ warnings: '' })
      // `-o` is what makes binary writers (docx/odt/epub/pptx) possible at all:
      // the result is a zip container, which the streaming converter above
      // cannot carry because it decodes stdout into a string.
      expect(spawnMock).toHaveBeenCalledWith(
        'pandoc',
        // No `-s`: the binary writers are standalone regardless, pandoc
        // ignores the flag there.
        ['-f', 'gfm', '-t', 'docx', '-o', '/tmp/notes.docx'],
        { cwd: undefined }
      )
      expect(proc.stdin.end).toHaveBeenCalledWith('# Title')
    })

    // Relative links are resolved by pandoc itself, against the cwd when the
    // document comes in over stdin. Without the source folder, `![](pics/a.png)`
    // is not found, pandoc substitutes the alt text and still exits 0, so
    // docx/odt/epub silently come out without their images (#5379).
    it('runs pandoc in the document folder so relative image links resolve', async() => {
      const proc = startProcess()

      const pending = pandoc.toFile('docx', '/tmp/notes.docx', 'x', { cwd: '/docs/notes' })
      proc.emit('close', 0)
      await pending

      expect(optionsOfLastSpawn()).toEqual({ cwd: '/docs/notes' })
    })

    it('parses with the reader it was given', async() => {
      const proc = startProcess()

      const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x', { reader: getPandocReader(true) })
      proc.emit('close', 0)
      await pending

      expect(argsOfLastSpawn().slice(0, 2)).toEqual(['-f', 'gfm+superscript+subscript'])
    })

    // A standalone document wants a title, and the document arrives on stdin:
    // pandoc has no source file name to fall back on, so an EPUB came out with
    // no `<dc:title>` and warned about it on every export (#5379 review).
    it('passes metadata on as --metadata key:value', async() => {
      const proc = startProcess()

      const pending = pandoc.toFile('epub3', '/tmp/x.epub', 'x', {
        metadata: { title: 'Q3: plan', lang: 'en-US' }
      })
      proc.emit('close', 0)
      await pending

      // The value may contain the separator; pandoc splits on the first colon.
      expect(argsOfLastSpawn()).toEqual([
        '-f',
        'gfm',
        '-t',
        'epub3',
        '--metadata=title:Q3: plan',
        '--metadata=lang:en-US',
        '-o',
        '/tmp/x.epub'
      ])
    })

    it('drops an empty metadata value instead of setting the field to nothing', async() => {
      const proc = startProcess()

      const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x', { metadata: { title: '' } })
      proc.emit('close', 0)
      await pending

      expect(argsOfLastSpawn().some((arg) => arg.startsWith('--metadata'))).toBe(false)
    })

    // Pandoc's built-in reference document draws no table borders and defines
    // no `Source Code` style, so a docx came out with columns that just float
    // next to each other and code as plain body text — nothing like the ruled
    // table and shaded block the editor showed. The bundled template closes
    // that gap and rides along on every docx export that names none of its own.
    describe('bundled docx template', () => {
      const here = path.dirname(fileURLToPath(import.meta.url))
      const staticDir = path.resolve(here, '..', '..', '..', 'static')

      afterEach(() => {
        delete (globalThis as { __static?: string }).__static
      })

      it('rides along on a docx export', async() => {
        const proc = startProcess()
        ;(globalThis as { __static?: string }).__static = staticDir

        const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x')
        proc.emit('close', 0)
        await pending

        expect(argsOfLastSpawn()).toContain(`--reference-doc=${path.join(staticDir, 'pandoc-reference.docx')}`)
      })

      it('stays out of the writers it cannot style', async() => {
        const proc = startProcess()
        ;(globalThis as { __static?: string }).__static = staticDir

        const pending = pandoc.toFile('epub3', '/tmp/x.epub', 'x')
        proc.emit('close', 0)
        await pending

        expect(argsOfLastSpawn().some((arg) => arg.startsWith('--reference-doc'))).toBe(false)
      })

      it('degrades to pandoc\'s default when the template is missing', async() => {
        const proc = startProcess()
        ;(globalThis as { __static?: string }).__static = path.join(staticDir, 'nowhere')

        const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x')
        proc.emit('close', 0)
        await pending

        expect(argsOfLastSpawn().some((arg) => arg.startsWith('--reference-doc'))).toBe(false)
      })

      it('yields to a reference document the caller picked', async() => {
        const proc = startProcess()
        ;(globalThis as { __static?: string }).__static = staticDir

        const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x', { referenceDoc: '/mine.docx' })
        proc.emit('close', 0)
        await pending

        expect(argsOfLastSpawn()).toContain('--reference-doc=/mine.docx')
      })

      it('lets an empty string force pandoc\'s default', async() => {
        const proc = startProcess()
        ;(globalThis as { __static?: string }).__static = staticDir

        const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x', { referenceDoc: '' })
        proc.emit('close', 0)
        await pending

        expect(argsOfLastSpawn().some((arg) => arg.startsWith('--reference-doc'))).toBe(false)
      })
    })

    it('reports the warnings pandoc prints on a successful conversion', async() => {
      const proc = startProcess()

      const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x')
      proc.stderr.emit(
        'data',
        Buffer.from(
          '[WARNING] Could not fetch resource pics/a.png: replacing image with description\n'
        )
      )
      proc.emit('close', 0)

      await expect(pending).resolves.toEqual({
        warnings: '[WARNING] Could not fetch resource pics/a.png: replacing image with description'
      })
    })

    // A writer pandoc rejects fails before it has read stdin; Node then emits
    // EPIPE on the pipe, which without a listener becomes an uncaught exception
    // in the main process ("Unexpected error" dialog). The failure itself still
    // arrives through `close`.
    it('survives an EPIPE on stdin', async() => {
      const proc = startProcess()

      const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x'.repeat(70 * 1024))
      expect(() => proc.stdin.emit('error', new Error('write EPIPE'))).not.toThrow()
      proc.stderr.emit('data', Buffer.from('pandoc: Unknown output format broke\n'))
      proc.emit('close', 1)

      await expect(pending).rejects.toThrow('Unknown output format broke')
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

  // `check` takes a renderer-supplied path, so a wrapper that never exits would
  // otherwise spin the Check button forever and leak the child (#5379 review).
  describe('pandoc.check', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('reports the version of a working binary', async() => {
      const proc = startProcess()

      const pending = pandoc.check('/usr/bin/pandoc')
      proc.stdout?.emit('data', Buffer.from('pandoc 3.1.3\nCopyright (C) 2023\n'))
      proc.emit('close', 0)

      await expect(pending).resolves.toEqual({ ok: true, version: 'pandoc 3.1.3' })
    })

    it('kills a binary that never exits and says why', async() => {
      vi.useFakeTimers()
      const proc = startProcess()

      const pending = pandoc.check('/usr/bin/impostor')
      const settled = expect(pending).resolves.toMatchObject({
        ok: false,
        error: expect.stringContaining('did not exit within 5 seconds')
      })
      await vi.advanceTimersByTimeAsync(5000)

      expect(proc.kill).toHaveBeenCalled()
      await settled
    })
  })
})
