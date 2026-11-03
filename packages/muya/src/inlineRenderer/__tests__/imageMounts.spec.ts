// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImageMounts } from '../resources/imageMounts';

let root: HTMLElement;
let mounts: ImageMounts;

function deferred() {
    let resolve!: (result: { id: string; isSuccess: boolean }) => void;
    const promise = new Promise<{ id: string; isSuccess: boolean }>(complete => resolve = complete);
    return { promise, resolve };
}

function watch(scope: HTMLElement, request = deferred()) {
    const apply = vi.fn();
    const id = mounts.watch(scope, request.promise, apply);
    const placeholder = document.createElement('span');
    placeholder.id = id;
    scope.append(placeholder);
    return { placeholder, apply, request };
}

beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
    mounts = new ImageMounts(root);
});

afterEach(() => {
    mounts.dispose();
    root.remove();
    vi.restoreAllMocks();
});

it('automatically releases a removed subtree without cancelling another shared occurrence', async () => {
    const parent = document.createElement('div');
    const first = document.createElement('div');
    const second = document.createElement('div');
    parent.append(first);
    root.append(parent, second);
    const request = deferred();
    const a = watch(first, request);
    const b = watch(second, request);
    await Promise.resolve();
    parent.remove();
    await vi.waitFor(() => expect(mounts.size).toBe(1));
    request.resolve({ id: 'shared', isSuccess: true });
    await request.promise;
    expect(a.apply).not.toHaveBeenCalled();
    expect(b.apply).toHaveBeenCalledWith(b.placeholder, { id: 'shared', isSuccess: true });
});

it('cleans old placeholders when the same block is rendered again', async () => {
    const scope = document.createElement('div');
    root.append(scope);
    const request = deferred();
    const previous = watch(scope, request);
    await Promise.resolve();
    scope.replaceChildren();
    const current = watch(scope, request);
    await vi.waitFor(() => expect(mounts.size).toBe(1));
    request.resolve({ id: 'shared', isSuccess: true });
    await request.promise;
    expect(previous.apply).not.toHaveBeenCalled();
    expect(current.apply).toHaveBeenCalledOnce();
});

it('preserves pending mounts across synchronous moves within the editor', async () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const scope = document.createElement('div');
    root.append(first, second);
    first.append(scope);
    const binding = watch(scope);
    await Promise.resolve();
    scope.remove();
    second.append(scope);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mounts.size).toBe(1);
    binding.request.resolve({ id: 'moving', isSuccess: true });
    await binding.request.promise;
    expect(binding.apply).toHaveBeenCalledOnce();
});

it('cleans a block moved outside its editor even while it remains connected', async () => {
    const scope = document.createElement('div');
    root.append(scope);
    const binding = watch(scope);
    await Promise.resolve();
    document.body.append(scope);
    try {
        await vi.waitFor(() => expect(mounts.size).toBe(0));
        binding.request.resolve({ id: 'removed', isSuccess: true });
        await binding.request.promise;
        expect(binding.apply).not.toHaveBeenCalled();
    }
    finally {
        scope.remove();
    }
});

it('cleans all pending mounts when document contents are replaced', async () => {
    watch(root);
    watch(root);
    await Promise.resolve();
    root.replaceChildren();
    await vi.waitFor(() => expect(mounts.size).toBe(0));
});

it('ignores completion before the observer delivers a removal', async () => {
    const binding = watch(root);
    await Promise.resolve();
    binding.request.resolve({ id: 'removed', isSuccess: true });
    binding.placeholder.remove();
    await binding.request.promise;
    expect(binding.apply).not.toHaveBeenCalled();
    expect(mounts.size).toBe(0);
});

it('releases an abandoned render even without a DOM mutation', async () => {
    mounts.watch(root, new Promise(() => {}), vi.fn());
    await Promise.resolve();
    expect(mounts.size).toBe(0);
});

it('disconnects when idle and starts observing again for the next image', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const first = watch(root);
    first.request.resolve({ id: 'first', isSuccess: true });
    await first.request.promise;
    expect(mounts.size).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce();
    const next = watch(root);
    await Promise.resolve();
    expect(observe).toHaveBeenCalledTimes(2);
    next.placeholder.remove();
    await vi.waitFor(() => expect(mounts.size).toBe(0));
    expect(disconnect).toHaveBeenCalledTimes(2);
});

it('clear cancels old callbacks and permits fresh subscriptions', async () => {
    const old = watch(root);
    mounts.clear();
    const fresh = watch(root);
    old.request.resolve({ id: 'old', isSuccess: true });
    fresh.request.resolve({ id: 'fresh', isSuccess: true });
    await Promise.all([old.request.promise, fresh.request.promise]);
    expect(old.apply).not.toHaveBeenCalled();
    expect(fresh.apply).toHaveBeenCalledOnce();
});

it('disposal disconnects observation and prevents future subscriptions', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const binding = watch(root);
    mounts.dispose();
    binding.request.resolve({ id: 'late', isSuccess: true });
    const after = watch(root);
    after.request.resolve({ id: 'later', isSuccess: true });
    await Promise.all([binding.request.promise, after.request.promise]);
    expect(binding.apply).not.toHaveBeenCalled();
    expect(after.apply).not.toHaveBeenCalled();
    expect(mounts.size).toBe(0);
    expect(observe).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
});
