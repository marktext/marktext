// @vitest-environment happy-dom

import type { Token } from '../../inlineRenderer/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as lexer from '../../inlineRenderer/lexer';
import { Muya } from '../../muya';
import { collapsedPreviewEndpoint, collapsedSyntaxBoundaries, snapToCollapsedSyntax } from '../collapsedSyntax';

const editors: Muya[] = [];
let originalVersion: string | undefined;

beforeEach(() => {
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (editors.length)
        editors.pop()!.destroy();
    vi.restoreAllMocks();
    if (originalVersion === undefined)
        delete (window as Partial<Window>).MUYA_VERSION;
    else
        window.MUYA_VERSION = originalVersion;
});

function boot(source: string) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: `Before ${source} after\n\n[ref]: https://example.com`, footnote: true, highlightSyntax: true, inlineDiff: true });
    muya.init();
    editors.push(muya);
    const block = muya.editor.scrollPage!.firstContentInDescendant()!;
    block.update();
    return { muya, block };
}

describe('collapsed inline syntax boundaries', () => {
    it.each(['<br>', '<br/>', '<br />'])('keeps the source boundary after a visible %s', (marker) => {
        const { block } = boot(`one${marker}two`);
        const afterBreak = 7 + 3 + marker.length;
        expect(snapToCollapsedSyntax(afterBreak, collapsedSyntaxBoundaries(block))).toBe(afterBreak);
    });

    it('does not merge formatting boundaries across a visible break', () => {
        const { block } = boot('**one**<br>**two**');
        const boundaries = collapsedSyntaxBoundaries(block);
        expect(snapToCollapsedSyntax(14, boundaries)).toBe(14);
        expect(snapToCollapsedSyntax(18, boundaries)).toBe(18);
    });

    it('bounds DOM and token reads for a long formatted paragraph', () => {
        const count = 200;
        const { block } = boot('**word** '.repeat(count));
        const tokens = lexer.tokenizer(block.text);
        let tokenReads = 0;
        const observe = (tokens: Token[]) => {
            for (const token of tokens) {
                const range = token.range;
                Object.defineProperty(token, 'range', {
                    get: () => {
                        tokenReads++;
                        return range;
                    },
                });
                if ('children' in token && Array.isArray(token.children))
                    observe(token.children);
            }
        };
        observe(tokens);
        vi.spyOn(lexer, 'tokenizer').mockReturnValue(tokens);
        const siblings = vi.spyOn(Node.prototype, 'previousSibling', 'get');
        const boundaries = collapsedSyntaxBoundaries(block);
        expect(boundaries).toHaveLength(count * 2);
        expect(tokenReads).toBeGreaterThan(0);
        expect(tokenReads).toBeLessThan(count * 10);
        expect(siblings.mock.calls.length).toBeLessThan(count * 10);
    });

    it.each([
        '**text**',
        '*text*',
        '~~text~~',
        '==text==',
        '`text`',
        '``a`b``',
        '^text^',
        '~text~',
        '{+text+}',
        '{-text-}',
        '<https://example.com>',
        '[text](https://example.com "title")',
        '[text][ref]',
        '[ref][]',
        '[ref]',
        '<kbd>text</kbd>',
        '[^note]',
        '**_text_**',
        '[**text**](https://example.com)',
        '$x+y$',
        ':smile:',
    ])('maps both hidden edges of %s to complete source boundaries', (source) => {
        const { block } = boot(source);
        const boundaries = collapsedSyntaxBoundaries(block);
        const first = boundaries[0];
        const last = boundaries[boundaries.length - 1];
        expect(first.start).toBe(7);
        expect(last.end).toBe(7 + source.length);
        for (let offset = first.start; offset <= first.end; offset++)
            expect(snapToCollapsedSyntax(offset, boundaries)).toBe(7);
        for (let offset = last.start; offset <= last.end; offset++)
            expect(snapToCollapsedSyntax(offset, boundaries)).toBe(7 + source.length);
    });

    it('keeps the shared boundary between adjacent formats', () => {
        const { block } = boot('**one***two*');
        const boundaries = collapsedSyntaxBoundaries(block);
        for (let offset = 12; offset <= 15; offset++)
            expect(snapToCollapsedSyntax(offset, boundaries)).toBe(14);
    });

    it('includes an escape when selecting its rendered character', () => {
        const { block } = boot('\\*text');
        expect(snapToCollapsedSyntax(8, collapsedSyntaxBoundaries(block))).toBe(7);
    });

    it('preserves revealed syntax and programmatic caret placement', () => {
        const { block, muya } = boot('**text**');
        block.setCursor(9, 9, true);
        expect(collapsedSyntaxBoundaries(block)).toEqual([]);
        expect(muya.editor.selection.getTextSelection()?.anchor.offset).toBe(9);
        block.setCursor(13, 13, true);
        expect(muya.editor.selection.getTextSelection()?.anchor.offset).toBe(13);
    });

    it('does not collapse visible replacement glyphs into hidden markers', () => {
        const { block } = boot('&amp; <ruby>漢<rt>kan</rt></ruby>');
        expect(collapsedSyntaxBoundaries(block)).toEqual([]);
    });

    it.each([
        { source: '$x+y$', selector: '.mu-math' },
        { source: '<ruby>漢<rt>kan</rt></ruby>', selector: '.mu-ruby' },
        { source: '&amp;', selector: '.mu-html-escape' },
    ])('maps the visual edges of $source without counting preview text', ({ source, selector }) => {
        const { block } = boot(source);
        const element = block.domNode!.querySelector<HTMLElement>(selector)!;
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 10, 40, 20));
        const boundaries = collapsedSyntaxBoundaries(block);
        const left = collapsedPreviewEndpoint(element, 21, 20)!;
        const right = collapsedPreviewEndpoint(element, 59, 20)!;
        expect(snapToCollapsedSyntax(left.offset, boundaries)).toBe(7);
        expect(snapToCollapsedSyntax(right.offset, boundaries)).toBe(7 + source.length);
    });

    it('does not snap keyboard selections after an interrupted preview drag', () => {
        const { block, muya } = boot('$x+y$');
        const preview = block.domNode!.querySelector<HTMLElement>('.mu-math')!;
        vi.spyOn(preview, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 10, 40, 20));
        vi.spyOn(document, 'elementFromPoint').mockReturnValue(preview);
        block.domNode!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 21, clientY: 20 }));
        block.domNode!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 30, clientY: 20 }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
        block.setCursor(9, 10, true);
        const selection = muya.editor.selection.getTextSelection();
        expect(selection?.anchor.offset).toBe(9);
        expect(selection?.focus.offset).toBe(10);
    });
});
