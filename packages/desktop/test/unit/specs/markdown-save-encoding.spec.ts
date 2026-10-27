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

    await expect(writeMarkdownFile(pathname, '😀', options('cp1252'))).rejects.toThrow(/cp1252/)

    expect(existsSync(path.dirname(pathname))).toBe(false)
  })

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
