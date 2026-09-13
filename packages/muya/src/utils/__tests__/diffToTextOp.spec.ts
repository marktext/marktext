// @vitest-environment node

import diff from 'fast-diff';
import { type as textType } from 'ot-text-unicode';
import { describe, expect, it } from 'vitest';
import { diffToTextOp } from '../index';

// `diffToTextOp` turns a text diff into an `ot-text-unicode` operation. That
// type counts its positions in **code points**, so a run of unchanged text has
// to be measured the same way. Measuring it in grapheme clusters (as this used
// to) drifts on every character that is more than one code point, and the
// resulting op then edits the wrong offset — the JSON state silently diverges
// from the text the user is looking at, which is the corruption behind the
// #4926 family of emoji crashes.
//
// The invariant asserted below is the only one that matters: replaying the op
// against the document must produce exactly the text the editor now shows.
const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
const SKIN_TONE = '\u{1F44D}\u{1F3FD}';
const FLAG = '\u{1F1E8}\u{1F1F3}';
const KEYCAP = '1\uFE0F\u20E3';
const COMBINING = 'e\u0301';
const SMILE = '\u{1F642}';

function apply(from: string, to: string): string {
    return textType.apply(from, diffToTextOp(diff(from, to)) as never);
}

describe('diffToTextOp — the op replays the edit exactly', () => {
    const cases: Array<[name: string, from: string, to: string]> = [
        ['delete', 'abc', 'ab'],
        ['insert', 'abc', 'abcd'],
        ['replace', 'abc', 'axc'],
        ['multi-edit', 'hello world', 'hello brave world'],
        ['insert a ZWJ sequence', 'abc', `abc${FAMILY}`],
        ['delete a ZWJ sequence', `abc${FAMILY}`, 'abc'],
        ['delete after a ZWJ sequence', `${FAMILY}abc`, FAMILY],
        ['insert after a ZWJ sequence', `${FAMILY}abc`, `${FAMILY}abcd`],
        ['edit between an emoji and a ZWJ sequence', `${SMILE}${FAMILY}y`, `${SMILE}${FAMILY}`],
        ['edit between two ZWJ sequences', `${FAMILY}${FAMILY}!`, `${FAMILY}${FAMILY}`],
        ['a skin tone modifier', `${SKIN_TONE}ok`, SKIN_TONE],
        ['a regional indicator flag', `${FLAG}${KEYCAP}x`, `${FLAG}${KEYCAP}`],
        ['a combining mark', `x${COMBINING}`, 'x'],
        ['mixed clusters', `a${SMILE}b${FAMILY}c`, `a${FAMILY}c`],
    ];

    for (const [name, from, to] of cases) {
        it(name, () => {
            expect(apply(from, to)).toBe(to);
        });
    }
});

describe('diffToTextOp — position units', () => {
    it('counts a skipped run in code points, not grapheme clusters', () => {
        // `👨‍👩‍👧` is ONE grapheme cluster but FIVE code points; the op has to
        // skip five, or the delete lands inside the emoji.
        expect(diffToTextOp(diff(`${FAMILY}y`, FAMILY))).toEqual([5, { d: 'y' }]);
    });

    it('keeps ASCII skips unchanged', () => {
        expect(diffToTextOp(diff('abcy', 'abc'))).toEqual([3, { d: 'y' }]);
    });

    it('counts an astral character as one code point', () => {
        expect(diffToTextOp(diff(`${SMILE}y`, SMILE))).toEqual([1, { d: 'y' }]);
    });
});
