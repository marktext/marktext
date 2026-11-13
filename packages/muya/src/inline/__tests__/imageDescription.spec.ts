// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';
import { generator } from '../serialization';

describe('image descriptions (#5981)', () => {
    it.each([
        ['![foo ![bar](/inner)](/outer)', 'foo bar'],
        ['![foo [bar](/inner)](/outer)', 'foo bar'],
        ['![foo ![bar ![baz](/one)](/two)](/outer)', 'foo bar baz'],
        ['![foo [bar](/inner[)](/outer)', 'foo bar'],
        ['![foo `] [bar` baz](/outer)', 'foo ] [bar baz'],
        ['![foo <span title="]">bar</span>](/outer)', 'foo bar'],
        ['![foo \\] bar](/outer)', 'foo ] bar'],
        ['![v1.2 + x_y & `a*b` \\*stars\\*](/outer)', 'v1.2 + x_y & a*b *stars*'],
        ['![foo\nbar](/outer)', 'foo\nbar'],
        ['![foo\\\\](/outer)', 'foo\\'],
    ])('extracts the outer destination and plain description from %j', (source, alt) => {
        const tokens = tokenizer(source);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ type: 'image', attrs: { src: '/outer', alt } });
        expect(generator(tokens)).toBe(source);
        expect(tokens[0].raw).toBe(source.slice(tokens[0].range.start, tokens[0].range.end));
    });

    it.each([
        ['![foo *bar*]', 'foo *bar*'],
        ['![foo *bar*][]', 'foo *bar*'],
        ['![foo *bar*][ref]', 'ref'],
        ['![foo [bar](/inner)][ref]', 'ref'],
        ['![foo ![bar](/inner)][ref]', 'ref'],
    ])('keeps source labels separate from rendered alt text in %j', (source, label) => {
        const tokens = tokenizer(source, { labels: new Map([[label, { href: '/outer', title: '' }]]) });
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ type: 'reference_image', label, attrs: { alt: 'foo bar' } });
        expect(generator(tokens)).toBe(source);
    });

    it('preserves the unformatted source description used by editing and clipboard operations', () => {
        const source = 'before ![foo *bar*](/outer "title") after';
        const tokens = tokenizer(source);
        expect(tokens[1]).toMatchObject({
            type: 'image',
            alt: 'foo *bar*',
            attrs: { alt: 'foo bar' },
            raw: '![foo *bar*](/outer "title")',
            range: { start: 7, end: source.length - 6 },
        });
        expect(generator(tokens)).toBe(source);
    });

    it.each(['![foo][missing]', '![missing](/bad url)', '![outer [inner](/inner)'])('does not invent an outer image for %j', (source) => {
        const tokens = tokenizer(source, { labels: new Map([['foo', { href: '/outer', title: '' }]]) });
        expect(tokens.some(token => token.type === 'image' || token.type === 'reference_image')).toBe(false);
        expect(generator(tokens)).toBe(source);
    });

    it('keeps soft-break whitespace in source ranges without including it in semantic text', () => {
        const source = 'foo \n \tbar';
        const tokens = tokenizer(source);
        expect(tokens).toMatchObject([
            { type: 'text', content: 'foo' },
            { type: 'soft_line_break', raw: ' \n \t', lineBreak: '\n', range: { start: 3, end: 7 } },
            { type: 'text', content: 'bar', range: { start: 7, end: 10 } },
        ]);
        expect(generator(tokens)).toBe(source);
    });
});
