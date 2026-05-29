import { describe, expect, it, vi } from 'vitest';
import EventCenter from '../index';

describe('eventCenter', () => {
    describe('unsubscribeAll() — bug 1 fix (listener leak)', () => {
        it('clears all pub/sub listeners', () => {
            const ec = new EventCenter();
            const cb = vi.fn();
            ec.on('foo', cb);
            ec.unsubscribeAll();
            ec.emit('foo');
            expect(cb).not.toHaveBeenCalled();
        });

        it('does not affect future subscriptions', () => {
            const ec = new EventCenter();
            const cb1 = vi.fn();
            const cb2 = vi.fn();
            ec.on('foo', cb1);
            ec.unsubscribeAll();
            ec.on('foo', cb2);
            ec.emit('foo');
            expect(cb1).not.toHaveBeenCalled();
            expect(cb2).toHaveBeenCalledTimes(1);
        });
    });

    describe('emit() — bug 2 fix (once-listener iteration)', () => {
        it('does not skip listeners when an earlier once-listener removes itself', () => {
            const ec = new EventCenter();
            const a = vi.fn();
            const b = vi.fn();
            const c = vi.fn();
            ec.once('foo', a);
            ec.on('foo', b);
            ec.on('foo', c);
            ec.emit('foo');
            expect(a).toHaveBeenCalledTimes(1);
            expect(b).toHaveBeenCalledTimes(1);
            expect(c).toHaveBeenCalledTimes(1);
        });

        it('all once-listeners removed after single emit', () => {
            const ec = new EventCenter();
            const a = vi.fn();
            const b = vi.fn();
            ec.once('foo', a);
            ec.once('foo', b);
            ec.emit('foo');
            ec.emit('foo');
            expect(a).toHaveBeenCalledTimes(1);
            expect(b).toHaveBeenCalledTimes(1);
        });

        it('mixed once + regular: regular survives, once is removed', () => {
            const ec = new EventCenter();
            const onceFn = vi.fn();
            const regFn = vi.fn();
            ec.once('foo', onceFn);
            ec.on('foo', regFn);
            ec.emit('foo');
            ec.emit('foo');
            expect(onceFn).toHaveBeenCalledTimes(1);
            expect(regFn).toHaveBeenCalledTimes(2);
        });
    });
});
