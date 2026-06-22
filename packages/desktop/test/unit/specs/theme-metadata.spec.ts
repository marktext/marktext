import { describe, it, expect } from 'vitest'
import { fileIdFromFilename, parseThemeMetadata } from 'main_renderer/themes/metadata'

describe('fileIdFromFilename', () => {
  it('extracts the id from a valid <id>.theme.css name', () => {
    expect(fileIdFromFilename('solarized-light.theme.css')).to.equal('solarized-light')
    expect(fileIdFromFilename('my_theme.theme.css')).to.equal('my_theme')
  })

  it('extracts from a full path using the basename', () => {
    expect(fileIdFromFilename('/home/user/.config/marktext/themes/cool.theme.css')).to.equal('cool')
  })

  it('accepts a case-insensitive .theme.css suffix', () => {
    expect(fileIdFromFilename('cool.THEME.CSS')).to.equal('cool')
  })

  it('rejects files that are not *.theme.css', () => {
    expect(fileIdFromFilename('cool.css')).to.equal(null)
    expect(fileIdFromFilename('cool.theme.scss')).to.equal(null)
    expect(fileIdFromFilename('theme.css')).to.equal(null)
  })

  it('rejects ids that are not lowercase/safe', () => {
    expect(fileIdFromFilename('MyTheme.theme.css')).to.equal(null)
    expect(fileIdFromFilename('-leading.theme.css')).to.equal(null)
    expect(fileIdFromFilename('has space.theme.css')).to.equal(null)
  })

  it('neutralizes path traversal by using only the basename', () => {
    expect(fileIdFromFilename('../../etc/evil.theme.css')).to.equal('evil')
    expect(fileIdFromFilename('/abs/path/cool.theme.css')).to.equal('cool')
  })

  it('rejects ids longer than 64 characters', () => {
    expect(fileIdFromFilename(`${'a'.repeat(65)}.theme.css`)).to.equal(null)
    expect(fileIdFromFilename(`${'a'.repeat(64)}.theme.css`)).to.equal('a'.repeat(64))
  })
})

describe('parseThemeMetadata', () => {
  it('reads @name and @type from a leading header comment', () => {
    const css = '/*!\n * @name My Cool Theme\n * @type dark\n */\n:root { --themeColor: #fff; }'
    const meta = parseThemeMetadata('my-cool', css)
    expect(meta.fileId).to.equal('my-cool')
    expect(meta.name).to.equal('My Cool Theme')
    expect(meta.type).to.equal('dark')
  })

  it('defaults the type to light when missing or invalid', () => {
    expect(parseThemeMetadata('x', ':root {}').type).to.equal('light')
    expect(parseThemeMetadata('x', '/* @type purple */ :root {}').type).to.equal('light')
  })

  it('falls back to a title-cased id when @name is absent', () => {
    expect(parseThemeMetadata('solarized-light', ':root {}').name).to.equal('Solarized Light')
    expect(parseThemeMetadata('my_cool_theme', ':root {}').name).to.equal('My Cool Theme')
  })

  it('accepts a case-insensitive @type value', () => {
    expect(parseThemeMetadata('x', '/* @type DARK */ :root {}').type).to.equal('dark')
  })

  it('ignores a header that appears after the first 2KB', () => {
    const css = `${' '.repeat(2100)}/* @name Too Late\n * @type dark */`
    const meta = parseThemeMetadata('late', css)
    expect(meta.name).to.equal('Late')
    expect(meta.type).to.equal('light')
  })
})
