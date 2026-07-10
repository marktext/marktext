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

    it('keeps the selection spanning both blocks after a cross-block format', async () => {
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
        await vi.waitFor(() => expect(muya.getMarkdown()).toContain('**alpha**'));
        // The span is restored across both blocks instead of collapsing onto the
        // first block (the live DOM selection collapses for a cross-block range).
        const sel = muya.editor.selection;
        expect(sel.anchorBlock).not.toBe(sel.focusBlock);
        expect(sel.anchorBlock!.text).toContain('alpha');
        expect(sel.focusBlock!.text).toContain('bravo');
    });

    it('bolds two paragraphs nested in the same blockquote (#3462)', async () => {
        const muya = boot('> alpha\n>\n> bravo\n');
        const sp = muya.editor.scrollPage!;
        const first = sp.firstContentInDescendant()!;
        const second = sp.lastContentInDescendant()!;
        // Both leaves live inside the SAME outmost block (the blockquote), so an
        // outmost-block-granular same-block check wrongly reports "same block".
        expect(first).not.toBe(second);
        expect(first.outMostBlock).toBe(second.outMostBlock);
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

// happy-dom does not track range offsets, so getCursor must report whatever the
// cached selection currently holds (the per-leaf range _formatLeafInRange sets).
// eslint-disable-next-line ts/no-explicit-any
function stubDynamicCursor(muya: Muya, leaf: any) {
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
}

describe('inline format — selection range & heading markers', () => {
    it('preserves the partial selection range in BOTH blocks after a cross-block bold', () => {
        const muya = boot('alpha beta\n\ngamma delta\n');
        const sp = muya.editor.scrollPage!;
        const first = sp.firstContentInDescendant()!;
        const second = (sp.firstChild!.next as Parent).firstContentInDescendant()!;
        stubDynamicCursor(muya, first);
        stubDynamicCursor(muya, second);
        muya.editor.activeContentBlock = second;
        // select "ha beta" .. "gamma d": first@3 -> second@7
        muya.editor.selection.setSelection(
            { offset: 3, block: first, path: first.path },
            { offset: 7, block: second, path: second.path },
        );
        muya.format('strong');
        const sel = muya.editor.selection;
        // The selected text stays selected INSIDE the new markers in both blocks.
        expect(sel.anchorBlock!.text).toBe('alp**ha beta**');
        expect(sel.anchor!.offset).toBe(5); // 3 + len("**")
        expect(sel.focusBlock!.text).toBe('**gamma d**elta');
        expect(sel.focus!.offset).toBe(9); // 7 + len("**")
    });

    it('skips the leading "# " marker when bolding a heading (same block)', async () => {
        const muya = boot('# Title\n');
        // eslint-disable-next-line ts/no-explicit-any
        const c: any = muya.editor.scrollPage!.firstContentInDescendant()!; // "# Title"
        muya.editor.activeContentBlock = c;
        // muya.format() reads selection.getSelection(); happy-dom collapses the
        // DOM selection, so stub it to the whole-heading range the user dragged.
        muya.editor.selection.getSelection = () => ({
            anchor: { offset: 0, block: c, path: c.path },
            focus: { offset: 7, block: c, path: c.path },
            start: { offset: 0, block: c },
            end: { offset: 7, block: c },
            isSelectionInSameBlock: true,
            isCollapsed: false,
            direction: 'forward',
            type: 'Range',
            // eslint-disable-next-line ts/no-explicit-any
        }) as any;
        stubDynamicCursor(muya, c); // Format.format reads getCursor after the clamp
        muya.format('strong');
        await vi.waitFor(() => expect(c.text).toBe('# **Title**')); // marker untouched
    });

    it('skips the heading marker for a heading inside a cross-block selection', async () => {
        const muya = boot('# Heading\n\nbody text\n');
        const sp = muya.editor.scrollPage!;
        const first = sp.firstContentInDescendant()!; // "# Heading"
        const second = (sp.firstChild!.next as Parent).firstContentInDescendant()!;
        stubDynamicCursor(muya, first);
        stubDynamicCursor(muya, second);
        muya.editor.activeContentBlock = second;
        muya.editor.selection.setSelection(
            { offset: 0, block: first, path: first.path },
            { offset: second.text.length, block: second, path: second.path },
        );
        muya.format('strong');
        await vi.waitFor(() => {
            expect(first.text).toBe('# **Heading**'); // "# " kept outside the bold
            expect(second.text).toBe('**body text**');
        });
    });
});
