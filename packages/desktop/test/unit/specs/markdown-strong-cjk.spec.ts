import { describe, it, expect } from 'vitest'
import { tokenizer } from 'muya/lib/parser'

interface InlineToken {
  type: string
  children?: InlineToken[]
}

const collectTypes = (tokens: InlineToken[], out: string[] = []): string[] => {
  for (const t of tokens) {
    out.push(t.type)
    if (t.children && Array.isArray(t.children)) collectTypes(t.children, out)
  }
  return out
}

describe('inline strong with CJK boundaries (issue #4307)', () => {
  // CJK-boundary cases that fail on develop because canOpen/canCloseEmphasis
  // treat CJK Unified Ideographs as neither whitespace nor punctuation, so
  // clause (2b) of the flanking rule rejects `**` adjacent to a CJK char when
  // the inner content starts/ends with a punctuation character.
  const cjkCases = [
    '例子例子**"加粗"**例子例子',
    '日本語**(強調)**日本語',
    '한국어**[강조]**한국어',
    // Non-BMP CJK (CJK Ext-B): 𠀀 is U+20000, stored as the surrogate pair
    // 𠀀. The flanking-boundary char extraction must read the full
    // code point, otherwise CJK_REG's surrogate-pair branch is dead.
    '𠀀𠀁**"加粗"**𠀀𠀁'
  ]

  // Sanity / regression cases that already work on develop. They lock in the
  // pre-existing behavior so the fix can't regress them.
  const sanityCases = [
    'before **"normal"** after',
    'before**normal**after',
    '中文**加粗**中文'
  ]

  for (const src of cjkCases) {
    it(`recognizes strong in CJK context: ${src}`, () => {
      const tokens = tokenizer(src) as InlineToken[]
      const types = collectTypes(tokens)
      expect(types).toContain('strong')
    })
  }

  for (const src of sanityCases) {
    it(`regression: still recognizes strong in: ${src}`, () => {
      const tokens = tokenizer(src) as InlineToken[]
      const types = collectTypes(tokens)
      expect(types).toContain('strong')
    })
  }
})
