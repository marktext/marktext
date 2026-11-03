// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';
import { generator, SourceGenerationMode } from '../serialization';

describe('commonMark raw HTML grammar (#5980)', () => {
    it.each([
        '<a h*#ref="hi">',
        '<a href=\'bar\'title=title>',
        '<a href="hi\'> <a href=hi\'>',
        '< a>',
        '<bar/ >',
        '<foo bar=baz\nbim!bop />',
        '<a\n\nhref="x">',
        '<a href="\\"">',
    ])('leaves invalid syntax literal: %j', (source) => {
        const tokens = tokenizer(source, { profile: 'inline' });
        expect(tokens.some(token => token.type === 'html_tag')).toBe(false);
        expect(generator(tokens)).toBe(source);
    });

    it('keeps angle brackets inside quoted attributes atomic', () => {
        const source = '<a foo="bar" bam = \'baz <em>"</em>\'\n_boolean zoop:33=zoop:33 />';
        const tokens = tokenizer(source, { profile: 'inline' });
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ type: 'html_tag', openTag: source, content: undefined, children: [] });
        expect(generator(tokens)).toBe(source);
    });

    it.each([
        ['</a>', 'closing-tag'],
        ['</foo \n>', 'closing-tag'],
        ['<!-->', 'comment'],
        ['<!--->', 'comment'],
        ['<!-- a\n>b -->', 'comment'],
        ['<?php echo $a; ?>', 'processing-instruction'],
        ['<!ELEMENT br EMPTY>', 'declaration'],
        ['<![CDATA[>&<]]>', 'cdata'],
    ])('recognizes %j independently of display policy', (source, kind) => {
        const tokens = tokenizer(source, { profile: 'inline' });
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ type: 'html_tag', kind, raw: source, range: { start: 0, end: source.length } });
        expect(generator(tokens)).toBe(source);
    });

    it('parses attributes without DOM tree repair, using HTML rather than Markdown escapes', () => {
        const tokens = tokenizer('<TD TITLE="&quot;\\* &Dcaron;" title="ignored" width="012" onclick="noop()">x</TD>', { profile: 'inline' });
        expect(tokens[0]).toMatchObject({ tag: 'td', attrs: { title: '"\\* Ď', width: '12' }, content: 'x' });
        if (tokens[0].type !== 'html_tag')
            throw new Error('Expected raw HTML');
        expect(tokens[0].attrs).not.toHaveProperty('onclick');
    });

    it('preserves image defaults and first-attribute precedence', () => {
        expect(tokenizer('<img src="one" src="two">', { profile: 'inline' })[0])
            .toMatchObject({ tag: 'img', attrs: { src: 'one', title: '', alt: '' } });
    });

    it.each([
        '<span><span>x</span>y</span>',
        '<span title="</span>">x</span>',
        '<span>`</span>`x</span>',
        '<span><!-- </span> -->x</span>',
    ])('pairs display wrappers outside protected syntax: %j', (source) => {
        const tokens = tokenizer(source, { profile: 'inline' });
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ type: 'html_tag', raw: source, closeTag: '</span>' });
        expect(generator(tokens, SourceGenerationMode.RebuildWrappers)).toBe(source);
    });

    it('shares code-span offsets across sibling and nested HTML wrappers', () => {
        const source = 'prefix `before` <span>`</span>`x</span> <b><i>`</i>`y</i></b> suffix';
        const tokens = tokenizer(source, { profile: 'inline' });
        const wrappers = tokens.filter(token => token.type === 'html_tag');
        expect(wrappers.map(token => token.raw)).toEqual(['<span>`</span>`x</span>', '<b><i>`</i>`y</i></b>']);
        expect(generator(tokens, SourceGenerationMode.RebuildWrappers)).toBe(source);
        for (const wrapper of wrappers) {
            expect(source.slice(wrapper.range.start, wrapper.range.end)).toBe(wrapper.raw);
            expect(wrapper.children?.[0]).toMatchObject({ range: { start: wrapper.range.start + wrapper.openTag.length } });
        }
    });
});

it.each(['', '<i>first</i> '])('pairs HTML after a backtick owned by math: %j', (prefix) => {
    const source = `${prefix}$\`math$ <span>body</span> \`tail\``;
    const tokens = tokenizer(source, { profile: 'inline' });
    expect(tokens.some(token => token.type === 'inline_math')).toBe(true);
    expect(tokens.find(token => token.type === 'html_tag' && token.tag === 'span'))
        .toMatchObject({ raw: '<span>body</span>', closeTag: '</span>' });
    expect(generator(tokens)).toBe(source);
});

it.each([
    '<span><span>x</span>[link](</span>) tail</span>',
    '<span><span>x</span>[link](/url "</span>") tail</span>',
    '<span><span>x</span>![alt](</span>) tail</span>',
])('does not pair HTML closers owned by link attributes: %j', (source) => {
    const tokens = tokenizer(source, { profile: 'inline' });
    expect(tokens[0]).toMatchObject({ type: 'html_tag', raw: source, closeTag: '</span>' });
    const stack = [...tokens];
    const links = [];
    while (stack.length) {
        const token = stack.pop()!;
        if (token.type === 'link' || token.type === 'image')
            links.push(token);
        if ('children' in token && token.children)
            stack.push(...token.children);
    }
    expect(links).toHaveLength(1);
    expect(generator(tokens, SourceGenerationMode.RebuildWrappers)).toBe(source);
});
