// @vitest-environment happy-dom

import type Format from '../../block/base/format';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { SelectionDirection } from '../../selection/types';
import { getImageInfo } from '../../utils/image';
import { imageClipboardData, readClipboardImage } from '../image';
import { PasteType } from '../types';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

const editors: Muya[] = [];

afterEach(() => {
    for (const muya of editors.splice(0))
        muya.domNode.remove();
    delete window.DIRNAME;
    vi.useRealTimers();
});

function boot(markdown: string, documentId = '/docs/source.md', options: Record<string, unknown> = {}) {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, documentId: () => documentId, ...options });
    muya.init();
    editors.push(muya);
    return muya;
}

function selectImage(muya: Muya) {
    const block = muya.editor.scrollPage!.firstContentInDescendant() as Format;
    const wrapper = block.domNode!.querySelector<HTMLElement>('.mu-inline-image')!;
    muya.editor.selection.selectImage({ ...getImageInfo(wrapper), block });
}

function copyData(markdown = '![alt](assets/source.png "caption")') {
    window.DIRNAME = '/docs';
    const source = boot(markdown);
    selectImage(source);
    return imageClipboardData(source.editor.clipboard)!;
}

function pasteEvent(data: { text: string; html: string }, withBitmap = true): ClipboardEvent {
    return {
        preventDefault() {},
        stopPropagation() {},
        clipboardData: {
            getData: (format: string) => format === 'text/plain' ? data.text : data.html,
            files: withBitmap ? [new File(['png'], 'image.png', { type: 'image/png' })] : [],
            items: [],
        },
    } as unknown as ClipboardEvent;
}

describe('selected image clipboard formats', () => {
    it('carries the original Markdown, resolved source and document identity in inert HTML', () => {
        const data = copyData();
        expect(readClipboardImage(data.html, data.text)).toEqual({
            version: 1,
            markdown: data.text,
            src: 'file:///docs/assets/source.png',
            documentId: '/docs/source.md',
        });
        const image = new DOMParser().parseFromString(data.html, 'text/html').querySelector('img')!;
        expect(image.getAttribute('alt')).toBe('alt');
        expect(image.getAttribute('title')).toBe('caption');
        expect(readClipboardImage(data.html, 'different text')).toBeNull();
        expect(readClipboardImage(`${data.html}<p>extra</p>`, data.text)).toBeNull();
        expect(readClipboardImage('<img data-marktext-image="broken">', data.text)).toBeNull();
    });

    it('does not include event handlers in the public HTML representation', () => {
        const data = copyData('<img src="assets/source.png" alt="x" width="123" onerror="alert(1)">');
        const image = new DOMParser().parseFromString(data.html, 'text/html').querySelector('img')!;
        expect(image.hasAttribute('onerror')).toBe(false);
        expect(image.getAttribute('width')).toBe('123');
    });

    it('lets the native copy event commit fallback data before requesting bitmap enrichment', async () => {
        vi.useFakeTimers();
        const writeImage = vi.fn().mockResolvedValue(false);
        const source = boot('![alt](https://example.com/source.png)', '/docs/source.md', { clipboardWriteImage: writeImage });
        selectImage(source);
        const setData = vi.fn();
        source.editor.clipboard.copyHandler({ clipboardData: { setData } } as unknown as ClipboardEvent);
        expect(writeImage).not.toHaveBeenCalled();
        expect(setData).toHaveBeenCalledWith('text/plain', '![alt](https://example.com/source.png)');
        await vi.advanceTimersByTimeAsync(0);
        expect(writeImage).toHaveBeenCalledOnce();
        expect(writeImage.mock.calls[0][0].html).toContain('data-marktext-copy');
    });
});

describe('internal image paste precedence', () => {
    it('prefers the original resized image over the accompanying bitmap in the same document', async () => {
        const raw = '<img src="assets/source.png" alt="alt" title="caption" width="123" height="45" data-align="right">';
        const data = copyData(raw);
        const action = vi.fn();
        const target = boot('![old](assets/old.png)', '/docs/source.md', { imageAction: action, clipboardImageAction: action });
        selectImage(target);
        await target.editor.clipboard.pasteHandler(pasteEvent(data));
        expect(target.getMarkdown()).toBe(`${raw}\n`);
        expect(action).not.toHaveBeenCalled();
        expect(target.editor.selection.image?.imageInfo.token.raw).toBe(raw);
    });

    it('resolves a relative source before applying another document’s asset preferences', async () => {
        const data = copyData();
        const action = vi.fn().mockResolvedValue('assets/copied.png');
        const target = boot('![old](assets/old.png)', '/elsewhere/target.md', { clipboardImageAction: action });
        selectImage(target);
        await target.editor.clipboard.pasteHandler(pasteEvent(data));
        expect(action).toHaveBeenCalledWith('file:///docs/assets/source.png');
        expect(target.getMarkdown()).toBe('![alt](assets/copied.png "caption")\n');
    });

    it('keeps an absolute working reference when the host cannot persist a cross-document asset', async () => {
        const data = copyData();
        const target = boot('![old](assets/old.png)', '/elsewhere/target.md', { clipboardImageAction: vi.fn().mockRejectedValue(new Error('offline')) });
        selectImage(target);
        await target.editor.clipboard.pasteHandler(pasteEvent(data));
        expect(target.getMarkdown()).toBe('![alt](file:///docs/assets/source.png "caption")\n');
    });

    it('does not apply a delayed asset result after the target document changes', async () => {
        const data = copyData();
        let resolve!: (src: string) => void;
        const target = boot('![old](assets/old.png)', '/elsewhere/target.md', {
            clipboardImageAction: () => new Promise<string>((done) => { resolve = done; }),
        });
        selectImage(target);
        const pasted = target.editor.clipboard.pasteHandler(pasteEvent(data));
        target.setContent('new document');
        resolve('assets/copied.png');
        await pasted;
        expect(target.getMarkdown()).toBe('new document\n');
    });

    it('ignores the native file-path hook for plain-text paste', async () => {
        const data = copyData();
        const hook = vi.fn().mockResolvedValue('/tmp/unrelated.png');
        const target = boot('text', '/docs/source.md', { clipboardFilePath: hook });
        const block = target.editor.scrollPage!.firstContentInDescendant();
        if (!block)
            throw new Error('Missing target block');
        block.setCursor(4, 4, true);
        vi.spyOn(block, 'getCursor').mockReturnValue({ start: { offset: 4 }, end: { offset: 4 } } as ReturnType<typeof block.getCursor>);
        vi.spyOn(target.editor.selection, 'getTextSelection').mockReturnValue({
            anchor: { offset: 4, block, path: block.path },
            focus: { offset: 4, block, path: block.path },
            isCollapsed: true,
            isSelectionInSameBlock: true,
            direction: SelectionDirection.FORWARD,
        });
        target.editor.clipboard.pasteType = PasteType.PASTE_AS_PLAIN_TEXT;
        await target.editor.clipboard.pasteHandler(pasteEvent(data));
        expect(hook).not.toHaveBeenCalled();
        expect(target.getMarkdown()).toBe(`text${data.text}\n`);
    });
});
