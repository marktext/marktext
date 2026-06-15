// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';
import { InlineFormatToolbar } from '../../../ui/inlineFormatToolbar';

// Coverage for the PUBLIC `Format.format()` toggle-OFF and `clear` paths over a
// real engine boot. `formatCursor.spec.ts` pins the apply-side `_addFormat`
// text rewriter at the function level, but the migration audit flagged that
// removing an existing inline format (toggle-off) and the `clear`-all path had
// NO direct coverage — both are the text surgery that, if it miscounts offsets,
// silently corrupts user content. These tests drive `format()` on a booted
// block whose run already carries the format, with the caret resting INSIDE the
// run (the way Ctrl+B-to-un-bold works), and assert the markers are stripped
// while the run's text survives.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    // The DOM selection is document-global; a range left pointing into the
    // just-removed host would corrupt the next test's `setCursor`. Clear it so
    // each test starts from a clean selection.
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// Rest a collapsed caret at `offset` (in RENDERED-text coordinates — markdown
// markers are hidden) inside the first content block and mark it active, the
// way a click lands the caret inside a formatted run before a Format command.
function caretInFirstBlock(muya: Muya, offset: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(offset, offset, true);
    return content;
}

// Drive `format()` over a NON-collapsed selection (`start..end`), the way
// dragging across a word before pressing Ctrl+B wraps the run. `format()` reads
// the live range through `this.getCursor()`, but happy-dom's `Selection` does
// not track range offsets — `document.getSelection()` always collapses to 0, so
// a real `setCursor(0, 3)` round-trips back as `{start:0,end:0}`. Stub the
// block's `getCursor` for this one call so the real `format()` / `_addFormat` /
// `generator` text surgery runs against the intended range; everything below it
// (the marker wrapping, the offset bookkeeping, the markdown serialization) is
// the genuine engine code path.
function selectInFirstBlock(muya: Muya, start: number, end: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(start, start, true);
    (content as unknown as { getCursor: () => unknown }).getCursor = () => ({
        start: { offset: start },
        end: { offset: end },
        anchor: { offset: start },
        focus: { offset: end },
        isCollapsed: start === end,
        isSelectionInSameBlock: true,
        direction: 'forward',
        type: start === end ? 'Caret' : 'Range',
    });
    return content;
}

describe('format.format() toggle-off with the caret inside the formatted run', () => {
    it('strong: `**word**` un-bolds to plain `word`', () => {
        const content = caretInFirstBlock(bootMuya('**word**\n'), 2);
        content.format('strong');
        expect(content.text).toBe('word');
    });

    it('un-bolding also drops the markers from the serialized markdown', async () => {
        const muya = bootMuya('**word**\n');
        caretInFirstBlock(muya, 2).format('strong');
        // getMarkdown() reads the JSON state, which flushes on the next frame.
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('word');
        });
    });

    it('em: `*word*` un-italics to plain `word`', () => {
        const content = caretInFirstBlock(bootMuya('*word*\n'), 2);
        content.format('em');
        expect(content.text).toBe('word');
    });

    it('del: `~~word~~` un-strikes to plain `word`', () => {
        const content = caretInFirstBlock(bootMuya('~~word~~\n'), 2);
        content.format('del');
        expect(content.text).toBe('word');
    });

    it('u (html_tag): `<u>word</u>` removes the underline tags', () => {
        // `format('u')` matches the html_tag token whose tag === 'u'.
        const content = caretInFirstBlock(bootMuya('<u>word</u>\n'), 2);
        content.format('u');
        expect(content.text).toBe('word');
    });

    it('mark (html_tag): `<mark>word</mark>` removes the highlight tags', () => {
        const content = caretInFirstBlock(bootMuya('<mark>word</mark>\n'), 2);
        content.format('mark');
        expect(content.text).toBe('word');
    });
});

describe('format.format() apply-ON over a non-collapsed selection', () => {
    it('strong: selecting `abc` and applying wraps it in `**…**`', async () => {
        const muya = bootMuya('abc\n');
        selectInFirstBlock(muya, 0, 3).format('strong');
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('**abc**');
        });
    });

    it('em: selecting `abc` and applying wraps it in `*…*`', async () => {
        const muya = bootMuya('abc\n');
        selectInFirstBlock(muya, 0, 3).format('em');
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('*abc*');
        });
    });

    it('u: selecting `abc` and applying wraps it in `<u>…</u>`', async () => {
        const muya = bootMuya('abc\n');
        selectInFirstBlock(muya, 0, 3).format('u');
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('<u>abc</u>');
        });
    });

    it('del: selecting `abc` and applying wraps it in `~~…~~`', async () => {
        const muya = bootMuya('abc\n');
        selectInFirstBlock(muya, 0, 3).format('del');
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('~~abc~~');
        });
    });

    it('also rewrites the live block text, not only the serialized state', () => {
        const muya = bootMuya('abc\n');
        const content = selectInFirstBlock(muya, 0, 3);
        content.format('strong');
        expect(content.text).toBe('**abc**');
    });
});

describe('format.format(\'clear\') with the caret inside the run', () => {
    it('strips a strong run to plain text', () => {
        const content = caretInFirstBlock(bootMuya('**word**\n'), 2);
        content.format('clear');
        expect(content.text).toBe('word');
    });

    it('unwraps an inline-code run to its raw content', () => {
        const content = caretInFirstBlock(bootMuya('`code`\n'), 2);
        content.format('clear');
        expect(content.text).toBe('code');
        expect(content.text).not.toContain('`');
    });

    it('unwraps a link to its anchor text', () => {
        // Caret rests inside the anchor text `Anthropic`.
        const content = caretInFirstBlock(bootMuya('[Anthropic](https://example.com)\n'), 4);
        content.format('clear');
        expect(content.text).toBe('Anthropic');
        expect(content.text).not.toContain('](');
    });
});

// The inline-format toolbar (the "format picker") is what calls
// `content.format('link')` when the user clicks the link button. The toolbar's
// `_selectItem` collapses the picker after a link/image (you can't keep the
// floating buttons up while the cursor jumps into the new `[](…)` URL slot).
// `format()` itself emits NOTHING — the collapse lives in the toolbar — so this
// drives the real `_selectItem` link branch on a real booted block and pins the
// hide.
//
// Reading the toolbar's private `_selectItem` off the prototype (the
// linkTools.spec.ts technique): the only collaborators it touches are
// `this.muya.editor.selection`, `this._block.format(type)` and `this.hide()`.
interface IFormatToolbarInternals {
    _block: Format | null;
    status: boolean;
    hide: () => void;
    _selectItem: (event: Event, item: { type: string; icon: string }) => void;
}

function makeFakeEvent(): Event {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as unknown as Event;
}

describe('format picker collapses after link creation', () => {
    it('selecting the link button runs content.format(\'link\') and hides the picker', () => {
        const muya = bootMuya('abc\n');
        const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
        muya.editor.activeContentBlock = content as never;
        content.setCursor(0, 0, true);

        const toolbar = new InlineFormatToolbar(muya);
        const internals = toolbar as unknown as IFormatToolbarInternals;
        internals._block = content;
        // `_selectItem` only collapses (`hide()`) once the float is shown.
        internals.status = true;
        const hideSpy = vi.spyOn(internals, 'hide');

        // A non-collapsed range so `format('link')` actually wraps `abc`.
        (content as unknown as { getCursor: () => unknown }).getCursor = () => ({
            start: { offset: 0 },
            end: { offset: 3 },
            anchor: { offset: 0 },
            focus: { offset: 3 },
            isCollapsed: false,
            isSelectionInSameBlock: true,
            direction: 'forward',
            type: 'Range',
        });

        internals._selectItem(makeFakeEvent(), { type: 'link', icon: '' });

        // The real `format('link')` rewrote the run into a markdown link.
        expect(content.text).toBe('[abc]()');
        // ...and the picker collapsed (link/image branch → `this.hide()`).
        expect(hideSpy).toHaveBeenCalledTimes(1);

        toolbar.destroy();
    });

    it('a non-link format (strong) re-renders the picker instead of hiding it', () => {
        const muya = bootMuya('abc\n');
        const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
        muya.editor.activeContentBlock = content as never;
        content.setCursor(0, 0, true);

        const toolbar = new InlineFormatToolbar(muya);
        const internals = toolbar as unknown as IFormatToolbarInternals;
        internals._block = content;
        internals.status = true;
        const hideSpy = vi.spyOn(internals, 'hide');

        (content as unknown as { getCursor: () => unknown }).getCursor = () => ({
            start: { offset: 0 },
            end: { offset: 3 },
            anchor: { offset: 0 },
            focus: { offset: 3 },
            isCollapsed: false,
            isSelectionInSameBlock: true,
            direction: 'forward',
            type: 'Range',
        });

        internals._selectItem(makeFakeEvent(), { type: 'strong', icon: '' });

        expect(content.text).toBe('**abc**');
        // Non-link/image formats keep the picker up (re-render branch).
        expect(hideSpy).not.toHaveBeenCalled();

        toolbar.destroy();
    });
});
