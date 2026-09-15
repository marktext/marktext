import { describe, expect, it } from 'vitest'

import { formatSourceLineNumber } from '@/util/sourceLineNumbers'

describe('source line numbers', () => {
  it('formats every source line instead of only multiples of ten', () => {
    expect([1, 2, 9, 10, 11].map(formatSourceLineNumber)).toEqual([1, 2, 9, 10, 11])
  })
})
