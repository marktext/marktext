// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';

// #1677 — the emoji rule (/^(:)([a-z_\d+-]+)\1/) matched the colons inside a
// timestamp range like "12:00-14:00", so ":00-14:" was tokenized as an
// (invalid) emoji and rendered with the red mu-warn styling. An emoji opener
// must sit at a word boundary: a ":" glued to a preceding letter/digit is not
// the start of an emoji shortcode.

function emojiTokens(src: string) {
    return tokenizer(src).filter(t => t.type === 'emoji');
}

describe('emoji detection — word boundary (#1677)', () => {
    it('does not treat the colons in a timestamp range as an emoji', () => {
        expect(emojiTokens('12:00-14:00')).toHaveLength(0);
    });

    it('does not treat a colon glued to a word as an emoji', () => {
        expect(emojiTokens('hello:smile:')).toHaveLength(0);
    });

    it('still recognises an emoji at the start of the text', () => {
        expect(emojiTokens(':smile:').length).toBeGreaterThan(0);
    });

    it('still recognises an emoji after whitespace', () => {
        expect(emojiTokens('lunch :100: today').length).toBeGreaterThan(0);
    });
});
