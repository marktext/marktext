import { describe, expect, it } from 'vitest'
import {
  assertMarkdownCompatibility,
  inspectMarkdown,
  normalizeGeneratedMarkdown
} from 'main_renderer/ai/outputRepair'

describe('AI Markdown output repair', () => {
  it('normalizes LaTeX delimiters without changing protected code', () => {
    const result = normalizeGeneratedMarkdown([
      'Inline \\(x^2\\) and display:',
      '',
      '\\[',
      'x^2 + y^2',
      '\\]',
      '',
      '```text',
      '\\(keep this literal\\)',
      '```'
    ].join('\n'))

    expect(result.content).toContain('Inline $x^2$ and display:')
    expect(result.content).toContain('$$\nx^2 + y^2\n$$')
    expect(result.content).toContain('\\(keep this literal\\)')
    expect(result.changes).toContain('math-delimiters')
    expect(inspectMarkdown(result.content).issues).toEqual([])
  })

  it('converts a math fence and strips an outer document fence when requested', () => {
    const result = normalizeGeneratedMarkdown([
      '```markdown',
      '```math',
      'x + y',
      '```',
      '```'
    ].join('\n'), { stripOuterFence: true })

    expect(result.content).toBe('$$\nx + y\n$$')
    expect(result.changes).toEqual(expect.arrayContaining(['outer-fence', 'math-fence']))
    expect(() => assertMarkdownCompatibility(result.content)).not.toThrow()
  })

  it('reports unsupported delimiters outside protected regions', () => {
    const inspection = inspectMarkdown('Use \\(x\\) but keep `\\[y\\]` unchanged.')
    expect(inspection.issues.map(issue => issue.code)).toContain('inline-math-delimiter')
    expect(inspection.issues.map(issue => issue.code)).not.toContain('display-math-delimiter')
  })

  it('can preserve replacement whitespace while normalizing only its syntax', () => {
    const result = normalizeGeneratedMarkdown('  \\(x\\)\n', { preserveWhitespace: true })
    expect(result.content).toBe('  $x$\n')
  })

  it('does not convert a math fence inside a larger code fence', () => {
    const result = normalizeGeneratedMarkdown([
      '````markdown',
      '```math',
      'x + y',
      '```',
      '````'
    ].join('\n'))
    expect(result.content).toContain('```math')
    expect(result.changes).not.toContain('math-fence')
  })
})
