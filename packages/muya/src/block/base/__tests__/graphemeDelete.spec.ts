// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';

// Coverage for deleting emoji as whole characters (#4926).
//
// A collapsed caret can end up *inside* a character: pasting, and Muya's own
// offset arithmetic, can both park it between the UTF-16 code units of an
// emoji. Deleting from there removed a single code unit, and that unit could be
// half of a surrogate pair — a lone surrogate that `ot-text-unicode` cannot
// encode, which crashed the renderer. Even when the delete did not throw, it
// took out only a fraction of what the user sees as one character.
//
// The contract pinned down here: whatever a caret sits inside, one Backspace or
// Delete removes that whole grapheme cluster (UAX #29) and nothing else.
//
// Fixtures, with the shape that makes them interesting:
//   🙂          1 code point  / 2 code units  (one surrogate pair)
//   👍🏽          2 code points / 4 code units  (base + skin tone modifier)
//   🇨🇳          2 code points / 4 code units  (two regional indicators)
//   1️⃣          3 code points / 3 code units  (digit + VS16 + enclosing keycap)
//   e + U+0301    2 code points / 2 code units  (base + combining acute)
//   👨‍👩‍👧          5 code points / 8 code units  (ZWJ sequence)
const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
const SKIN_TONE = '\u{1F44D}\u{1F3FD}';
const FLAG = '\u{1F1E8}\u{1F1F3}';
const KEYCAP = '1\uFE0F\u20E3';
const COMBINING = 'e\u0301';

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
// first content block, the way a paste or an offset calculation can leave it.
function caretInFirstBlock(muya: Muya, offset: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(offset, offset, true);
    return content;
}

// The full keydown path, which is where the cluster check runs.
function pressKey(content: Format, key: 'Backspace' | 'Delete'): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    content.keydownHandler(event);
    return event;
}

// The handler on its own, with the cluster check bypassed.
function pressBackspaceHandler(content: Format): Event {
    const event = new Event('keydown', { cancelable: true });
    content.backspaceHandler(event);
    return event;
}

describe('grapheme cluster fixtures', () => {
    it('are multi-code-point / multi-code-unit characters', () => {
        // Guard the fixtures themselves: if these lengths ever change, the
        // offsets the tests below use stop meaning anything.
        expect(FAMILY.length).toBe(8);
        expect(SKIN_TONE.length).toBe(4);
        expect(FLAG.length).toBe(4);
        expect(KEYCAP.length).toBe(3);
        expect(COMBINING.length).toBe(2);
    });
});

describe('caret inside a grapheme cluster — Backspace removes the whole character', () => {
    it('between the halves of a ZWJ sequence\'s first code point', () => {
        const content = caretInFirstBlock(bootMuya(`abc${FAMILY}\n`), 5);
        const event = pressKey(content, 'Backspace');

        // The whole 8-unit family emoji is gone — not the 2 units of `👨`, and
        // not a lone surrogate left behind.
        expect(content.text).toBe('abc');
        expect(content.getCursor()!.start.offset).toBe(3);
        expect(event.defaultPrevented).toBe(true);
    });

    it('between the ZWJ joiner and the following code point', () => {
        const content = caretInFirstBlock(bootMuya(`abc${FAMILY}\n`), 6);
        const event = pressKey(content, 'Backspace');

        expect(content.text).toBe('abc');
        expect(content.getCursor()!.start.offset).toBe(3);
        expect(event.defaultPrevented).toBe(true);
    });

    it('removes only the cluster under the caret, leaving its neighbours', () => {
        const content = caretInFirstBlock(bootMuya(`a${FAMILY}b\n`), 5);
        const event = pressKey(content, 'Backspace');

        expect(content.text).toBe('ab');
        expect(content.getCursor()!.start.offset).toBe(1);
        expect(event.defaultPrevented).toBe(true);
    });

    it('handles a skin tone modifier', () => {
        const content = caretInFirstBlock(bootMuya(`x${SKIN_TONE}\n`), 2);
        const event = pressKey(content, 'Backspace');

        expect(content.text).toBe('x');
        expect(content.getCursor()!.start.offset).toBe(1);
        expect(event.defaultPrevented).toBe(true);
    });

    it('handles a regional indicator flag', () => {
        const content = caretInFirstBlock(bootMuya(`x${FLAG}\n`), 2);
        const event = pressKey(content, 'Backspace');

        expect(content.text).toBe('x');
        expect(content.getCursor()!.start.offset).toBe(1);
        expect(event.defaultPrevented).toBe(true);
    });

    it('handles a keycap sequence', () => {
        const content = caretInFirstBlock(bootMuya(`x${KEYCAP}\n`), 2);
        const event = pressKey(content, 'Backspace');

        expect(content.text).toBe('x');
        expect(content.getCursor()!.start.offset).toBe(1);
        expect(event.defaultPrevented).toBe(true);
    });

    it('handles a combining mark', () => {
        const content = caretInFirstBlock(bootMuya(`x${COMBINING}\n`), 2);
        const event = pressKey(content, 'Backspace');

        expect(content.text).toBe('x');
        expect(content.getCursor()!.start.offset).toBe(1);
        expect(event.defaultPrevented).toBe(true);
    });
});

describe('caret inside a grapheme cluster — Delete removes the whole character', () => {
    it('between the halves of a ZWJ sequence\'s first code point', () => {
        const content = caretInFirstBlock(bootMuya(`abc${FAMILY}\n`), 5);
        const event = pressKey(content, 'Delete');

        expect(content.text).toBe('abc');
        expect(content.getCursor()!.start.offset).toBe(3);
        expect(event.defaultPrevented).toBe(true);
    });

    it('inside a cluster that ends the text', () => {
        const content = caretInFirstBlock(bootMuya(`a${FAMILY}\n`), 5);
        const event = pressKey(content, 'Delete');

        expect(content.text).toBe('a');
        expect(content.getCursor()!.start.offset).toBe(1);
        expect(event.defaultPrevented).toBe(true);
    });
});

describe('caret on a cluster boundary — the default behaviour is left alone', () => {
    it('before a ZWJ sequence defers instead of deleting it', () => {
        const content = caretInFirstBlock(bootMuya(`abc${FAMILY}\n`), 3);
        const event = pressKey(content, 'Backspace');

        // Offset 3 is the cluster's own start: a boundary, so Muya does not own
        // this delete. The browser's grapheme-aware Backspace removes `c`.
        expect(content.text).toBe(`abc${FAMILY}`);
        expect(event.defaultPrevented).toBe(false);
    });

    it('inside plain ASCII text defers', () => {
        const content = caretInFirstBlock(bootMuya('hello\n'), 3);
        const event = pressKey(content, 'Backspace');

        expect(content.text).toBe('hello');
        expect(event.defaultPrevented).toBe(false);
    });
});

describe('inline-token trimming is cluster aware', () => {
    it('trims a whole trailing ZWJ sequence from the token', () => {
        const content = caretInFirstBlock(bootMuya(`abc${FAMILY}\n`), 11);
        const event = pressBackspaceHandler(content);

        expect(content.text).toBe('abc');
        expect(content.getCursor()!.start.offset).toBe(3);
        expect(event.defaultPrevented).toBe(true);
    });

    it('trims a whole leading ZWJ sequence from the token', () => {
        const content = caretInFirstBlock(bootMuya(`${FAMILY}abc\n`), 8);
        const event = pressBackspaceHandler(content);

        expect(content.text).toBe('abc');
        expect(content.getCursor()!.start.offset).toBe(0);
        expect(event.defaultPrevented).toBe(true);
    });

    it('still trims one marker char from an ASCII run', () => {
        // The #113 behaviour must survive: `foo **strong**` loses one `*`.
        const content = caretInFirstBlock(bootMuya('foo **strong**\n'), 14);
        const event = pressBackspaceHandler(content);

        expect(content.text).toBe('foo **strong*');
        expect(event.defaultPrevented).toBe(true);
    });
});
