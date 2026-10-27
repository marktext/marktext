import type { Token, Tokens } from 'marked';
import { indentationWidth, removeIndent } from '../indentation';

function countNewlines(source: string, start = 0, end = source.length): number {
    let count = 0;
    for (let offset = source.indexOf('\n', start); offset >= 0 && offset < end; offset = source.indexOf('\n', offset + 1))
        count++;
    return count;
}

// Marked expands code tabs while parsing lists. Restore the payload from source;
// structural indentation is consumed, not stored in the document model.
export function restoreCodeTabs(tokens: Token[], source: string, original = source.split('\n'), parentColumn = 0, startColumn = 0): void {
    let offset = 0;
    let line = 0;
    for (const token of tokens) {
        const start = source.indexOf(token.raw, offset);
        if (start < 0)
            continue;
        line += countNewlines(source, offset, start);
        const lineCount = countNewlines(token.raw);
        const lines = original.slice(line, line + lineCount + 1);
        if (token.type === 'list') {
            restoreListCode(token as Tokens.List, lines, parentColumn, startColumn);
        }
        else if (token.type === 'code') {
            const code = token as Tokens.Code;
            if (code.codeBlockStyle === 'indented') {
                const count = code.text.replace(/\n$/, '').split('\n').length;
                const suffix = code.text.endsWith('\n') ? '\n' : '';
                code.text = lines.slice(0, count).map(value => removeIndent(value, parentColumn + 4, startColumn)).join('\n') + suffix;
            }
            else {
                const fence = /^([ \t]*)(?:`{3,}|~{3,})/.exec(lines[0] ?? '');
                if (fence && code.text) {
                    const columns = indentationWidth(fence[1], startColumn);
                    code.text = lines.slice(1, code.text.split('\n').length + 1).map(value => removeIndent(value, columns, startColumn)).join('\n');
                }
            }
        }
        else if (token.type === 'blockquote') {
            const prefix = /^[ \t]*> ?/.exec(lines[0] ?? '')?.[0] ?? '> ';
            const quoteColumn = startColumn + indentationWidth(prefix, startColumn);
            restoreCodeTabs(token.tokens ?? [], token.text ?? '', lines.map(value => value.replace(/^[ \t]*> ?/, '')), 0, quoteColumn);
        }
        offset = start + token.raw.length;
        line += lineCount;
    }
}

function restoreListCode(token: Tokens.List, original: string[], parentColumn: number, startColumn: number): void {
    let offset = 0;
    let line = 0;
    for (const item of token.items) {
        const start = token.raw.indexOf(item.raw, offset);
        if (start < 0)
            continue;
        line += countNewlines(token.raw, offset, start);
        const lineCount = countNewlines(item.raw);
        const lines = original.slice(line, line + lineCount + 1);
        const match = /^([ \t]*)([*+-]|\d{1,9}[.)])([ \t]*)(\S.*)?$/.exec(lines[0] ?? '');
        if (match) {
            const prefix = match[1] || (line === 0 ? ' '.repeat(parentColumn) : '');
            const gap = match[3] || ' ';
            const markerColumn = indentationWidth(prefix + match[2], startColumn);
            const gapWidth = indentationWidth(prefix + match[2] + gap, startColumn) - markerColumn;
            const contentColumn = indentationWidth(prefix + match[2] + (gapWidth > 4 ? ' ' : gap), startColumn);
            lines[0] = prefix + ' '.repeat(match[2].length) + gap + (match[4] ?? '');
            restoreCodeTabs(item.tokens, item.text, lines, contentColumn, startColumn);
        }
        offset = start + item.raw.length;
        line += lineCount;
    }
}
