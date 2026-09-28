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

            // Resolve children AFTER the callback, which may augment the token.
            const children: Token[][] = [];
            switch (token.type) {
                case 'table': {
                    for (const cell of token.header)
                        children.push(cell.tokens);
                    for (const row of token.rows) {
                        for (const cell of row)
                            children.push(cell.tokens);
                    }
                    break;
                }
                case 'list':
                    children.push(token.items);
                    break;
                default: {
                    const keys = this.defaults.extensions?.childTokens?.[token.type];
                    if (keys) {
                        for (const key of keys)
                            children.push((token as Tokens.Generic)[key].flat(Infinity));
                    }
                    else if ('tokens' in token && token.tokens) {
                        children.push(token.tokens);
                    }
                }
            }
            for (let i = children.length - 1; i >= 0; i--)
                stack.push(children[i][Symbol.iterator]());
        }
        return results;
    }
}
