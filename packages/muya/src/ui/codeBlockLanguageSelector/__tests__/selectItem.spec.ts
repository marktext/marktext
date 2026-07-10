// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { CodeBlockLanguageSelector } from '../index';

// `selectItem` only touches a small, structurally-typed slice of the selector
// surface: `this._block` (the language-input content), `this.muya`, and — via
// `super.selectItem` — `this.cb` and `requestAnimationFrame(this.hide)`. So,
// like langInputContent/handlers.spec.ts, we drive the prototype method off a
// fake `this` and avoid the full Muya/DOM bootstrap. happy-dom supplies
// `requestAnimationFrame` for the inherited hide-on-select tail.
//
// NOTE: the real #4654 crash (mutating an orphaned block re-computes an OT
// path through a detached parent) cannot be reproduced with a structural mock
// — the mock's `block.text = name` is a plain property set, not the engine's
// path-computing setter. The end-to-end reproduction lives in
// e2e/tests/ui/code-block-language-selector-orphan-4654.spec.ts; this spec
// pins the guard's contract: a detached block (`outMostBlock` null) is left
// untouched.

function selectLanguage(fakeThis: unknown, name: string) {
    CodeBlockLanguageSelector.prototype.selectItem.call(
        fakeThis as CodeBlockLanguageSelector,
        { name },
    );
}

describe('codeBlockLanguageSelector.selectItem', () => {
    it('applies the language to the parent code block when attached', () => {
        const lastContent = { setCursor: vi.fn() };
        const parent = {
            lang: '',
            lastContentInDescendant: vi.fn(() => lastContent),
        };
        const block = {
            blockName: 'language-input',
            text: '',
            parent,
            outMostBlock: parent, // truthy => attached to the document
            update: vi.fn(),
        };
        const fakeThis = { _block: block, muya: {}, hide: vi.fn() };

        selectLanguage(fakeThis, 'python');

        expect(block.text).toBe('python');
        expect(block.update).toHaveBeenCalledTimes(1);
        expect(parent.lang).toBe('python');
        expect(lastContent.setCursor).toHaveBeenCalledWith(0, 0);
    });

    // Regression: #4654 — when the language-input's block is detached from the
    // document (its code block was converted away while the picker stayed open),
    // `outMostBlock` is null and selectItem must bail without mutating, instead
    // of crashing on the orphaned parent chain.
    it('leaves a detached block untouched (outMostBlock null)', () => {
        const parent = { lang: '', lastContentInDescendant: vi.fn() };
        const block = {
            blockName: 'language-input',
            text: '',
            parent, // immediate parent exists, but...
            outMostBlock: null, // ...an ancestor is detached from the root
            update: vi.fn(),
        };
        const fakeThis = { _block: block, muya: {}, hide: vi.fn() };

        expect(() => selectLanguage(fakeThis, 'javascript')).not.toThrow();
        expect(block.text).toBe('');
        expect(block.update).not.toHaveBeenCalled();
        expect(parent.lang).toBe('');
    });
});
