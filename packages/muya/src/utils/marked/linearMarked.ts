import type { Token, Tokens } from 'marked';
import { Marked } from 'marked';

/** Marked's traversal without copying an ever-growing result array per token. */
export class LinearMarked extends Marked {
    override walkTokens(tokens: Token[], callback: Parameters<Marked['walkTokens']>[1]): ReturnType<Marked['walkTokens']> {
        const results: ReturnType<Marked['walkTokens']> = [];
        const stack: Iterator<Token>[] = [tokens[Symbol.iterator]()];
        while (stack.length) {
            const next = stack[stack.length - 1].next();
            if (next.done) {
                stack.pop();
                continue;
            }
            const token = next.value;
            const result = callback.call(this, token);
            if (Array.isArray(result)) {
                for (const value of result)
                    results.push(value);
            }
            else {
                results.push(result);
            }

            stack.push(this._walkChildren(token));
        }
        return results;
    }

    // Earlier subtree callbacks may replace later sibling arrays, so read each only when reached.
    private* _walkChildren(token: Token): Generator<Token> {
        switch (token.type) {
            case 'table':
                for (const cell of token.header)
                    yield* cell.tokens;
                for (const row of token.rows) {
                    for (const cell of row)
                        yield* cell.tokens;
                }
                break;
            case 'list':
                yield* token.items;
                break;
            default: {
                const keys = this.defaults.extensions?.childTokens?.[token.type];
                if (keys) {
                    // Marked uses forEach: appended keys are ignored and deleted keys are skipped.
                    for (let i = 0, length = keys.length; i < length; i++) {
                        if (i in keys)
                            yield* (token as Tokens.Generic)[keys[i]].flat(Infinity);
                    }
                }
                else if ('tokens' in token && token.tokens) {
                    yield* token.tokens;
                }
            }
        }
    }
}
