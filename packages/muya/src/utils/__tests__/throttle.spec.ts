import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from '../index';

describe('throttle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs immediately and trails with the latest arguments and receiver', () => {
        const callback = vi.fn(function (this: { prefix: string }, value: string) {
            return `${this.prefix}${value}`;
        });
        const throttled = throttle(callback, 300);

        expect(throttled.call({ prefix: 'first:' }, 'one')).toBe('first:one');
        vi.advanceTimersByTime(100);
        expect(throttled.call({ prefix: 'second:' }, 'two')).toBe('first:one');
        vi.advanceTimersByTime(100);
        throttled.call({ prefix: 'last:' }, 'three');
        expect(callback).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveLastReturnedWith('last:three');
    });

    it('cancels a queued trailing call', () => {
        const callback = vi.fn();
        const throttled = throttle(callback, 300);
        throttled('first');
        vi.advanceTimersByTime(100);
        throttled('pending');

        throttled.cancel();
        vi.advanceTimersByTime(500);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('first');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('runs the first call after cancellation immediately without replaying old arguments', () => {
        const callback = vi.fn();
        const throttled = throttle(callback, 300);
        throttled('first');
        vi.advanceTimersByTime(100);
        throttled('discarded');
        throttled.cancel();

        throttled('resumed');
        expect(callback).toHaveBeenLastCalledWith('resumed');
        expect(callback).toHaveBeenCalledTimes(2);

        throttled('latest');
        vi.advanceTimersByTime(300);
        expect(callback.mock.calls).toEqual([['first'], ['resumed'], ['latest']]);
    });

    it('can be cancelled repeatedly before use and when no trailing call is pending', () => {
        const callback = vi.fn();
        const throttled = throttle(callback, 300);
        throttled.cancel();
        throttled.cancel();
        throttled();
        throttled.cancel();
        throttled.cancel();
        throttled();

        expect(callback).toHaveBeenCalledTimes(2);
        expect(vi.getTimerCount()).toBe(0);
    });
});
