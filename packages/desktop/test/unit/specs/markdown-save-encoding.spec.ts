import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import iconv from 'iconv-lite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeMarkdownFile } from 'main_renderer/filesystem/markdown'

vi.mock('ced', () => ({ default: () => 'UTF-8' }))
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))

let directory: string
let pathname: string

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'marktext-5614-'))
  pathname = path.join(directory, 'note.md')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

const options = (encoding: string, isBom = false) => ({
  encoding: { encoding, isBom },
  lineEnding: 'lf' as const,
  adjustLineEndingOnSave: false
})

describe('markdown saves preserve characters (#5614)', () => {
  it('writes an extensionless path exactly and preserves a neighboring md file', async() => {
    const destination = path.join(directory, 'note')
    writeFileSync(pathname, 'Unrelated original bytes')
    await writeMarkdownFile(destination, 'Requested destination bytes', options('utf8'))
    expect(readFileSync(pathname, 'utf8')).toBe('Unrelated original bytes')
    expect(readFileSync(destination, 'utf8')).toBe('Requested destination bytes')
  })

  it.each(['cp1252', 'iso88591', 'shiftjis', 'gbk'])(
    'rejects a lossy %s save without overwriting the original bytes',
    async(encoding) => {
      const original = iconv.encode('Original text', encoding)
      writeFileSync(pathname, original)

      await expect(writeMarkdownFile(pathname, 'Café 😀 ok', options(encoding))).rejects.toThrow(
        /Command Palette.*"Change Encoding".*UTF-8/
      )

      expect(readFileSync(pathname)).toEqual(original)
    }
  )

  it('does not create a file or its parent directory for a lossy save', async() => {
    pathname = path.join(directory, 'new', 'note.md')

    await expect(writeMarkdownFile(pathname, '😀', options('cp1252'))).rejects.toThrow(/Windows 1252/)

    expect(existsSync(path.dirname(pathname))).toBe(false)
  })

  it('names the encoding and distinct unsupported code points in the error', async() => {
    const failure = writeMarkdownFile(pathname, 'Café 😀😀 漢字', options('cp1252'))

    await expect(failure).rejects.toMatchObject({ name: 'EncodingLossError' })
    await expect(failure).rejects.toThrow(
      /Western \(Windows 1252\).*characters \("😀", "漢", "字"\)/
    )
  })

  it('limits the error to eight distinct character examples', async() => {
    const content = '😀'.repeat(20) + '😀😃😄😁😆😅🤣😂🙂'

    await expect(writeMarkdownFile(pathname, content, options('cp1252'))).rejects.toThrow(
      'characters ("😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂")'
    )
  })

  it.each([1, 510, 1021])(
    'rejects a single unsupported character at code point %i in a long document',
    async(index) => {
      const content = 'a'.repeat(index) + '😀' + 'a'.repeat(1023 - index)

      await expect(writeMarkdownFile(pathname, content, options('cp1252'))).rejects.toThrow('"😀"')

      expect(existsSync(pathname)).toBe(false)
    }
  )

  it.each([
    ['cp1252', 'Café ? ok'],
    ['iso88591', 'Café ? ok'],
    ['shiftjis', '日本語 ? ok'],
    ['gbk', '中文 ? ok']
  ])('saves representable %s text including literal question marks', async(encoding, content) => {
    await writeMarkdownFile(pathname, content, options(encoding))

    expect(readFileSync(pathname)).toEqual(iconv.encode(content, encoding))
  })

  it.each(['utf8', 'utf16le', 'utf16be', 'utf32le', 'utf32be'])(
    'preserves Unicode and BOM options for %s',
    async(encoding) => {
      for (const isBom of [false, true]) {
        for (const content of ['', 'Café 😀 中文\n', '\uFEFFLeading content BOM']) {
          await writeMarkdownFile(pathname, content, options(encoding, isBom))

          expect(readFileSync(pathname)).toEqual(iconv.encode(content, encoding, { addBOM: isBom }))
        }
      }
    }
  )

  it('checks the content after converting the requested line endings', async() => {
    await writeMarkdownFile(pathname, 'Café\nnext\n', {
      ...options('cp1252'),
      adjustLineEndingOnSave: true,
      lineEnding: 'crlf'
    })

    expect(readFileSync(pathname)).toEqual(iconv.encode('Café\r\nnext\r\n', 'cp1252'))
  })

  it('can retry a rejected save as UTF-8 without losing any characters', async() => {
    const content = 'Café 😀 ok'
    await expect(writeMarkdownFile(pathname, content, options('cp1252'))).rejects.toThrow()

    await writeMarkdownFile(pathname, content, options('utf8'))

    expect(readFileSync(pathname, 'utf8')).toBe(content)
  })
})
