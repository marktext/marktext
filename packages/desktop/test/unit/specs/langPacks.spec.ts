import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  clearLanguagePacks,
  getBuiltinLanguageIds,
  getLanguageCatalog,
  getLanguagePack,
  getMuyaResource,
  isLocaleId,
  parseFlatLanguageFile,
  parseLanguagePackFolder,
  reloadLanguagePacks,
  scanLanguagePackDir
} from '../../../src/common/langPacks'

const makeTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-langpack-'))

const writeJson = (filePath: string, data: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

describe('language pack plugins', () => {
  let tempRoot: string

  beforeEach(() => {
    tempRoot = makeTempDir()
    clearLanguagePacks()
  })

  afterEach(() => {
    clearLanguagePacks()
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  it('validates locale ids', () => {
    expect(isLocaleId('th')).toBe(true)
    expect(isLocaleId('pt-BR')).toBe(true)
    expect(isLocaleId('zh-Hans')).toBe(true)
    expect(isLocaleId('messages')).toBe(false)
    expect(isLocaleId('not a locale')).toBe(false)
    expect(isLocaleId('')).toBe(false)
  })

  it('loads a flat drop-in JSON pack with $meta and muya', () => {
    const file = path.join(tempRoot, 'th.json')
    writeJson(file, {
      $meta: { id: 'th', name: 'Thai', nativeName: 'ไทย', author: 'tester', version: '1.0.0' },
      muya: { 'Code Block': 'บล็อกโค้ด' },
      menu: { file: { save: 'บันทึก' } }
    })

    const pack = parseFlatLanguageFile(file, 'user')
    expect(pack).not.toBeNull()
    expect(pack!.id).toBe('th')
    expect(pack!.nativeName).toBe('ไทย')
    expect(pack!.hasMuya).toBe(true)
    expect(pack!.muya?.['Code Block']).toBe('บล็อกโค้ด')
    expect(pack!.messages.menu).toEqual({ file: { save: 'บันทึก' } })
    expect((pack!.messages as Record<string, unknown>).$meta).toBeUndefined()
    expect((pack!.messages as Record<string, unknown>).muya).toBeUndefined()
  })

  it('rejects a flat pack whose $meta.id disagrees with the filename', () => {
    const file = path.join(tempRoot, 'th.json')
    writeJson(file, { $meta: { id: 'ko' }, menu: {} })
    expect(parseFlatLanguageFile(file, 'user')).toBeNull()
  })

  it('loads a folder pack from manifest + messages + muya', () => {
    const folder = path.join(tempRoot, 'thai-pack')
    writeJson(path.join(folder, 'manifest.json'), {
      id: 'th',
      name: 'Thai',
      nativeName: 'ไทย',
      author: 'community',
      version: '2.0.0'
    })
    writeJson(path.join(folder, 'messages.json'), { menu: { file: { save: 'บันทึก' } } })
    writeJson(path.join(folder, 'muya.json'), {
      resource: { Paragraph: 'ย่อหน้า' }
    })

    const pack = parseLanguagePackFolder(folder, 'user')
    expect(pack).not.toBeNull()
    expect(pack!.id).toBe('th')
    expect(pack!.author).toBe('community')
    expect(pack!.muya?.Paragraph).toBe('ย่อหน้า')
    expect(pack!.messages.menu).toEqual({ file: { save: 'บันทึก' } })
  })

  it('scans a directory of mixed flat files and folder packs', () => {
    writeJson(path.join(tempRoot, 'th.json'), {
      $meta: { nativeName: 'ไทย' },
      menu: { file: { save: 'บันทึก' } }
    })
    writeJson(path.join(tempRoot, 'sample-pack', 'manifest.json'), {
      id: 'xx',
      name: 'Sample',
      nativeName: '示例'
    })
    writeJson(path.join(tempRoot, 'sample-pack', 'messages.json'), { menu: {} })
    writeJson(path.join(tempRoot, 'broken.json'), {
      not: 'a valid locale id file name?',
      $meta: { id: '!!' }
    })

    // broken.json basename is "broken" — valid id, but $meta.id '!!' is not, so it is skipped.
    const found = scanLanguagePackDir(tempRoot, 'user')
    const ids = found.map(p => p.id).sort()
    expect(ids).toEqual(['th', 'xx'])
  })

  it('lets a later directory override the same language id', () => {
    const userDir = path.join(tempRoot, 'user')
    const cwdDir = path.join(tempRoot, 'cwd')
    writeJson(path.join(userDir, 'th.json'), { menu: { file: { save: 'user' } } })
    writeJson(path.join(cwdDir, 'th.json'), {
      $meta: { nativeName: 'ไทย' },
      menu: { file: { save: 'cwd' } }
    })

    reloadLanguagePacks([
      { directory: userDir, source: 'user' },
      { directory: cwdDir, source: 'cwd' }
    ])

    const pack = getLanguagePack('th')
    expect(pack?.source).toBe('cwd')
    expect(pack?.messages.menu).toEqual({ file: { save: 'cwd' } })
    expect(pack?.nativeName).toBe('ไทย')
  })

  it('exposes a sorted catalog with builtins first', () => {
    writeJson(path.join(tempRoot, 'builtin', 'en.json'), { menu: {} })
    writeJson(path.join(tempRoot, 'user', 'th.json'), {
      $meta: { name: 'Thai', nativeName: 'ไทย' },
      menu: {}
    })

    reloadLanguagePacks([
      { directory: path.join(tempRoot, 'builtin'), source: 'builtin' },
      { directory: path.join(tempRoot, 'user'), source: 'user' }
    ])

    const catalog = getLanguageCatalog()
    expect(catalog.map(e => e.id)).toEqual(['en', 'th'])
    expect(catalog[0]!.source).toBe('builtin')
    expect(catalog[1]!.source).toBe('user')
    expect(getBuiltinLanguageIds()).toEqual(['en'])
  })

  it('returns muya resources for packs that ship them', () => {
    writeJson(path.join(tempRoot, 'th.json'), {
      muya: { 'Code Block': 'บล็อกโค้ด' },
      menu: {}
    })
    reloadLanguagePacks([{ directory: tempRoot, source: 'user' }])
    expect(getMuyaResource('th')?.['Code Block']).toBe('บล็อกโค้ด')
  })

  it('ignores .min.json build artifacts and non-objects', () => {
    writeJson(path.join(tempRoot, 'en.min.json'), { menu: {} })
    writeJson(path.join(tempRoot, 'ok.json'), { menu: {} })
    fs.writeFileSync(path.join(tempRoot, 'bad.json'), '[]', 'utf8')

    const found = scanLanguagePackDir(tempRoot, 'user')
    expect(found.map(p => p.id)).toEqual(['ok'])
  })
})
