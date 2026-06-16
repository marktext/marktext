// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import CodeBlockContent from '../index';

// Regression for marktext 04834032 "fix list indent by tab (#908)".
// Despite the misleading commit title, the fix is actually about the
// Emmet-style HTML tag expansion that fires when Tab is pressed inside
// a markup / html / xml / svg / mathml code block.
//
// The pre-fix logic:
//   - used the trailing word of the entire line (`text.split(/\s+/).pop()`)
//     instead of the word immediately preceding the cursor;
//   - dropped everything after the cursor when emitting the new HTML;
//   - called `parseSelector(undefined)` when the line was empty.
//
// Post-fix logic (current `codeBlockContent.tabHandler`):
//   - reads `lastWordBeforeCursor = text.substring(0, start.offset).split(/\s+/).pop()`;
//   - composes `preText + html + postText` so trailing content survives;
//   - `parseSelector` defaults to `''` so it never blows up on undefined.
//
// We drive the prototype directly with a structurally typed `this` so we
// don't need a real Muya bootstrap.

interface IFakeCell {
    text: string;
    _lang: string;
    cursor: { start: number; end: number };
    getCursor: () => { start: { offset: number }; end: { offset: number } };
    setCursor: (start: number, end: number, _selected?: boolean) => void;
    insertTab: () => void;
}

function makeFakeCodeContent(initial: {
    text: string;
    lang: string;
    cursorAt: number;
}): IFakeCell {
    return {
        text: initial.text,
        _lang: initial.lang,
        cursor: { start: initial.cursorAt, end: initial.cursorAt },
        getCursor() {
            return {
                start: { offset: this.cursor.start },
                end: { offset: this.cursor.end },
            };
        },
        setCursor(start: number, end: number) {
            this.cursor = { start, end };
        },
        insertTab: vi.fn(),
    };
}

function makeKeyEvent() {
    return {
        preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
}

describe('codeBlockContent.tabHandler — 04834032 Emmet expansion preserves postText', () => {
    it('expands selector and keeps the text after the cursor intact', () => {
        // Cursor sits right after `div` but more text follows.
        const cell = makeFakeCodeContent({
            text: 'div post-text',
            lang: 'html',
            cursorAt: 3,
        });

        CodeBlockContent.prototype.tabHandler.call(
            cell as unknown as CodeBlockContent,
            makeKeyEvent(),
        );

        // Pre-fix bug: line became `<div></div>` and ` post-text` was lost.
        // Post-fix expectation: trailing content survives.
        expect(cell.text).toBe('<div></div> post-text');
        expect(cell.text.includes('post-text')).toBe(true);
    });

    it('expands `div#id.cls` mid-line without dropping the suffix', () => {
        const cell = makeFakeCodeContent({
            text: 'div#main.box trailing',
            lang: 'html',
            cursorAt: 'div#main.box'.length,
        });

        CodeBlockContent.prototype.tabHandler.call(
            cell as unknown as CodeBlockContent,
            makeKeyEvent(),
        );

        // The id="main" / class="box" expansion must remain anchored;
        // the trailing word must survive.
        expect(cell.text).toMatch(/^<div id="main" class="box"><\/div>/);
        expect(cell.text.endsWith(' trailing')).toBe(true);
    });

    it('does not throw when called on an empty line (parseSelector default arg)', () => {
        const cell = makeFakeCodeContent({
            text: '',
            lang: 'html',
            cursorAt: 0,
        });

        expect(() => {
            CodeBlockContent.prototype.tabHandler.call(
                cell as unknown as CodeBlockContent,
                makeKeyEvent(),
            );
        }).not.toThrow();
    });

    it('falls back to insertTab when no valid selector precedes the cursor in markup', () => {
        const cell = makeFakeCodeContent({
            text: 'not-a-tag ',
            lang: 'html',
            cursorAt: 'not-a-tag '.length,
        });

        CodeBlockContent.prototype.tabHandler.call(
            cell as unknown as CodeBlockContent,
            makeKeyEvent(),
        );

        // `lastWordBeforeCursor` is the empty string after the trailing space →
        // parseSelector → no tag → insertTab.
        expect(cell.insertTab).toHaveBeenCalledTimes(1);
        expect(cell.text).toBe('not-a-tag ');
    });

    it('falls back to insertTab for non-markup languages', () => {
        const cell = makeFakeCodeContent({
            text: 'div',
            lang: 'javascript',
            cursorAt: 3,
        });

        CodeBlockContent.prototype.tabHandler.call(
            cell as unknown as CodeBlockContent,
            makeKeyEvent(),
        );

        expect(cell.insertTab).toHaveBeenCalledTimes(1);
        expect(cell.text).toBe('div');
    });
});
