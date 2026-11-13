// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { renderToStaticHTML } from '../../state/renderToStaticHTML';
import { tokenizer } from '../lexer';
import { lowerPriority } from '../parser/precedence';
import { linkValidateRules } from '../parser/rules';
import { generator } from '../serialization';

describe('raw HTML at link text boundaries (#5978)', () => {
    it.each([
        ['[<b>x](</b>)', '/b', ''],
        ['[<b>x](/b)</b>', '/b', ''],
        ['[<b>x](/b "title </b>")', '/b', 'title </b>'],
        ['[<b>x](</b>) `tail`', '/b', ''],
    ])('preserves the link in %j', (source, href, title) => {
        const tokens = tokenizer(source, { profile: 'inline' });
        const link = tokens[0];
        expect(link.type).toBe('link');
        if (link.type !== 'link')
            throw new Error('Expected a link token');
        expect(link.href).toBe(href);
        expect(link.title).toBe(title);
        expect(link.children.map(token => token.raw)).toEqual(['<b>', 'x']);
        expect(generator(tokens)).toBe(source);
        expect(source.slice(link.range.start, link.range.end)).toBe(link.raw);
    });

    it('agrees with the export renderer on the reported CommonMark input', () => {
        const source = '[<b>x](</b>)';
        expect(renderToStaticHTML(source, { sanitize: false })).toBe('<p><a href="/b"><b>x</a></p>\n');
        expect(tokenizer(source)[0]).toMatchObject({ type: 'link', href: '/b', anchor: '<b>x' });
    });

    it('preserves reference links whose HTML closes after the reference label', () => {
        const source = '[<b>x][ref]</b>';
        const labels = new Map([['ref', { href: '/b', title: '' }]]);
        const tokens = tokenizer(source, { labels, profile: 'inline' });
        expect(tokens[0]).toMatchObject({ type: 'reference_link', anchor: '<b>x', label: 'ref' });
        expect(generator(tokens)).toBe(source);
    });

    it.each([
        '<b>',
        '</b>',
        '<b title="a > `">',
        '<b title=\'a < `\'>',
        '<!-- ` -->',
        '<?processing ` ?>',
        '<!DECLARATION `>',
        '<![CDATA[`]]>',
    ])('ignores code openers inside the complete HTML token %j', (html) => {
        const text = `[${html}x](/url) \`tail\``;
        expect(lowerPriority(text, html.length + 2, linkValidateRules)).toBe(true);
    });

    it.each([
        '[<b title="x](/url)">',
        '[<b title="x > ](/url)">',
        '[<!-- x](/url) -->',
        '[<?x](/url) ?>',
        '[<!DECLARATION x](/url)>',
        '[<![CDATA[x](/url)]]>',
        '[not a `link](/foo`)',
        '[foo<https://example.com/?search=](uri)>',
    ])('rejects a link whose closing bracket is inside a protected token: %j', (source) => {
        expect(tokenizer(source, { profile: 'inline' }).some(token => token.type === 'link')).toBe(false);
    });
});
