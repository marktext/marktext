// @vitest-environment happy-dom
import type Content from '../../block/base/content';
import type { TState } from '../../state/types';
import { afterEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { SelectionDirection } from '../../selection/types';
import { isAnyListState } from '../../state/types';
import { CopyType } from '../types';

const editors: Muya[] = [];

function boot(markdown: string, fancyLists = true) {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown, fancyLists });
    muya.init();
    editors.push(muya);
    return muya;
}

function freezeSelection(muya: Muya, first: Content, last = first) {
    const anchor = { block: first, path: first.path, offset: first === last ? first.text.length : 0 };
    const focus = { block: last, path: last.path, offset: last.text.length };
    muya.editor.selection.getTextSelection = () => ({
        anchor,
        focus,
        isCollapsed: first === last,
        isSelectionInSameBlock: first === last,
        direction: SelectionDirection.FORWARD,
    });
}

async function paste(muya: Muya, text: string, html = '') {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    freezeSelection(muya, first);
    const event = {
        preventDefault() {},
        stopPropagation() {},
        clipboardData: { getData: (type: string) => type === 'text/plain' ? text : html, files: [], items: [] },
    } as unknown as ClipboardEvent;
    await muya.editor.clipboard.pasteHandler(event, text, html);
}

function listStyles(states: TState[]): string[] {
    return states.flatMap((state): string[] => {
        const style = isAnyListState(state) && 'delimiter' in state.meta ? [state.meta.style ?? 'decimal'] : [];
        return [...style, ...('children' in state ? listStyles(state.children as TState[]) : [])];
    });
}

afterEach(() => {
    for (const editor of editors.splice(0)) {
        editor.destroy();
        editor.domNode.remove();
    }
    document.getSelection()?.removeAllRanges();
});

describe('fancy list paste boundaries', () => {
    it.each([
        ['1. existing\n', 'a. pasted\nb. next\n', 'decimal', 'lower-alpha'],
        ['a. existing\n', 'i. pasted\nii. next\n', 'lower-alpha', 'lower-roman'],
        ['(a) [ ] existing\n', '(i) [x] pasted\n', 'lower-alpha', 'lower-roman'],
    ])('keeps different styles when pasting into %j', async (source, text, originalStyle, pastedStyle) => {
        const muya = boot(source);
        await paste(muya, text);
        expect(listStyles(muya.getState())).toEqual([originalStyle, pastedStyle]);
        expect(muya.getMarkdown()).not.toContain('existingpasted');
    });

    it.each([false, true])('keeps same-style merging with fancyLists=%s', async (fancyLists) => {
        const muya = boot('1. existing\n', fancyLists);
        await paste(muya, '1. pasted\n2. next\n');
        expect(muya.getMarkdown()).toBe('1. existingpasted\n2. next\n');
    });
});

describe('rich clipboard source preservation', () => {
    it.each([
        'I.  outer\n    A.  inner\nII. next\n',
        '#. first\n#. second\n',
        '(a) [ ] first\n(b) [x] second\n',
    ])('keeps the Markdown markers when rich-copying %j', async (markdown) => {
        const source = boot(markdown);
        freezeSelection(source, source.editor.scrollPage!.firstContentInDescendant()!, source.editor.scrollPage!.lastContentInDescendant()!);
        const data = new Map<string, string>();
        source.editor.clipboard.copyType = CopyType.COPY_AS_RICH;
        source.editor.clipboard.copyHandler({ clipboardData: { setData: (type: string, value: string) => data.set(type, value) } } as unknown as ClipboardEvent);
        expect(data.get('text/plain')).toBe(markdown);
        expect(data.get('text/html')).toContain('<ol');
        const target = boot('');
        await paste(target, data.get('text/plain')!, data.get('text/html')!);
        expect(target.getMarkdown()).toBe(markdown);
    });

    it('keeps authored source as text when pasted into an editor with the extension off', async () => {
        const target = boot('', false);
        const markdown = 'I.  outer\nII. next\n';
        await paste(target, markdown, '<div data-marktext-markdown="1"><ol type="I"><li>outer</li><li>next</li></ol></div>');
        expect(target.getMarkdown()).toBe(markdown);
        expect(listStyles(target.getState())).toEqual([]);
    });

    it('keeps the external HTML conversion path when no Markdown source is marked', async () => {
        const target = boot('');
        await paste(target, 'bold', '<p><strong>bold</strong></p>');
        expect(target.getMarkdown()).toBe('**bold**\n');
    });

    it.each([false, true])('normalizes CRLF paste with fancyLists=%s', async (fancyLists) => {
        const target = boot('', fancyLists);
        await paste(target, '1) first\r\n2) [x] second\r\n');
        expect(target.getMarkdown()).toBe('1) first\n2) [x] second\n');
    });
});
