import type { Token } from 'marked';
import type { ListItemToken, ListToken } from './types';

function isListToken(token: Token | ListToken): token is ListToken {
    return token.type === 'list';
}

const BULL_REG = /^ {0,3}([*+-]|\d{1,9}(?:\.|\)))/;
// The marker may be a bullet or an ordered number (`- [x] …` / `1. [x] …`).
const EMPTY_TASK_REG = /^ {0,3}(?:[*+-]|\d{1,9}[.)])[ \t]+\[([ x])\][ \t]*$/i;
const TASK_MARKER_PREFIX_REG = /^ {0,3}(?:[*+-]|\d{1,9}[.)])[ \t]+\[([ x])\][ \t]+/i;

function stripTaskTextPrefix(value: string, marker: string) {
    if (!value.startsWith(marker))
        return value;

    const rest = value.slice(marker.length);
    const newlinePrefix = /^[ \t]*\r?\n/.exec(rest);
    if (newlinePrefix)
        return rest.slice(newlinePrefix[0].length);

    return rest.replace(/^[ \t]+/, '');
}

function stripSyntheticTaskMarker(item: ListItemToken, marker: string) {
    const first = item.tokens?.[0] as Token & { raw?: string; text?: string; tokens?: Token[] } | undefined;
    if (!first)
        return;

    if (typeof first.text === 'string')
        first.text = stripTaskTextPrefix(first.text, marker);
    if (typeof first.raw === 'string')
        first.raw = stripTaskTextPrefix(first.raw, marker);

    const inner = first.type === 'paragraph'
        ? first.tokens?.[0] as Token & { raw?: string; text?: string } | undefined
        : undefined;
    if (inner) {
        if (typeof inner.text === 'string')
            inner.text = stripTaskTextPrefix(inner.text, marker);
        if (typeof inner.raw === 'string')
            inner.raw = stripTaskTextPrefix(inner.raw, marker);
    }
}

// marked >=17 keeps the GFM task marker inside the item content: a leading
// `checkbox` token, plus the literal "[ ] " / "[x] " prefix in the first
// paragraph's `text` for loose lists. muya renders the marker from the
// task-list-item `checked` meta, so strip it here to avoid double-emitting it
// on serialization.
function stripTaskMarker(item: ListItemToken) {
    const tokens = item.tokens;
    if (!tokens || !tokens.length)
        return;
    const first = tokens[0] as Token & { text?: string; tokens?: Token[] };
    if (first.type === 'checkbox') {
        tokens.shift();
        return;
    }
    const inner = first.type === 'paragraph' ? first.tokens?.[0] : undefined;
    if (inner?.type === 'checkbox') {
        const { raw } = inner;
        first.tokens!.shift();
        if (typeof first.text === 'string' && first.text.startsWith(raw))
            first.text = first.text.slice(raw.length);
        if (typeof first.raw === 'string' && first.raw.startsWith(raw))
            first.raw = first.raw.slice(raw.length);
    }
}

function normalizeEmptyTaskItem(item: ListItemToken) {
    if (item.task)
        return;

    const matches = EMPTY_TASK_REG.exec(item.raw) || TASK_MARKER_PREFIX_REG.exec(item.raw);
    if (!matches)
        return;

    const marker = `[${matches[1]}]`;
    const text = typeof item.text === 'string' ? item.text : '';
    if (text.trimEnd() !== marker && !text.startsWith(marker))
        return;

    item.task = true;
    item.checked = matches[1] !== ' ';
    item.text = stripTaskTextPrefix(text, marker);
    if (item.text === '')
        item.tokens = [];
    else
        stripSyntheticTaskMarker(item, marker);
}

// A run of same-kind items inside a marked list token; each run becomes one
// muya list block, so one markdown list can expand into several runs.
interface IListRun {
    type: 'list';
    listType: 'order' | 'bullet' | 'task';
    raw: string;
    ordered: boolean;
    start: number | '';
    loose: boolean;
    items: ListItemToken[];
}

// Classifies the item, computing its marker fields as a side effect.
function classifyOrderedItem(item: ListItemToken): 'order' | 'task' {
    item.tokens = compatibleTaskList(item.tokens);
    normalizeEmptyTaskItem(item);
    const listItemType = item.task ? 'task' : 'order';
    item.listItemType = listItemType;
    if (item.task)
        stripTaskMarker(item);

    const matches = BULL_REG.exec(item.raw);
    item.bulletMarkerOrDelimiter = matches
        ? matches[1].slice(-1) as ListItemToken['bulletMarkerOrDelimiter']
        : '';
    item.orderMarker = matches?.[1];

    return listItemType;
}

function classifyBulletItem(item: ListItemToken): 'bullet' | 'task' {
    item.tokens = compatibleTaskList(item.tokens);
    normalizeEmptyTaskItem(item);
    const listItemType = item.task ? 'task' : 'bullet';
    item.listItemType = listItemType;
    if (item.task)
        stripTaskMarker(item);

    const matches = BULL_REG.exec(item.raw);
    item.bulletMarkerOrDelimiter = matches
        ? matches[1] as ListItemToken['bulletMarkerOrDelimiter']
        : '';

    return listItemType;
}

// The list's first number as written (`007.` -> 7). GFM ignores later markers,
// so every run numbers from this value plus its own offset.
function firstMarkerNumber(items: ListItemToken[], fallback: number | ''): number {
    const marker = items[0]?.orderMarker;
    if (marker) {
        const parsed = Number(marker.replace(/[.)]$/, ''));
        if (Number.isFinite(parsed))
            return parsed;
    }

    return typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 1;
}

function splitIntoRuns(
    base: Omit<IListRun, 'listType' | 'items'>,
    classified: Array<{ item: ListItemToken; listItemType: IListRun['listType'] }>,
): IListRun[] {
    const runs: IListRun[] = [];
    for (const [index, { item, listItemType }] of classified.entries()) {
        const last = runs[runs.length - 1];
        if (last && last.listType === listItemType) {
            last.items.push(item);
        }
        else {
            runs.push({
                ...base,
                listType: listItemType,
                items: [item],
                // The run keeps the number its first item had in the whole list.
                start: typeof base.start === 'number' ? base.start + index : base.start,
            });
        }
    }

    return runs;
}

// Add `listType` to token, it's type: "order" | "bullet" | "task".
// Add `listItemType` to list_item token. it's type: "order" | "bullet" | "task".
// Add `bulletMarkerOrDelimiter` to list_item token. it's type: "." | ")" | "*" | "+" | "-"
// Add `orderMarker` to ordered list_item token, the number and delimiter as written, e.g. "1." | "007." | "10)"
//
// GFM task-list-items apply to ordered lists too
// (https://github.github.com/gfm/#task-list-items-extension-).
function compatibleTaskList(tokens: (Token | ListToken | ListItemToken)[] = []) {
    const results = [];

    for (const token of tokens) {
        if (isListToken(token)) {
            if (token.ordered === true) {
                const { type, raw, loose, start } = token;
                const items = token.items as ListItemToken[];
                results.push(
                    ...splitIntoRuns(
                        { type, raw, ordered: true, start: firstMarkerNumber(items, start), loose },
                        items.map(item => ({
                            item: item as ListItemToken,
                            listItemType: classifyOrderedItem(item as ListItemToken),
                        })),
                    ),
                );
            }
            else {
                const { type, raw, ordered, loose } = token;
                results.push(
                    ...splitIntoRuns(
                        { type, raw, ordered, start: '', loose },
                        token.items.map(item => ({
                            item: item as ListItemToken,
                            listItemType: classifyBulletItem(item as ListItemToken),
                        })),
                    ),
                );
            }
        }
        else if (token.type === 'blockquote') {
            token.tokens = compatibleTaskList(token.tokens);
            results.push(token);
        }
        else if (token.type === 'multilineBlockquote') {
            const bq = token as { tokens?: (Token | ListToken | ListItemToken)[] };
            bq.tokens = compatibleTaskList(bq.tokens);
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
