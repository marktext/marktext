import type { HTMLTagToken, Token } from '../../src/inline/model/types';
import type { IInlineExample } from './fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as lexer from '../../src/inline/lexer';
import { audit, fingerprint } from './audit';
import { htmlSemantics, tokensToHtml } from './semantics';

afterEach(() => vi.restoreAllMocks());

function fixture(markdown: string): IInlineExample {
    return { id: 'commonmark:mutation', suite: 'commonmark', number: 0, section: 'Raw HTML', markdown, html: `<p>${markdown}</p>\n` };
}

function mutateHtmlTokens(tokens: Token[], mutate: (token: HTMLTagToken) => void): void {
    for (const token of tokens) {
        if (token.type === 'html_tag')
            mutate(token);
        if ('children' in token && token.children)
            mutateHtmlTokens(token.children, mutate);
    }
}

describe('raw HTML parsed-field mutations', () => {
    it.each([
        ['tag name', (token: HTMLTagToken) => { token.tag = 'img'; }],
        ['href value', (token: HTMLTagToken) => { token.attrs.href = '/wrong'; }],
        ['missing href', (token: HTMLTagToken) => { delete token.attrs.href; }],
        ['injected src', (token: HTMLTagToken) => { token.attrs.src = '/wrong'; }],
    ] as const)('does not let a changed %s remain conforming', (_name, mutate) => {
        const example = fixture('foo <a href="/correct">bar</a>');
        const original = lexer.tokenizer;
        const before = audit(example);
        const rawProjection = htmlSemantics(tokensToHtml(original(example.markdown, { profile: 'inline' }), new Map()));
        vi.spyOn(lexer, 'tokenizer').mockImplementation((...args) => {
            const tokens = original(...args);
            mutateHtmlTokens(tokens, mutate);
            return tokens;
        });

        const after = audit(example);
        expect(before.status).toBe('conforming');
        expect(after.status).toBe('known-difference');
        expect(fingerprint(after)).not.toBe(fingerprint(before));
        expect(after.invariants).toEqual([]);
        expect(htmlSemantics(tokensToHtml(lexer.tokenizer(example.markdown, { profile: 'inline' }), new Map())))
            .toEqual(rawProjection);
    });

    it('checks src changes on void HTML tags', () => {
        const example = fixture('foo <img src="/correct" alt="ok">');
        const original = lexer.tokenizer;
        expect(audit(example).status).toBe('conforming');
        vi.spyOn(lexer, 'tokenizer').mockImplementation((...args) => {
            const tokens = original(...args);
            mutateHtmlTokens(tokens, (token) => {
                token.attrs.src = '/wrong';
            });
            return tokens;
        });
        const result = audit(example);
        expect(result.status).toBe('known-difference');
        expect(result.htmlFields).toContainEqual(expect.objectContaining({ field: 'attrs.src', expected: '/correct', actual: '/wrong' }));
    });

    it('checks HTML fields recursively inside paired HTML', () => {
        const example = fixture('foo <strong><a href="/correct">bar</a></strong>');
        const original = lexer.tokenizer;
        expect(audit(example).status).toBe('conforming');
        vi.spyOn(lexer, 'tokenizer').mockImplementation((...args) => {
            const tokens = original(...args);
            mutateHtmlTokens(tokens, (token) => {
                if (token.tag === 'a')
                    token.attrs.href = '/wrong';
            });
            return tokens;
        });
        expect(audit(example).htmlFields).toHaveLength(1);
    });

    it('fingerprints parsed-field changes even in an already nonconforming example', () => {
        const example = { ...fixture('foo <a href="/correct">bar</a>'), html: '<p>different expected text</p>\n' };
        const original = lexer.tokenizer;
        const before = audit(example);
        vi.spyOn(lexer, 'tokenizer').mockImplementation((...args) => {
            const tokens = original(...args);
            mutateHtmlTokens(tokens, (token) => {
                token.attrs.href = '/wrong';
            });
            return tokens;
        });
        const after = audit(example);
        expect(before.status).toBe('known-difference');
        expect(after.status).toBe('known-difference');
        expect(after.actual).toEqual(before.actual);
        expect(fingerprint(after)).not.toBe(fingerprint(before));
    });
});

describe('raw HTML attribute policy boundaries', () => {
    it('reports whitelist filtering and dimension normalization separately from parsing errors', () => {
        const result = audit(fixture('foo <img src="/correct" width="012" height="bogus" data-note="x" onclick="noop()">'));
        expect(result.status).toBe('conforming');
        expect(result.htmlFields).toEqual([]);
        expect(result.htmlAttributePolicies).toEqual(expect.arrayContaining([
            expect.objectContaining({ attribute: 'data-note', policy: 'attribute-whitelist', sourceValue: 'x', parsedValue: null }),
            expect.objectContaining({ attribute: 'onclick', policy: 'attribute-whitelist', sourceValue: 'noop()', parsedValue: null }),
            expect.objectContaining({ attribute: 'width', policy: 'dimension-normalization', sourceValue: '012', parsedValue: '12' }),
            expect.objectContaining({ attribute: 'height', policy: 'dimension-normalization', sourceValue: 'bogus', parsedValue: '' }),
        ]));
    });

    it('accepts and records empty defaults for missing image attributes', () => {
        const result = audit(fixture('foo <img>'));
        expect(result.status).toBe('conforming');
        expect(result.htmlFields).toEqual([]);
        expect(result.htmlAttributePolicies.map(policy => [policy.attribute, policy.policy])).toEqual([
            ['alt', 'image-default'],
            ['src', 'image-default'],
            ['title', 'image-default'],
        ]);
    });

    it('compares decoded attributes and case-insensitive tag names without false differences', () => {
        const result = audit(fixture('foo <A HREF="/correct?a=1&amp;b=2" TITLE="&quot;ok&quot;">bar</A>'));
        expect(result.status).toBe('conforming');
        expect(result.htmlFields).toEqual([]);
    });

    it('does not let excluded attributes hide a retained href regression', () => {
        const example = fixture('foo <a href="/correct" data-note="x">bar</a>');
        const original = lexer.tokenizer;
        vi.spyOn(lexer, 'tokenizer').mockImplementation((...args) => {
            const tokens = original(...args);
            mutateHtmlTokens(tokens, (token) => {
                token.attrs.href = '/wrong';
            });
            return tokens;
        });
        const result = audit(example);
        expect(result.status).toBe('known-difference');
        expect(result.htmlAttributePolicies).toContainEqual(expect.objectContaining({ attribute: 'data-note', policy: 'attribute-whitelist' }));
        expect(result.htmlFields).toContainEqual(expect.objectContaining({ field: 'attrs.href' }));
    });
});
