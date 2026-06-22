import { describe, expect, it } from 'vitest';
import Content from '../content';

// Regression suite for marktext muya auto-pair commits being migrated as
// part of PR-3b. Auto-pairing is the input-handler logic that decides
// whether typing `(`, `*`, `"` etc. should also insert the matching
// closing character.  In the new architecture the logic lives in
// `Content.autoPair` (packages/core/src/block/base/content.ts).
//
// `autoPair` only relies on `this.text`, `this.selection.{anchor,focus}`
// and `this.muya.options.{autoPairQuote,autoPairBracket,autoPairMarkdownSyntax}`,
// so we can drive it directly off the prototype with a structurally-typed
// fake `this` and avoid the full Muya bootstrap (which needs a real DOM).

interface IFakeThisOptions {
    autoPairQuote?: boolean;
    autoPairBracket?: boolean;
    autoPairMarkdownSyntax?: boolean;
}

function makeFakeThis(blockText: string, oldAnchorOffset: number, opts: IFakeThisOptions = {}) {
    const offset = oldAnchorOffset;
    return {
        text: blockText,
        selection: {
            anchor: { offset },
            focus: { offset },
        },
        muya: {
            options: {
                autoPairQuote: true,
                autoPairBracket: true,
                autoPairMarkdownSyntax: true,
                ...opts,
            },
        },
    };
}

function makeInputEvent(inputType: string, data: string | null) {
    // `isInputEvent` only checks for an `inputType` property and the
    // autoPair body reads `event.type`, `event.inputType`, `event.data`.
    // A plain object is enough.
    return { type: 'input', inputType, data } as unknown as Event;
}

function invokeAutoPair(
    fakeThis: ReturnType<typeof makeFakeThis>,
    event: Event,
    newText: string,
    cursorOffset: number,
    flags: { isInInlineMath?: boolean; isInInlineCode?: boolean; type?: string } = {},
) {
    // `Content.prototype.autoPair` is a real instance method but the
    // structural fakeThis doesn't satisfy the full Content surface. The
    // cursor params are `{ offset }`-shaped; the production type accepts
    // `INodeOffset | null` so the structural object lines up if cast to it.
    return Content.prototype.autoPair.call(
        fakeThis as unknown as Content,
        event,
        newText,
        { offset: cursorOffset },
        { offset: cursorOffset },
        flags.isInInlineMath ?? false,
        flags.isInInlineCode ?? false,
        flags.type ?? 'format',
    );
}

// ── marktext 358fa83d "Update auto pair quote logic" (#2960) ──────────────
// User-visible bug: typing `"`, `(`, `[`, `{` (or `'` with the existing
// pre-char guard) immediately before a non-whitespace character would
// still insert the closing pair, producing `"|foo` -> `""|foo` instead
// of `"|foo` (caret shown as `|`). The 2022 fix gates these branches on
// the next character being whitespace / EOL.
describe('autoPair — 358fa83d quote/bracket gate on postInputChar', () => {
    it('does not pair `"` when the next character is non-whitespace', () => {
        const fakeThis = makeFakeThis('foo', 0);
        const event = makeInputEvent('insertText', '"');
        const { text, needRender } = invokeAutoPair(fakeThis, event, '"foo', 1);

        expect(text).toBe('"foo');
        expect(needRender).toBe(false);
    });

    it('does not pair `(` when the next character is non-whitespace', () => {
        const fakeThis = makeFakeThis('foo', 0);
        const event = makeInputEvent('insertText', '(');
        const { text, needRender } = invokeAutoPair(fakeThis, event, '(foo', 1);

        expect(text).toBe('(foo');
        expect(needRender).toBe(false);
    });

    it('does not pair `[` when the next character is non-whitespace', () => {
        const fakeThis = makeFakeThis('bar', 0);
        const event = makeInputEvent('insertText', '[');
        const { text, needRender } = invokeAutoPair(fakeThis, event, '[bar', 1);

        expect(text).toBe('[bar');
        expect(needRender).toBe(false);
    });

    it('still pairs `"` when typed at the end of the line', () => {
        // Empty postInputChar -> the gate should still allow pairing,
        // otherwise users lose the feature entirely.
        const fakeThis = makeFakeThis('foo', 3);
        const event = makeInputEvent('insertText', '"');
        const { text, needRender } = invokeAutoPair(fakeThis, event, 'foo"', 4);

        expect(text).toBe('foo""');
        expect(needRender).toBe(true);
    });

    it('still pairs `(` when typed before whitespace', () => {
        const fakeThis = makeFakeThis(' bar', 0);
        const event = makeInputEvent('insertText', '(');
        const { text, needRender } = invokeAutoPair(fakeThis, event, '( bar', 1);

        expect(text).toBe('() bar');
        expect(needRender).toBe(true);
    });
});

// ── marktext 3fa8a9ae "no need to auto pair in inline code" (#1423) ───────
// Already covered by the `isInInlineCode` parameter on `autoPair`.
// Defensive test pins the behaviour so future refactors of `format.ts`
// (which computes the flag via `_checkCursorInTokenType`) don't regress.
describe('autoPair — 3fa8a9ae no markdown-syntax pairing inside inline code', () => {
    it('does not auto-pair `*` inside inline code', () => {
        const fakeThis = makeFakeThis('``foo``', 2);
        const event = makeInputEvent('insertText', '*');
        const { text, needRender } = invokeAutoPair(
            fakeThis,
            event,
            '``*foo``',
            3,
            { isInInlineCode: true },
        );

        expect(text).toBe('``*foo``');
        expect(needRender).toBe(false);
    });

    it('still auto-pairs `*` in normal text', () => {
        const fakeThis = makeFakeThis(' foo', 0);
        const event = makeInputEvent('insertText', '*');
        const { text, needRender } = invokeAutoPair(fakeThis, event, '* foo', 1);

        expect(text).toBe('** foo');
        expect(needRender).toBe(true);
    });
});

// ── marktext 4278362f "disable autocompletion in inline math" (#715) ─────
// Same shape as 3fa8a9ae but gated on `isInInlineMath`.
describe('autoPair — 4278362f no markdown-syntax pairing inside inline math', () => {
    it('does not auto-pair `*` inside inline math', () => {
        const fakeThis = makeFakeThis('$x$', 1);
        const event = makeInputEvent('insertText', '*');
        const { text, needRender } = invokeAutoPair(
            fakeThis,
            event,
            '$*x$',
            2,
            { isInInlineMath: true },
        );

        expect(text).toBe('$*x$');
        expect(needRender).toBe(false);
    });
});

// ── marktext 701fb9ae "Append soft-lines on text removal" (#2853) ────────
// The new architecture replaced the old `inputCtrl.removeBlocks` path
// with native browser deletion + an OT-json1 apply via
// `Editor.updateContents`, so the original multi-paragraph fix is gone.
// What survived in `autoPair` is the *single-paragraph* counterpart:
// restore the trailing soft-line when the browser collapses it on a
// backward delete at end-of-text, and reattach a soft-line when typing
// at the end of a block whose last char is `\n`. These two branches
// guard the soft-line invariant from inside the active block; pinning
// them here surfaces any future regression at unit-test speed (the
// multi-block case still needs to be re-verified by hand in examples/).
describe('autoPair — 701fb9ae soft-line preservation (in-block branches)', () => {
    it('restores trailing soft-line on deleteContentBackward at end-of-text', () => {
        const fakeThis = makeFakeThis('a\nb', 3);
        const event = makeInputEvent('deleteContentBackward', null);
        // Browser already removed the last char, leaving textContent='a\n';
        // autoPair should keep the soft-line and place the caret right
        // after it.
        const { text, needRender } = invokeAutoPair(fakeThis, event, 'a\n', 2);

        expect(text).toBe('a\n');
        expect(needRender).toBe(false);
    });

    it('re-attaches a soft-line when typing at end of a block ending in \\n', () => {
        const fakeThis = makeFakeThis('a\n', 2);
        const event = makeInputEvent('insertText', 'x');
        // Without this branch the browser may collapse the trailing
        // soft-line and leave textContent='ax'. autoPair should restore
        // the `\n` and place the caret after the new char.
        const { text } = invokeAutoPair(fakeThis, event, 'ax', 2);

        expect(text).toBe('a\nx');
    });
});

// ── marktext 67e18176 "Enter multiple lines in Chinese" (#1117) ──────────
// IME composition (e.g. CJK input) ends with a `compositionend` event,
// not a regular `insertText`. The new arch's soft-line completion
// branch in `autoPair` already covers this by accepting either event
// shape (`event.inputType === 'insertText' || event.type === 'compositionend'`).
// Pinning the compositionend pathway here so the OR-branch isn't quietly
// narrowed in a future refactor.
describe('autoPair — 67e18176 soft-line completion on compositionend', () => {
    it('appends composed text after a trailing \\n when compositionend fires', () => {
        const fakeThis = makeFakeThis('a\n', 2);
        // compositionend has no inputType; only event.type matches.
        const event = {
            type: 'compositionend',
            inputType: '',
            data: '你',
        } as unknown as Event;

        const { text } = invokeAutoPair(fakeThis, event, 'a你', 2);

        expect(text).toBe('a\n你');
    });
});

// ── marktext bbea7eca "do not auto-pair after alphanumeric" (#2843) ──────
// Already covered by `!/[a-z0-9]/i.test(preInputChar)` in the
// markdown-syntax branch. Defensive test.
describe('autoPair — bbea7eca skip when preInputChar is alphanumeric', () => {
    it('still auto-pairs `*` after whitespace (the negative control)', () => {
        // Counter-test to anchor the boundary: after `foo `, the
        // preInputChar is ' ' which is NOT alphanumeric, so the
        // markdown-syntax branch should still fire and the closer is
        // inserted. The next two tests prove that swapping the space
        // for an alphanumeric character flips the result.
        const fakeThis = makeFakeThis('foo ', 4);
        const event = makeInputEvent('insertText', '*');
        const { text, needRender } = invokeAutoPair(fakeThis, event, 'foo *', 5);

        expect(text).toBe('foo **');
        expect(needRender).toBe(true);
    });

    it('does not auto-pair `*` immediately after a letter (no space between)', () => {
        const fakeThis = makeFakeThis('foo', 3);
        const event = makeInputEvent('insertText', '*');
        const { text, needRender } = invokeAutoPair(fakeThis, event, 'foo*', 4);

        expect(text).toBe('foo*');
        expect(needRender).toBe(false);
    });

    it('does not auto-pair `_` immediately after a digit', () => {
        const fakeThis = makeFakeThis('foo1', 4);
        const event = makeInputEvent('insertText', '_');
        const { text, needRender } = invokeAutoPair(fakeThis, event, 'foo1_', 5);

        expect(text).toBe('foo1_');
        expect(needRender).toBe(false);
    });
});

// ── option toggles disable the individual auto-pair behaviours ────────────
// Each of `autoPairBracket`, `autoPairMarkdownSyntax`, `autoPairQuote`
// gates exactly one branch in `autoPair`. When the option is `false` the
// branch must NOT fire: the typed character is left as-is with no inserted
// closer and `needRender` stays `false`. These pin the per-option opt-out
// so a future refactor can't silently re-enable a disabled behaviour.
describe('autoPair — per-option opt-out', () => {
    it('does not pair `(` when autoPairBracket is false', () => {
        const fakeThis = makeFakeThis('foo', 3, { autoPairBracket: false });
        const event = makeInputEvent('insertText', '(');
        const { text, needRender } = invokeAutoPair(fakeThis, event, 'foo(', 4);

        expect(text).toBe('foo(');
        expect(needRender).toBe(false);
    });

    it('does not pair `*` after a space when autoPairMarkdownSyntax is false', () => {
        const fakeThis = makeFakeThis('foo ', 4, { autoPairMarkdownSyntax: false });
        const event = makeInputEvent('insertText', '*');
        const { text, needRender } = invokeAutoPair(fakeThis, event, 'foo *', 5);

        expect(text).toBe('foo *');
        expect(needRender).toBe(false);
    });

    it('does not pair `"` when autoPairQuote is false', () => {
        const fakeThis = makeFakeThis('foo', 3, { autoPairQuote: false });
        const event = makeInputEvent('insertText', '"');
        const { text, needRender } = invokeAutoPair(fakeThis, event, 'foo"', 4);

        expect(text).toBe('foo"');
        expect(needRender).toBe(false);
    });
});

// ── marktext #3573 absorb manually typed closing markdown marker ──────────
// With auto-pair on, typing `_` inserts `_|_`. Typing text then the closing
// `_` should "type over" the auto-paired closing marker (-> `_text_`), but
// the old `shouldRemoveClosingChar` only absorbed when the char two before
// the caret was itself a formatting char, so a closing `_` after normal text
// left a stray trailing `_` (`_text__`).
describe('autoPair — #3573 absorb manually typed closing markdown marker', () => {
    it('absorbs the closing `_` typed over the auto-paired one after text', () => {
        // "_something|_" + type "_" -> browser yields "_something__" @ offset 11
        const fakeThis = makeFakeThis('_something_', 10);
        const event = makeInputEvent('insertText', '_');
        const { text, needRender } = invokeAutoPair(fakeThis, event, '_something__', 11);

        expect(text).toBe('_something_');
        expect(needRender).toBe(true);
    });

    it('still doubles `*` into a bold opener (does not absorb marker doubling)', () => {
        // "*|*" (auto-paired italic) + type "*" -> "***"; must NOT collapse to "**"
        const fakeThis = makeFakeThis('**', 1);
        const event = makeInputEvent('insertText', '*');
        const { text } = invokeAutoPair(fakeThis, event, '***', 2);

        expect(text).not.toBe('**');
    });
});
