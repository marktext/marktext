import type { Token } from '../../src/inline/model/types';
import type { IInlineExample } from './fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as referenceDefinitions from '../../src/inline/referenceDefinitions';
import { audit, fingerprint } from './audit';
import { adaptFixture } from './fixtures';
import { htmlSemantics, tokensToHtml } from './semantics';

afterEach(() => vi.restoreAllMocks());

function example(markdown: string, html: string, suite: 'commonmark' | 'gfm' = 'commonmark'): IInlineExample {
    return { id: `${suite}:test`, suite, number: 0, section: 'Links', markdown, html };
}

describe('semantic comparison boundaries', () => {
    it('ignores attribute order, void-tag spelling and URL encoding style', () => {
        expect(htmlSemantics('<p><a title="x" href="/föö bar">x</a><br>\ny</p>'))
            .toEqual(htmlSemantics('<p><a href="/f%C3%B6%C3%B6%20bar" title="x">x</a><br />y</p>'));
    });

    it('preserves meaningful spaces between inline elements', () => {
        expect(htmlSemantics('<p><em>a</em> <em>b</em></p>'))
            .not
            .toEqual(htmlSemantics('<p><em>a</em><em>b</em></p>'));
    });

    it('preserves code whitespace, including all-space code and blank lines', () => {
        for (const value of [' ', ' x ', '\nx\n\ny\n']) {
            expect(htmlSemantics(`<p><code>${value}</code></p>`))
                .toContainEqual({ type: 'text', value });
        }
    });

    it('does not use browser repairs to hide nested anchors or unmatched end tags', () => {
        expect(htmlSemantics('<p><a href="a"><a href="b">b</a></a></p>'))
            .not
            .toEqual(htmlSemantics('<p><a href="a"></a><a href="b">b</a></p>'));
        expect(htmlSemantics('<p></foo></p>')).toContainEqual({ type: 'close', tag: 'foo' });
    });

    it('keeps tag-shaped text distinct from a recognized tag', () => {
        expect(htmlSemantics('<p>&lt;a href=x&gt;</p>'))
            .not
            .toEqual(htmlSemantics('<p><a href=x></p>'));
    });

    it('does not conflate soft breaks, hard breaks, or indentation after br', () => {
        expect(htmlSemantics('<p>a\nb</p>')).not.toEqual(htmlSemantics('<p>a<br>\nb</p>'));
        expect(htmlSemantics('<p>a<br>\n b</p>')).not.toEqual(htmlSemantics('<p>a<br>\nb</p>'));
        expect(htmlSemantics('<p>a<br>\n\nb</p>')).toContainEqual({ type: 'softbreak' });
    });

    it('does not decode reserved URL delimiters or entities twice', () => {
        expect(htmlSemantics('<p><a href="a%2Fb">x</a></p>'))
            .not
            .toEqual(htmlSemantics('<p><a href="a/b">x</a></p>'));
        expect(htmlSemantics('<p><a href="a%252Fb">x</a></p>'))
            .not
            .toEqual(htmlSemantics('<p><a href="a%2Fb">x</a></p>'));
        expect(htmlSemantics('<p>&amp;copy;</p>')).toContainEqual({ type: 'text', value: '&copy;' });
    });

    it('preserves text outside the early end of an HTML comment', () => {
        expect(htmlSemantics('<p><!--> visible --&gt;</p>'))
            .not
            .toEqual(htmlSemantics('<p><!-- visible --></p>'));
    });

    it('only ignores a serialization newline immediately following br', () => {
        expect(htmlSemantics('<p>a<br><!--comment-->\nb</p>')).toContainEqual({ type: 'softbreak' });
    });

    it('keeps non-void self-closing syntax and unmatched code ends explicit', () => {
        expect(htmlSemantics('<p><a/></p>')).not.toEqual(htmlSemantics('<p><a></a></p>'));
        expect(htmlSemantics('<p></code>a\nb</p>')).toContainEqual({ type: 'softbreak' });
    });
});

describe('fixture adaptation and difference classification', () => {
    it('passes source text, not marked inline output, to the live lexer', () => {
        const fixture = adaptFixture(example('foo\\\n     bar\n', '<p>foo<br />\nbar</p>\n'));
        expect(fixture).toMatchObject({ blocks: [{ tag: 'p', source: 'foo\\\n     bar' }] });
    });

    it('keeps paragraph boundaries and block-ending backslashes', () => {
        const result = audit(example('foo\\\n\nbar\n', '<p>foo\\</p>\n<p>bar</p>\n'));
        expect(result.status).toBe('conforming');
        expect(result.sources).toEqual(['foo\\', 'bar']);
    });

    it('uses the shared editor reference parser instead of marked resolved links', () => {
        const collector = vi.spyOn(referenceDefinitions, 'getReferenceDefinition')
            .mockReturnValue({ label: 'editor-label', info: { href: '/editor', title: 'editor title' } });
        const fixture = adaptFixture(example('[x][foo bar]\n\n[foo  bar]: /a\\* "t\\*"\n', ''));
        if ('uncovered' in fixture)
            throw new Error(fixture.uncovered);
        expect(collector).toHaveBeenCalledWith({ text: '[foo  bar]: /a\\* "t\\*"' });
        expect(fixture.labels.get('editor-label')).toEqual({ href: '/editor', title: 'editor title' });
        expect(fixture.labels.has('foo bar')).toBe(false);
        expect(fixture.blocks).toEqual([{ tag: 'p', source: '[x][foo bar]' }]);
    });

    it('does not silently discard code blocks or list context', () => {
        for (const markdown of ['    code\n', '- foo\n', 'foo\n\n```\ncode\n```\n'])
            expect(audit(example(markdown, '')).status).toBe('uncovered');
    });

    it('keeps the first reference definition', () => {
        const result = audit(example('[x]\n\n[x]: /first\n[x]: /second\n', '<p><a href="/first">x</a></p>\n'));
        expect(result.status).toBe('conforming');
    });

    it('rejects unadapted token kinds instead of declaring them conforming', () => {
        const tokens: Token[] = [];
        tokens.push({ type: 'footnote_identifier', raw: '[^x]', marker: '[^', content: 'x', parent: tokens, range: { start: 0, end: 4 } });
        expect(() => tokensToHtml(tokens, new Map())).toThrow('Unadapted lexer token');
    });

    it('does not normalize lexer-provided code text in the projection', () => {
        const tokens: Token[] = [];
        tokens.push({ type: 'inline_code', marker: '``', content: ' x ', backlash: '', raw: '`` x ``', parent: tokens, range: { start: 0, end: 7 } });
        expect(tokensToHtml(tokens, new Map())).toBe('<code> x </code>');
        const result = audit(example('x', '<p>x</p>'));
        expect(fingerprint(result)).not.toBe(fingerprint({ ...result, actual: htmlSemantics('<p>y</p>') }));
    });

    it('reports always-enabled extensions separately and does not hide unrelated defects', () => {
        expect(audit(example('https://example.com\n', '<p>https://example.com</p>\n')).status).toBe('extension-difference');
        expect(audit(example('https://example.com\n', '<p><a href="https://example.com">https://example.com</a></p>\n', 'gfm')).status).toBe('conforming');
        expect(audit(example('https://example.com x\n', '<p>https://example.com y</p>\n')).status).toBe('known-difference');
    });

    it('distinguishes older GFM emphasis expectations from the newer CommonMark baseline', () => {
        const result = audit(example('****foo****\n', '<p><strong>foo</strong></p>\n', 'gfm'));
        expect(result.status).toBe('version-difference');
    });
});
