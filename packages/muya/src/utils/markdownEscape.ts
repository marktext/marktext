import { decodeHTMLStrict } from 'entities';

export const ASCII_PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;
export const CHARACTER_REFERENCE = /&(?:#\d{1,7}|#x[\da-f]{1,6}|[A-Z][A-Z\d]*);/i;

/** Accepts one complete reference matching CHARACTER_REFERENCE. */
export function decodeCharacterReference(reference: string): string {
    if (reference[1] !== '#')
        return decodeHTMLStrict(reference);

    const hexadecimal = reference[2] === 'x' || reference[2] === 'X';
    const code = Number.parseInt(reference.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10);
    // CommonMark uses Unicode code points, without HTML's Windows-1252 remapping.
    return code === 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)
        ? '\uFFFD'
        : String.fromCodePoint(code);
}

const markdownEscape = new RegExp(`\\\\(${ASCII_PUNCTUATION.source})|${CHARACTER_REFERENCE.source}`, 'gi');

/** Decode once: escaped ampersands and decoded backslashes cannot introduce another escape. */
export function decodeMarkdownString(text: string): string {
    return text.replace(markdownEscape, (raw: string, punctuation: string | undefined) => punctuation ?? decodeCharacterReference(raw));
}

// Controls use entities: literal line endings can invalidate destinations and split titles.
export function escapeLinkAttribute(text: string): string {
    return text.replace(/[\\&<>\p{Cc}]/gu, char => /\p{Cc}/u.test(char) ? `&#${char.codePointAt(0)};` : `\\${char}`);
}

export function encodeLinkTitle(title: string): string {
    return escapeLinkAttribute(title).replace(/"/g, char => `\\${char}`);
}

export function isPunctuationEscape(text: string, index: number): boolean {
    return text[index] === '\\' && ASCII_PUNCTUATION.test(text[index + 1] ?? '');
}
