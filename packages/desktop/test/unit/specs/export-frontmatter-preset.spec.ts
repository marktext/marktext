import { describe, expect, it } from 'vitest'
import { parseExportFrontmatter } from '@/components/exportSettings/frontmatterPreset'

describe('parseExportFrontmatter', () => {
  it('reads a flat export mapping from the document frontmatter', () => {
    const md = [
      '---',
      'title: Report',
      'export:',
      '  pageSize: A4',
      '  isLandscape: true',
      '  showFrontMatter: false',
      '  pageMarginTop: 25',
      '  tocTitle: 目录',
      '---',
      '',
      '# 正文'
    ].join('\n')

    expect(parseExportFrontmatter(md)).toEqual({
      pageSize: 'A4',
      isLandscape: true,
      showFrontMatter: false,
      pageMarginTop: 25,
      tocTitle: '目录'
    })
  })

  it('returns an empty preset without frontmatter or without an export section', () => {
    expect(parseExportFrontmatter('')).toEqual({})
    expect(parseExportFrontmatter('# Just a doc\n\nno frontmatter')).toEqual({})
    expect(parseExportFrontmatter('---\ntitle: No export section\n---\n')).toEqual({})
  })

  it('stops at the next top-level frontmatter key', () => {
    const md = '---\nexport:\n  pageSize: A5\ntitle: After\n  isLandscape: true\n---\n'
    expect(parseExportFrontmatter(md)).toEqual({ pageSize: 'A5' })
  })

  it('supports quoted strings, comments and CRLF documents', () => {
    const md = '---\r\nexport:\r\n  htmlTitle: "My Report"\r\n  theme: github # 视觉主题\r\n---\r\n'
    expect(parseExportFrontmatter(md)).toEqual({
      htmlTitle: 'My Report',
      theme: 'github'
    })
  })
})
