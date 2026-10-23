import { afterEach, describe, expect, it, vi } from 'vitest';
import logger from '../logger';

afterEach(() => {
    logger.setSink();
    logger.level('log');
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('logger sink', () => {
    it('receives production warnings and errors from previously created loggers without console output', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const debug = logger('editor:');
        const sink = vi.fn();
        const failure = new Error('Failed to update');
        logger.setSink(sink);

        debug.warn('Unknown operation');
        debug.error(failure);

        expect(sink.mock.calls).toEqual([
            ['warn', 'editor:', 'Unknown operation'],
            ['error', 'editor:', failure],
        ]);
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    it('keeps development console logging and applies the level filter to both outputs', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const sink = vi.fn();
        logger.setSink(sink);
        logger.level('warn');
        const debug = logger('selection:');

        debug.warn('Invalid selection');
        debug.log('Document operation');

        expect(sink).toHaveBeenCalledExactlyOnceWith('warn', 'selection:', 'Invalid selection');
        expect(warn).toHaveBeenCalledExactlyOnceWith('selection:', 'Invalid selection');
        expect(log).not.toHaveBeenCalled();
    });

    it('can replace and remove the sink without recreating loggers', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const first = vi.fn();
        const second = vi.fn();
        const debug = logger('editor:');
        logger.setSink(first);
        debug.warn('first');
        logger.setSink(second);
        debug.warn('second');
        logger.setSink();
        debug.warn('disabled');

        expect(first).toHaveBeenCalledExactlyOnceWith('warn', 'editor:', 'first');
        expect(second).toHaveBeenCalledExactlyOnceWith('warn', 'editor:', 'second');
    });

    it('does not break editor error recovery when the sink throws', () => {
        vi.stubEnv('NODE_ENV', 'production');
        logger.setSink(() => {
            throw new Error('Log transport unavailable');
        });

        expect(() => logger('editor:').error('Recovering')).not.toThrow();
    });
});
