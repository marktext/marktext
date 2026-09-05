import fs from 'fs'
import fsPromises from 'fs/promises'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import { pipeline } from 'stream/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import yauzl, { type Entry } from 'yauzl'
import yazl from 'yazl'
import {
  closeTextPackSession,
  exportTextPackToMarkdown,
  findMarkdownDestinations,
  loadTextPackFile,
  markTextPackResourcesDirty,
  prepareTextPackReload,
  resolveTextPackReload,
  validateTextPackEntryName,
  writeTextPackFile
} from '../../../src/main/filesystem/textpack'

vi.mock('ced', () => ({ default: () => 'utf8' }))

const temporaryDirectories: string[] = []
const openedTextPacks: string[] = []

const makeDirectory = async(): Promise<string> => {
  const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'marktext-textpack-test-'))
  temporaryDirectories.push(directory)
  return directory
}

const createArchive = async(
  pathname: string,
  entries: Array<{ name: string; content: string | Buffer }>
): Promise<void> => {
  const archive = new yazl.ZipFile()
  for (const entry of entries) archive.addBuffer(Buffer.from(entry.content), entry.name)
  archive.end()
  await pipeline(archive.outputStream, fs.createWriteStream(pathname))
}

const readArchive = (pathname: string): Promise<Map<string, Buffer>> =>
  new Promise((resolve, reject) => {
    yauzl.open(pathname, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) return reject(error)
      const entries = new Map<string, Buffer>()
      zipfile.on('error', reject)
      zipfile.on('end', () => resolve(entries))
      zipfile.on('entry', (entry: Entry) => {
        zipfile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError)
          const chunks: Buffer[] = []
          stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
          stream.on('error', reject)
          stream.on('end', () => {
            entries.set(entry.fileName, Buffer.concat(chunks))
            zipfile.readEntry()
          })
        })
      })
      zipfile.readEntry()
    })
  })

afterEach(async() => {
  await Promise.all(openedTextPacks.splice(0).map(closeTextPackSession))
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fsPromises.rm(directory, { recursive: true, force: true }))
  )
})

describe('TextPack codec', () => {
  it('reserves remote embedding without silently falling back or writing a file', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'remote.textpack')
    await expect(writeTextPackFile(pathname, '![remote](https://example.invalid/a.png)', {}, undefined, {
      remoteImages: 'embed'
    })).rejects.toThrow(/not implemented/)
    await expect(fsPromises.access(pathname)).rejects.toThrow()
  })
  it('embeds Base64 images on the first save of an untitled document and deduplicates them', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'untitled.textpack')
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    const data = `data:image/png;base64,${bytes.toString('base64')}`
    const saved = await writeTextPackFile(pathname, `![one](${data})\n<img src="${data}" width="80">`, {})
    openedTextPacks.push(pathname)
    expect(saved.markdown).not.toContain('data:image')
    expect(saved.markdown).toContain('width="80"')
    const entries = await readArchive(pathname)
    const assets = [...entries.keys()].filter((name) => name.startsWith('assets/'))
    expect(assets).toHaveLength(1)
    expect(entries.get(assets[0])).toEqual(bytes)
    expect(entries.get('text.md')?.toString()).toBe(saved.markdown)
  })

  it('embeds absolute, file URL, reference and HTML images without copying absolute attachment links', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'images.textpack')
    const image = path.join(directory, 'photo one.png')
    const bytes = Buffer.from('image bytes')
    await fsPromises.writeFile(image, bytes)
    const absolute = image.split(path.sep).join('/')
    const fileUrl = pathToFileURL(image).href
    const markdown = [
      `![inline](<${absolute}>)`,
      '![reference][photo]',
      `[photo]: <${fileUrl}>`,
      `<img alt='literal src="ignored.png"'\n src="${fileUrl}" width="100">`,
      `[attachment](<${absolute}>)`,
      '![remote](https://example.invalid/image.png)',
      '![remote](//example.invalid/image.png)'
    ].join('\n')
    const saved = await writeTextPackFile(pathname, markdown, {})
    openedTextPacks.push(pathname)
    expect(saved.markdown).toContain('![inline](<assets/photo-one.png>)')
    expect(saved.markdown).toContain('[photo]: <assets/photo-one.png>')
    expect(saved.markdown).toContain('src="assets/photo-one.png" width="100"')
    expect(saved.markdown).toContain(`[attachment](<${absolute}>)`)
    expect(saved.markdown).toContain('https://example.invalid/image.png')
    expect(saved.markdown).toContain('//example.invalid/image.png')
    const entries = await readArchive(pathname)
    expect(entries.get('assets/photo-one.png')).toEqual(bytes)
    expect(await fsPromises.readFile(image)).toEqual(bytes)
    const exported = await exportTextPackToMarkdown(pathname, path.join(directory, 'out.md'), saved.markdown, {
      encoding: { encoding: 'utf8', isBom: false }, lineEnding: 'lf'
    })
    expect(exported.markdown).toContain('src="out.assets/photo-one.png"')
    expect(exported.markdown).toContain('[photo]: <out.assets/photo-one.png>')
  })

  it('leaves image examples in code and comments unchanged', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'examples.textpack')
    const markdown = [
      '``![example](missing.png)``',
      '```html',
      '<img src="missing.png">',
      '```',
      '<!-- <img src="missing.png"> -->'
    ].join('\n')
    const saved = await writeTextPackFile(pathname, markdown, {})
    openedTextPacks.push(pathname)
    expect(saved.markdown).toBe(markdown)
  })

  it.each([
    '![broken](data:image/png;base64,not!base64)',
    '![broken](data:image/png;base64,AB==)',
    '![relative](unknown.png)'
  ])('rejects invalid or unresolved images before replacing the destination: %s', async(markdown) => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'unchanged.textpack')
    const original = Buffer.from('existing destination')
    await fsPromises.writeFile(pathname, original)
    await expect(writeTextPackFile(pathname, markdown, {})).rejects.toThrow()
    expect(await fsPromises.readFile(pathname)).toEqual(original)
  })

  it('opens and round-trips Markdown while preserving unknown data', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'sample.textpack')
    const metadata = {
      version: 2,
      type: 'net.daringfireball.markdown',
      transient: false,
      thirdParty: { nested: ['kept', 42] }
    }
    const asset = Buffer.from([0, 1, 2, 250, 255])
    await createArchive(pathname, [
      { name: 'info.json', content: JSON.stringify(metadata) },
      { name: 'text.markdown', content: '\uFEFF# Before\n\n![](assets/picture.bin)\n' },
      { name: 'assets/picture.bin', content: asset },
      { name: 'vendor/private.dat', content: 'opaque' }
    ])

    const opened = await loadTextPackFile(pathname, 'lf')
    openedTextPacks.push(pathname)
    expect(opened.markdown).toBe('# Before\n\n![](assets/picture.bin)\n')
    expect(opened.documentKind).toBe('textpack')
    expect(opened.resourcePath).toBeTruthy()

    await writeTextPackFile(pathname, '# After\n', {
      encoding: { encoding: 'utf8', isBom: false },
      lineEnding: 'lf',
      adjustLineEndingOnSave: false,
      trimTrailingNewline: 1
    })

    const contents = await readArchive(pathname)
    expect(contents.get('text.markdown')?.toString()).toBe('# After\n')
    expect(contents.get('assets/picture.bin')).toEqual(asset)
    expect(contents.get('vendor/private.dat')?.toString()).toBe('opaque')
    expect(JSON.parse(contents.get('info.json')!.toString())).toEqual(metadata)
  })

  it('rejects traversal, absolute, backslash, NUL, and device paths', () => {
    for (const name of [
      '../escape',
      '/absolute',
      'C:/drive',
      'assets\\escape',
      'a\0b',
      'assets/CON'
    ]) {
      expect(() => validateTextPackEntryName(name)).toThrow(/Unsafe TextPack entry path/)
    }
  })

  it('rejects ambiguous case-folded entries', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'duplicate.textpack')
    await createArchive(pathname, [
      { name: 'info.json', content: '{"version":2}' },
      { name: 'text.md', content: '# Test' },
      { name: 'assets/A.txt', content: 'one' },
      { name: 'assets/a.txt', content: 'two' }
    ])
    await expect(loadTextPackFile(pathname, 'lf')).rejects.toThrow(/Duplicate TextPack entry/)
  })

  it('rejects unsupported metadata and ambiguous text entries', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'invalid.textpack')
    await createArchive(pathname, [
      { name: 'info.json', content: '{"version":3}' },
      { name: 'text.md', content: 'one' },
      { name: 'text.txt', content: 'two' }
    ])
    await expect(loadTextPackFile(pathname, 'lf')).rejects.toThrow(/exactly one text/)
  })

  it('does not overwrite a TextPack changed by another process', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'conflict.textpack')
    await createArchive(pathname, [
      { name: 'info.json', content: '{"version":2}' },
      { name: 'text.md', content: '# Original' }
    ])
    await loadTextPackFile(pathname, 'lf')
    openedTextPacks.push(pathname)
    const externalBytes = Buffer.from('external replacement')
    await fsPromises.writeFile(pathname, externalBytes)

    await expect(
      writeTextPackFile(pathname, '# Local edit', {
        encoding: { encoding: 'utf8', isBom: false },
        lineEnding: 'lf'
      })
    ).rejects.toThrow(/changed on disk/)
    expect(await fsPromises.readFile(pathname)).toEqual(externalBytes)
  })

  it('finds inline and reference destinations without treating code as links', () => {
    const markdown = [
      '![inline](images/a.png "title")',
      '[attachment](docs/file(1).pdf)',
      '[ref]: <images/ref image.png>',
      '`![code](ignored.png)`',
      '```md',
      '![fenced](ignored-too.png)',
      '```'
    ].join('\n')
    expect(findMarkdownDestinations(markdown).map((item) => item.value)).toEqual([
      'images/a.png',
      'docs/file(1).pdf',
      'images/ref image.png'
    ])
  })

  it('packages local resources and exports assets beside Markdown', async() => {
    const directory = await makeDirectory()
    await fsPromises.mkdir(path.join(directory, 'images'))
    await fsPromises.writeFile(
      path.join(directory, 'images', 'photo one.png'),
      Buffer.from([1, 2, 3])
    )
    const sourcePath = path.join(directory, 'source.md')
    const targetPack = path.join(directory, 'portable.textpack')
    const sourceMarkdown = '# Portable\n\n![](images/photo%20one.png)\n'
    await fsPromises.writeFile(sourcePath, sourceMarkdown)
    await fsPromises.mkdir(path.join(directory, 'docs'))
    await fsPromises.writeFile(path.join(directory, 'docs', 'report.pdf'), Buffer.from('PDF'))
    const markdownWithAttachment = `${sourceMarkdown}\n[Report](docs/report.pdf)\n`
    const saved = await writeTextPackFile(
      targetPack,
      markdownWithAttachment,
      { lineEnding: 'lf' },
      sourcePath
    )
    openedTextPacks.push(targetPack)
    expect(saved.markdown).toMatch(/!\[\]\(assets\/photo-one\.png\)/)
    expect(saved.markdown).toContain('[Report](assets/report.pdf)')

    const entries = await readArchive(targetPack)
    expect(entries.get('assets/photo-one.png')).toEqual(Buffer.from([1, 2, 3]))
    expect(entries.get('assets/report.pdf')?.toString()).toBe('PDF')

    const targetMarkdown = path.join(directory, 'exported.md')
    const exported = await exportTextPackToMarkdown(targetPack, targetMarkdown, saved.markdown, {
      encoding: { encoding: 'utf8', isBom: false },
      lineEnding: 'lf',
      adjustLineEndingOnSave: false,
      trimTrailingNewline: 1
    })
    expect(exported.markdown).toContain('exported.assets/photo-one.png')
    expect(
      await fsPromises.readFile(path.join(directory, 'exported.assets', 'photo-one.png'))
    ).toEqual(Buffer.from([1, 2, 3]))
    expect(
      await fsPromises.readFile(path.join(directory, 'exported.assets', 'report.pdf'), 'utf8')
    ).toBe('PDF')
  })

  it('stages external changes until reload is accepted and then swaps all resources', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'reload.textpack')
    await createArchive(pathname, [
      { name: 'info.json', content: '{"version":2}' },
      { name: 'text.md', content: '# Original' },
      { name: 'assets/report.pdf', content: 'old resource' }
    ])
    const opened = await loadTextPackFile(pathname, 'lf')
    openedTextPacks.push(pathname)
    markTextPackResourcesDirty(pathname)

    await createArchive(pathname, [
      { name: 'info.json', content: '{"version":2}' },
      { name: 'text.md', content: '# External' },
      { name: 'assets/report.pdf', content: 'new resource' },
      { name: 'assets/data.csv', content: 'a,b' }
    ])
    const staged = await prepareTextPackReload(pathname, 'lf')
    expect(staged.reloadToken).toBeTruthy()
    expect(
      await fsPromises.readFile(path.join(opened.resourcePath!, 'assets', 'report.pdf'), 'utf8')
    ).toBe('old resource')
    expect(
      await fsPromises.readFile(path.join(staged.resourcePath!, 'assets', 'report.pdf'), 'utf8')
    ).toBe('new resource')

    expect(await resolveTextPackReload(pathname, staged.reloadToken!, false)).toEqual({
      accepted: false
    })
    expect(
      await fsPromises.readFile(path.join(opened.resourcePath!, 'assets', 'report.pdf'), 'utf8')
    ).toBe('old resource')

    const accepted = await prepareTextPackReload(pathname, 'lf')
    const resolved = await resolveTextPackReload(pathname, accepted.reloadToken!, true)
    expect(resolved).toMatchObject({ accepted: true, resourcePath: accepted.resourcePath })
    expect(
      await fsPromises.readFile(path.join(resolved.resourcePath!, 'assets', 'data.csv'), 'utf8')
    ).toBe('a,b')
    expect(
      await fsPromises.readFile(path.join(opened.resourcePath!, 'assets', 'report.pdf'), 'utf8')
    ).toBe('old resource')

    await writeTextPackFile(pathname, '# Reloaded\n', { lineEnding: 'lf' })
    const entries = await readArchive(pathname)
    expect(entries.get('assets/report.pdf')?.toString()).toBe('new resource')
    expect(entries.get('assets/data.csv')?.toString()).toBe('a,b')
  })

  it('records recoverable resource changes in the private session manifest', async() => {
    const directory = await makeDirectory()
    const pathname = path.join(directory, 'recovery.textpack')
    await createArchive(pathname, [
      { name: 'info.json', content: '{"version":2}' },
      { name: 'text.md', content: '# Recovery' }
    ])
    const opened = await loadTextPackFile(pathname, 'lf')
    openedTextPacks.push(pathname)
    markTextPackResourcesDirty(pathname)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const manifest = JSON.parse(
      await fsPromises.readFile(
        path.join(path.dirname(opened.resourcePath!), 'manifest.json'),
        'utf8'
      )
    )
    expect(manifest).toMatchObject({
      version: 1,
      physicalPath: pathname,
      dirtyResources: true
    })
  })
})
