// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';

// Word-style bold toggle: mixed selection → all bold; fully bold → all plain.
// Partial overlap with an existing strong run must expand+merge rather than
// truncate mid-token (`**hello w**orld`).

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function selectInFirstBlock(muya: Muya, start: number, end: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(start, start, true);
    (content as unknown as { getCursor: () => unknown }).getCursor = () => ({
        start: { offset: start, delta: 0 },
        end: { offset: end, delta: 0 },
        anchor: { offset: start },
        focus: { offset: end },
        isCollapsed: start === end,
        isSelectionInSameBlock: true,
        direction: 'forward',
        type: start === end ? 'Caret' : 'Range',
    });
    return content;
}

function selectLive(content: Format, start: number, end: number) {
    (content as unknown as { getCursor: () => unknown }).getCursor = () => ({
        start: { offset: start, delta: 0 },
        end: { offset: end, delta: 0 },
        anchor: { offset: start },
        focus: { offset: end },
        isCollapsed: start === end,
        isSelectionInSameBlock: true,
        direction: 'forward',
        type: start === end ? 'Caret' : 'Range',
    });
}

describe('format.format() Word-style strong toggle on mixed selections', () => {
    it('plain + bold: first Cmd+B bolds the whole selection', () => {
        const content = selectInFirstBlock(bootMuya('aa **bb**\n'), 0, 9);
        content.format('strong');
        expect(content.text).toBe('**aa bb**');
    });

    it('bold + plain: first Cmd+B bolds the whole selection', () => {
        const content = selectInFirstBlock(bootMuya('**aa** bb\n'), 0, 9);
        content.format('strong');
        expect(content.text).toBe('**aa bb**');
    });

    it('second Cmd+B clears bold from the whole selection', () => {
        const content = selectInFirstBlock(bootMuya('aa **bb**\n'), 0, 9);
        content.format('strong');
        expect(content.text).toBe('**aa bb**');
        // After apply, selection sits on the content inside the markers (2..7).
        selectLive(content, 2, 7);
        content.format('strong');
        expect(content.text).toBe('aa bb');
    });

    it('partial overlap into a bold run expands and merges (no mid-token truncate)', () => {
        // `hello **world**` — selecting through mid-`world` used to yield
        // `**hello w**orld`. Expand-to-neighbor must produce one clean run.
        const content = selectInFirstBlock(bootMuya('hello **world**\n'), 0, 9);
        content.format('strong');
        expect(content.text).toBe('**hello world**');
    });

    it('selecting across two strong runs consolidates then clears', () => {
        const content = selectInFirstBlock(bootMuya('**aa** **bb**\n'), 0, 12);
        content.format('strong');
        expect(content.text).toBe('**aa bb**');
        selectLive(content, 2, 7);
        content.format('strong');
        expect(content.text).toBe('aa bb');
    });
});

describe('format.format() Word-style strong toggle across blocks', () => {
    it('mixed bold/plain paragraphs: first Cmd+B bolds both', async () => {
        const muya = bootMuya('**alpha**\n\nbravo\n');
        const sp = muya.editor.scrollPage!;
        const first = sp.firstContentInDescendant()!;
        const last = sp.lastContentInDescendant()!;
        // eslint-disable-next-line ts/no-explicit-any
        const stub = (leaf: any) => {
            leaf.getCursor = () => {
                const s = muya.editor.selection;
                const a = s.anchor?.offset ?? 0;
                const f = s.focus?.offset ?? 0;
                return {
                    start: { offset: Math.min(a, f) },
                    end: { offset: Math.max(a, f) },
                    anchor: { offset: a, block: leaf },
                    focus: { offset: f, block: leaf },
                    isCollapsed: a === f,
                    isSelectionInSameBlock: true,
                    direction: 'forward',
                    type: 'Range',
                };
            };
        };
        stub(first);
        stub(last);
        muya.editor.activeContentBlock = last;
        muya.editor.selection.setSelection(
            { offset: 0, block: first, path: first.path },
            { offset: last.text.length, block: last, path: last.path },
        );
        muya.format('strong');
        expect(first.text).toBe('**alpha**');
        expect(last.text).toBe('**bravo**');
    });

    it('both paragraphs bold: Cmd+B clears both', () => {
        const muya = bootMuya('**alpha**\n\n**bravo**\n');
        const sp = muya.editor.scrollPage!;
        const first = sp.firstContentInDescendant()!;
        const last = sp.lastContentInDescendant()!;
        // eslint-disable-next-line ts/no-explicit-any
        const stub = (leaf: any) => {
            leaf.getCursor = () => {
                const s = muya.editor.selection;
                const a = s.anchor?.offset ?? 0;
                const f = s.focus?.offset ?? 0;
                return {
                    start: { offset: Math.min(a, f) },
                    end: { offset: Math.max(a, f) },
                    anchor: { offset: a, block: leaf },
                    focus: { offset: f, block: leaf },
                    isCollapsed: a === f,
                    isSelectionInSameBlock: true,
                    direction: 'forward',
                    type: 'Range',
                };
            };
        };
        stub(first);
        stub(last);
        muya.editor.activeContentBlock = last;
        muya.editor.selection.setSelection(
            { offset: 0, block: first, path: first.path },
            { offset: last.text.length, block: last, path: last.path },
        );
        muya.format('strong');
        expect(first.text).toBe('alpha');
        expect(last.text).toBe('bravo');
    });
});
