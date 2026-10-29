// @vitest-environment happy-dom
import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { createTextSelectionState } from '../../selection/state';
import { canDropText, dropText, getTextDragSource } from '../dragDropText';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: async () => null,
    search: () => [],
}));

let muya: Muya;
beforeEach(() => {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.append(host);
    muya = new MuyaClass(host, { markdown: 'ABCDE\n\nTarget' });
    muya.init();
});
afterEach(() => muya.destroy());

function leaves(): Content[] {
    const result: Content[] = [];
    let block: Content | null | undefined = muya.editor.scrollPage!.firstContentInDescendant();
    while (block) {
        result.push(block);
        block = block.nextContentInContext() ?? null;
    }
    return result;
}
function source(block: Content, start = 1, end = 3) {
    block.setCursor(start, end, true);
    return getTextDragSource(muya)!;
}
function target(block: Content, offset: number) {
    return { block, offset, path: block.path };
}

describe('single-content text moves', () => {
    it.each([[5, 'ADEBC'], [0, 'BCADE']])('maps a same-block target at %i', (offset, expected) => {
        const [block] = leaves();
        dropText(muya, source(block), target(block, offset), false);
        expect(block.text).toBe(expected);
        expect(muya.getSelectedText()).toBe('BC');
        muya.undo();
        expect(leaves()[0].text).toBe('ABCDE');
        expect(muya.getSelectedText()).toBe('BC');
        muya.redo();
        expect(leaves()[0].text).toBe(expected);
        expect(muya.getSelectedText()).toBe('BC');
    });

    it('moves between blocks and isolates typing on both sides', () => {
        const [a, b] = leaves();
        muya.transact(() => {
            a.text += '!';
        });
        dropText(muya, source(a), target(b, 0), false);
        expect(a.text).toBe('ADE!');
        expect(b.text).toBe('BCTarget');
        muya.transact(() => {
            b.text += '?';
        });
        muya.undo();
        expect(leaves()[1].text).toBe('BCTarget');
        muya.undo();
        expect(leaves().map(b => b.text)).toEqual(['ABCDE!', 'Target']);
        muya.undo();
        expect(leaves()[0].text).toBe('ABCDE');
    });

    it.each([1, 2, 3])('does not record a move into its range at %i', (offset) => {
        const [block] = leaves();
        dropText(muya, source(block), target(block, offset), false);
        expect(block.text).toBe('ABCDE');
        expect(muya.editor.history.getHistory().stack.undo).toHaveLength(0);
    });

    it.each([1, 3])('allows copying adjacent to the selection at %i', (offset) => {
        const [block] = leaves();
        dropText(muya, source(block), target(block, offset), true);
        expect(block.text).toBe('ABCBCDE');
        muya.undo();
        expect(leaves()[0].text).toBe('ABCDE');
    });

    it.each(['# Heading', '| A | B |\n| --- | --- |\n| Cell | Value |'])('converts logical newlines for %s', (markdown) => {
        muya.setContent(`before\n\n${markdown}`);
        const [a, b] = leaves();
        muya.transact(() => {
            a.text = '\r\n甲\n\n乙\r<br>\n';
        });
        const drag = source(a, 0, a.text.length);
        const offset = b.blockName === 'atxheading.content' ? 2 : 0;
        const original = b.text;
        dropText(muya, drag, target(b, offset), true);
        expect(b.text).toBe(`${original.slice(0, offset)}<br>甲<br><br>乙<br><br><br>${original.slice(offset)}`);
        expect(a.text).toBe(drag.original);
        expect(muya.getSelectedText()).toBe('<br>甲<br><br>乙<br><br><br>');
        muya.undo();
        expect(leaves()[1].text).toBe(original);
        muya.redo();
        expect(muya.getSelectedText()).toBe('<br>甲<br><br>乙<br><br><br>');
    });

    it('preserves line breaks in paragraphs and deletes the full source without removing its container', () => {
        const [a, b] = leaves();
        muya.transact(() => {
            a.text = '甲\n乙';
        });
        dropText(muya, source(a, 0, a.text.length), target(b, 0), false);
        expect(leaves().map(b => b.text)).toEqual(['', '甲\n乙Target']);
    });

    it('rejects cross-block selections, metadata, heading markers and surrogate interiors', () => {
        const [a, b] = leaves();
        muya.setSelection(createTextSelectionState(target(a, 1), target(b, 1)));
        expect(getTextDragSource(muya)).toBeNull();
        muya.setContent('A😀B\n\n# Title\n\n```js\nx\n```');
        const [text, heading, language] = leaves();
        const drag = source(text, 0, 1);
        expect(canDropText(muya, drag, target(text, 2), true)).toBe(false);
        expect(canDropText(muya, drag, target(heading, 0), false)).toBe(false);
        expect(canDropText(muya, drag, target(language, 0), false)).toBe(false);
    });

    it.each(['- Target', '> Target', 'Target\n===', '```js\nTarget\n```'])(
        'retains target structure in %s',
        (markdown) => {
            muya.setContent(`ABCDE\n\n${markdown}`);
            const a = leaves()[0];
            const b = leaves().find(block => block.text === 'Target')!;
            const before = b.blockName;
            dropText(muya, source(a), target(b, b.text.length), false);
            expect(leaves().find(block => block.text === 'TargetBC')?.blockName).toBe(before);
            muya.undo();
            expect(muya.getMarkdown()).toBe(`ABCDE\n\n${markdown}\n`);
        },
    );

    it.each(['A# Heading', '# Heading'])(
        'normalizes a source heading after removing its prefix in %s',
        (markdown) => {
            muya.setContent(`${markdown}\n\nTarget`);
            const [a, b] = leaves();
            const drag = source(a, 0, markdown === '# Heading' ? 2 : 1);
            dropText(muya, drag, target(b, b.text.length), false);
            expect(muya.getSelectedText()).toBe(drag.original.slice(drag.start, drag.end));
            expect(leaves()[1].text).toBe(`Target${drag.original.slice(drag.start, drag.end)}`);
            muya.undo();
            expect(muya.getMarkdown()).toBe(`${markdown}\n\nTarget\n`);
        },
    );

    it.each([
        ['- A[x] foo\n\n  Target', 0, 1],
        ['1. A[x] foo\n\n   Target', 0, 1],
        ['- Before\n- A[x] foo\n- Target', 1, 2],
        ['1. Before\n2. A[x] foo\n3. Target', 1, 2],
        ['- Target\n- A[x] foo\n- After', 1, 0],
        ['> - A[x] foo\n>\n>   Target', 0, 1],
        ['- A[x] foo\n\n  - Target', 0, 1],
        ['- Before\n- A[x] foo\n\n  ```js\n  code\n  ```\n\n  Target', 1, 4],
        ['- Before\n- A[x] foo\n- Target\n- Target', 1, 3],
        ['- Before\n- A[x] foo\n\n  # Heading\n\n  Target', 1, 3],
    ])('keeps the destination through source task conversion in %s', (markdown, sourceIndex, targetIndex) => {
        muya.setContent(markdown);
        const before = muya.getMarkdown();
        const contents = leaves();
        const drag = source(contents[sourceIndex], 0, 1);
        dropText(muya, drag, target(contents[targetIndex], 0), false);
        expect(leaves().map(block => block.text)).toContain('ATarget');
        expect(leaves().map(block => block.text)).toContain('foo');
        expect(muya.getSelectedText()).toBe('A');
        const after = muya.getMarkdown();
        expect(muya.editor.history.getHistory().stack.undo).toHaveLength(1);
        muya.undo();
        expect(muya.getMarkdown()).toBe(before);
        expect(muya.getSelectedText()).toBe('A');
        muya.redo();
        expect(muya.getMarkdown()).toBe(after);
        expect(muya.getSelectedText()).toBe('A');
    });

    it.each(['A# Heading\nbody', 'A> Quote\nbody', 'A- Item\nbody', 'A---\nbody', 'A    code\nbody'])('keeps a later target after splitting source %s', (text) => {
        const [a, b] = leaves();
        muya.transact(() => {
            a.text = text;
        });
        const before = muya.getMarkdown();
        dropText(muya, source(a, 0, 1), target(b, 0), false);
        expect(leaves().at(-1)?.text).toBe('ATarget');
        expect(muya.getSelectedText()).toBe('A');
        const after = muya.getMarkdown();
        muya.undo();
        expect(muya.getMarkdown()).toBe(before);
        muya.redo();
        expect(muya.getMarkdown()).toBe(after);
        expect(muya.getSelectedText()).toBe('A');
    });

    it('retains the edited source when target task conversion rebuilds its container', () => {
        muya.setContent('- [x foo\n\n  ] Target');
        const before = muya.getMarkdown();
        const [destination, origin] = leaves();
        dropText(muya, source(origin, 0, 1), target(destination, 2), false);
        expect(leaves().map(block => block.text)).toEqual(['foo', ' Target']);
        const after = muya.getMarkdown();
        expect(after).toContain('- [x] foo');
        muya.undo();
        expect(muya.getMarkdown()).toBe(before);
        expect(muya.getSelectedText()).toBe(']');
        muya.redo();
        expect(muya.getMarkdown()).toBe(after);
    });

    it('rejects stale and read-only moves', () => {
        const [a, b] = leaves();
        const drag = source(a);
        muya.transact(() => {
            a.text += '!';
        });
        expect(canDropText(muya, drag, target(b, 0), false)).toBe(false);
        const fresh = source(a);
        muya.setReadOnly(true);
        dropText(muya, fresh, target(b, 0), false);
        expect(b.text).toBe('Target');
    });

    it('rolls back a failed target insertion and restores the source selection', () => {
        const [a, b] = leaves();
        const drag = source(a);
        vi.spyOn(b, 'update').mockImplementationOnce(() => {
            throw new Error('render failed');
        });
        expect(() => dropText(muya, drag, target(b, 0), false)).toThrow('render failed');
        expect(leaves().map(b => b.text)).toEqual(['ABCDE', 'Target']);
        expect(muya.getSelectedText()).toBe('BC');
        expect(muya.editor.history.getHistory().stack.undo).toHaveLength(0);
    });
});
