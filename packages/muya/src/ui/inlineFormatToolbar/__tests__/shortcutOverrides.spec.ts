// @vitest-environment happy-dom

import type Format from '../../../block/base/format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';
import icons from '../config';
import { InlineFormatToolbar } from '../index';

// marktext #4687: the toolbar's shortcut hints and its internal Cmd/Ctrl
// keydown handler were hardcoded, so an embedder that rebinds its
// accelerators kept advertising — and applying — the stale defaults. Both
// now resolve through the `inlineFormatShortcuts` muya option (falling back
// to the bundled defaults), updatable at runtime via `setOptions`.

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    // baseFloat observes its container with a ResizeObserver; happy-dom doesn't
    // ship one, so stand in a no-op.
    if (typeof globalThis.ResizeObserver === 'undefined') {
        globalThis.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as never;
    }
});

afterEach(() => {
    while (bootedHosts.length) bootedHosts.pop()!.remove();
    // A range left pointing into a removed host corrupts the next test's
    // `setCursor` (the DOM selection is document-global).
    document.getSelection()?.removeAllRanges();
});

function bootMuya(markdown: string, options: Record<string, unknown> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, ...options } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function openToolbar(muya: Muya): InlineFormatToolbar {
    const toolbar = new InlineFormatToolbar(muya);
    toolbar.status = true;
    // Re-rendering on selection-change is how an open toolbar refreshes; it
    // also renders the buttons without a real floating-ui reference element.
    muya.eventCenter.emit('selection-change', {
        formats: [],
        isCollapsed: false,
        isSelectionInSameBlock: true,
    });
    return toolbar;
}

function titleOf(toolbar: InlineFormatToolbar, type: string): string {
    const item = toolbar.container!.querySelector(`li.item.${type}`);
    expect(item, `no toolbar item rendered for type=${type}`).toBeTruthy();
    return item!.getAttribute('title') ?? '';
}

// Select `hello` in the document's first block so the internal keydown
// handler sees a same-block, Format-typed selection. happy-dom's `Selection`
// does not track range offsets — a real `setCursor(0, 5)` round-trips through
// `getCursor()` as a collapsed `{0,0}` — so stub the block's `getCursor` the
// way `formatToggle.spec.ts` does; everything below it (the keydown gate, the
// shortcut matching, `format()`'s text surgery) is the genuine code path.
function selectHello(muya: Muya): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(0, 0, true);
    (content as unknown as { getCursor: () => unknown }).getCursor = () => ({
        start: { offset: 0 },
        end: { offset: 5 },
        anchor: { offset: 0 },
        focus: { offset: 5 },
        isCollapsed: false,
        isSelectionInSameBlock: true,
        direction: 'forward',
        type: 'Range',
    });
    return content;
}

function pressOnEditor(
    muya: Muya,
    key: string,
    modifiers: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {},
): void {
    muya.domNode.dispatchEvent(
        new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true, ...modifiers }),
    );
}

describe('tooltip shortcut hints (#4687)', () => {
    it('falls back to the bundled default hint when no override is passed', () => {
        const muya = bootMuya('hello world\n');
        const toolbar = openToolbar(muya);

        const defaultStrong = icons.find(i => i.type === 'strong')!;
        expect(titleOf(toolbar, 'strong')).toContain(defaultStrong.shortcut);
    });

    it('renders the override label and leaves other buttons on their defaults', () => {
        const muya = bootMuya('hello world\n', {
            inlineFormatShortcuts: { strong: { label: 'Ctrl+Shift+7' } },
        });
        const toolbar = openToolbar(muya);

        expect(titleOf(toolbar, 'strong')).toContain('Ctrl+Shift+7');

        const defaultEm = icons.find(i => i.type === 'em')!;
        expect(titleOf(toolbar, 'em')).toContain(defaultEm.shortcut);
    });

    it('hides the hint line entirely for an empty override label (unbound command)', () => {
        const muya = bootMuya('hello world\n', {
            inlineFormatShortcuts: { strong: { label: '' } },
        });
        const toolbar = openToolbar(muya);

        expect(titleOf(toolbar, 'strong')).not.toContain('\n');
    });

    it('applies a runtime setOptions change on the next re-render', () => {
        const muya = bootMuya('hello world\n');
        const toolbar = openToolbar(muya);

        const defaultStrong = icons.find(i => i.type === 'strong')!;
        expect(titleOf(toolbar, 'strong')).toContain(defaultStrong.shortcut);

        muya.setOptions({ inlineFormatShortcuts: { strong: { label: 'F6' } } });
        muya.eventCenter.emit('selection-change', {
            formats: [],
            isCollapsed: false,
            isSelectionInSameBlock: true,
        });

        expect(titleOf(toolbar, 'strong')).toContain('F6');
    });
});

describe('internal format keydown handler (#4687)', () => {
    it('applies the default combo when no override is passed', () => {
        const muya = bootMuya('hello world\n');
        openToolbar(muya);
        const content = selectHello(muya);

        pressOnEditor(muya, 'b');

        expect(content.text).toBe('**hello** world');
    });

    it('matches Shift-modified combos although KeyboardEvent.key arrives uppercase', () => {
        // The pre-#4687 handler looked the raw key up in a lowercase map, so
        // its Shift entries (mark, image, clear, inline_math) never fired.
        const muya = bootMuya('hello world\n');
        openToolbar(muya);
        const content = selectHello(muya);

        pressOnEditor(muya, 'H', { shiftKey: true });

        expect(content.text).toBe('<mark>hello</mark> world');
    });

    it('stops applying the default combo once the format is rebound', () => {
        const muya = bootMuya('hello world\n', {
            inlineFormatShortcuts: { strong: { label: 'Ctrl+Shift+7', key: '7', shiftKey: true } },
        });
        openToolbar(muya);
        const content = selectHello(muya);

        pressOnEditor(muya, 'b');
        expect(content.text).toBe('hello world');

        pressOnEditor(muya, '7', { shiftKey: true });
        expect(content.text).toBe('**hello** world');
    });

    it('leaves the combo to the embedder when the override carries no key', () => {
        const muya = bootMuya('hello world\n', {
            inlineFormatShortcuts: { strong: { label: 'F6' } },
        });
        openToolbar(muya);
        const content = selectHello(muya);

        pressOnEditor(muya, 'b');

        expect(content.text).toBe('hello world');
    });

    it('requires the Alt state to match, so Ctrl+Alt combos no longer collide', () => {
        const muya = bootMuya('hello world\n');
        openToolbar(muya);
        const content = selectHello(muya);

        // AltGr arrives as ctrlKey+altKey on Windows layouts; it must not bold.
        pressOnEditor(muya, 'b', { altKey: true });

        expect(content.text).toBe('hello world');
    });
});
