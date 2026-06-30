import type { TBlockToken } from '../utils/marked/types';
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
import logger from '../utils/logger';
import { lexBlock } from '../utils/marked';

const debug = logger('import markdown: ');
function restoreTableEscapeCharacters(text: string) {
    // NOTE: markedjs replaces all escaped "|" ("\|") characters inside a cell with "|".
    //       We have to re-escape the character to not break the table.
    return text.replace(/\|/g, '\\|');
}

interface IMarkdownToStateOptions {
    footnote: boolean;
    math: boolean;
    isGitlabCompatibilityEnabled: boolean;
    trimUnnecessaryCodeBlockEmptyLines: boolean;
    frontMatter: boolean;
};

const DEFAULT_OPTIONS = {
    footnote: false,
    math: true,
    isGitlabCompatibilityEnabled: true,
    trimUnnecessaryCodeBlockEmptyLines: false,
    frontMatter: true,
};

// Token types whose handler manipulates the `parentList` stack (push a
// container and recurse via synthetic `block-end`), as opposed to the leaf
// tokens that only append a state to the current level.
const CONTAINER_TOKEN_TYPES = new Set([
    'block-end',
    'blockquote',
    'list',
    'list_item',
    'footnote',
]);

const FULL_DOC_DIR_RE = /^<div\s+dir="(rtl|ltr)"\s*>\n([\s\S]*)\n<\/div>\s*$/;
// Kept only for the `style="direction:..."` fallback in _handleLeafToken.
const BLOCK_DIR_STYLE_RE = /^<div\s+style="direction\s*:\s*(rtl|ltr)\s*"\s*>\n([\s\S]*?)\n<\/div>$/;

// Pre-processing: detect `<div dir="...">` on its own line. CommonMark type-6
// HTML blocks end at blank lines, so any blank line inside a direction wrapper
// would terminate the html-block token before </div> is reached. We extract
// direction wrappers ourselves before handing text to marked.
const DIR_OPEN_LINE_RE = /^<div\s+dir="(rtl|ltr)"\s*>$/;
// Matches any block-level div opening alone on a line (for depth tracking).
const DIV_ANY_OPEN_LINE_RE = /^<div\b[^>]*>\s*$/;
const DIV_CLOSE_LINE_RE = /^<\/div>\s*$/;

export class MarkdownToState {
    public lastDocumentDir: 'ltr' | 'rtl' | null = null;

    constructor(private _options: IMarkdownToStateOptions = DEFAULT_OPTIONS) {}

    generate(markdown: string): TState[] {
        const docMatch = FULL_DOC_DIR_RE.exec(markdown);
        if (docMatch) {
            this.lastDocumentDir = docMatch[1] as 'ltr' | 'rtl';
            return this._convertMarkdownToState(docMatch[2]);
        }
        this.lastDocumentDir = null;
        return this._convertMarkdownToState(markdown);
    }

    private _convertMarkdownToState(markdown: string): TState[] {
        // Pre-process: extract direction blocks before the marked lexer sees the text.
        // Type-6 HTML blocks end at blank lines, so any blank line inside a
        // <div dir="...">…</div> wrapper would split the html token mid-wrapper.
        // By splitting on direction-block boundaries here we handle that correctly
        // and recursively parse the inner content through the same pipeline.
        const segments = this._splitOnDirectionBlocks(markdown);
        const states: TState[] = [];

        for (const segment of segments) {
            if (segment.type === 'direction') {
                const innerStates = this._convertMarkdownToState(segment.text);
                const isEmptyParagraph = innerStates.length === 1
                    && innerStates[0].name === 'paragraph'
                    && (innerStates[0] as { text?: string }).text === '';
                if (!isEmptyParagraph) {
                    states.push({
                        name: 'direction-block' as const,
                        meta: { dir: segment.dir },
                        children: innerStates,
                    });
                }
            }
            else {
                states.push(...this._lexMarkdownSegment(segment.text));
            }
        }

        return states.length ? states : [{ name: 'paragraph', text: '' }];
    }

    private _lexMarkdownSegment(markdown: string): TState[] {
        const {
            footnote = false,
            math = true,
            isGitlabCompatibilityEnabled = true,
            trimUnnecessaryCodeBlockEmptyLines = false,
            frontMatter = true,
        } = this._options;

        const tokens: TBlockToken[] = lexBlock(markdown, {
            footnote,
            math,
            frontMatter,
            isGitlabCompatibilityEnabled,
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

        return states;
    }

    // Split markdown on direction-block boundaries before lexing. Returns an
    // array of segments: 'plain' for regular markdown and 'direction' for the
    // content inside a `<div dir="...">…</div>` wrapper. Direction blocks are
    // detected line-by-line so blank lines inside them are handled correctly
    // (the marked lexer would otherwise end the HTML block at each blank line).
    private _splitOnDirectionBlocks(markdown: string): Array<
        { type: 'plain'; text: string }
        | { type: 'direction'; dir: 'rtl' | 'ltr'; text: string }
    > {
        const lines = markdown.split('\n');
        const segments: Array<
            { type: 'plain'; text: string }
            | { type: 'direction'; dir: 'rtl' | 'ltr'; text: string }
        > = [];
        const plainLines: string[] = [];
        let i = 0;

        while (i < lines.length) {
            const openMatch = DIR_OPEN_LINE_RE.exec(lines[i]);
            if (openMatch) {
                if (plainLines.length > 0) {
                    segments.push({ type: 'plain', text: plainLines.join('\n') });
                    plainLines.splice(0, plainLines.length);
                }
                const dir = openMatch[1] as 'rtl' | 'ltr';
                i++;
                const innerLines: string[] = [];
                let depth = 1;

                while (i < lines.length && depth > 0) {
                    const line = lines[i];
                    // Track nesting depth: any block-level <div> opens a new level.
                    if (DIV_ANY_OPEN_LINE_RE.test(line)) {
                        depth++;
                    }
                    else if (DIV_CLOSE_LINE_RE.test(line)) {
                        depth--;
                        if (depth === 0) {
                            i++;
                            break;
                        }
                    }
                    innerLines.push(line);
                    i++;
                }

                segments.push({ type: 'direction', dir, text: innerLines.join('\n') });
            }
            else {
                plainLines.push(lines[i]);
                i++;
            }
        }

        if (plainLines.length > 0)
            segments.push({ type: 'plain', text: plainLines.join('\n') });

        return segments.length ? segments : [{ type: 'plain', text: markdown }];
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
                    && (token.tokenType === 'blockquote' || token.tokenType === 'list-item')
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

            case 'list': {
                const { listType, loose, start } = token;
                const bulletMarkerOrDelimiter
                    = token.items[0].bulletMarkerOrDelimiter;

                let listState: IOrderListState | IBulletListState | ITaskListState;
                if (listType === 'order') {
                    listState = {
                        name: 'order-list',
                        meta: {
                            loose,
                            start: /^\d+$/.test(String(start)) ? Number(start) : 1,
                            delimiter: bulletMarkerOrDelimiter || '.',
                        },
                        children: [],
                    };
                }
                else if (listType === 'task') {
                    listState = {
                        name: 'task-list',
                        meta: {
                            loose,
                            marker: bulletMarkerOrDelimiter || '-',
                        },
                        children: [],
                    };
                }
                else {
                    listState = {
                        name: 'bullet-list',
                        meta: {
                            loose,
                            marker: bulletMarkerOrDelimiter || '-',
                        },
                        children: [],
                    };
                }

                state = listState;
                parentList[0].push(state);
                parentList.unshift(state.children);
                tokens.unshift({ type: 'block-end', tokenType: 'list' });
                tokens.unshift(...(token.items as TBlockToken[]));
                break;
            }

            case 'list_item': {
                const { listItemType, checked } = token;
                let itemState: IListItemState | ITaskListItemState;
                if (listItemType === 'task') {
                    itemState = {
                        name: 'task-list-item',
                        meta: { checked: Boolean(checked) },
                        children: [],
                    };
                }
                else {
                    itemState = {
                        name: 'list-item',
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
                const fenceLength = /^ {0,3}([`~]{3,})/.exec(raw)?.[1].length;
                parentList[0].push(
                    this._buildCodeState(codeText, infoString, codeBlockStyle, trimUnnecessaryCodeBlockEmptyLines, fenceLength),
                );
                break;
            }

            case 'table': {
                const { header, align, rows } = token;
                const tableState: ITableState = {
                    name: 'table',
                    children: [],
                };

                tableState.children.push({
                    name: 'table.row',
                    children: header.map((h, i) => ({
                        name: 'table.cell' as const,
                        meta: { align: align[i] || 'none' },
                        text: restoreTableEscapeCharacters(h.text),
                    })),
                });

                tableState.children.push(
                    ...rows.map(row => ({
                        name: 'table.row' as const,
                        children: row.map((c, i) => ({
                            name: 'table.cell' as const,
                            meta: { align: align[i] || 'none' },
                            text: restoreTableEscapeCharacters(c.text),
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
                    break;
                }

                // BLOCK_DIR_ATTR_RE is no longer needed here: direction blocks are
                // extracted in _splitOnDirectionBlocks before lexing, so they never
                // reach this handler. Only the legacy style-attribute form remains.
                const dirMatch = BLOCK_DIR_STYLE_RE.exec(text);
                if (dirMatch) {
                    const dir = dirMatch[1] as 'ltr' | 'rtl';
                    const innerContent = dirMatch[2];
                    const innerStates = this._convertMarkdownToState(innerContent);
                    if (innerStates.length > 0 && !(innerStates.length === 1 && innerStates[0].name === 'paragraph' && (innerStates[0] as { text: string }).text === '')) {
                        parentList[0].push({
                            name: 'direction-block' as const,
                            meta: { dir },
                            children: innerStates,
                        });
                        break;
                    }
                }

                state = {
                    name: 'html-block' as const,
                    text,
                };
                parentList[0].push(state);
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
    ): TState {
        // GH#697, markedjs#1387 — strip everything past the first
        // whitespace; `\S*` matches the empty string so this is
        // always non-null even for `infoString === ''`.
        const lang = (infoString || '').match(/\S*/)?.[0] ?? '';

        let value = text;
        // Fix: #1265.
        if (
            trimUnnecessaryCodeBlockEmptyLines
            && (value.endsWith('\n') || value.startsWith('\n'))
        ) {
            value = value.replace(/\n+$/, '').replace(/^\n+/, '');
        }

        const diagramMatch = /^(mermaid|vega-lite|plantuml|flowchart|sequence)$/.exec(lang);
        if (diagramMatch) {
            const diagramType = diagramMatch[1] as 'mermaid' | 'vega-lite' | 'plantuml' | 'flowchart' | 'sequence';
            return {
                name: 'diagram' as const,
                text: value,
                meta: {
                    type: diagramType,
                    lang: diagramType === 'vega-lite' ? 'json' : 'yaml',
                },
            };
        }

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
                lang,
                ...(isFenced && fenceLength && fenceLength > 3 ? { fenceLength } : {}),
            },
            text: value,
        };
    }
}
