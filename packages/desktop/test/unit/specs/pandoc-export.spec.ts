import { EventEmitter } from 'events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.fn()

// `pandoc.ts` reaches `child_process` through a default import, so does the mock.
vi.mock('child_process', () => {
  const spawn = (...args: unknown[]) => spawnMock(...args)
  return { default: { spawn }, spawn }
})

import { tmpdir } from 'os'
import path from 'path'
import { mkdtemp, writeFile } from 'fs-extra'
import pandoc, {
  PANDOC_EXPORT_FORMATS,
  formatLinksMedia,
  getPandocLanguage,
  getPandocReader,
  isRemoteMedia,
  listLinkedMedia,
  uniquePandocOutputPath,
  type PandocToFileOptions
} from 'main_renderer/utils/pandoc'

/** The ChildProcess `spawn` would hand back; stdin is an emitter so the EPIPE is testable. */
const startProcess = () => {
  const proc = Object.assign(new EventEmitter(), {
    stdin: Object.assign(new EventEmitter(), { end: vi.fn() }),
    stderr: new EventEmitter(),
    stdout: new EventEmitter()
  })
  spawnMock.mockReturnValue(proc)
  return proc
}

/** The spawn stub plus the pending conversion, stderr emitted before the exit included. */
const runToFile = (
  to: string,
  outputPath: string,
  { input = 'x', stderr = '', code = 0, ...options }: PandocToFileOptions & {
    input?: string
    stderr?: string
    code?: number
  } = {}
) => {
  const proc = startProcess()
  const done = pandoc.toFile(to, outputPath, input, options)
  if (stderr) proc.stderr.emit('data', Buffer.from(stderr))
  proc.emit('close', code)
  return { proc, done }
}

describe('pandoc export', () => {
  afterEach(() => {
    spawnMock.mockReset()
    delete process.env.MARKTEXT_PANDOC
  })

  // The formats of #2103/#3917 minus OPML, whose writer puts the document in one attribute.
  it('offers the requested formats', () => {
    const ids = PANDOC_EXPORT_FORMATS.map((f) => f.id)
    expect(ids).toEqual(expect.arrayContaining(['docx', 'odt', 'epub']))
    expect(ids).not.toContain('opml')
  })

  // `gfm` is what the editor shows, within pandoc 3.1.3 (Ubuntu 24.04); the extensions
  // asked for mirror the editor's footnote and super/subscript preferences (#5379).
  it('reads GFM, adding sub/superscript or dropping footnotes only when asked', () => {
    expect(getPandocReader(false)).toBe('gfm')
    expect(getPandocReader(false, false)).toBe('gfm-footnotes')
    expect(getPandocReader(true)).toBe('gfm+superscript+subscript')
    expect(getPandocReader(true)).not.toMatch(/tex_math_gfm|alerts/)
  })

  // pandoc ships no `zh`/`zh-CN`/`zh-TW`, and an unresolvable `lang` warns on every export (#5379).
  it('spells the Chinese region as the script subtag pandoc carries', () => {
    expect(getPandocLanguage('zh-CN')).toBe('zh-Hans')
    expect(getPandocLanguage('zh_SG')).toBe('zh-Hans')
    expect(getPandocLanguage('zh-TW')).toBe('zh-Hant')
    expect(getPandocLanguage('zh-Hant')).toBe('zh-Hant')
    expect(getPandocLanguage('en-US')).toBe('en-US')
    expect(getPandocLanguage('ja')).toBe('ja')
  })

  // The argv is asserted in full because `cwd` is what makes `![](pics/a.png)` resolve;
  // the named binary stands in for the portable pandoc — `process.execPath` exists.
  it('spawns the named binary with the reader and target asked for', async() => {
    const { proc, done } = runToFile('docx', '/tmp/notes.docx', {
      input: '# Title',
      cwd: '/docs/notes',
      reader: getPandocReader(true)
    })

    await expect(done).resolves.toEqual({ warnings: '' })
    expect(spawnMock).toHaveBeenCalledWith(
      'pandoc',
      ['-f', 'gfm+superscript+subscript', '-t', 'docx', '-s', '-o', '/tmp/notes.docx'],
      { cwd: '/docs/notes' }
    )
    expect(proc.stdin.end).toHaveBeenCalledWith('# Title')

    spawnMock.mockReset()
    process.env.MARKTEXT_PANDOC = process.execPath
    await runToFile('docx', '/tmp/x.docx').done

    expect(spawnMock).toHaveBeenCalledWith(process.execPath, expect.any(Array), expect.anything())
    expect(pandoc.exists()).toBe(true)
  })

  // pandoc splits `--metadata` on the first colon only, so "Q3: plan" survives; an
  // empty value is what pandoc complains about.
  it('passes metadata on as --metadata key:value, dropping empty values', async() => {
    const { done } = runToFile('epub3', '/tmp/x.epub', {
      metadata: { title: 'Notes: draft', lang: 'zh-Hans', author: '' }
    })
    await done

    const args = spawnMock.mock.calls.at(-1)?.[1] as string[]
    expect(args).toContain('--metadata=title:Notes: draft')
    expect(args).toContain('--metadata=lang:zh-Hans')
    expect(args.some((arg) => arg.startsWith('--metadata=author'))).toBe(false)
    expect(args.slice(-2)).toEqual(['-o', '/tmp/x.epub'])
  })

  // Exit code 0 is not a clean conversion: stderr holds the warnings it would
  // otherwise hide, and names the offending source position when pandoc fails.
  it('reports the warnings of a run that worked and the stderr of one that did not', async() => {
    const { done } = runToFile('docx', '/tmp/x.docx', {
      stderr: '[WARNING] Could not fetch resource pics/a.png: replacing image with description\n'
    })
    await expect(done).resolves.toEqual({
      warnings: '[WARNING] Could not fetch resource pics/a.png: replacing image with description'
    })

    const { done: broken } = runToFile('docx', '/tmp/x.docx', {
      code: 1,
      stderr: 'pandoc: Unknown output format docx\n'
    })
    await expect(broken).rejects.toThrow('Unknown output format docx')

    const { done: quiet } = runToFile('docx', '/tmp/x.docx', { code: 3 })
    await expect(quiet).rejects.toThrow('pandoc exited with code 3')
  })

  // Without a listener the EPIPE is uncaught; a binary that never starts rejects through `error`.
  it('survives an EPIPE on stdin and a binary that cannot be spawned', async() => {
    const proc = startProcess()
    const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x'.repeat(70 * 1024))
    expect(() => proc.stdin.emit('error', new Error('write EPIPE'))).not.toThrow()
    proc.stderr.emit('data', Buffer.from('pandoc: Unknown output format broke\n'))
    proc.emit('close', 1)
    await expect(pending).rejects.toThrow('Unknown output format broke')

    const failing = startProcess()
    const missing = pandoc.toFile('docx', '/tmp/x.docx', 'x')
    failing.emit('error', new Error('spawn pandoc ENOENT'))
    await expect(missing).rejects.toThrow('spawn pandoc ENOENT')
  })

  // Exporting one document twice must not replace the first result.
  it('numbers a taken output path instead of overwriting it', async() => {
    const dir = await mkdtemp(path.join(tmpdir(), 'marktext-export-'))
    const taken = path.join(dir, 'notes.rst')
    await writeFile(taken, 'first')

    expect(uniquePandocOutputPath(taken)).toBe(path.join(dir, 'notes (2).rst'))
    await writeFile(path.join(dir, 'notes (2).rst'), 'second')
    expect(uniquePandocOutputPath(taken)).toBe(path.join(dir, 'notes (3).rst'))
    expect(uniquePandocOutputPath(path.join(dir, 'free.rst'))).toBe(path.join(dir, 'free.rst'))
  })

  // The plain-text writers keep `pics/a.png` as a link, so pandoc copies the pictures next to
  // the export and rewrites the links; both are relative to where it runs, not the output file.
  it('mirrors the document images next to the export', async() => {
    const { done } = runToFile('rst', '/tmp/out/notes.rst', {
      cwd: '/docs/notes',
      resourcePath: '/docs/notes',
      mirrorMedia: true
    })
    await done

    const args = spawnMock.mock.calls.at(-1)?.[1] as string[]
    expect(args).toContain('--extract-media=.')
    expect(args).toContain('--resource-path=/docs/notes')
    expect(spawnMock).toHaveBeenLastCalledWith('pandoc', args, { cwd: '/tmp/out' })
  })

  // Only a link pandoc reads from disk is mirrored; one that needs the network is left alone.
  it('tells the links that need the network apart from the file links', () => {
    expect(isRemoteMedia('https://example.com/b.png')).toBe(true)
    expect(isRemoteMedia('//example.com/b.png')).toBe(true)
    expect(isRemoteMedia('pics/a.png')).toBe(false)
    expect(isRemoteMedia('C:/docs/pics/a.png')).toBe(false)
    expect(isRemoteMedia('../outside.png')).toBe(false)
    expect(isRemoteMedia('data:image/png;base64,x')).toBe(false)
    expect(formatLinksMedia('rst')).toBe(true)
    expect(formatLinksMedia('docx')).toBe(false)
  })

  // The list comes from pandoc, whose AST is what the export is written from; a raw
  // `<img>` is a raw node and never reaches it.
  it('lists the images pandoc found in the document', async() => {
    const proc = startProcess()
    const pending = listLinkedMedia('# Title', 'gfm')
    proc.stdout.emit('data', Buffer.from(JSON.stringify([
      { t: 'Para', c: [{ t: 'Image', c: [[], [], ['pics/a.png', 'fig:']] }] },
      { t: 'RawInline', c: ['html', '<img src="pics/b.png">'] }
    ])))
    proc.emit('close', 0)

    await expect(pending).resolves.toEqual(['pics/a.png'])
    expect(spawnMock).toHaveBeenCalledWith('pandoc', ['-f', 'gfm', '-t', 'json'])
    expect(proc.stdin.end).toHaveBeenCalledWith('# Title')
  })
})
