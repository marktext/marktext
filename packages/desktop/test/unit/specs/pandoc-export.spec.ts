import { EventEmitter } from 'events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.fn()

// `pandoc.ts` reaches `child_process` through a default import, so does the mock.
vi.mock('child_process', () => {
  const spawn = (...args: unknown[]) => spawnMock(...args)
  return { default: { spawn }, spawn }
})

import path from 'path'
import pandoc, {
  PANDOC_EXPORT_FORMATS,
  formatLinksMedia,
  getPandocLanguage,
  getPandocReader,
  isRemoteMedia,
  listLinkedMedia,
  pandocLocations,
  shouldMirrorMedia,
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

/** Resolves the command before the spawn, so the stub has to be awaited into place. */
const spawned = (before: number) =>
  vi.waitFor(() => expect(spawnMock.mock.calls.length).toBeGreaterThan(before))

/** The spawn stub plus the pending conversion, stderr emitted before the exit included. */
const runToFile = async(
  to: string,
  outputPath: string,
  { input = 'x', stderr = '', code = 0, ...options }: PandocToFileOptions & {
    input?: string
    stderr?: string
    code?: number
  } = {}
) => {
  const before = spawnMock.mock.calls.length
  const proc = startProcess()
  const done = pandoc.toFile(to, outputPath, input, options)
  await spawned(before)
  if (stderr) proc.stderr.emit('data', Buffer.from(stderr))
  proc.emit('close', code)
  return { proc, done }
}

describe('pandoc export', () => {
  beforeEach(() => {
    // A real executable, so resolution stops at the override. child_process is
    // mocked here, and a fall-through to the login shell would hang on it.
    process.env.MARKTEXT_PANDOC = process.execPath
  })

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

  // `gfm` is what the editor shows; the extensions asked for mirror its preferences (#5379).
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

  // The argv is asserted because `cwd` is what makes `![](pics/a.png)` resolve.
  it('spawns the named binary with the reader and target asked for', async() => {
    const { proc, done } = await runToFile('docx', '/tmp/notes.docx', {
      input: '# Title',
      cwd: '/docs/notes',
      reader: getPandocReader(true)
    })

    await expect(done).resolves.toEqual({ warnings: '' })
    // Which binary is used depends on the install, so argv and `cwd` are what this pins.
    expect(spawnMock).toHaveBeenCalledWith(
      expect.any(String),
      ['-f', 'gfm+superscript+subscript', '-t', 'docx', '-s', '-o', '/tmp/notes.docx'],
      { cwd: '/docs/notes' }
    )
    expect(proc.stdin.end).toHaveBeenCalledWith('# Title')

    spawnMock.mockReset()
    process.env.MARKTEXT_PANDOC = process.execPath
    await (await runToFile('docx', '/tmp/x.docx')).done

    expect(spawnMock).toHaveBeenCalledWith(process.execPath, expect.any(Array), expect.anything())
    await expect(pandoc.exists()).resolves.toBe(true)
  })

  // pandoc splits `--metadata` on the first colon only, so "Q3: plan" survives.
  it('passes metadata on as --metadata key:value, dropping empty values', async() => {
    const { done } = await runToFile('epub3', '/tmp/x.epub', {
      metadata: { title: 'Notes: draft', lang: 'zh-Hans', author: '' }
    })
    await done

    const args = spawnMock.mock.calls.at(-1)?.[1] as string[]
    expect(args).toContain('--metadata=title:Notes: draft')
    expect(args).toContain('--metadata=lang:zh-Hans')
    expect(args.some((arg) => arg.startsWith('--metadata=author'))).toBe(false)
    expect(args.slice(-2)).toEqual(['-o', '/tmp/x.epub'])
  })

  // Exit code 0 is not clean: stderr holds the warnings and names the failing position.
  it('reports the warnings of a run that worked and the stderr of one that did not', async() => {
    const { done } = await runToFile('docx', '/tmp/x.docx', {
      stderr: '[WARNING] Could not fetch resource pics/a.png: replacing image with description\n'
    })
    await expect(done).resolves.toEqual({
      warnings: '[WARNING] Could not fetch resource pics/a.png: replacing image with description'
    })

    const { done: broken } = await runToFile('docx', '/tmp/x.docx', {
      code: 1,
      stderr: 'pandoc: Unknown output format docx\n'
    })
    await expect(broken).rejects.toThrow('Unknown output format docx')

    const { done: quiet } = await runToFile('docx', '/tmp/x.docx', { code: 3 })
    await expect(quiet).rejects.toThrow('pandoc exited with code 3')
  })

  // Without a listener the EPIPE is uncaught; a binary that never starts rejects through `error`.
  it('survives an EPIPE on stdin and a binary that cannot be spawned', async() => {
    const proc = startProcess()
    const pending = pandoc.toFile('docx', '/tmp/x.docx', 'x'.repeat(70 * 1024))
    await spawned(0)
    expect(() => proc.stdin.emit('error', new Error('write EPIPE'))).not.toThrow()
    proc.stderr.emit('data', Buffer.from('pandoc: Unknown output format broke\n'))
    proc.emit('close', 1)
    await expect(pending).rejects.toThrow('Unknown output format broke')

    const spawnsSoFar = spawnMock.mock.calls.length
    const failing = startProcess()
    const missing = pandoc.toFile('docx', '/tmp/x.docx', 'x')
    await spawned(spawnsSoFar)
    failing.emit('error', new Error('spawn pandoc ENOENT'))
    await expect(missing).rejects.toThrow('spawn pandoc ENOENT')
  })

  // `pandoc.exe` sits in a `Pandoc` folder of each: the case the `PATH` check misses.
  it('looks for pandoc where the Windows installers put it', () => {
    const env = {
      ProgramFiles: 'C:\\Program Files',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
      ProgramData: 'C:\\ProgramData',
      USERPROFILE: 'C:\\Users\\me'
    }

    // The package-manager shim dirs are not here: they serve every tool and
    // live in extraPathDirs.
    expect(pandocLocations('win32', env)).toEqual([
      path.join(env.ProgramFiles, 'Pandoc', 'pandoc.exe'),
      path.join(env['ProgramFiles(x86)'], 'Pandoc', 'pandoc.exe'),
      path.join(env.LOCALAPPDATA, 'Pandoc', 'pandoc.exe')
    ])
    expect(pandocLocations('linux', env)).toEqual([])
  })

  // The plain-text writers keep `pics/a.png` as a link, so pandoc copies the pictures along.
  it('mirrors the document images next to the export', async() => {
    const { done } = await runToFile('rst', '/tmp/out/notes.rst', {
      cwd: '/docs/notes',
      resourcePath: '/docs/notes',
      mirrorMedia: true
    })
    await done

    const args = spawnMock.mock.calls.at(-1)?.[1] as string[]
    expect(args).toContain('--extract-media=.')
    expect(args).toContain('--resource-path=/docs/notes')
    expect(spawnMock).toHaveBeenLastCalledWith(expect.any(String), args, { cwd: '/tmp/out' })
  })

  // Only a link pandoc reads from disk is mirrored; one that needs the network is left alone.
  it('tells the links that need the network apart from the file links', () => {
    expect(isRemoteMedia('https://example.com/b.png')).toBe(true)
    expect(isRemoteMedia('//example.com/b.png')).toBe(true)
    expect(isRemoteMedia('pics/a.png')).toBe(false)
    expect(isRemoteMedia('C:/docs/pics/a.png')).toBe(false)
    // Two backslashes open a file over SMB, they do not fetch a URL.
    expect(isRemoteMedia('\\\\srv\\pics\\a.png')).toBe(false)
    expect(isRemoteMedia('../outside.png')).toBe(false)
    expect(isRemoteMedia('data:image/png;base64,x')).toBe(false)
    expect(formatLinksMedia('rst')).toBe(true)
    expect(formatLinksMedia('docx')).toBe(false)
  })

  // `--extract-media` replaces a link it cannot read with the alt text, which is exactly what
  // a never-saved document's relative links are — no folder to read them from (#5379).
  it('mirrors only the links the export is able to read', () => {
    const dir = path.dirname(path.resolve('/docs/notes.md'))
    const out = path.resolve('/out/notes.rst')

    expect(shouldMirrorMedia(['pics/a.png'], dir, out)).toBe(true)
    expect(shouldMirrorMedia([path.resolve('/docs/pics/a.png')], dir, out)).toBe(true)
    // No path yet: an absolute link needs no folder to be read from, a relative one does.
    expect(shouldMirrorMedia(['pics/a.png'], undefined, out)).toBe(false)
    expect(shouldMirrorMedia([path.resolve('/docs/pics/a.png')], undefined, out)).toBe(true)
    // A download that fails costs the picture, and the document's own folder needs no copy.
    expect(shouldMirrorMedia(['https://example.com/b.png'], dir, out)).toBe(false)
    expect(shouldMirrorMedia(['pics/a.png'], dir, path.join(dir, 'notes.rst'))).toBe(false)
    // The same folder spelled by hand; `path.join` would resolve the `..` and hide the case.
    expect(shouldMirrorMedia(['pics/a.png'], dir, `${dir}${path.sep}..${path.sep}${path.basename(dir)}${path.sep}notes.rst`)).toBe(false)
  })

  // The list comes from pandoc's AST; a raw `<img>` is a raw node and never reaches it.
  it('lists the images pandoc found in the document', async() => {
    const proc = startProcess()
    const pending = listLinkedMedia('# Title', 'gfm')
    await spawned(0)
    proc.stdout.emit('data', Buffer.from(JSON.stringify([
      { t: 'Para', c: [{ t: 'Image', c: [[], [], ['pics/a.png', 'fig:']] }] },
      { t: 'RawInline', c: ['html', '<img src="pics/b.png">'] }
    ])))
    proc.emit('close', 0)

    await expect(pending).resolves.toEqual(['pics/a.png'])
    expect(spawnMock).toHaveBeenCalledWith(expect.any(String), ['-f', 'gfm', '-t', 'json'])
    expect(proc.stdin.end).toHaveBeenCalledWith('# Title')
  })
})
