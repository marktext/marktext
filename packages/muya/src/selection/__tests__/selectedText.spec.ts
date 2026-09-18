// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type Table from '../../block/gfm/table';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

const editors: Muya[] = [];
let originalVersion: string | undefined;

beforeEach(() => {
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (editors.length)
        editors.pop()!.destroy();
    document.getSelection()?.removeAllRanges();
    if (originalVersion === undefined)
        delete (window as Partial<Window>).MUYA_VERSION;
    else
        window.MUYA_VERSION = originalVersion;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown });
    muya.init();
    editors.push(muya);
    return muya;
}

function content(muya: Muya, text: string): Content {
    let result: Content | undefined;
    muya.editor.scrollPage!.breadthFirstTraverse((block) => {
        if (block.isContent() && block.text === text)
            result = block;
    });
    if (!result)
        throw new Error(`Content not found: ${text}`);
    return result;
}

describe('muya.getSelectedText', () => {
    it.each([false, true])('returns source text with UTF-16 offsets (backward: %s)', (backward) => {
        const muya = boot('one 😀 中文 **bold**\n');
        const block = content(muya, 'one 😀 中文 **bold**');
        const start = 4;
        const end = block.text.length;
        block.setCursor(backward ? end : start, backward ? start : end, true);

        expect(muya.getSelectedText()).toBe('😀 中文 **bold**');
    });

    const spans = [
        { name: 'paragraphs', markdown: 'First\n\nMiddle\n\nLast\n', expected: 'rst\n\nMiddle\n\nLas' },
        { name: 'nested lists', markdown: 'First\n\n- beta\n  - gamma\n\nLast\n', expected: 'rst\n\nbeta\ngamma\n\nLas' },
        { name: 'loose lists', markdown: 'First\n\n- beta\n\n- gamma\n\nLast\n', expected: 'rst\n\nbeta\n\ngamma\n\nLas' },
        { name: 'quoted paragraphs', markdown: 'First\n\n> beta\n>\n> gamma\n\nLast\n', expected: 'rst\n\nbeta\n\ngamma\n\nLas' },
        { name: 'code and its language', markdown: 'First\n\n```js\nconst x = 1\nline two\n```\n\nLast\n', expected: 'rst\n\njs\nconst x = 1\nline two\n\nLas' },
        { name: 'table cells', markdown: 'First\n\n| a | b |\n| --- | --- |\n| c | d |\n\nLast\n', expected: 'rst\n\na\nb\nc\nd\n\nLas' },
        { name: 'rendered inline content', markdown: 'First\n\n$E = mc^2$ and <ruby>漢<rt>kan</rt></ruby>\n\nLast\n', expected: 'rst\n\n$E = mc^2$ and <ruby>漢<rt>kan</rt></ruby>\n\nLas' },
    ];

    for (const backward of [false, true]) {
        it.each(spans)(`extracts a partial range across $name (backward: ${backward})`, ({ markdown, expected }) => {
            const muya = boot(markdown);
            const first = content(muya, 'First');
            const last = content(muya, 'Last');
            const start = { block: first, path: first.path, offset: 2 };
            const end = { block: last, path: last.path, offset: 3 };
            muya.editor.selection.setSelection(backward ? end : start, backward ? start : end);

            expect(muya.getSelectedText()).toBe(expected);
        });
    }

    it('returns empty text for a caret, a cleared selection and another editor', () => {
        const muya = boot('Alpha beta\n');
        const block = content(muya, 'Alpha beta');
        block.setCursor(2, 2);
        expect(muya.getSelectedText()).toBe('');

        block.setCursor(0, 5);
        expect(muya.getSelectedText()).toBe('Alpha');
        muya.editor.selection.clear();
        expect(muya.getSelectedText()).toBe('');

        const other = boot('Other editor\n');
        content(other, 'Other editor').setCursor(0, 5);
        expect(other.getSelectedText()).toBe('Other');
        expect(muya.getSelectedText()).toBe('');
    });

    // A frozen rectangular table selection drops the native range, so there is
    // nothing to report until the Selection modules are reworked.
    it('reports no text for a rectangular table selection', () => {
        const muya = boot('| a | b |\n| --- | --- |\n| c | d |\n');
        const table = content(muya, 'a').closestBlock('table') as Table;

        muya.editor.selection.table.selectTable(table);

        expect(muya.editor.selection.type).toBe('table');
        expect(document.getSelection()!.rangeCount).toBe(0);
        expect(muya.getSelectedText()).toBe('');
    });

    it('uses an explicit text selection made after a frozen table selection', () => {
        const muya = boot('| a | b |\n| --- | --- |\n| c | d |\n\nNext paragraph\n');
        const table = content(muya, 'a').closestBlock('table') as Table;
        muya.editor.selection.table.selectTable(table);

        content(muya, 'Next paragraph').setCursor(0, 4);

        expect(muya.getSelectedText()).toBe('Next');
    });
});
