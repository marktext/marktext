// @vitest-environment happy-dom
import type { IMuyaOptions } from '../../types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pastePlainText } from '../../clipboard/paste';
import { Muya } from '../../muya';

const { normalize } = vi.hoisted(() => ({ normalize: vi.fn() }));
vi.mock('../../utils/paste', async importOriginal => ({
    ...await importOriginal<typeof import('../../utils/paste')>(),
    normalizePastedHTML: normalize,
}));

const editors = new Set<Muya>();
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
function boot(options: Partial<IMuyaOptions> = {}, markdown = 'original\n\nkeep') {
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown, ...options });
    muya.init({ focus: false });
    editors.add(muya);
    const target = muya.editor.scrollPage!.firstContentInDescendant()!;
    target.setCursor(target.text.length, target.text.length, true);
    muya.editor.activeContentBlock = target;
    return { muya, target };
}
afterEach(() => {
    for (const muya of editors) muya.destroy();
    editors.clear();
    normalize.mockReset();
});

describe('asynchronous block targets', () => {
    it.each(['remove', 'replace', 'read', 'destroy'] as const)('discards an upload after %s invalidates its target', async (action) => {
        const upload = deferred<string>();
        const { muya, target } = boot({ imageAction: () => upload.promise });
        const done = muya.editor.clipboard.pasteImage('/pending.png');
        expect(target.text).toContain('loading-');
        if (action === 'remove')
            target.parent!.remove();
        if (action === 'replace')
            muya.setContent('replacement');
        if (action === 'read')
            muya.setReadOnly(true);
        if (action === 'destroy') {
            muya.destroy();
            editors.delete(muya);
        }
        const before = target.text;
        upload.resolve('assets/completed.png');
        await done;
        expect(target.text).toBe(before);
        expect(!muya.isReadOnly && muya.isBlockInDocument(target)).toBe(false);
    });

    it('finishes an upload after locking and unlocking when the same target remains', async () => {
        const upload = deferred<string>();
        const { muya, target } = boot({ imageAction: () => upload.promise });
        const done = muya.editor.clipboard.pasteImage('/pending.png');
        muya.setReadOnly(true);
        muya.setReadOnly(false);
        expect(!muya.isReadOnly && muya.isBlockInDocument(target)).toBe(true);
        upload.resolve('assets/completed.png');
        await done;
        expect(target.text).toContain('![](assets/completed.png)');
        expect(target.text).not.toContain('loading-');
    });

    it('rejects a removed inner paragraph even when its outer block still exists', async () => {
        const upload = deferred<string>();
        const { muya, target } = boot({ imageAction: () => upload.promise }, '> first\n>\n> second');
        const outer = target.outMostBlock!;
        const done = muya.editor.clipboard.pasteImage('/pending.png');
        target.parent!.remove();
        expect(muya.isBlockInDocument(outer)).toBe(true);
        expect(muya.isBlockInDocument(target)).toBe(false);
        const before = target.text;
        upload.resolve('assets/completed.png');
        await done;
        expect(target.text).toBe(before);
    });

    it('does not fall through to text paste when an image lookup outlives its target', async () => {
        const lookup = deferred<string>();
        const { muya } = boot({ clipboardFilePath: () => lookup.promise });
        const done = pastePlainText(muya.editor.clipboard, 'stale paste');
        muya.setContent('replacement');
        lookup.resolve('/pending.png');
        await done;
        expect(muya.getMarkdown().trim()).toBe('replacement');
        expect(normalize).not.toHaveBeenCalled();
    });

    it('does not redirect an asynchronous clipboard read into another document', async () => {
        const read = deferred<string>();
        const { muya } = boot({ clipboardText: () => read.promise });
        const done = muya.editor.clipboard.pasteAsPlainText();
        muya.setContent('replacement');
        const next = muya.editor.scrollPage!.firstContentInDescendant()!;
        next.setCursor(0, 0, true);
        read.resolve('stale paste');
        await done;
        expect(muya.getMarkdown().trim()).toBe('replacement');
    });

    it('does not redirect a clipboard read when selection moves to another valid block', async () => {
        const read = deferred<string>();
        const { muya, target } = boot({ clipboardText: () => read.promise });
        const done = muya.editor.clipboard.pasteAsPlainText();
        const next = muya.editor.scrollPage!.lastContentInDescendant()!;
        next.setCursor(0, 0, true);
        expect(!muya.isReadOnly && muya.isBlockInDocument(target)).toBe(true);
        read.resolve('stale paste');
        await done;
        expect(muya.getMarkdown()).not.toContain('stale paste');
    });

    it('discards normalized paste when its target is replaced while normalization waits', async () => {
        const normalized = deferred<string>();
        normalize.mockReturnValue(normalized.promise);
        const { muya } = boot();
        const done = pastePlainText(muya.editor.clipboard, 'stale paste');
        await vi.waitFor(() => expect(normalize).toHaveBeenCalled());
        muya.replaceContent('replacement');
        normalized.resolve('');
        await done;
        expect(muya.getMarkdown().trim()).toBe('replacement');
    });
});
