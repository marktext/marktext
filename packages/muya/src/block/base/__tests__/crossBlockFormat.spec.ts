// @vitest-environment happy-dom
import type Parent from '../parent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

const hosts: HTMLElement[] = [];
beforeEach(() => {
    window.MUYA_VERSION = 'test';
});
afterEach(() => {
    while (hosts.length)
        hosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
});

function boot(md: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: md } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    hosts.push(muya.domNode);
    return muya;
}

// happy-dom collapses non-collapsed ranges to {0,0}, so stub getCursor on each
// formattable leaf to report its full-text range when format() reads it (same
// workaround formatToggle.spec uses).
// eslint-disable-next-line ts/no-explicit-any
function stubFullRange(leaf: any) {
    leaf.getCursor = () => ({
        start: { offset: 0 },
        end: { offset: leaf.text.length },
        anchor: { offset: 0, block: leaf },
        focus: { offset: leaf.text.length, block: leaf },
        isCollapsed: false,
        isSelectionInSameBlock: true,
        direction: 'forward',
        type: 'Range',
    });
}

describe('cross-block format', () => {
    it('bolds every block in the selection', async () => {
        const muya = boot('alpha\n\nbravo\n');
        const sp = muya.editor.scrollPage!;
        const first = sp.firstContentInDescendant()!;
        const second = (sp.firstChild!.next as Parent).firstContentInDescendant()!;
        stubFullRange(first);
        stubFullRange(second);
        muya.editor.activeContentBlock = second;
        muya.editor.selection.setSelection(
            { offset: 0, block: first, path: first.path },
            { offset: second.text.length, block: second, path: second.path },
        );
        muya.format('strong');
        await vi.waitFor(() => {
            const md = muya.getMarkdown();
            expect(md).toContain('**alpha**');
            expect(md).toContain('**bravo**');
        });
    });

    it('skips a code block inside the range', async () => {
        const muya = boot('alpha\n\n```\ncode\n```\n\nbravo\n');
        const sp = muya.editor.scrollPage!;
        const first = sp.firstContentInDescendant()!;
        const last = sp.lastContentInDescendant()!;
        stubFullRange(first);
        stubFullRange(last);
        muya.editor.activeContentBlock = last;
        muya.editor.selection.setSelection(
            { offset: 0, block: first, path: first.path },
            { offset: last.text.length, block: last, path: last.path },
        );
        muya.format('strong');
        await vi.waitFor(() => {
            const md = muya.getMarkdown();
            expect(md).toContain('**alpha**');
            expect(md).toContain('**bravo**');
            expect(md).not.toContain('**code**');
        });
    });
});
