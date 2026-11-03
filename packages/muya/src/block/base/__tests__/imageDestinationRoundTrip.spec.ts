// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { bootMuya, useMuyaHarness } from '../../../__tests__/muyaHarness';
import { tokenizer } from '../../../inline/lexer';
import { getImageInfo } from '../../../utils/image';
import Format from '../format';

useMuyaHarness();

describe('image destination preservation when editing a title', () => {
    it.each([
        [String.raw`https://example.com/a\&copy;.png`, 'https://example.com/a&copy;.png'],
        ['https://example.com/a&amp;copy;.png', 'https://example.com/a&copy;.png'],
        ['https://example.com/a&#38;copy;.png', 'https://example.com/a&copy;.png'],
        ['https://example.com/a&#x26;copy;.png', 'https://example.com/a&copy;.png'],
        [String.raw`https://example.com/a\&amp;.png`, 'https://example.com/a&amp;.png'],
        [String.raw`https://example.com/a\\\&copy;.png`, String.raw`https://example.com/a\&copy;.png`],
        ['https://example.com/a%26copy;.png', 'https://example.com/a%26copy;.png'],
        ['https://example.com/a.png?first=1&second=2', 'https://example.com/a.png?first=1&second=2'],
        ['https://example.com/a&Tab;.png', 'https://example.com/a\t.png'],
        ['https://example.com/a&NewLine;.png', 'https://example.com/a\n.png'],
        ['https://example.com/a&#9;.png', 'https://example.com/a\t.png'],
        ['https://example.com/a&#10;.png', 'https://example.com/a\n.png'],
        ['https://example.com/a&#13;.png', 'https://example.com/a\r.png'],
        ['https://example.com/a&#31;.png', 'https://example.com/a\u001F.png'],
        ['https://example.com/a&#127;.png', 'https://example.com/a\u007F.png'],
        ['https://example.com/a&lt;.png', 'https://example.com/a<.png'],
        ['https://example.com/a&gt;.png', 'https://example.com/a>.png'],
        ['https://example.com/a.svg#icon', 'https://example.com/a.svg#icon'],
        ['assets/a&#9;.png', 'assets/a\t.png'],
    ])('keeps the destination from %j through edits, history and reloads', (raw, src) => {
        const muya = bootMuya(`![alt](${raw} "old")\n`);
        for (const title of ['new', 'new again', '&ouml; \"quoted\" \\*']) {
            const block = muya.editor.scrollPage!.firstContentInDescendant();
            if (!(block instanceof Format))
                throw new Error('Expected a formattable image block');
            const wrapper = block.domNode!.querySelector<HTMLElement>('.mu-inline-image')!;
            const imageInfo = getImageInfo(wrapper);
            expect(imageInfo.token.attrs.src).toBe(src);
            const before = muya.getMarkdown();
            muya.transact(() => block.replaceImage(imageInfo, {
                src: imageInfo.token.attrs.src ?? '',
                alt: 'alt',
                title,
            }));
            const changed = muya.getMarkdown();
            expect(tokenizer(changed)[0]).toMatchObject({ type: 'image', attrs: { src, title } });

            muya.undo();
            expect(muya.getMarkdown()).toBe(before);
            muya.redo();
            expect(muya.getMarkdown()).toBe(changed);
            expect(tokenizer(muya.getMarkdown())[0]).toMatchObject({ type: 'image', attrs: { src, title } });
            muya.setContent(changed);
        }
    });
});
