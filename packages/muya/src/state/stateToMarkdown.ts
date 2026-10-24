import type { TBlockSeparation } from './blockBoundary';
import type {
    IAtxHeadingState,
    IBlockQuoteState,
    IBulletListState,
    ICodeBlockState,
    IDiagramState,
    IFootnoteBlockState,
    IFrontmatterState,
    IHtmlBlockState,
    IListItemState,
    IMathBlockState,
    IOrderListState,
    IParagraphState,
    ISetextHeadingState,
    ITableState,
    ITaskListItemState,
    ITaskListState,
    IThematicBreakState,
    TState,
} from './types';
/* eslint-disable no-fallthrough */
import { deepClone } from '../utils';
import { githubAlertMarker } from '../utils/githubAlerts';

import logger from '../utils/logger';
import stringWidth from '../utils/stringWidth';
import { BlockBoundaryResolver } from './blockBoundary';
import { defaultCodeSyntax, printAtxHeading, printCodeBlock, printSetextHeading } from './syntax';
import { isAnyListState } from './types';

const debug = logger('export markdown: ');
const SETEXT_SAFE_BULLET_MARKER = '*';

function escapeText(str: string) {
    return str.replace(/(?<!\\)\|/g, '\\|');
}

export interface IExportMarkdownOptions {
    listIndentation: number | string;
    syntaxMode?: 'preserve' | 'canonical';
}

export default class ExportMarkdown {
    private _blockBoundary = new BlockBoundaryResolver();

    // Open list metadata stack; innermost settings control nested item serialization.
    private _listType: (
        | IBulletListState['meta']
        | IOrderListState['meta']
        | ITaskListState['meta']
    )[];

    private _isLooseParentList: boolean;
    private _listIndentation: string;
    private _listIndentationCount: number;
    private _syntaxMode: 'preserve' | 'canonical';

    constructor(
        {
            listIndentation,
            syntaxMode = 'canonical',
        }: IExportMarkdownOptions = {
            listIndentation: 1,
        },
    ) {
        this._listType = []; // 'ul' or 'ol'
        this._syntaxMode = syntaxMode;
        // helper to translate the first tight item in a nested list
        this._isLooseParentList = true;

        this._listIndentation = 'number';
        if (listIndentation === 'dfm') {
            this._listIndentation = 'dfm';
            this._listIndentationCount = 4;
        }
        else if (typeof listIndentation === 'number') {
            this._listIndentationCount = Math.min(Math.max(listIndentation, 1), 4);
        }
        else {
            this._listIndentationCount = 1;
        }
    }

    generate(states: TState[]) {
        this._blockBoundary.reset();
        return this._convertStatesToMarkdown(states);
    }

    private _convertStatesToMarkdown(
        states: TState[],
        indent = '',
        listIndent = '',
        isTightItem = false,
    ): string {
        const result: string[] = [];
        // helper for CommonMark 264
        let lastListBullet = '';
        let previousState: TState | undefined;

        for (const originalState of states) {
            let state = originalState;
            if (
                state.name !== 'order-list'
                && state.name !== 'bullet-list'
                && state.name !== 'task-list'
            ) {
                lastListBullet = '';
            }

            if (isAnyListState(state)) {
                const markerOverride = !this._isLooseParentList
                    && previousState?.name === 'paragraph'
                    && previousState.text.trim() !== ''
                    && this._startsWithEmptyDashBulletItem(state)
                    ? SETEXT_SAFE_BULLET_MARKER
                    : undefined;
                const followsTightList = previousState !== undefined
                    && isAnyListState(previousState)
                    && !previousState.meta.loose
                    && !state.meta.loose;
                lastListBullet = this._serializeListBlock(
                    state,
                    result,
                    indent,
                    listIndent,
                    lastListBullet,
                    markerOverride,
                    followsTightList,
                );
            }
            else if (state.name === 'list-item' || state.name === 'task-list-item') {
                this._serializeListItemBlock(state, result, indent, listIndent);
            }
            else {
                const prepared = this._prepareBlockBoundary(state, previousState, isTightItem);
                state = prepared.state;
                this._serializeSimpleBlock(state, result, indent, prepared.separation);
            }

            previousState = state;
        }

        return result.join('');
    }

    private _prepareBlockBoundary(state: TState, previous: TState | undefined, tightListItem: boolean) {
        let separation: TBlockSeparation = previous
            ? this._blockBoundary.resolve(previous, state, { tightListItem })
            : 'adjacent';
        if (separation === 'rewrite-required' && state.name === 'code-block') {
            if (this._syntaxMode === 'preserve')
                throw new Error('Adjacent indented code blocks require a source-form edit before export');
            // Blank lines remain part of indented code. Fence the next
            // block on output to keep two code blocks without mutating state.
            state = { ...state, syntax: defaultCodeSyntax(state.text) };
            separation = tightListItem ? 'adjacent' : 'blank-line';
        }
        return { state, separation };
    }

    private _serializeSimpleBlock(
        state: TState,
        result: string[],
        indent: string,
        separation: TBlockSeparation,
    ) {
        if (state.name !== 'frontmatter' && separation !== 'adjacent')
            this._insertLineBreak(result, indent);

        switch (state.name) {
            case 'frontmatter':
                result.push(this._serializeFrontMatter(state));
                break;

            case 'paragraph':

            case 'thematic-break':
                result.push(this._serializeTextParagraph(state, indent));
                break;

            case 'atx-heading':
                result.push(this._serializeAtxHeading(state, indent));
                break;

            case 'setext-heading':
                result.push(this._serializeSetextHeading(state, indent));
                break;

            case 'code-block':
                result.push(this._serializeCodeBlock(state, indent));
                break;

            case 'html-block':
                result.push(this._serializeHtmlBlock(state, indent));
                break;

            case 'math-block':
                result.push(this._serializeMathBlock(state, indent));
                break;

            case 'diagram':
                result.push(this._serializeDiagramBlock(state, indent));
                break;

            case 'github-alert': {
                const prefix = `${indent}> `;
                const body = this._convertStatesToMarkdown(state.children, prefix);
                result.push(`${prefix}${githubAlertMarker(state.meta)}\n${state.meta.blankLineAfterMarker && body.trim() ? `${prefix}\n` : ''}${body}`);
                break;
            }

            case 'block-quote':
                result.push(this._serializeBlockquote(state, indent));
                break;

            case 'table':
                result.push(this._serializeTable(state, indent));
                break;

            case 'footnote':
                result.push(this._serializeFootnote(state, indent));
                break;

            default: {
                debug.warn(
                    'convertStatesToMarkdown: Unknown state type:',
                    state.name,
                );
                break;
            }
        }
    }

    private _serializeListBlock(
        state: IOrderListState | IBulletListState | ITaskListState,
        result: string[],
        indent: string,
        listIndent: string,
        lastListBullet: string,
        markerOverride?: string,
        followsTightList = false,
    ): string {
        let insertNewLine = this._isLooseParentList;
        this._isLooseParentList = true;
        const meta = deepClone(state.meta);
        if (markerOverride && 'marker' in meta)
            meta.marker = markerOverride;
        if (state.name !== 'bullet-list' && 'sourceMarkers' in meta && !this._shouldPreserveOrderMarkers(state))
            delete meta.sourceMarkers;

        // Changing a bullet or ordered delimiter starts a separate Markdown list.
        const bulletMarkerOrDelimiter
            = 'delimiter' in meta ? meta.delimiter : meta.marker;

        if (lastListBullet && lastListBullet !== bulletMarkerOrDelimiter)
            insertNewLine = false;

        // Adjacent tight lists with the same marker are one markdown list (the
        // parser splits it where items switch between plain and task), so a
        // blank line would only make that list loose on the next parse.
        if (lastListBullet === bulletMarkerOrDelimiter && followsTightList)
            insertNewLine = false;

        if (insertNewLine)
            this._insertLineBreak(result, indent);

        this._listType.push(meta);
        result.push(this._serializeList(state, indent, listIndent));
        this._listType.pop();

        return bulletMarkerOrDelimiter;
    }

    // Source markers only hold while the list keeps the items it was parsed
    // with: an insert, delete or reorder breaks the per-item match, and the
    // list falls back to numbering from `start`.
    private _shouldPreserveOrderMarkers(state: IOrderListState | ITaskListState) {
        const sourceMarkers = 'sourceMarkers' in state.meta
            ? state.meta.sourceMarkers
            : undefined;
        if (!sourceMarkers || sourceMarkers.length !== state.children.length)
            return false;

        return state.children.every((child, index) =>
            child.meta?.orderMarker === sourceMarkers[index],
        );
    }

    private _startsWithEmptyDashBulletItem(
        state: IOrderListState | IBulletListState | ITaskListState,
    ) {
        if (state.name !== 'bullet-list' || state.meta.marker !== '-')
            return false;

        const firstItem = state.children[0];
        if (!firstItem)
            return false;
        if (firstItem.children.length === 0)
            return true;

        const firstChild = firstItem.children[0];
        return firstChild.name === 'paragraph' && firstChild.text.trim() === '';
    }

    private _serializeListItemBlock(
        state: IListItemState | ITaskListItemState,
        result: string[],
        indent: string,
        listIndent: string,
    ) {
        const { loose } = this._listType[this._listType.length - 1];

        this._isLooseParentList = loose;
        if (loose)
            this._insertLineBreak(result, indent);

        // An item of a tight list keeps its direct children blank-line free
        // unless a pair of them genuinely needs a separator.
        result.push(this._serializeListItem(state, indent + listIndent, !loose));
        this._isLooseParentList = true;
    }

    private _insertLineBreak(result: unknown[], indent: string) {
        if (!result.length)
            return;
        // Blank lines inside a list item should be empty, not carry the
        // item's indent as trailing whitespace. For blockquote-style indents
        // like `> ` we keep the `>` so the quote stays continuous — only
        // strip the trailing run of plain spaces.
        result.push(`${indent.replace(/ +$/, '')}\n`);
    }

    private _serializeFrontMatter(state: IFrontmatterState) {
        let startToken;
        let endToken;
        switch (state.meta.lang) {
            case 'yaml':
                startToken = '---\n';
                endToken = '---\n';
                break;

            case 'toml':
                startToken = '+++\n';
                endToken = '+++\n';
                break;

            case 'json':
                if (state.meta.style === ';') {
                    startToken = ';;;\n';
                    endToken = ';;;\n';
                }
                else {
                    startToken = '{\n';
                    endToken = '}\n';
                }
                break;
        }

        const result = [];
        result.push(startToken);
        const { text } = state;
        const lines = text.split('\n');

        for (const line of lines)
            result.push(`${line}\n`);

        result.push(endToken);

        return result.join('');
    }

    private _serializeTextParagraph(
        state: IParagraphState | IThematicBreakState,
        indent: string,
    ) {
        const { text } = state;
        const lines = text.split('\n');

        return `${lines.map(line => `${indent}${line}`).join('\n')}\n`;
    }

    private _serializeAtxHeading(state: IAtxHeadingState, indent: string) {
        if (this._syntaxMode === 'preserve')
            return `${indent}${printAtxHeading(state)}\n`;
        const { text } = state;
        const match = text.match(/(#{1,6})(.*)/);

        const atxHeadingText = `${match?.[1]} ${match?.[2].trim()}`;

        return `${indent}${atxHeadingText}\n`;
    }

    private _serializeSetextHeading(state: ISetextHeadingState, indent: string) {
        if (this._syntaxMode === 'preserve')
            return `${printSetextHeading(state).split('\n').map(line => indent + line).join('\n')}\n`;
        const { text, meta } = state;
        const underline = (meta.level === 1 ? '=' : '-').repeat(state.syntax.underline.length);
        const lines = text.trim().split('\n');

        return (
            `${lines.map(line => `${indent}${line}`).join('\n')
            }\n${indent}${underline.trim()}\n`
        );
    }

    private _serializeCodeBlock(state: ICodeBlockState, indent: string) {
        if (this._syntaxMode === 'preserve')
            return `${printCodeBlock(state).split('\n').map(line => indent + line).join('\n')}\n`;
        const result = [];
        const { text, meta, syntax } = state;
        const textList = text.split('\n');
        const { lang } = meta;

        if (syntax.form === 'fenced') {
            // A backtick fence's info string may not contain a backtick
            // (CommonMark §4.5), so fall back to a tilde fence rather than emit
            // markdown that would not read back as a code block.
            const fenceChar: '`' | '~'
                = syntax.fenceChar === '~' || lang.includes('`') ? '~' : '`';
            const fence = fenceChar.repeat(
                this._codeFenceLength(text, syntax.opening.length, fenceChar),
            );
            result.push(`${indent}${lang ? `${fence}${lang}\n` : `${fence}\n`}`);
            textList.forEach((text) => {
                result.push(`${indent}${text}\n`);
            });
            result.push(`${indent}${fence}\n`);
        }
        else {
            textList.forEach((text) => {
                result.push(`${indent}    ${text}\n`);
            });
        }

        return result.join('');
    }

    // The opening fence must be longer than any interior line made only of the
    // same fence character (else that line closes the block early), at least as
    // long as the original fence, and never shorter than the markdown minimum
    // of 3.
    private _codeFenceLength(text: string, stored: number | undefined, fenceChar: '`' | '~'): number {
        const fenceRun = fenceChar === '`' ? /^`+$/ : /^~+$/;
        let longestInterior = 0;
        for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (fenceRun.test(trimmed))
                longestInterior = Math.max(longestInterior, trimmed.length);
        }

        return Math.max(3, stored ?? 3, longestInterior + 1);
    }

    private _serializeHtmlBlock(state: IHtmlBlockState, indent: string) {
        const result = [];
        const { text } = state;
        const lines = text.split('\n');

        for (const line of lines)
            result.push(`${indent}${line}\n`);

        return result.join('');
    }

    private _serializeMathBlock(state: IMathBlockState, indent: string) {
        const result = [];
        const {
            text,
            meta: { mathStyle },
        } = state;
        const lines = text.split('\n');
        result.push(indent + (mathStyle === '' ? '$$\n' : '```math\n'));

        for (const line of lines)
            result.push(`${indent}${line}\n`);

        result.push(indent + (mathStyle === '' ? '$$\n' : '```\n'));

        return result.join('');
    }

    private _serializeDiagramBlock(state: IDiagramState, indent: string) {
        const result = [];
        const {
            text,
            meta: { type },
        } = state;
        const lines = text.split('\n');
        result.push(`${indent}\`\`\`${type}\n`);

        for (const line of lines)
            result.push(`${indent}${line}\n`);

        result.push(`${indent}\`\`\`\n`);

        return result.join('');
    }

    private _serializeBlockquote(state: IBlockQuoteState, indent: string) {
        const { children, meta } = state;

        if (meta?.style === 'fenced') {
            const inner = this._convertStatesToMarkdown(children, indent);
            return `${indent}>>>\n${inner}${indent}>>>\n`;
        }

        const newIndent = `${indent}> `;
        return this._convertStatesToMarkdown(children, newIndent);
    }

    private _serializeFootnote(state: IFootnoteBlockState, indent: string) {
        // Prefix the first line with [^id]: and indent continuation blocks by four spaces.
        const { meta, children } = state;
        const innerIndent = `${indent}    `;
        const inner = this._convertStatesToMarkdown(children, innerIndent);
        const prefix = `${indent}[^${meta.identifier}]: `;
        // Strip the inner indent off the first non-empty line so the prefix
        // sits flush, leaving subsequent lines at the four-space indent.
        const stripped = inner.replace(innerIndent, '');
        return `${prefix}${stripped}`;
    }

    private _serializeTable(state: ITableState, indent: string) {
        const result: string[] = [];
        const row = state.children.length;
        const tableData = [];

        for (const rowState of state.children) {
            tableData.push(
                rowState.children.map(cell => escapeText(cell.text.trim())),
            );
        }

        const columnWidth = state.children[0].children.map(th => ({
            width: 5,
            align: th.meta.align,
        }));

        let i;
        let j;

        for (i = 0; i < row; i++) {
            const cells = Math.min(tableData[i].length, columnWidth.length);
            for (j = 0; j < cells; j++) {
                columnWidth[j].width = Math.max(
                    columnWidth[j].width,
                    stringWidth(tableData[i][j]) + 2,
                ); // add 2, because have two space around text
            }
        }

        tableData.forEach((r, i) => {
            const rs
                = `${indent
                }|${
                    r
                        .slice(0, columnWidth.length)
                        .map((cell, j) => {
                            // Pad by visual column width, not code-unit length,
                            // so combining marks and wide characters stay
                            // aligned (#1983). One leading space + cell + fill.
                            const fill = columnWidth[j].width - 1 - stringWidth(cell);

                            return ` ${cell}${' '.repeat(Math.max(fill, 0))}`;
                        })
                        .join('|')
                }|`;
            result.push(rs);
            if (i === 0) {
                const cutOff
                    = `${indent
                    }|${
                        columnWidth
                            .map(({ width, align }) => {
                                let raw = '-'.repeat(width - 2);
                                switch (align) {
                                    case 'left':
                                        raw = `:${raw} `;
                                        break;

                                    case 'center':
                                        raw = `:${raw}:`;
                                        break;

                                    case 'right':
                                        raw = ` ${raw}:`;
                                        break;
                                    default:
                                        raw = ` ${raw} `;
                                        break;
                                }

                                return raw;
                            })
                            .join('|')
                    }|`;
                result.push(cutOff);
            }
        });

        return `${result.join('\n')}\n`;
    }

    private _serializeList(
        state: IBulletListState | IOrderListState | ITaskListState,
        indent: string,
        listIndent: string,
    ) {
        const { children } = state;

        return this._convertStatesToMarkdown(children, indent, listIndent);
    }

    private _serializeListItem(
        state: IListItemState | ITaskListItemState,
        indent: string,
        isTightItem = false,
    ) {
        const result = [];
        const listInfo = this._listType[this._listType.length - 1];
        const marker = 'marker' in listInfo ? listInfo.marker : undefined;
        const delimiter = 'delimiter' in listInfo ? listInfo.delimiter : undefined;
        const isUnorderedList = !!marker;
        const { children, name } = state;
        let itemMarker;

        if (isUnorderedList) {
            itemMarker = marker ? `${marker} ` : '- ';
        }
        else if ('start' in listInfo) {
            const preservedMarker = listInfo.sourceMarkers?.shift();
            if (preservedMarker) {
                itemMarker = `${preservedMarker} `;
            }
            else {
                // NOTE: GitHub and Bitbucket limit the list count to 99 but this is nowhere defined.
                //  We limit the number to 99 for Daring Fireball Markdown to prevent indentation issues.
                let n = listInfo.start;
                if ((this._listIndentation === 'dfm' && n > 99) || n > 999999999)
                    n = 1;

                itemMarker = `${n}${delimiter || '.'} `;
            }
            listInfo.start++;
        }
        else {
            itemMarker = '- ';
        }

        const newIndent = indent + ' '.repeat(itemMarker.length);

        // Additional nesting indentation beyond the parent item’s content column;
        // CommonMark already permits nesting at that column.
        let listIndent = '';
        const { _listIndentation: listIndentation } = this;
        if (listIndentation === 'dfm')
            listIndent = ' '.repeat(Math.max(0, 4 - itemMarker.length));
        else if (listIndentation === 'number')
            listIndent = ' '.repeat(this._listIndentationCount - 1);

        // TODO: Indent subsequent paragraphs by one tab. - not important
        //  Problem: "convertStatesToMarkdown" use "indent" in spaces to indent elements. How should
        //  we integrate tabs in block quotes and subsequent paragraphs and how to combine with spaces?
        //  I don't know how to combine tabs and spaces and it seems not specified, so work for another day.

        if (name === 'task-list-item')
            itemMarker += state.meta.checked ? '[x] ' : '[ ] ';

        if (!children.length)
            return `${indent}${itemMarker}\n`;

        result.push(`${indent}${itemMarker}`);
        result.push(
            this._convertStatesToMarkdown(children, newIndent, listIndent, isTightItem).substring(
                newIndent.length,
            ),
        );

        return result.join('');
    }
}
