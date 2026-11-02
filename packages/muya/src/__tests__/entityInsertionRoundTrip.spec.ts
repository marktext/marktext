// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import Format from '../block/base/format';
import { pasteImageSrc } from '../clipboard/pasteImage';
import { getUrlPaste, pasteUrl } from '../clipboard/pasteUrl';
import { PasteType } from '../clipboard/types';
import { tokenizer } from '../inlineRenderer/lexer';
import { isImageToken } from '../utils/image';
import { bootMuya, useMuyaHarness } from './muyaHarness';

useMuyaHarness();

describe('literal entities in inserted attributes', () => {
    it.each(['/tmp/a&copy;.png', 'https://example.com/a.png?x=1&copy;'])('preserves inserted image source %j', (src) => {
        const muya = bootMuya('text');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(4, 4, true);
        muya.insertImage({ src, alt: 'x' });
        muya.flush();
        const token = tokenizer(block.text).find(isImageToken);
        expect(token?.type === 'image' && token.src).toBe(src);
    });

    it('preserves a clipboard image path', async () => {
        const muya = bootMuya('text');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(4, 4, true);
        await pasteImageSrc(muya.editor.clipboard, '/tmp/a&copy;.png');
        muya.flush();
        const token = tokenizer(block.text).find(isImageToken);
        expect(token?.type === 'image' && token.src).toBe('/tmp/a&copy;.png');
    });

    it('preserves replaced image sources and titles', () => {
        const muya = bootMuya('![old](/old.png)');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        if (!(block instanceof Format))
            throw new Error('Expected a formattable block');
        const token = tokenizer(block.text)[0];
        if (!isImageToken(token))
            throw new Error('Expected an image');
        block.replaceImage({ token, imageId: 'test' }, { src: '/tmp/a&copy;.png', title: '&ouml; "quoted" \\*' });
        muya.flush();
        const replacement = tokenizer(block.text).find(isImageToken);
        expect(replacement?.attrs).toMatchObject({ src: '/tmp/a&copy;.png', title: '&ouml; "quoted" \\*' });
    });

    it('preserves a URL pasted over selected text', () => {
        const muya = bootMuya('text');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(0, 4, true);
        const url = 'https://example.com/?x=1&copy;';
        const paste = getUrlPaste(muya.editor.clipboard, block, url, PasteType.NORMAL);
        expect(paste).not.toBeNull();
        if (!paste)
            throw new Error('Expected a URL paste');
        pasteUrl(muya.editor.clipboard, block, paste);
        muya.flush();
        expect(tokenizer(block.text)[0]).toMatchObject({ type: 'link', href: url });
    });
});
