// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { generator, tokenizer, tokensToPlainText } from '../lexer';

const options = { superSubScript: false, footnote: false, texMathDollars: false, texMathGfm: false, texMathSingleBackslash: false, texMathDoubleBackslash: false, highlightSyntax: false };
const parse = (source: string) => tokenizer(source, { hasBeginRules: false, options });

describe('unicode symbol flanking (#5994)', () => {
    it.each(['$', '£', '€', '©', '±', '😀', '𝛁'])('keeps *%s*word literal', (symbol) => {
        const source = `*${symbol}*word`;
        expect(parse(source).every(token => token.type === 'text')).toBe(true);
        expect(generator(parse(source))).toBe(source);
    });

    it.each(['𠀀', '𫝀', '𬺰', '\u{2FFFF}'])('retains CJK emphasis next to %s', (character) => {
        const source = `${character}**"加粗"**${character}`;
        expect(parse(source)).toMatchObject([{ type: 'text' }, { type: 'strong' }, { type: 'text' }]);
        expect(generator(parse(source))).toBe(source);
    });

    it('retains emphasis around symbols separated from words', () => {
        expect(parse('*£* word')[0]).toMatchObject({ type: 'em' });
        expect(parse('中文**"加粗"**中文').some(token => token.type === 'strong')).toBe(true);
    });
});

describe('paragraph-final whitespace (#5995)', () => {
    it.each(['foo ', 'foo  ', 'foo\t  ', '*foo*  ', '`foo `  '])('omits source whitespace from reading text: %j', (source) => {
        const tokens = parse(source);
        expect(tokensToPlainText(tokens)).toBe(source.startsWith('`') ? 'foo ' : 'foo');
        expect(generator(tokens)).toBe(source);
        for (const token of tokens)
            expect(source.slice(token.range.start, token.range.end)).toBe(token.raw);
    });

    it('keeps whitespace inside inline constructs and non-ASCII trailing whitespace', () => {
        expect(tokensToPlainText(parse('[foo ](/u)'))).toBe('foo ');
        expect(tokensToPlainText(parse('foo\u00A0'))).toBe('foo\u00A0');
        expect(tokensToPlainText(parse('\\ x'))).toBe('\\ x');
        expect(parse('foo  \nbar').some(token => token.type === 'hard_line_break')).toBe(true);
    });
});

describe('bare autolink recognition (#5996)', () => {
    it.each([
        ['Visit www.commonmark.org.', 'www.commonmark.org', 'www'],
        ['ftp://foo.bar.baz.', 'ftp://foo.bar.baz', 'url'],
        ['a.b-c_d@a.b.', 'a.b-c_d@a.b', 'email'],
        ['www.example.com/path).', 'www.example.com/path', 'www'],
        ['http://example.com.', 'http://example.com', 'url'],
        ['http://example.com?q=one.', 'http://example.com?q=one', 'url'],
        ['www.example.com#section.', 'www.example.com#section', 'www'],
        ['https://example.com*word', 'https://example.com*word', 'url'],
        ['www.example.com,a*b*.', 'www.example.com,a*b', 'www'],
    ])('recognizes %j without sentence punctuation', (source, raw, linkType) => {
        const tokens = parse(source);
        expect(tokens.find(token => token.type === 'auto_link_extension')).toMatchObject({ raw, linkType });
        expect(generator(tokens)).toBe(source);
    });

    it.each(['a.b-c_d@a.b-', 'a.b-c_d@a.b_', 'abcwww.example.com', 'xftp://example.com', 'http://example.com_bad', 'www.example.com_bad'])('rejects invalid boundary: %j', (source) => {
        expect(parse(source).some(token => token.type === 'auto_link_extension')).toBe(false);
    });

    it('protects FTP URL delimiters during emphasis scanning', () => {
        const tokens = parse('*ftp://example.com/a*b*');
        expect(tokens).toMatchObject([{ type: 'em', children: [{ type: 'auto_link_extension', raw: 'ftp://example.com/a*b' }] }]);
    });
});
