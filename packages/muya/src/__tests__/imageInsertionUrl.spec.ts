// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { tokenizer } from '../inline/lexer';
import { bootMuya, useMuyaHarness } from './muyaHarness';

useMuyaHarness();

describe('inserting images preserves the requested destination', () => {
    it.each([
        ['/tmp/a&copy;.png', '/tmp/a&copy;.png'],
        ['https://example.com/a&copy;.png', 'https://example.com/a&copy;.png'],
        ['https://example.com/a&amp;.png', 'https://example.com/a&amp;.png'],
        ['https://example.com/a.png?first=1&copy;=2', 'https://example.com/a.png?first=1&copy;=2'],
        ['https://example.com/a&copy;.svg#icon', 'https://example.com/a&copy;.svg#icon'],
        ['https://example.com/图 &copy;.png#icon', 'https://example.com/%E5%9B%BE%20&copy;.png#icon'],
        ['https://example.com/a.png?first=1&second=2', 'https://example.com/a.png?first=1&second=2'],
    ])('keeps %j through insertion, history and reload', (src, expected) => {
        const muya = bootMuya('before\n');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(block.text.length, block.text.length, true);
        muya.transact(() => muya.insertImage({ src, alt: 'alt' }));
        const changed = muya.getMarkdown();
        expect(tokenizer(changed).find(token => token.type === 'image')).toMatchObject({ attrs: { src: expected } });

        muya.undo();
        expect(muya.getMarkdown()).toBe('before\n');
        muya.redo();
        expect(muya.getMarkdown()).toBe(changed);
        muya.setContent(changed);
        expect(tokenizer(muya.getMarkdown()).find(token => token.type === 'image')).toMatchObject({ attrs: { src: expected } });
    });
});
