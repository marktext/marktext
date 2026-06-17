// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';

// Coverage for `Format.backspaceHandler` — the Firefox-compatibility fix for
// muya#113 (https://github.com/marktext/muya/issues/113). When the collapsed
// caret rests on an inline-syntax marker boundary, a raw contenteditable
// Backspace would delete one marker character and leave the rendered run with
// an unbalanced / duplicated marker. `backspaceHandler` intercepts that case:
// it re-tokenizes `this.text`, trims ONE character off the matched token's raw
// markdown, regenerates the text, and steps the caret back by one — removing a
// single marker char with no dangling or doubled markers.
//
// Offsets here are in RAW markdown-text coordinates: the active content block
// renders its markdown source (markers visible), so `setCursor`/`getCursor`
// round-trip against the same string the handler scans. For `'foo **strong**'`
// the tokenizer yields a `'foo '` text token (range 0..4) and a `'**strong**'`
// strong token (range 4..14); the handler matches a token by
// `range.end === offset` (caret just past the token's close) or
// `range.start + 1 === offset` (caret one char into the token's open).

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
    // just-removed host would corrupt the next test's `setCursor`.
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

// Rest a collapsed caret at `offset` (RAW markdown coordinates) inside the
// first content block and mark it active, the way a click lands the caret
// before a Backspace.
function caretInFirstBlock(muya: Muya, offset: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(offset, offset, true);
    return content;
}

function pressBackspace(content: Format): Event {
    const event = new Event('keydown', { cancelable: true });
    content.backspaceHandler(event);
    return event;
}

describe('format.backspaceHandler — closing-marker boundary (muya#113)', () => {
    it('just-outside the closing `**`: removes one marker char, no doubled markers', () => {
        // Caret at offset 14, immediately after the whole `**strong**` close.
        const content = caretInFirstBlock(bootMuya('foo **strong**\n'), 14);
        const event = pressBackspace(content);

        // Exactly one `*` of the closing pair is gone — not the whole pair, not
        // a content char. `strong` and the opening `**` survive intact.
        expect(content.text).toBe('foo **strong*');
        // No dangling / duplicated markers: the original balanced `**…**` is now
        // a clean single trailing `*`, never `***` or an untouched `**…**`.
        expect(content.text).not.toContain('***');
        expect(content.text).not.toContain('strong**');
        // Caret steps back by one to sit on the boundary it just edited.
        expect(content.getCursor()!.start.offset).toBe(13);
        // The handler owns this Backspace, so the native delete is suppressed.
        expect(event.defaultPrevented).toBe(true);
    });

    it('just-inside the closing `**` (between `strong` and the close): no-op, defers to default', () => {
        // Caret at offset 12, between the `strong` text and its closing `**`.
        // Neither token boundary rule matches, so the handler leaves the markers
        // alone and lets the default contenteditable Backspace run.
        const content = caretInFirstBlock(bootMuya('foo **strong**\n'), 12);
        const event = pressBackspace(content);

        expect(content.text).toBe('foo **strong**');
        expect(content.getCursor()!.start.offset).toBe(12);
        expect(event.defaultPrevented).toBe(false);
    });

    it('between the two `*` of the closing marker: still a no-op', () => {
        const content = caretInFirstBlock(bootMuya('foo **strong**\n'), 13);
        const event = pressBackspace(content);

        expect(content.text).toBe('foo **strong**');
        expect(content.getCursor()!.start.offset).toBe(13);
        expect(event.defaultPrevented).toBe(false);
    });
});

describe('format.backspaceHandler — opening-marker boundary (muya#113)', () => {
    it('just-inside the opening `**`: removes one marker char, no doubled markers', () => {
        // Caret at offset 5, one char into the opening `**` (between the pair).
        const content = caretInFirstBlock(bootMuya('foo **strong**\n'), 5);
        const event = pressBackspace(content);

        // One `*` of the opening pair is removed; the closing `**` is untouched.
        expect(content.text).toBe('foo *strong**');
        expect(content.text).not.toContain('***');
        expect(content.getCursor()!.start.offset).toBe(4);
        expect(event.defaultPrevented).toBe(true);
    });
});

describe('format.backspaceHandler — single-char `*` em markers (muya#113)', () => {
    it('just-outside the closing `*`: removes the single closing marker', () => {
        // `foo *em*` — caret at offset 8, just past the closing `*`.
        const content = caretInFirstBlock(bootMuya('foo *em*\n'), 8);
        const event = pressBackspace(content);

        expect(content.text).toBe('foo *em');
        expect(content.getCursor()!.start.offset).toBe(7);
        expect(event.defaultPrevented).toBe(true);
    });

    it('just-inside the opening `*`: removes the single opening marker', () => {
        // `foo *em*` — caret at offset 5, one char into the opening `*`.
        const content = caretInFirstBlock(bootMuya('foo *em*\n'), 5);
        const event = pressBackspace(content);

        expect(content.text).toBe('foo em*');
        expect(content.getCursor()!.start.offset).toBe(4);
        expect(event.defaultPrevented).toBe(true);
    });
});

describe('format.backspaceHandler — plain-text boundaries (no markers involved)', () => {
    it('caret at start of text (offset 0): no-op, defers to default', () => {
        const content = caretInFirstBlock(bootMuya('foo **strong**\n'), 0);
        const event = pressBackspace(content);

        expect(content.text).toBe('foo **strong**');
        expect(content.getCursor()!.start.offset).toBe(0);
        expect(event.defaultPrevented).toBe(true);
    });

    it('caret one char into leading text: trims that text char, markers untouched', () => {
        // Offset 1 matches the `'foo '` text token's `range.start + 1`, so the
        // leading `f` is dropped and the inline-format markers are left alone.
        const content = caretInFirstBlock(bootMuya('foo **strong**\n'), 1);
        const event = pressBackspace(content);

        expect(content.text).toBe('oo **strong**');
        expect(content.getCursor()!.start.offset).toBe(0);
        expect(event.defaultPrevented).toBe(true);
    });

    it('caret mid-run, off any marker boundary (offset 6): no-op, defers to default', () => {
        // Offset 6 is the first char of `strong`; it matches no token boundary
        // (`range.end` 4/14, `range.start + 1` 1/5), so the handler leaves the
        // text untouched and lets the default Backspace delete the char.
        const content = caretInFirstBlock(bootMuya('foo **strong**\n'), 6);
        const event = pressBackspace(content);

        expect(content.text).toBe('foo **strong**');
        expect(content.getCursor()!.start.offset).toBe(6);
        expect(event.defaultPrevented).toBe(false);
    });
});
