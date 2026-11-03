// @vitest-environment happy-dom

import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { renderToStaticHTML } from '../../state/renderToStaticHTML';
import { tokenizer } from '../lexer';
import { generator } from '../serialization';

const OPTIONS = {
    superSubScript: false,
    footnote: false,
    texMathDollars: false,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
    highlightSyntax: false,
    inlineDiff: false,
};

const formulas = [
    ['texMathDollars', '$[x](y)$'],
    ['texMathDollars', '$$[x](y)$$'],
    ['texMathGfm', '$`[x](y)`$'],
    ['texMathSingleBackslash', String.raw`\([x](y)\)`],
    ['texMathSingleBackslash', String.raw`\[[x](y)\]`],
    ['texMathDoubleBackslash', String.raw`\\([x](y)\\)`],
    ['texMathDoubleBackslash', String.raw`\\[[x](y)\\]`],
] as const;

describe('bracket resolution with extensions enabled', () => {
    it.each(formulas)('keeps %s formula %j atomic inside a link', (option, formula) => {
        for (const tail of ['(/target)', '[ref]']) {
            const source = `[see ${formula}]${tail}`;
            const tokens = tokenizer(source, {
                options: { ...OPTIONS, [option]: true },
                labels: new Map([['ref', { href: '/target', title: '' }]]),
            });
            expect(tokens).toHaveLength(1);
            const link = tokens[0];
            expect(link.type).toBe(tail === '(/target)' ? 'link' : 'reference_link');
            if (link.type !== 'link' && link.type !== 'reference_link')
                throw new Error('Expected an enclosing link');
            expect(link.children.map(token => token.type)).toEqual(['text', 'inline_math']);
            expect(generator(tokens)).toBe(source);
        }
    });

    it('applies ordinary CommonMark links when math is disabled', () => {
        const source = '[see $[x](y)$](/target)';
        const tokens = tokenizer(source, { options: OPTIONS });
        expect(tokens.map(token => token.type)).toEqual(['text', 'link', 'text']);
        expect(tokens[1]).toMatchObject({ href: 'y', anchor: 'x' });
        expect(generator(tokens)).toBe(source);
    });

    it.each(['[+added+]', '[-removed-]'])('gives %j precedence over inline and reference links', (diff) => {
        for (const tail of ['(url)', '[ref]', '']) {
            const source = `${diff}${tail}`;
            const tokens = tokenizer(source, {
                options: { ...OPTIONS, inlineDiff: true },
                labels: new Map([['ref', { href: '/ref', title: '' }], [diff.slice(1, -1), { href: '/shortcut', title: '' }]]),
            });
            expect(tokens[0]).toMatchObject({ type: 'inline_diff', raw: diff });
            expect(tokens.map(token => token.type)).toEqual(tail === '[ref]' ? ['inline_diff', 'reference_link'] : tail ? ['inline_diff', 'text'] : ['inline_diff']);
            expect(generator(tokens)).toBe(source);
            const html = renderToStaticHTML(source, { ...OPTIONS, inlineDiff: true, sanitize: false });
            expect(html).toContain(diff[1] === '+' ? '<ins ' : '<del ');
        }
    });

    it('keeps literal diff contents from deactivating an enclosing link', () => {
        const source = '[see [+[x](y)+]](/target)';
        const tokens = tokenizer(source, { options: { ...OPTIONS, inlineDiff: true } });
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ type: 'link', href: '/target', children: [
            { type: 'text', content: 'see ' },
            { type: 'inline_diff', content: '[x](y)' },
        ] });
        expect(generator(tokens)).toBe(source);
    });

    it('reuses bracket positions through nested descriptions, emphasis and leading text', () => {
        const source = 'before *[outer ![inner *em*](a.png)](/outer)* after';
        const tokens = tokenizer(source, { options: OPTIONS });
        expect(tokens[1]).toMatchObject({ type: 'em', children: [{
            type: 'link',
            href: '/outer',
            children: [
                { type: 'text', content: 'outer ' },
                { type: 'image', attrs: { alt: 'inner em' }, range: { start: source.indexOf('!['), end: source.indexOf('](/outer)') } },
            ],
        }] });
        expect(generator(tokens)).toBe(source);
    });

    it('recognizes the link when inline diff is disabled', () => {
        expect(tokenizer('[+added+](url)', { options: OPTIONS })[0])
            .toMatchObject({ type: 'link', anchor: '+added+', href: 'url' });
    });
});

describe('nested image performance', () => {
    it.each([1000, 5000])('handles %i image descriptions without blocking the editor', (depth) => {
        const source = `${'!['.repeat(depth)}x${'](a.png)'.repeat(depth)}`;
        const start = performance.now();
        const tokens = tokenizer(source, { options: OPTIONS });
        const elapsed = performance.now() - start;
        process.stdout.write(`nested images (${depth}, ${source.length} characters): ${elapsed.toFixed(1)} ms\n`);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ type: 'image', attrs: { src: 'a.png', alt: 'x' } });
        expect(generator(tokens)).toBe(source);
        expect(elapsed).toBeLessThan(depth === 1000 ? 500 : 2000);
    });
});
