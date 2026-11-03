// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenizer } from '../lexer';
import { tokensToInlineHtml, tokensToPlainText } from '../projection';
import { generator, SourceGenerationMode } from '../serialization';

const indexing = vi.hoisted(() => ({ characters: 0, reads: 0, htmlSteps: 0 }));

vi.mock('../parser/codeSpan', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../parser/codeSpan')>();
    return {
        ...actual,
        CodeSpanScanner: class extends actual.CodeSpanScanner {
            override read(index: number) {
                indexing.reads++;
                return super.read(index);
            }

            constructor(source: string) {
                super(source);
                indexing.characters += source.length;
            }
        },
    };
});

vi.mock('../parser/brackets', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../parser/brackets')>();
    return {
        ...actual,
        BracketScanner: class extends actual.BracketScanner {
            override protectedEnd(index: number) {
                indexing.htmlSteps++;
                return super.protectedEnd(index);
            }
        },
    };
});

beforeEach(() => {
    indexing.characters = 0;
    indexing.reads = 0;
    indexing.htmlSteps = 0;
});

describe('code-span indexing in HTML-heavy paragraphs', () => {
    it.each([1000, 2000, 4000, 8000])('indexes a linear amount of source for %i wrappers', (count) => {
        const source = '<span>`code`</span> '.repeat(count);
        const tokens = tokenizer(source, { profile: 'inline' });

        expect(generator(tokens)).toBe(source);
        expect(tokens.filter(token => token.type === 'html_tag')).toHaveLength(count);
        // Bound indexing work independently of CI speed.
        expect(indexing.characters).toBe(source.length);
        expect(indexing.htmlSteps).toBeLessThanOrEqual(source.length * 2);
    }, 20_000);
});

describe('unmatched HTML wrappers', () => {
    it.each([1000, 2000, 4000, 8000])('bounds code-span reads for %i protected closers', (count) => {
        const source = '<span>`</span>` '.repeat(count);
        const tokens = tokenizer(source, { profile: 'inline' });
        expect(generator(tokens)).toBe(source);
        expect(tokens.filter(token => token.type === 'html_tag')).toHaveLength(count);
        expect(indexing.reads).toBeLessThanOrEqual(count * 4);
    }, 20_000);
});

describe('deep HTML wrappers', () => {
    it.each([[1000, '`x`'], [4000, '`x`'], [4000, 'x'], [4000, '*`x`*']] as const)('shares indexes and preserves %i levels around %s without recursion', (count, body) => {
        const source = '<span>'.repeat(count) + body + '</span>'.repeat(count);
        const contentOffset = count * 6 + body.indexOf('x');
        const tokens = tokenizer(source, { profile: 'inline', highlights: [{ start: contentOffset, end: contentOffset + 1, active: true }] });
        expect(generator(tokens, SourceGenerationMode.RebuildWrappers)).toBe(source);
        expect(indexing.characters).toBe(source.length);
        expect(indexing.htmlSteps).toBeLessThanOrEqual(source.length * 2);
        let children = tokens;
        for (let i = 0; i < count; i++) {
            expect(children).toHaveLength(1);
            const token = children[0];
            if (token.type !== 'html_tag')
                throw new Error('Expected an HTML wrapper');
            expect(token.range).toEqual({ start: i * 6, end: source.length - i * 7 });
            children = token.children!;
        }
        const leaf = children[0].type === 'em' ? children[0].children[0] : children[0];
        expect(leaf).toMatchObject({ type: body === 'x' ? 'text' : 'inline_code', content: 'x' });
        expect(leaf.highlights).toHaveLength(1);
        expect(tokensToPlainText(tokens)).toBe('x');
        expect(tokensToInlineHtml(tokens)).toBe(body === 'x' ? 'x' : body.startsWith('*') ? '<em><code>x</code></em>' : '<code>x</code>');
    }, 20_000);
});

it('bounds scans inside consecutive link labels', () => {
    const count = 2000;
    const source = '[<span>`x`](/url) '.repeat(count);
    const tokens = tokenizer(source, { profile: 'inline' });
    expect(generator(tokens, SourceGenerationMode.RebuildWrappers)).toBe(source);
    expect(tokens.filter(token => token.type === 'link')).toHaveLength(count);
    expect(indexing.reads).toBeLessThanOrEqual(count * 4);
    expect(indexing.htmlSteps).toBeLessThanOrEqual(source.length * 2);
});
