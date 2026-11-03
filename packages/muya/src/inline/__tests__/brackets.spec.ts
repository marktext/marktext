// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { decodeMarkdownString, encodeLinkTitle } from '../../utils/markdownEscape';
import { tokenizer } from '../lexer';
import { BracketScanner } from '../parser/brackets';
import { parseSrcAndTitle } from '../parser/linkDestination';
import { normalizeReferenceLabel } from '../referenceLabel';
import { generator } from '../serialization';

const definition = { href: '/target', title: 'reference title' };

describe('reference label normalization (#5979)', () => {
    it.each([
        ['ẞ', 'SS'],
        ['Straße', 'STRASSE'],
        ['Σςσ', 'σσσ'],
        ['ﬃ', 'FFI'],
        ['ᾈ', 'ἀι'],
        ['İ', 'i\u0307'],
        ['𐐀', '𐐨'],
        ['𐵐', '𐵰'],
        ['\tFoo\n  BAR\r\n baz\u00A0', 'foo bar baz'],
    ])('resolves %j against %j for links and images', (sourceLabel, definitionLabel) => {
        const key = normalizeReferenceLabel(definitionLabel);
        expect(normalizeReferenceLabel(sourceLabel)).toBe(key);
        for (const prefix of ['', '!']) {
            const source = `${prefix}[label][${sourceLabel}]`;
            const tokens = tokenizer(source, { labels: new Map([[key, definition]]) });
            expect(tokens).toHaveLength(1);
            expect(tokens[0].type).toBe(prefix ? 'reference_image' : 'reference_link');
            expect(generator(tokens)).toBe(source);
        }
    });

    it.each([['ı', 'i'], ['é', 'e\u0301'], ['Ａ', 'a'], ['foo\\!', 'foo!']])('keeps distinct labels %j and %j distinct', (left, right) => {
        expect(normalizeReferenceLabel(left)).not.toBe(normalizeReferenceLabel(right));
    });
});

describe('shared bracket scanning', () => {
    it('handles deeply nested unmatched labels without recursive scans', () => {
        const source = `${'['.repeat(20000)}text${']'.repeat(20000)}`;
        const scanner = new BracketScanner(source, new Map());
        expect(scanner.read(0)).toBeNull();
    });

    it('does not let the brackets in a destination open another link', () => {
        const source = '[outer [inner](/url[)](/outer)';
        const tokens = tokenizer(source);
        expect(tokens.map(token => token.type)).toEqual(['text', 'link', 'text']);
        expect(tokens[1]).toMatchObject({ href: '/url[', anchor: 'inner' });
        expect(generator(tokens)).toBe(source);
    });

    it('preserves paired backslashes in both labels and destinations without duplicating them', () => {
        const source = '[label\\\\](/url\\\\)';
        const tokens = tokenizer(source);
        expect(tokens[0]).toMatchObject({ type: 'link', href: '/url\\', anchor: 'label\\\\' });
        expect(generator(tokens)).toBe(source);
    });
});

describe('commonMark link tails', () => {
    it.each(['a "quoted" title', 'C:\\photos\\', '&quot; &#34; &amp;', 'two\nlines', 'two\n\nlines\t\r\u001F'])('round-trips a decoded title %j through Markdown', (title) => {
        const source = `[label](/target "${encodeLinkTitle(title)}")`;
        const tokens = tokenizer(source);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({ type: 'link', title });
        expect(generator(tokens)).toBe(source);
    });

    it.each(['\n', '\r', '\r\n'])('accepts a %j line ending around a title', (lineEnding) => {
        const tail = parseSrcAndTitle(` /uri${lineEnding} \"two${lineEnding}lines\" ${lineEnding})`);
        expect(tail).toMatchObject({ src: '/uri', title: `two${lineEnding}lines` });
    });

    it.each([
        '/uri\n\n \"title\")',
        '/uri \"two\n \nlines\")',
        '/uri \"title\"\n\n)',
        '<foo\nbar>)',
    ])('rejects blank lines and multiline angle destinations in %j', (source) => {
        expect(parseSrcAndTitle(source)).toBeNull();
    });

    it('decodes once and preserves escaped ampersands and encoded URL delimiters', () => {
        expect(decodeMarkdownString(String.raw`\&ouml; &amp;ouml; &ouml; %2F &#x80; &#0;`))
            .toBe('&ouml; &ouml; ö %2F \u0080 \uFFFD');
    });
});
