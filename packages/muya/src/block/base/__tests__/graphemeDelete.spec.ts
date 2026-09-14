// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';

// Coverage for deleting emoji as whole characters (#4926).
//
// When the caret sits at an inline token boundary, Muya performs the Backspace
// itself instead of leaving it to the browser (muya#113). That emulation used
// to trim one UTF-16 code unit, so a token ending in an emoji kept half of its
// surrogate pair — a lone surrogate that `ot-text-unicode` cannot encode, which
// crashed the renderer on the next state flush.
//
// The contract pinned down here: when Muya owns the Backspace, it removes one
// whole grapheme cluster (UAX #29), however many code points or code units it
// is made of.
//
// Fixtures, with the shape that makes them interesting:
//   🙂          1 code point  / 2 code units  (one surrogate pair)
//   👍🏽          2 code points / 4 code units  (base + skin tone modifier)
//   🇨🇳          2 code points / 4 code units  (two regional indicators)
//   1️⃣          3 code points / 3 code units  (digit + VS16 + enclosing keycap)
//   e + U+0301    2 code points / 2 code units  (base + combining acute)
//   👨‍👩‍👧          5 code points / 8 code units  (ZWJ sequence)
const SMILE = '\u{1F642}';
const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
const SKIN_TONE = '\u{1F44D}\u{1F3FD}';
const FLAG = '\u{1F1E8}\u{1F1F3}';
const KEYCAP = '1\uFE0F\u20E3';
const COMBINING = 'e\u0301';

const CLUSTERS: Array<[name: string, cluster: string]> = [
    ['an astral character', SMILE],
    ['a skin tone modifier', SKIN_TONE],
    ['a regional indicator flag', FLAG],
    ['a keycap sequence', KEYCAP],
    ['a combining mark', COMBINING],
    ['a ZWJ sequence', FAMILY],
];

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
// first content block.
function caretInFirstBlock(muya: Muya, offset: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(offset, offset, true);
    return content;
}

function pressBackspace(content: Format): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true });
    content.keydownHandler(event);
    return event;
}

describe('grapheme cluster fixtures', () => {
    it('are multi-code-point / multi-code-unit characters', () => {
        // Guard the fixtures themselves: if these lengths ever change, the
        // offsets the tests below use stop meaning anything.
        expect(SMILE.length).toBe(2);
        expect(FAMILY.length).toBe(8);
        expect(SKIN_TONE.length).toBe(4);
        expect(FLAG.length).toBe(4);
        expect(KEYCAP.length).toBe(3);
        expect(COMBINING.length).toBe(2);
    });
});

describe('inline-token trimming is cluster aware', () => {
    for (const [name, cluster] of CLUSTERS) {
        it(`trims ${name} that ends the token as one character`, () => {
            const text = `abc${cluster}`;
            const content = caretInFirstBlock(bootMuya(`${text}\n`), text.length);
            const event = pressBackspace(content);

            expect(content.text).toBe('abc');
            expect(content.getCursor()!.start.offset).toBe(3);
            expect(event.defaultPrevented).toBe(true);
        });
    }

    it('trims an emoji that ends the text before inline markup', () => {
        const content = caretInFirstBlock(bootMuya(`${SMILE}**b**\n`), SMILE.length);
        const event = pressBackspace(content);

        expect(content.text).toBe('**b**');
        expect(content.getCursor()!.start.offset).toBe(0);
        expect(event.defaultPrevented).toBe(true);
    });

    it('trims a whole leading ZWJ sequence from the token', () => {
        const content = caretInFirstBlock(bootMuya(`${FAMILY}abc\n`), FAMILY.length);
        const event = pressBackspace(content);

        expect(content.text).toBe('abc');
        expect(content.getCursor()!.start.offset).toBe(0);
        expect(event.defaultPrevented).toBe(true);
    });

    it('still trims one marker char from an ASCII run', () => {
        // The #113 behaviour must survive: `foo **strong**` loses one `*`.
        const content = caretInFirstBlock(bootMuya('foo **strong**\n'), 14);
        const event = pressBackspace(content);

        expect(content.text).toBe('foo **strong*');
        expect(event.defaultPrevented).toBe(true);
    });

    it('leaves a Backspace after an emoji inside a token to the browser', () => {
        const content = caretInFirstBlock(bootMuya(`a${SMILE}b\n`), 1 + SMILE.length);
        const event = pressBackspace(content);

        expect(content.text).toBe(`a${SMILE}b`);
        expect(event.defaultPrevented).toBe(false);
    });
});
