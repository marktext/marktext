import type { IAtxHeadingState, ICodeBlockState, ISetextHeadingState } from './types';

export type IAtxHeadingSyntax = {
    indent: string;
    afterOpening: string;
} & (
    | { closing: { before: string; length: number; after: string }; trailing?: never }
    | { closing?: never; trailing: string }
);

export interface ISetextHeadingSyntax {
    prefixes: string[];
    underline: { indent: string; length: number; trailing: string };
}

export interface ICodeLinePrefix {
    raw: string;
    // Spaces left in the code when a tab straddles the opening fence's indentation.
    remainder: number;
}

export type ICodeSyntax = {
    prefixes: ICodeLinePrefix[];
} & (
    | {
        form: 'fenced';
        fenceChar: '`' | '~';
        opening: { indent: string; length: number; beforeInfo: string; afterInfo: string };
        closing?: { indent: string; length: number; after: string };
    }
    | { form: 'indented' }
);

export type TSyntaxState = IAtxHeadingState | ISetextHeadingState | ICodeBlockState;

export function defaultAtxSyntax(): IAtxHeadingSyntax {
    return { indent: '', afterOpening: ' ', trailing: '' };
}

export function defaultSetextSyntax(text: string, length = 3): ISetextHeadingSyntax {
    return { prefixes: text.split('\n').map(() => ''), underline: { indent: '', length, trailing: '' } };
}

export function defaultCodeSyntax(text = '', fenceChar: '`' | '~' = '`'): ICodeSyntax {
    return {
        form: 'fenced',
        fenceChar,
        opening: { indent: '', length: 3, beforeInfo: '', afterInfo: '' },
        closing: { indent: '', length: 3, after: '' },
        prefixes: text === '' ? [] : text.split('\n').map(() => ({ raw: '', remainder: 0 })),
    };
}

export function headingBody(text: string): string {
    return text.replace(/^ {0,3}#{1,6}(?:[ \t]|$)/, '');
}

function leadingWhitespace(text: string): string {
    let end = 0;
    while (end < text.length && (text[end] === ' ' || text[end] === '\t')) end++;
    return text.slice(0, end);
}

function trailingWhitespace(text: string): string {
    let start = text.length;
    while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t')) start--;
    return text.slice(start);
}

export function parseAtxHeading(raw: string, level: number): IAtxHeadingState {
    const line = raw.replace(/\n$/, '');
    const opening = /^( {0,3})#{1,6}(?=[ \t]|$)/.exec(line)!;
    const indent = opening[1];
    const afterOpening = leadingWhitespace(line.slice(opening[0].length));
    const rest = line.slice(opening[0].length + afterOpening.length);
    const trailing = trailingWhitespace(rest);
    const trimmed = rest.slice(0, rest.length - trailing.length);
    const hashes = /#+$/.exec(trimmed);
    const beforeHashes = hashes ? trimmed.slice(0, hashes.index) : '';
    const before = trailingWhitespace(beforeHashes);
    const closed = hashes && (before || (!beforeHashes && afterOpening));
    let body: string;
    let syntax: IAtxHeadingSyntax;
    if (closed) {
        body = beforeHashes.slice(0, beforeHashes.length - before.length);
        syntax = { indent, afterOpening, closing: { before, length: hashes[0].length, after: trailing } };
    }
    else {
        body = rest.slice(0, rest.length - trailing.length);
        syntax = { indent, afterOpening, trailing };
    }
    return { name: 'atx-heading', meta: { level }, text: '#'.repeat(level) + (afterOpening || body ? ' ' : '') + body, syntax };
}

export function parseSetextHeading(raw: string, level: number): ISetextHeadingState {
    const lines = raw.replace(/\n$/, '').split('\n');
    const underline = /^( {0,3})(?:=+|-+)([ \t]*)$/.exec(lines.pop()!)!;
    const prefixes = lines.map(line => /^ {0,3}/.exec(line)![0]);
    return {
        name: 'setext-heading',
        meta: { level },
        text: lines.map((line, index) => line.slice(prefixes[index].length)).join('\n'),
        syntax: {
            prefixes,
            underline: { indent: underline[1], length: underline[0].trim().length, trailing: underline[2] },
        },
    };
}

function stripIndent(line: string, width: number): { prefix: ICodeLinePrefix; text: string } {
    let column = 0;
    let offset = 0;
    while (column < width && offset < line.length && /[ \t]/.test(line[offset])) {
        column += line[offset] === '\t' ? 4 - column % 4 : 1;
        offset++;
    }
    const remainder = Math.max(0, column - width);
    return { prefix: { raw: line.slice(0, offset), remainder }, text: ' '.repeat(remainder) + line.slice(offset) };
}

export function parseCodeBlock(raw: string, indented: boolean): ICodeBlockState {
    const lines = raw.replace(/\n$/, '').split('\n');
    let syntax: ICodeSyntax;
    let info = '';
    let width = 4;
    if (indented) {
        syntax = { form: 'indented', prefixes: [] };
    }
    else {
        const first = lines.shift()!;
        const opening = /^( {0,3})(`{3,}|~{3,})/.exec(first)!;
        const [, indent, fence] = opening;
        const beforeInfo = leadingWhitespace(first.slice(opening[0].length));
        const rest = first.slice(opening[0].length + beforeInfo.length);
        const afterInfo = trailingWhitespace(rest);
        info = rest.slice(0, rest.length - afterInfo.length);
        width = indent.length;
        const last = lines.at(-1);
        const closing = last === undefined ? null : /^( {0,3})(`+|~+)([ \t]*)$/.exec(last);
        const closed = closing && closing[2][0] === fence[0] && closing[2].length >= fence.length;
        if (closed)
            lines.pop();
        syntax = {
            form: 'fenced',
            fenceChar: fence[0] as '`' | '~',
            opening: { indent, length: fence.length, beforeInfo, afterInfo },
            ...(closed ? { closing: { indent: closing[1], length: closing[2].length, after: closing[3] } } : {}),
            prefixes: [],
        };
    }
    const body = lines.map(line => stripIndent(line, width));
    syntax.prefixes = body.map(line => line.prefix);
    return { name: 'code-block', meta: { lang: info }, text: body.map(line => line.text).join('\n'), syntax };
}

export function printAtxHeading(state: IAtxHeadingState): string {
    const { syntax, meta, text } = state;
    const ending = syntax.closing
        ? syntax.closing.before + '#'.repeat(syntax.closing.length) + syntax.closing.after
        : syntax.trailing;
    return syntax.indent + '#'.repeat(meta.level) + syntax.afterOpening + headingBody(text) + ending;
}

export function printSetextHeading(state: ISetextHeadingState): string {
    const { syntax, meta, text } = state;
    const body = text.split('\n').map((line, index) => (syntax.prefixes[index] ?? '') + line).join('\n');
    const underline = syntax.underline;
    return `${body}\n${underline.indent}${(meta.level === 1 ? '=' : '-').repeat(underline.length)}${underline.trailing}`;
}

export function printCodeBlock(state: ICodeBlockState): string {
    const { syntax, meta, text } = state;
    const lines = text === '' && syntax.prefixes.length === 0 ? [] : text.split('\n');
    const body = lines.map((line, index) => {
        const prefix = syntax.prefixes[index];
        return prefix ? prefix.raw + line.slice(prefix.remainder) : line;
    });
    if (syntax.form === 'indented')
        return body.join('\n');
    const { opening, closing, fenceChar } = syntax;
    const result = [opening.indent + fenceChar.repeat(opening.length) + opening.beforeInfo + meta.lang + opening.afterInfo, ...body];
    if (closing)
        result.push(closing.indent + fenceChar.repeat(closing.length) + closing.after);
    return result.join('\n');
}

/** Keep unaffected line forms when a local edit inserts or removes lines. */
export function reconcilePrefixes<T>(before: string, after: string, prefixes: T[], create: () => T): T[] {
    const oldLines = before.split('\n');
    const newLines = after.split('\n');
    let start = 0;
    while (start < Math.min(oldLines.length, newLines.length) && oldLines[start] === newLines[start]) start++;
    let suffix = 0;
    while (suffix < Math.min(oldLines.length, newLines.length) - start
        && oldLines[oldLines.length - suffix - 1] === newLines[newLines.length - suffix - 1]) {
        suffix++;
    }
    return newLines.map((_, index) => {
        const oldIndex = index >= newLines.length - suffix ? oldLines.length - (newLines.length - index) : index;
        const unchangedOrReplaced = index < start || index >= newLines.length - suffix
            || index - start < oldLines.length - start - suffix;
        return unchangedOrReplaced && prefixes[oldIndex] !== undefined ? prefixes[oldIndex] : create();
    });
}
