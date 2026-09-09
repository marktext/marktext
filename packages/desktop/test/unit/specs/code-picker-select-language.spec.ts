import { describe, expect, it, vi } from 'vitest'
import codeBlockCtrl from 'muya/lib/contentState/codeBlockCtrl'

// codeBlockCtrl is a mixin factory: it installs selectLanguage /
// updateCodeLanguage onto a ContentState class. Drive selectLanguage off a
// minimal fake so the spec needs no Muya/DOM bootstrap — the same approach as
// packages/muya's codeBlockLanguageSelector/__tests__/selectItem.spec.ts.
class FakeContentState {
  blocks: Record<string, unknown> = {}

  getBlock(id: string) {
    return this.blocks[id] ?? null
  }
}
codeBlockCtrl(FakeContentState)

type SelectLanguageState = FakeContentState & {
  selectLanguage(paragraph: { id: string }, lang: string): void
  updateCodeLanguage(block: unknown, lang: string): void
}

describe('selectLanguage (#4896)', () => {
  // Regression: confirming a language with the keyboard after the paragraph
  // was already converted into a code block left the picker callback holding
  // a stale paragraph id — selectLanguage passed the null block into
  // updateCodeLanguage, which crashed reading `functionType`. The real
  // updateCodeLanguage stays in place here so the spec fails without the
  // guard, exactly like the reported crash.
  it('bails without crashing when the picked block no longer exists', () => {
    const state = new FakeContentState() as SelectLanguageState
    const spy = vi.spyOn(state, 'updateCodeLanguage')

    expect(() => state.selectLanguage({ id: 'ag-gone' }, 'python')).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('still applies the language when the block is present', () => {
    const state = new FakeContentState() as SelectLanguageState
    state.updateCodeLanguage = vi.fn()
    const block = { functionType: 'languageInput', text: '' }
    state.blocks['ag-1'] = block

    state.selectLanguage({ id: 'ag-1' }, 'python')

    expect(state.updateCodeLanguage).toHaveBeenCalledWith(block, 'python')
  })
})
