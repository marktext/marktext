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
    githubAlerts?: boolean;
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

// Container tokens push the parent stack; synthetic block-end tokens pop it.
const CONTAINER_TOKEN_TYPES = new Set([
    'block-end',
    'blockquote',
    'githubAlert',
    'multilineBlockquote',
    'list',
    'list_item',
    'footnote',
]);

export class MarkdownToState {
    constructor(private _options: Partial<IMarkdownToStateOptions> = DEFAULT_OPTIONS) {}

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
            githubAlerts = false,
        } = this._options;

        // Synthetic block-end markers make this stream wider than the lexer output.
        const tokens: TBlockToken[] = lexBlock(markdown, {
            footnote,
            texMathDollars,
            frontMatter,
            texMathGfm,
            texMathSingleBackslash,
            texMathDoubleBackslash,
            multilineBlockquote,
            githubAlerts,
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

            case 'githubAlert': {
                state = { name: 'github-alert', meta: token.meta, children: [] };
                parentList[0].push(state);
                parentList.unshift(state.children);
                tokens.unshift({ type: 'block-end', tokenType: 'githubAlert' });
                tokens.unshift(...token.tokens as TBlockToken[]);
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
                // Footnote tokens contain nested block tokens; traverse them as container children.
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
                parentList[0].push(this._buildHeadingState(token));
                break;
            }

            case 'code': {
                parentList[0].push(this._buildCodeState(token, trimUnnecessaryCodeBlockEmptyLines));
                break;
            }

            case 'table': {
                parentList[0].push(this._buildTableState(token));
                break;
            }

            case 'html': {
                const text = token.text.trim();
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
                // Keep reference definitions as raw paragraph text for rendering and lossless Markdown round-trips.
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

    private _buildHeadingState(token: Extract<TBlockToken, { type: 'heading' }>): IAtxHeadingState | ISetextHeadingState {
        const { headingStyle, depth, text, marker } = token;
        if (headingStyle === 'atx') {
            return {
                name: 'atx-heading',
                meta: { level: depth },
                text: `${'#'.repeat(+depth)} ${text}`,
            };
        }

        return {
            name: 'setext-heading',
            meta: { level: depth, underline: marker },
            text,
        };
    }

    private _buildTableState(token: Extract<TBlockToken, { type: 'table' }>): ITableState {
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

        return tableState;
    }

    private _buildCodeState(
        token: Extract<TBlockToken, { type: 'code' }>,
        trimUnnecessaryCodeBlockEmptyLines: boolean,
    ): TState {
        const { codeBlockStyle, text, lang: infoString = '', raw = '' } = token;
        // marked >=17 appends a trailing newline to indented code text
        // (fenced text has none); strip it so indented blocks round-trip.
        const codeText = codeBlockStyle === 'indented' ? text.replace(/\n$/, '') : text;
        // Read the opening fence itself so its character (` or ~) and
        // run length both survive the round trip (CommonMark §4.5).
        const fence = parseFenceLine(raw);
        const { fenceLength, fenceChar } = fence ?? {};
        // Preserve info-string attributes; diagram detection uses only the first word.
        const info = (infoString || '').trim();
        const lang = firstWordOfInfo(info);

        let value = codeText;
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

        // walkTokens adds 'fenced', which marked's declared codeBlockStyle type omits.
        const isFenced = (codeBlockStyle as 'indented' | 'fenced' | undefined) === 'fenced';
        return {
            name: 'code-block' as const,
            meta: {
                type: isFenced ? 'fenced' : 'indented',
                lang: info,
                ...(isFenced && fenceLength && fenceLength > 3 ? { fenceLength } : {}),
                ...(isFenced ? { fenceChar: fenceChar ?? '`' } : {}),
            },
            text: value,
        };
    }
}
