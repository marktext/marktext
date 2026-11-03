// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { ImageMounts } from '../resources/imageMounts';
import { ImageResources } from '../resources/images';

it('releases one block without cancelling another occurrence of the shared resource', async () => {
    const mounts = new ImageMounts();
    let complete!: (result: { id: string; isSuccess: boolean }) => void;
    const promise = new Promise<{ id: string; isSuccess: boolean }>(resolve => complete = resolve);
    const first = document.createElement('div');
    const second = document.createElement('div');
    const a = vi.fn();
    const b = vi.fn();
    mounts.watch(first, promise, a);
    mounts.watch(second, promise, b);
    mounts.release(first);
    complete({ id: 'resource', isSuccess: true });
    await promise;
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
});

it('clears all pending mounts on disposal and rejects future resource requests', async () => {
    const mounts = new ImageMounts();
    const update = vi.fn();
    const promise = Promise.resolve({ id: 'resource', isSuccess: true });
    mounts.watch(document.createElement('div'), promise, update);
    mounts.clear();
    await promise;
    expect(update).not.toHaveBeenCalled();
    const resources = new ImageResources();
    resources.setPreview('src', 'preview');
    resources.dispose();
    resources.setPreview('src', 'later');
    expect(resources.getPreview('src')).toBeUndefined();
    expect(await resources.request('src', false)).toBeNull();
});
