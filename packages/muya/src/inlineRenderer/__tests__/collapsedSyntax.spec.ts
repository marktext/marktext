// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Token } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { snapToCollapsedSyntax } from '../collapsedSyntax';
import * as lexer from '../lexer';

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

function collapsedSyntaxBoundaries(block: Content) {
    return block.muya.editor.inlineRenderer.getCollapsedSyntax(block);
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
        block.update();
        const boundaries = collapsedSyntaxBoundaries(block);
        expect(boundaries).toHaveLength(count * 2);
        expect(tokenReads).toBeGreaterThan(0);
        expect(tokenReads).toBeLessThan(count * 50);
        expect(siblings.mock.calls.length).toBeLessThan(count * 50);
    });

    it('reuses rendered boundaries without parsing or scanning DOM during selection', () => {
        const { block } = boot('**one***two*');
        const parsing = vi.spyOn(lexer, 'tokenizer');
        const siblings = vi.spyOn(Node.prototype, 'previousSibling', 'get');
        for (let i = 0; i < 100; i++)
            expect(snapToCollapsedSyntax(13, collapsedSyntaxBoundaries(block))).toBe(14);
        expect(parsing).not.toHaveBeenCalled();
        expect(siblings).not.toHaveBeenCalled();
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
});
