import type { ListItemToken, TBlockToken } from '../utils/marked/types';
import type {
    IAtxHeadingState,
    IBulletListState,
    IListItemState,
    IOrderListState,
    ISetextHeadingState,
    ITableState,
    ITaskListItemState,
    ITaskListState,
    TState,
} from './types';
import { firstWordOfInfo, parseFenceLine } from '../utils';
import { createDiagramState, diagramTypeOfLang } from '../utils/diagram/fence';
import logger from '../utils/logger';
import { lexBlock } from '../utils/marked';

const debug = logger('import markdown: ');

interface IMarkdownToStateOptions {
    footnote: boolean;
    texMathDollars: boolean;
    texMathGfm: boolean;
    texMathSingleBackslash: boolean;
    texMathDoubleBackslash: boolean;
    trimUnnecessaryCodeBlockEmptyLines: boolean;
    frontMatter: boolean;
    multilineBlockquote?: boolean;
};

const DEFAULT_OPTIONS = {
    footnote: false,
    texMathDollars: true,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
    trimUnnecessaryCodeBlockEmptyLines: false,
    frontMatter: true,
    multilineBlockquote: false,
};

// Token types whose handler manipulates the `parentList` stack (push a
// container and recurse via synthetic `block-end`), as opposed to the leaf
// tokens that only append a state to the current level.
const CONTAINER_TOKEN_TYPES = new Set([
    'block-end',
    'blockquote',
    'multilineBlockquote',
    'list',
    'list_item',
    'footnote',
]);

export class MarkdownToState {
    constructor(private _options: IMarkdownToStateOptions = DEFAULT_OPTIONS) {}

    generate(markdown: string): TState[] {
        return this._convertMarkdownToState(markdown);
    }

    private _convertMarkdownToState(markdown: string): TState[] {
        const {
            footnote = false,
            texMathDollars = true,
            texMathGfm = false,
            texMathSingleBackslash = false,
            texMathDoubleBackslash = false,
            trimUnnecessaryCodeBlockEmptyLines = false,
            frontMatter = true,
            multilineBlockquote = false,
        } = this._options;

        // markdownToState injects synthetic `block-end` markers (see the
        // blockquote/list/list_item/footnote cases below) to pop the parent
        // stack, so the working stream is wider than what `lexBlock` returns.
        const tokens: TBlockToken[] = lexBlock(markdown, {
            footnote,
            texMathDollars,
            frontMatter,
            texMathGfm,
            texMathSingleBackslash,
            texMathDoubleBackslash,
            multilineBlockquote,
        });

        const states: TState[] = [];
        let token: TBlockToken | undefined;
        const parentList: TState[][] = [states];

        // eslint-disable-next-line no-cond-assign
        while ((token = tokens.shift())) {
            if (CONTAINER_TOKEN_TYPES.has(token.type))
                this._handleContainerToken(token, parentList, tokens);
            else
                this._handleLeafToken(token, parentList, tokens, trimUnnecessaryCodeBlockEmptyLines);
        }

        return states.length ? states : [{ name: 'paragraph', text: '' }];
    }

    private _handleContainerToken(
        token: TBlockToken,
        parentList: TState[][],
        tokens: TBlockToken[],
    ) {
        let state: TState;
        switch (token.type) {
            // Marks the end of the children's traversal and a return to the previous level
            case 'block-end': {
                // Fix #1735 the blockquote maybe empty. like bellow:
                // >
                // bar
                if (
                    parentList[0].length === 0
                    && (
                        token.tokenType === 'blockquote'
                        || token.tokenType === 'multilineBlockquote'
                        || token.tokenType === 'list-item'
                    )
                ) {
                    state = {
                        name: 'paragraph' as const,
                        text: '',
                    };
                    parentList[0].push(state);
                }
                parentList.shift();
                break;
            }

            case 'blockquote': {
                state = {
                    name: 'block-quote' as const,
                    children: [],
                };
                parentList[0].push(state);
                parentList.unshift(state.children);
                tokens.unshift({ type: 'block-end', tokenType: 'blockquote' });
                tokens.unshift(...(token.tokens as TBlockToken[]));
                break;
            }

            case 'multilineBlockquote': {
                // Same block tree as a `>` blockquote; the `meta.style` flag
                // only changes how it serializes back to markdown so a `>>>`
                // fence round-trips instead of collapsing to `>`.
                state = {
                    name: 'block-quote' as const,
                    meta: { style: 'fenced' as const },
                    children: [],
                };
                parentList[0].push(state);
                parentList.unshift(state.children);
                tokens.unshift({ type: 'block-end', tokenType: 'multilineBlockquote' });
                tokens.unshift(...(token.tokens as TBlockToken[]));
                break;
            }

            case 'list': {
                state = this._buildListState(token);
                parentList[0].push(state);
                parentList.unshift(state.children);
                tokens.unshift({ type: 'block-end', tokenType: 'list' });
                tokens.unshift(...(token.items as TBlockToken[]));
                break;
            }

            case 'list_item': {
                const { listItemType, checked, orderMarker } = token;
                let itemState: IListItemState | ITaskListItemState;
                if (listItemType === 'task') {
                    itemState = {
                        name: 'task-list-item',
                        meta: {
                            checked: Boolean(checked),
                            ...(orderMarker ? { orderMarker } : {}),
                        },
                        children: [],
                    };
                }
                else {
                    itemState = {
                        name: 'list-item',
                        ...(orderMarker ? { meta: { orderMarker } } : {}),
                        children: [],
                    };
                }

                state = itemState;
                parentList[0].push(state);
                parentList.unshift(state.children);
                tokens.unshift({ type: 'block-end', tokenType: 'list-item' });
                tokens.unshift(...(token.tokens as TBlockToken[]));
                break;
            }

            case 'footnote': {
                // The footnote extension (utils/marked/extensions/footnote.ts)
                // emits a parent token whose `tokens` array holds nested
                // block tokens. Mirror that into a `footnote` container
                // state and recurse via tokens.unshift / block-end.
                const { identifier } = token;
                state = {
                    name: 'footnote' as const,
                    meta: { identifier },
                    children: [],
                };
                parentList[0].push(state);
                parentList.unshift(state.children);
                tokens.unshift({ type: 'block-end', tokenType: 'footnote' });
                tokens.unshift(...(token.tokens as TBlockToken[]));
                break;
            }
        }
    }

    // `token` is one run of same-kind items (see compatibleTaskList).
    private _buildListState(
        token: Extract<TBlockToken, { type: 'list' }>,
    ): IOrderListState | IBulletListState | ITaskListState {
        const { listType, loose, start } = token;
        const bulletMarkerOrDelimiter = token.items[0].bulletMarkerOrDelimiter;
        const ordered = token.ordered === true;
        // Resolved by `compatibleTaskList` (list's first marker + run offset).
        const orderStart
            = typeof start === 'number' && Number.isFinite(start) ? start : 1;
        const sourceMarkers = token.items.map((item: ListItemToken) => item.orderMarker);
        const markers = sourceMarkers.every((marker): marker is string => !!marker)
            ? { sourceMarkers }
            : {};

        if (listType === 'order') {
            return {
                name: 'order-list',
                meta: {
                    loose,
                    start: orderStart,
                    delimiter: bulletMarkerOrDelimiter || '.',
                    ...markers,
                },
                children: [],
            };
        }

        if (listType === 'task') {
            return ordered
                ? {
                        name: 'task-list',
                        meta: {
                            ordered: true,
                            loose,
                            start: orderStart,
                            delimiter: bulletMarkerOrDelimiter || '.',
                            ...markers,
                        },
                        children: [],
                    }
                : {
                        name: 'task-list',
                        meta: { loose, marker: bulletMarkerOrDelimiter || '-' },
                        children: [],
                    };
        }

        return {
            name: 'bullet-list',
            meta: { loose, marker: bulletMarkerOrDelimiter || '-' },
            children: [],
        };
    }

    private _handleLeafToken(
        token: TBlockToken,
        parentList: TState[][],
        tokens: TBlockToken[],
        trimUnnecessaryCodeBlockEmptyLines: boolean,
    ) {
        let state: TState;
        let value: string;
        switch (token.type) {
            case 'frontmatter': {
                const { lang, style, text } = token;
                value = text.replace(/^\s+/, '').replace(/\s$/, '');

                state = {
                    name: 'frontmatter' as const,
                    meta: {
                        lang,
                        style,
                    },
                    text: value,
                };

                parentList[0].push(state);
                break;
            }

            case 'hr': {
                state = {
                    name: 'thematic-break' as const,
                    text: token.raw.replace(/\n+$/, ''),
                };

                parentList[0].push(state);
                break;
            }

            case 'heading': {
                const { headingStyle, depth, text, marker } = token;
                value = headingStyle === 'atx'
                    ? `${'#'.repeat(+depth)} ${text}`
                    : text;

                if (headingStyle === 'atx') {
                    const atxState: IAtxHeadingState = {
                        name: 'atx-heading',
                        meta: { level: depth },
                        text: value,
                    };
                    state = atxState;
                }
                else {
                    const setextState: ISetextHeadingState = {
                        name: 'setext-heading',
                        meta: { level: depth, underline: marker },
                        text: value,
                    };
                    state = setextState;
                }

                parentList[0].push(state);
                break;
            }

            case 'code': {
                const { codeBlockStyle, text, lang: infoString = '', raw = '' } = token;
                // marked >=17 appends a trailing newline to indented code text
                // (fenced text has none); strip it so indented blocks round-trip.
                const codeText = codeBlockStyle === 'indented' ? text.replace(/\n$/, '') : text;
                // Read the opening fence itself so its character (` or ~) and
                // run length both survive the round trip (CommonMark §4.5).
                const fence = parseFenceLine(raw);
                const fenceLength = fence?.fenceLength;
                const fenceChar = fence?.fenceChar;
                parentList[0].push(
                    this._buildCodeState(codeText, infoString, codeBlockStyle, trimUnnecessaryCodeBlockEmptyLines, fenceLength, fenceChar),
                );
                break;
            }

            case 'table': {
                const { header, align, rows } = token;
                const tableState: ITableState = {
                    name: 'table',
                    children: [],
                };

                // Store the cell text as marked emits it (with the table `\|`
                // escape already resolved to a literal `|`), so the editor shows
                // `` `|` `` rather than the escaped `` `\|` `` inside inline code
                // (#4849). `escapeText` re-adds the `\|` escape on serialization,
                // keeping the markdown round-trip intact.
                tableState.children.push({
                    name: 'table.row',
                    children: header.map((h, i) => ({
                        name: 'table.cell' as const,
                        meta: { align: align[i] || 'none' },
                        text: h.text,
                    })),
                });

                tableState.children.push(
                    ...rows.map(row => ({
                        name: 'table.row' as const,
                        children: row.map((c, i) => ({
                            name: 'table.cell' as const,
                            meta: { align: align[i] || 'none' },
                            text: c.text,
                        })),
                    })),
                );

                state = tableState;
                parentList[0].push(state);
                break;
            }

            case 'html': {
                const text = token.text.trim();
                // TODO: Treat html state which only contains one img as paragraph, we maybe add image state in the future.
                const isSingleImage = /^<img[^<>]+>$/.test(text);
                if (isSingleImage) {
                    state = {
                        name: 'paragraph' as const,
                        text,
                    };
                    parentList[0].push(state);
                }
                else {
                    state = {
                        name: 'html-block' as const,
                        text,
                    };
                    parentList[0].push(state);
                }
                break;
            }

            case 'multiplemath': {
                const text = token.text.trim();
                const { mathStyle = '' } = token;
                const state = {
                    name: 'math-block' as const,
                    text,
                    meta: { mathStyle },
                };
                parentList[0].push(state);
                break;
            }

            case 'text': {
                value = token.text;
                while (tokens[0]?.type === 'text') {
                    const next = tokens.shift() as Extract<TBlockToken, { type: 'text' }>;
                    value += `\n${next.text}`;
                }
                state = {
                    name: 'paragraph',
                    text: value,
                };
                parentList[0].push(state);
                break;
            }

            case 'paragraph': {
                value = token.text;
                state = {
                    name: 'paragraph' as const,
                    text: value,
                };
                parentList[0].push(state);
                break;
            }

            case 'space': {
                break;
            }

            case 'def': {
                // Marked v16 hoists `[label]: url "title"` reference
                // definitions to block-level `def` tokens. Lower them back
                // to paragraph state nodes so the rest of the pipeline —
                // `InlineRenderer.collectReferenceDefinitions` (regex scan
                // over paragraph text) and round-trip serialization —
                // keeps working without a dedicated state node.
                // Aligns with marktext's "definition is paragraph text"
                // model. See plan section 13 (PR-16).
                state = {
                    name: 'paragraph' as const,
                    text: token.raw.replace(/\n+$/, ''),
                };
                parentList[0].push(state);
                break;
            }

            default:
                debug.warn(`Unknown type ${token.type}`);
                break;
        }
    }

    private _buildCodeState(
        text: string,
        infoString: string,
        codeBlockStyle: 'indented' | undefined,
        trimUnnecessaryCodeBlockEmptyLines: boolean,
        fenceLength?: number,
        fenceChar?: '`' | '~',
    ): TState {
        // Keep the whole info string; the language for highlighting / diagram
        // detection is its first word (CommonMark §4.5).
        const info = (infoString || '').trim();
        const lang = firstWordOfInfo(info);

        let value = text;
        // Fix: #1265.
        if (
            trimUnnecessaryCodeBlockEmptyLines
            && (value.endsWith('\n') || value.startsWith('\n'))
        ) {
            value = value.replace(/\n+$/, '').replace(/^\n+/, '');
        }

        const diagramType = diagramTypeOfLang(lang);
        if (diagramType)
            return createDiagramState(diagramType, value);

        // walkTokens (utils/marked/walkTokens.ts) writes
        // codeBlockStyle = 'fenced' for fenced blocks and
        // leaves 'indented' for indented blocks. marked's
        // type widens the field to `'indented' | undefined`,
        // but `'fenced'` reaches us at runtime via the
        // walkTokens assignment — hence the cast.
        const isFenced = (codeBlockStyle as 'indented' | 'fenced' | undefined) === 'fenced';
        return {
            name: 'code-block' as const,
            meta: {
                type: isFenced ? 'fenced' : 'indented',
                // The full info string verbatim (empty for indented blocks); the
                // language is its first word — see `firstWordOfInfo`.
                lang: info,
                ...(isFenced && fenceLength && fenceLength > 3 ? { fenceLength } : {}),
                ...(isFenced ? { fenceChar: fenceChar ?? '`' } : {}),
            },
            text: value,
        };
    }
}
