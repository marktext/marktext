import type Content from '../block/base/content';
import type { Token } from '../inlineRenderer/types';
import type Clipboard from './index';
import { tokenizer } from '../inlineRenderer/lexer';
import { PasteType } from './types';

function singleHttpUrl(text: string): string | null {
    const candidate = text.trim();
    if (!/^https?:\/\//i.test(candidate) || /\s/.test(candidate))
        return null;
    try {
        const url = new URL(candidate);
        return url.hostname ? candidate : null;
    }
    catch {
        return null;
    }
}

function safeSelection(tokens: Token[], start: number, end: number): boolean {
    return tokens.every((token) => {
        const { range } = token;
        if (range.end <= start || range.start >= end)
            return true;
        if (token.type === 'text')
            return true;
        if (token.type === 'backlash' || token.type === 'html_escape')
            return start <= range.start && end >= range.end;
        if (token.type === 'strong' || token.type === 'em' || token.type === 'del' || token.type === 'mark') {
            const coversToken = start <= range.start && end >= range.end;
            const insideContent = start >= range.start + token.marker.length
                && end <= range.end - token.marker.length;
            return (coversToken || insideContent) && safeSelection(token.children, start, end);
        }
        return false;
    });
}

function escapeLabel(tokens: Token[], text: string, start: number, end: number): string {
    const edits: { start: number; end: number; text: string }[] = [];
    const visit = (items: Token[]) => {
        for (const token of items) {
            if (token.type === 'text') {
                const left = Math.max(start, token.range.start);
                const right = Math.min(end, token.range.end);
                if (left < right)
                    edits.push({ start: left - start, end: right - start, text: text.slice(left, right).replace(/[[\]\\]/g, '\\$&') });
            }
            else if ('children' in token && token.children) {
                visit(token.children);
            }
        }
    };
    visit(tokens);
    let label = text.slice(start, end);
    for (const edit of edits.sort((a, b) => b.start - a.start))
        label = label.slice(0, edit.start) + edit.text + label.slice(edit.end);
    return label;
}

export function tryPasteUrl(clipboard: Clipboard, block: Content, text: string, pasteType: PasteType): boolean {
    const url = singleHttpUrl(text);
    if (pasteType !== PasteType.NORMAL || !url)
        return false;
    const allowedBlocks = ['paragraph.content', 'atxheading.content', 'setextheading.content', 'table.cell.content'];
    if (!allowedBlocks.includes(block.blockName))
        return false;
    if (clipboard.selection.table.hasSelection)
        return false;
    const cursor = block.getCursor();
    if (!cursor || !cursor.isSelectionInSameBlock || cursor.isCollapsed)
        return false;
    const start = cursor.start.offset;
    const end = cursor.end.offset;
    if (!block.text.slice(start, end).trim() || /[\r\n]/.test(block.text.slice(start, end)))
        return false;
    const tokens = tokenizer(block.text, {
        hasBeginRules: /^(?:paragraph|atxheading)\.content$/.test(block.blockName),
        labels: clipboard.muya.editor.inlineRenderer.labels,
        options: clipboard.muya.options,
    });
    if (!safeSelection(tokens, start, end))
        return false;
    const label = escapeLabel(tokens, block.text, start, end);
    // Escaping delimiters keeps URL parentheses and backslashes out of Markdown syntax.
    const destination = url.replace(/[\\()<>]/g, '\\$&').replace(/\|/g, '%7C');
    const link = `[${label}](${destination})`;
    clipboard.muya.editor.history.cutoff(cursor);
    block.text = block.text.slice(0, start) + link + block.text.slice(end);
    block.setCursor(start + link.length, start + link.length, true);
    return true;
}
