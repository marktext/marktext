import type { Token } from './types';

/** Paired enter/exit events keep consumers independent of the JavaScript call-stack limit. */
export function* tokenEvents(tokens: readonly Token[], descend: (token: Token) => boolean = () => true): Generator<{ token: Token; exiting: boolean }> {
    const stack: { iterator: Iterator<Token>; parent?: Token }[] = [{ iterator: tokens[Symbol.iterator]() }];
    while (stack.length) {
        const frame = stack[stack.length - 1];
        const next = frame.iterator.next();
        if (next.done) {
            stack.pop();
            if (frame.parent)
                yield { token: frame.parent, exiting: true };
            continue;
        }
        const token = next.value;
        yield { token, exiting: false };
        if ('children' in token && token.children && descend(token))
            stack.push({ iterator: token.children[Symbol.iterator](), parent: token });
        else
            yield { token, exiting: true };
    }
}
