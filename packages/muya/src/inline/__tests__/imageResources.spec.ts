// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { loadImage } from '../../utils/image';
import { ImageResources } from '../resources/images';

vi.mock('../../utils/image', async original => ({
    ...await original<typeof import('../../utils/image')>(),
    loadImage: vi.fn(),
}));

function deferred() {
    let resolve!: (value: { url: string; width: number; height: number }) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<{ url: string; width: number; height: number }>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

beforeEach(() => {
    vi.mocked(loadImage).mockReset();
});

describe('image resource ownership', () => {
    it('shares pending loads and retries failures', async () => {
        const resources = new ImageResources();
        const first = deferred();
        vi.mocked(loadImage).mockReturnValueOnce(first.promise);
        const request = resources.request('image.png', false);
        expect(resources.request('image.png', false)).toBe(request);
        expect(loadImage).toHaveBeenCalledTimes(1);
        first.reject(new Error('offline'));
        expect(await request).toMatchObject({ isSuccess: false });
        vi.mocked(loadImage).mockResolvedValueOnce({ url: 'image.png', width: 10, height: 20 });
        expect(await resources.request('image.png', false)).toMatchObject({ isSuccess: true });
        expect(loadImage).toHaveBeenCalledTimes(2);
    });

    it('ignores a stale completion after invalidation and a replacement request', async () => {
        const resources = new ImageResources();
        const old = deferred();
        const fresh = deferred();
        vi.mocked(loadImage).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
        const stale = resources.request('file:///image.png', false);
        resources.invalidate();
        const current = resources.request('file:///image.png', false);
        fresh.resolve({ url: 'fresh', width: 20, height: 20 });
        await current;
        old.resolve({ url: 'stale', width: 10, height: 10 });
        expect(await stale).toBeNull();
        expect(resources.get('file:///image.png')?.url).toBe('fresh');
        expect(vi.mocked(loadImage).mock.calls[0][0]).not.toBe(vi.mocked(loadImage).mock.calls[1][0]);
    });

    it('mounts shared resources into distinct occurrences and stops after destruction', async () => {
        const pending = deferred();
        vi.mocked(loadImage).mockReturnValue(pending.promise);
        const host = document.createElement('div');
        document.body.append(host);
        const muya = new Muya(host, { markdown: '![one](https://example.com/image.png)\n\n![two](https://example.com/image.png)' });
        muya.init();
        try {
            expect(loadImage).toHaveBeenCalledTimes(1);
            expect(muya.domNode.querySelectorAll('.mu-image-loading')).toHaveLength(2);
            expect(muya.domNode.querySelectorAll('.mu-image-fail')).toHaveLength(0);
            pending.resolve({ url: 'https://example.com/image.png', width: 100, height: 100 });
            await vi.waitFor(() => expect(muya.domNode.querySelectorAll('.mu-image-container img')).toHaveLength(2));
            const ids = Array.from(muya.domNode.querySelectorAll('.mu-inline-image')).map(node => node.id);
            expect(new Set(ids).size).toBe(2);
            const next = deferred();
            vi.mocked(loadImage).mockReturnValue(next.promise);
            muya.invalidateImageCache();
            muya.destroy();
            next.resolve({ url: 'late', width: 10, height: 10 });
            await next.promise;
            await Promise.resolve();
            expect(muya.editor.inlineEngine.renderer.images.size).toBe(0);
        }
        finally {
            muya.destroy();
        }
    });
});

it('keeps a pending image subscription when its block moves within the document', async () => {
    const pending = deferred();
    vi.mocked(loadImage).mockReturnValue(pending.promise);
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown: '![moving](https://example.com/moving.png)\n\ntail' });
    muya.init();
    try {
        const page = muya.editor.scrollPage!;
        const paragraph = page.firstContentInDescendant()!.parent!;
        paragraph.insertInto(page);
        await Promise.resolve();
        pending.resolve({ url: 'https://example.com/moving.png', width: 100, height: 100 });
        await vi.waitFor(() => expect(muya.domNode.querySelectorAll('.mu-image-container img')).toHaveLength(1));
        expect(loadImage).toHaveBeenCalledTimes(1);
    }
    finally {
        muya.destroy();
    }
});

it('automatically removes pending subscriptions when the document is rebuilt', async () => {
    const pending = deferred();
    vi.mocked(loadImage).mockReturnValue(pending.promise);
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown: '![old](https://example.com/old.png)' });
    muya.init();
    try {
        const mounts = muya.editor.inlineEngine.renderer.mounts;
        await vi.waitFor(() => expect(mounts.size).toBe(1));
        muya.setContent('replacement');
        await vi.waitFor(() => expect(mounts.size).toBe(0));
        pending.resolve({ url: 'https://example.com/old.png', width: 100, height: 100 });
        await pending.promise;
        await Promise.resolve();
        expect(muya.domNode.querySelector('img')).toBeNull();
        expect(muya.getMarkdown()).toContain('replacement');
    }
    finally {
        muya.destroy();
    }
});
