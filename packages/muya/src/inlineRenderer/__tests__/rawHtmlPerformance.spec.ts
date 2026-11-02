// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generator, tokenizer } from '../lexer';

const indexing = vi.hoisted(() => ({ characters: 0 }));

vi.mock('../codeSpan', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../codeSpan')>();
    return {
        ...actual,
        CodeSpanScanner: class extends actual.CodeSpanScanner {
            constructor(source: string) {
                super(source);
                indexing.characters += source.length;
            }
        },
    };
});

beforeEach(() => {
    indexing.characters = 0;
});

describe('code-span indexing in HTML-heavy paragraphs', () => {
    it.each([1000, 2000, 4000, 8000])('indexes a linear amount of source for %i wrappers', (count) => {
        const source = '<span>`code`</span> '.repeat(count);
        const tokens = tokenizer(source, { hasBeginRules: false });

        expect(generator(tokens)).toBe(source);
        expect(tokens.filter(token => token.type === 'html_tag')).toHaveLength(count);
        // Bound indexing work independently of CI speed.
        expect(indexing.characters).toBeLessThanOrEqual(source.length * 2);
    }, 20_000);
});
