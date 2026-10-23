export type TLogLevel = 'error' | 'warn' | 'log' | 'info';
export type TLogSink = (level: TLogLevel, ...args: unknown[]) => void;

const levels: TLogLevel[] = ['error', 'warn', 'log', 'info'];
let level: TLogLevel = 'log';
let sink: TLogSink | undefined;

type Ilogger = Record<TLogLevel, (...args: unknown[]) => void>;

function debug(method: TLogLevel, ...args: unknown[]) {
    if (levels.indexOf(method) > levels.indexOf(level)) {
        return;
    }

    try {
        sink?.(method, ...args);
    }
    catch {
        // A host's logging failure must not interrupt editing or error recovery.
    }

    // eslint-disable-next-line node/prefer-global/process
    if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console[method](...args);
    }
}

function namespace(ns: string): Ilogger {
    return levels.reduce((logger, method) => {
        logger[method] = debug.bind(console, method, ns);

        return logger;
    }, {} as Ilogger);
}

namespace.level = (newLevel: TLogLevel) => {
    level = newLevel;
};
debug.level = namespace.level;

/** The process-wide sink receives level-filtered events in every build, with the namespace first. */
namespace.setSink = (newSink?: TLogSink) => {
    sink = newSink;
};

export default namespace;
