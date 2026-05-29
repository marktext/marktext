import type { Token } from 'marked';
import type { ListItemToken, ListToken } from './types';

function isListToken(token: Token | ListToken): token is ListToken {
    return token.type === 'list';
}

const BULL_REG = /^ {0,3}([*+-]|\d{1,9}(?:\.|\)))/;

// If bullet list contains task list items, split the bullet list into bullet lists and task lists.
// Add `listType` to token, it's type: "order" | "bullet" | "task".
// Add `listItemType` to list_item token. it's type: "order" | "bullet" | "task".
// Add `bulletMarkerOrDelimiter` to list_item token. it's type: "." | ")" | "*" | "+" | "-"
function compatibleTaskList(tokens: (Token | ListToken | ListItemToken)[] = []) {
    const results = [];

    for (const token of tokens) {
        if (isListToken(token)) {
            if (token.ordered === true) {
                token.listType = 'order';
                for (const item of token.items) {
                    item.tokens = compatibleTaskList(item.tokens);
                    item.listItemType = 'order';
                    const matches = BULL_REG.exec(item.raw);
                    item.bulletMarkerOrDelimiter = matches ? matches[1].slice(-1) as ListItemToken['bulletMarkerOrDelimiter'] : '';
                }
                results.push(token);
            }
            else {
                const { type, raw, ordered, loose } = token;
                let cache: {
                    type: 'list';
                    listType: 'bullet' | 'task';
                    raw: string;
                    ordered: false;
                    start: '';
                    loose: boolean;
                    items: ListItemToken[];
                } | null = null;

                for (const item of token.items) {
                    item.tokens = compatibleTaskList(item.tokens);
                    const listItemType = item.task ? 'task' : 'bullet';
                    item.listItemType = listItemType;
                    const matches = BULL_REG.exec(item.raw);
                    item.bulletMarkerOrDelimiter = matches ? matches[1] as ListItemToken['bulletMarkerOrDelimiter'] : '';

                    if (!cache) {
                        cache = {
                            type,
                            raw,
                            ordered,
                            start: '',
                            loose,
                            listType: listItemType,
                            items: [item],
                        };
                    }
                    else {
                        if (listItemType === cache.listType) {
                            cache.items.push(item);
                        }
                        else {
                            results.push(cache);
                            cache = {
                                type,
                                raw,
                                ordered,
                                start: '',
                                loose,
                                listType: listItemType,
                                items: [item],
                            };
                        }
                    }
                }

                if (cache)
                    results.push(cache);
            }
        }
        else if (token.type === 'blockquote') {
            token.tokens = compatibleTaskList(token.tokens);
            results.push(token);
        }
        else if (token.type === 'footnote') {
            // The footnote extension stores its body block tokens under
            // `tokens` (see utils/marked/extensions/footnote.ts). Without
            // this branch a nested bullet/order/task list inside a footnote
            // never receives a `listType`, and markdownToState produces
            // `undefined-list` for the child state.
            const ft = token as { tokens?: (Token | ListToken | ListItemToken)[] };
            ft.tokens = compatibleTaskList(ft.tokens);
            results.push(token);
        }
        else {
            results.push(token);
        }
    }

    return results;
}

export default compatibleTaskList;
