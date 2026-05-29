type TLevel = 'error' | 'warn' | 'log' | 'info';

const levels: TLevel[] = ['error', 'warn', 'log', 'info'];
let level: TLevel = 'log';

type Ilogger = Record<TLevel, (...args: string[]) => void>;

function debug(method: TLevel, ...args: unknown[]) {
    if (
        levels.indexOf(method) <= levels.indexOf(level)
        // eslint-disable-next-line node/prefer-global/process
        && process.env.NODE_ENV !== 'production'
    ) {
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

namespace.level = (newLevel: TLevel) => {
    level = newLevel;
};
debug.level = namespace.level;

export default namespace;
