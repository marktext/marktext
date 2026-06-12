import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { describe, expect, it, vi } from 'vitest';

// Same prism stub as copyHandler.spec — the import graph touches `window`.
vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

const Clipboard = (await import('../index')).default;

// Regression for marktext commits 393139e5 (#2197 — "unnecessary character
// sanitation on clipboard output") and dc54c7b6-adjacent code-content path:
// the text copied to the clipboard from a single-block selection MUST NOT be
// HTML-escaped. The user copied `<`, they should get `<` on the clipboard,
// not `&lt;`.

function fakeMuya() {
    return {
        options: { frontMatter: true },
    } as unknown as Muya;
}

function selectionOver(
    text: string,
    begin: number,
    end: number,
    blockName: string = 'paragraph.content',
) {
    // The fake block only exposes the two fields getClipboardData reads.
    const block = { text, blockName } as unknown as Content;
    return {
        isSelectionInSameBlock: true,
        anchor: { offset: begin },
        focus: { offset: end },
        anchorBlock: block,
        focusBlock: block,
    };
}

function makeClipboard(
    text: string,
    begin: number,
    end: number,
    blockName?: string,
) {
    const clipboard = new Clipboard(fakeMuya());
    Object.defineProperty(clipboard, 'selection', {
        get: () => ({
            getSelection: () => selectionOver(text, begin, end, blockName),
            table: { hasSelection: false, getStateForCopy: () => null, clear: vi.fn() },
        }),
    });
    Object.defineProperty(clipboard, 'scrollPage', { get: () => null });
    return clipboard;
}

describe('clipboard.getClipboardData — single-block selection is not HTML-escaped', () => {
    it('preserves angle brackets and ampersands verbatim in text/plain', () => {
        const clipboard = makeClipboard('a <b> & "c"', 0, 11);

        const { text } = clipboard.getClipboardData();

        expect(text).toBe('a <b> & "c"');
    });

    it('returns empty text when the selection is collapsed', () => {
        const clipboard = makeClipboard('hello', 2, 2);

        const { text } = clipboard.getClipboardData();

        expect(text).toBe('');
    });
});

// Regression for marktext commit 0028a4bc (#2375 — "Fix issue with not being
// able to copy table cell"). marktext's old `paragraphCtrl.selectTableCells`
// built a virtual {key, top, right, bottom, left, ...} cell descriptor for
// single-cell copy, but forgot the `text` field; the descriptor went to the
// clipboard with an empty body, so copying a cell produced "".
//
// New muya's `getClipboardData` doesn't have a separate "selected table
// cell" data structure: when the user copies inside a single
// `table.cell.content` block, the `isSelectionInSameBlock` branch simply
// reads `anchorBlock.text.substring(begin, end)`. So the text always survives
// — provided the call site still feeds the cell's text into that substring.
// This defensive test pins that contract.
describe('clipboard.getClipboardData — single table-cell copy keeps the cell text (marktext 0028a4bc)', () => {
    it('copies the full cell text when the user selects everything in the cell', () => {
        const cellText = 'cell <body> & "value"';
        const clipboard = makeClipboard(
            cellText,
            0,
            cellText.length,
            'table.cell.content',
        );

        const { text } = clipboard.getClipboardData();

        expect(text).toBe(cellText);
        expect(text).not.toBe('');
    });

    it('copies a partial selection inside the cell verbatim', () => {
        // Selecting `<body>` out of the middle of a cell — the substring
        // must not be HTML-escaped or stripped.
        const cellText = 'pre <body> post';
        const clipboard = makeClipboard(cellText, 4, 10, 'table.cell.content');

        const { text } = clipboard.getClipboardData();

        expect(text).toBe('<body>');
    });

    it('returns the cell text even when it is the only content', () => {
        // The original marktext bug: descriptor had no `text` → output "".
        // Here we assert the path that fills it.
        const clipboard = makeClipboard('only-cell', 0, 9, 'table.cell.content');

        const { text } = clipboard.getClipboardData();

        expect(text).toBe('only-cell');
    });
});
