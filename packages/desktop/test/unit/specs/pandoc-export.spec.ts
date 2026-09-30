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
  getReaderExtensions,
  isRemoteMedia,
  listLinkedMedia,
  listReaderExtensions,
  pandocLocations,
  shouldMirrorMedia,
  type PandocReaderExtensions,
  type PandocToFileOptions
} from 'main_renderer/utils/pandoc'

/** A stand-in for `--list-extensions`: gfm's set plus the extras `markdown` turns on. */
const EXTENSIONS: PandocReaderExtensions = {
  gfm: new Map([
    ['pipe_tables', true],
    ['strikeout', true],
    ['footnotes', true],
    ['tex_math_dollars', true],
    ['tex_math_gfm', true],
    ['superscript', false],
    ['subscript', false]
  ]),
  markdown: new Map([
    ['pipe_tables', true],
    ['strikeout', true],
    ['footnotes', true],
    ['tex_math_dollars', true],
    ['tex_math_single_backslash', false],
    ['tex_math_double_backslash', false],
    ['superscript', true],
    ['subscript', true],
    ['smart', true],
    ['fenced_divs', true]
  ])
}

/**
 * The ChildProcess `spawn` would hand back; stdin is an emitter so the EPIPE is
 * testable. The command is resolved before the spawn, so `spawned` says when
 * the stub is actually in use rather than polling for it.
 */
const startProcess = () => {
  let inUse!: () => void
  const spawned = new Promise<void>((resolve) => {
    inUse = resolve
  })
  const proc = Object.assign(new EventEmitter(), {
    stdin: Object.assign(new EventEmitter(), { end: vi.fn() }),
    stderr: new EventEmitter(),
    stdout: new EventEmitter(),
    spawned: () => spawned
  })
  spawnMock.mockImplementation(() => {
    inUse()
    return proc
  })
  return proc
}

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
  const proc = startProcess()
  const done = pandoc.toFile(to, outputPath, input, options)
  await proc.spawned()
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
  // `gfm` enables `tex_math_dollars` and `footnotes`, so the defaults are already the
  // editor's, and only the prefs that diverge or opt in add a flag.
  it('reads GFM, adding sub/superscript or dropping footnotes only when asked', () => {
    expect(getPandocReader({ superSubScript: false })).toBe('gfm')
    expect(getPandocReader({ superSubScript: false, footnotes: false })).toBe('gfm-footnotes')
    expect(getPandocReader({ superSubScript: true })).toBe('gfm+superscript+subscript')
  })

  // #5566: the Preferences → Markdown math toggles must reach the reader, or an export
  // silently parses the delimiters the editor turns on — or leaves on — differently.
  it('forwards the dollar and gfm math toggles to the gfm reader', () => {
    expect(getPandocReader({ superSubScript: false, texMathDollars: false })).toBe(
      'gfm-tex_math_dollars'
    )
    expect(getPandocReader({ superSubScript: false, texMathGfm: true }, EXTENSIONS)).toBe(
      'gfm+tex_math_gfm'
    )
    expect(getPandocReader({ superSubScript: false, texMathGfm: false }, EXTENSIONS)).toBe(
      'gfm-tex_math_gfm'
    )
    // No listing, or one without the name: `gfm`'s own default is the only safe answer.
    expect(getPandocReader({ superSubScript: false, texMathGfm: true })).toBe('gfm')
  })

  // pandoc's `gfm` rejects the backslash math extensions, so one switches the reader to
  // `markdown` — told to read every non-math extension the way `gfm` does (#5566).
  it('reads the backslash math from a gfm-shaped markdown reader', () => {
    const reader = getPandocReader({ superSubScript: false, texMathSingleBackslash: true }, EXTENSIONS)
    expect(reader.startsWith('markdown')).toBe(true)
    expect(reader).toContain('+tex_math_single_backslash')
    expect(reader).not.toContain('tex_math_double_backslash')
    // The extensions `gfm` does not carry come off, so the quote/dash `smart` rewrite and
    // the definition-list and fenced-div syntaxes cannot change the document.
    expect(reader).toContain('-smart')
    expect(reader).toContain('-fenced_divs')
    // `pipe_tables` is on in both, so it needs no flag either way.
    expect(reader).not.toMatch(/[+-]pipe_tables/)
    // commonmark-only: no pandoc reader carries it beside the backslash extensions.
    expect(reader).not.toContain('tex_math_gfm')

    expect(
      getPandocReader(
        {
          superSubScript: true,
          footnotes: false,
          texMathSingleBackslash: true,
          texMathDoubleBackslash: true
        },
        EXTENSIONS
      )
    ).toContain('+tex_math_single_backslash+tex_math_double_backslash')
    // `markdown` enables sub/superscript itself, so an enabled preference adds no flag.
    expect(reader).toContain('-superscript')

    // No listing, or one that failed (`null`): only the math flags can be named, so a
    // backslash document still exports its formulas instead of bare `markdown`.
    expect(getPandocReader({ superSubScript: false, texMathSingleBackslash: true })).toBe(
      'markdown+tex_math_single_backslash'
    )
    expect(getPandocReader({ superSubScript: false, texMathSingleBackslash: true }, null)).toBe(
      'markdown+tex_math_single_backslash'
    )
    expect(
      getPandocReader({ superSubScript: false, texMathDollars: false, texMathDoubleBackslash: true })
    ).toBe('markdown-tex_math_dollars+tex_math_double_backslash')
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
      reader: getPandocReader({ superSubScript: true })
    })

    await expect(done).resolves.toEqual({ warnings: '' })
    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      ['-f', 'gfm+superscript+subscript', '-t', 'docx', '-s', '-o', '/tmp/notes.docx'],
      { cwd: '/docs/notes' }
    )
    expect(proc.stdin.end).toHaveBeenCalledWith('# Title')

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
    await proc.spawned()
    expect(() => proc.stdin.emit('error', new Error('write EPIPE'))).not.toThrow()
    proc.stderr.emit('data', Buffer.from('pandoc: Unknown output format broke\n'))
    proc.emit('close', 1)
    await expect(pending).rejects.toThrow('Unknown output format broke')

    const failing = startProcess()
    const missing = pandoc.toFile('docx', '/tmp/x.docx', 'x')
    await failing.spawned()
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

  // The listing is the authority on which names the installed pandoc accepts and whether
  // it enables each one; the reader is built from exactly what it reports.
  it('reads the extension names pandoc lists, with their default state', async() => {
    const proc = startProcess()
    const pending = listReaderExtensions('gfm')
    await proc.spawned()
    proc.stdout.emit('data', Buffer.from('+tex_math_dollars\r\n-smart\n+tex_math_gfm\n'))
    proc.emit('close', 0)

    await expect(pending).resolves.toEqual(
      new Map([
        ['tex_math_dollars', true],
        ['smart', false],
        ['tex_math_gfm', true]
      ])
    )
    expect(spawnMock).toHaveBeenCalledWith(expect.any(String), ['--list-extensions=gfm'])

    // A probe that fails, exits non-zero or names nothing is `null`, not an empty
    // listing: the reader then falls back instead of reading as "carries nothing".
    const failing = startProcess()
    const missing = listReaderExtensions('markdown')
    await failing.spawned()
    failing.emit('error', new Error('spawn pandoc ENOENT'))
    await expect(missing).resolves.toBeNull()

    const broken = startProcess()
    const exited = listReaderExtensions('markdown')
    await broken.spawned()
    broken.emit('close', 2)
    await expect(exited).resolves.toBeNull()

    const empty = startProcess()
    const nothing = listReaderExtensions('markdown')
    await empty.spawned()
    empty.emit('close', 0)
    await expect(nothing).resolves.toBeNull()
  })

  // A miss must not be remembered: a pandoc installed or repaired after a failed probe is
  // picked up by the next export instead of riding the empty listing forever.
  it('retries both probes after a miss and caches the hit', async() => {
    const procs = [0, 1, 2, 3].map(() =>
      Object.assign(new EventEmitter(), {
        stdin: Object.assign(new EventEmitter(), { end: vi.fn() }),
        stderr: new EventEmitter(),
        stdout: new EventEmitter()
      })
    )
    let next = 0
    spawnMock.mockImplementation(() => procs[next++])

    const first = getReaderExtensions()
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(2))
    procs[0].emit('error', new Error('spawn pandoc ENOENT'))
    procs[1].emit('error', new Error('spawn pandoc ENOENT'))
    await expect(first).resolves.toBeNull()

    const second = getReaderExtensions()
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(4))
    procs[2].stdout.emit('data', Buffer.from('+tex_math_gfm\n'))
    procs[2].emit('close', 0)
    procs[3].stdout.emit('data', Buffer.from('+tex_math_dollars\n-tex_math_single_backslash\n'))
    procs[3].emit('close', 0)
    await expect(second).resolves.toEqual({
      gfm: new Map([['tex_math_gfm', true]]),
      markdown: new Map([
        ['tex_math_dollars', true],
        ['tex_math_single_backslash', false]
      ])
    })

    // The hit is remembered: a third call spawns nothing more.
    await expect(getReaderExtensions()).resolves.toEqual({
      gfm: new Map([['tex_math_gfm', true]]),
      markdown: new Map([
        ['tex_math_dollars', true],
        ['tex_math_single_backslash', false]
      ])
    })
    expect(spawnMock).toHaveBeenCalledTimes(4)
  })

  // The list comes from pandoc's AST; a raw `<img>` is a raw node and never reaches it.
  it('lists the images pandoc found in the document', async() => {
    const proc = startProcess()
    const pending = listLinkedMedia('# Title', 'gfm')
    await proc.spawned()
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
