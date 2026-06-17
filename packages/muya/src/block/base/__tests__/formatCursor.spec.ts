import { describe, expect, it } from 'vitest';
import Format from '../format';

// `Format.prototype._addFormat` is the small text-rewriter that:
//   1. Wraps `text[start..end]` with the format's opening + closing
//      markers.
//   2. Adjusts `start.offset` / `end.offset` so the public `format()` call
//      can `setCursor(start, end, true)` afterwards.
//
// Two distinct cursor states drive two distinct outcomes:
//   - Non-empty selection: the originally-selected text must STAY selected
//     after wrapping (matching legacy muyajs and every standard editor —
//     select a word, bold it, the word is still highlighted). Both offsets
//     shift by the OPENING marker length so the range lands on the original
//     text now sitting inside the markers. (PR-10b's f3b53427 had collapsed
//     this selection to a caret past the closing marker — a regression.)
//   - Collapsed selection (toggle-then-type): the caret stays BETWEEN the
//     markers so the next keystroke is captured INSIDE the format.
//
// `_addFormat` only reads/writes `this.text`, so a structurally-typed
// fake `this` is enough — no Muya bootstrap needed.

interface IOffset {
    offset: number;
}

// `_addFormat` is declared private on Format, so accessing it via the
// prototype requires bypassing visibility — this structural type captures
// the signature the helper here actually invokes.
interface IFormatProtoAddFormat {
    _addFormat: (
        this: { text: string },
        type: string,
        cursor: { start: IOffset; end: IOffset },
    ) => void;
}

function applyAddFormat(text: string, start: number, end: number, type: string) {
    const fakeThis = { text } as { text: string };
    const startOffset: IOffset = { offset: start };
    const endOffset: IOffset = { offset: end };
    (Format.prototype as unknown as IFormatProtoAddFormat)._addFormat.call(fakeThis, type, {
        start: startOffset,
        end: endOffset,
    });
    return { text: fakeThis.text, start: startOffset.offset, end: endOffset.offset };
}

describe('format._addFormat caret/selection placement after wrapping', () => {
    describe('paired markdown markers — selection stays on the wrapped text', () => {
        it('strong (`**`): "abc" -> "**abc**" with "abc" still selected (2..5)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'strong');
            expect(text).toBe('**abc**');
            expect(start).toBe(2);
            expect(end).toBe(5);
        });

        it('em (`*`): "abc" -> "*abc*" with "abc" still selected (1..4)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'em');
            expect(text).toBe('*abc*');
            expect(start).toBe(1);
            expect(end).toBe(4);
        });

        it('inline_code (`` ` ``): "abc" -> "`abc`" with "abc" still selected (1..4)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'inline_code');
            expect(text).toBe('`abc`');
            expect(start).toBe(1);
            expect(end).toBe(4);
        });

        it('del (`~~`): "abc" -> "~~abc~~" with "abc" still selected (2..5)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'del');
            expect(text).toBe('~~abc~~');
            expect(start).toBe(2);
            expect(end).toBe(5);
        });

        it('inline_math (`$`): "abc" -> "$abc$" with "abc" still selected (1..4)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'inline_math');
            expect(text).toBe('$abc$');
            expect(start).toBe(1);
            expect(end).toBe(4);
        });

        it('mid-text selection: "hello world" select "world" -> "world" still selected', () => {
            const { text, start, end } = applyAddFormat('hello world', 6, 11, 'strong');
            expect(text).toBe('hello **world**');
            // 'hello ' (6) + '**' (2) = 8 .. 8 + 'world' (5) = 13
            expect(start).toBe(8);
            expect(end).toBe(13);
        });
    });

    describe('html-tag markers — selection stays on the wrapped text', () => {
        it('u (`<u>...</u>`): "abc" -> "<u>abc</u>" with "abc" still selected (3..6)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'u');
            expect(text).toBe('<u>abc</u>');
            expect(start).toBe(3);
            expect(end).toBe(6);
        });

        it('sub: "abc" -> "<sub>abc</sub>" with "abc" still selected (5..8)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'sub');
            expect(text).toBe('<sub>abc</sub>');
            expect(start).toBe(5);
            expect(end).toBe(8);
        });

        it('sup: "abc" -> "<sup>abc</sup>" with "abc" still selected (5..8)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'sup');
            expect(text).toBe('<sup>abc</sup>');
            expect(start).toBe(5);
            expect(end).toBe(8);
        });

        it('mark: "abc" -> "<mark>abc</mark>" with "abc" still selected (6..9)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'mark');
            expect(text).toBe('<mark>abc</mark>');
            expect(start).toBe(6);
            expect(end).toBe(9);
        });
    });

    describe('collapsed selection (start === end) — caret BETWEEN markers so user can type into the format', () => {
        // Toggle-then-type workflow: cursor at offset X with no selection,
        // press Ctrl+B → text gets `****` inserted at X, caret stays
        // between the two markers so the next keystroke is captured INSIDE
        // the bold. Without this branch, the new "jump past close marker"
        // logic would put the caret after the closing `**`, breaking the
        // common UX (the user's next keystroke would be plain text, not
        // bold). Copilot review on PR-10b flagged this regression.

        it('strong (collapsed at offset 3 in "abcdef"): caret stays between `**…**` (offset 5)', () => {
            const { text, start, end } = applyAddFormat('abcdef', 3, 3, 'strong');
            expect(text).toBe('abc****def');
            expect(start).toBe(5);
            expect(end).toBe(5);
        });

        it('em (collapsed at offset 0 in ""): caret stays between `*…*` (offset 1)', () => {
            const { text, start, end } = applyAddFormat('', 0, 0, 'em');
            expect(text).toBe('**');
            expect(start).toBe(1);
            expect(end).toBe(1);
        });

        it('inline_code (collapsed at offset 0 in ""): caret between backticks (offset 1)', () => {
            const { text, start, end } = applyAddFormat('', 0, 0, 'inline_code');
            expect(text).toBe('``');
            expect(start).toBe(1);
            expect(end).toBe(1);
        });

        it('u (collapsed at offset 2 in "ab"): caret between `<u>` and `</u>` (offset 5)', () => {
            const { text, start, end } = applyAddFormat('ab', 2, 2, 'u');
            expect(text).toBe('ab<u></u>');
            expect(start).toBe(5);
            expect(end).toBe(5);
        });

        it('mark (collapsed at offset 0 in ""): caret between `<mark>` and `</mark>` (offset 6)', () => {
            const { text, start, end } = applyAddFormat('', 0, 0, 'mark');
            expect(text).toBe('<mark></mark>');
            expect(start).toBe(6);
            expect(end).toBe(6);
        });
    });

    describe('link / image — preserve existing caret-inside-`()` behavior (unchanged)', () => {
        it('link: "abc" -> "[abc]()" with caret between `(` and `)` (offset 6)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'link');
            expect(text).toBe('[abc]()');
            expect(start).toBe(6);
            expect(end).toBe(6);
        });

        it('image: "abc" -> "![abc]()" with caret between `(` and `)` (offset 7)', () => {
            const { text, start, end } = applyAddFormat('abc', 0, 3, 'image');
            expect(text).toBe('![abc]()');
            expect(start).toBe(7);
            expect(end).toBe(7);
        });
    });
});
