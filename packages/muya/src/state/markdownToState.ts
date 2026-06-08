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

export class MarkdownToState {
    constructor(private _options: IMarkdownToStateOptions = DEFAULT_OPTIONS) {}

    generate(markdown: string): TState[] {
        return this._convertMarkdownToState(markdown);
    }

    // eslint-disable-next-line max-lines-per-function, complexity
    private _convertMarkdownToState(markdown: string): TState[] {
        const {
            footnote = false,
            math = true,
            isGitlabCompatibilityEnabled = true,
            trimUnnecessaryCodeBlockEmptyLines = false,
            frontMatter = true,
        } = this._options;

        // markdownToState injects synthetic `block-end` markers (see the
        // blockquote/list/list_item/footnote cases below) to pop the parent
        // stack, so the working stream is wider than what `lexBlock` returns.
        const tokens: TBlockToken[] = lexBlock(markdown, {
            footnote,
            math,
            frontMatter,
            isGitlabCompatibilityEnabled,
        });

        const states: TState[] = [];
        let token: TBlockToken | undefined;
        let state: TState;
        let value: string;
        const parentList: TState[][] = [states];

        // eslint-disable-next-line no-cond-assign
        while ((token = tokens.shift())) {
            switch (token.type) {
                // Marks the end of the children's traversal and a return to the previous level
                case 'block-end': {
                    // Fix #1735 the blockquote maybe empty. like bellow:
                    // >
                    // bar
                    if (parentList[0].length === 0 && token.tokenType === 'blockquote') {
                        state = {
                            name: 'paragraph' as const,
                            text: '',
                        };
                        parentList[0].push(state);
                    }
                    parentList.shift();
                    break;
                }

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
                    const { codeBlockStyle, text, lang: infoString = '' } = token;

                    // GH#697, markedjs#1387 — strip everything past the first
                    // whitespace; `\S*` matches the empty string so this is
                    // always non-null even for `infoString === ''`.
                    const lang = (infoString || '').match(/\S*/)?.[0] ?? '';

                    value = text;
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
                        state = {
                            name: 'diagram' as const,
                            text: value,
                            meta: {
                                type: diagramType,
                                lang: diagramType === 'vega-lite' ? 'json' : 'yaml',
                            },
                        };
                    }
                    else {
                        // walkTokens (utils/marked/walkTokens.ts) writes
                        // codeBlockStyle = 'fenced' for fenced blocks and
                        // leaves 'indented' for indented blocks. marked's
                        // type widens the field to `'indented' | undefined`,
                        // but `'fenced'` reaches us at runtime via the
                        // walkTokens assignment — hence the cast.
                        const isFenced = (codeBlockStyle as 'indented' | 'fenced' | undefined) === 'fenced';
                        state = {
                            name: 'code-block' as const,
                            meta: {
                                type: isFenced ? 'fenced' : 'indented',
                                lang,
                            },
                            text: value,
                        };
                    }
                    parentList[0].push(state);
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

                default:
                    debug.warn(`Unknown type ${token.type}`);
                    break;
            }
        }

        return states.length ? states : [{ name: 'paragraph', text: '' }];
    }
}
