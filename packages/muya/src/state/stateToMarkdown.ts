/* eslint-disable no-fallthrough */
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
/**
 * Hi contributors!
 *
 * Before you edit or update codes in this file,
 * make sure you have read this bellow:
 * Commonmark Spec: https://spec.commonmark.org/0.29/
 * GitHub Flavored Markdown Spec: https://github.github.com/gfm/
 * Pandoc Markdown: https://pandoc.org/MANUAL.html#pandocs-markdown
 * The output markdown needs to obey the standards of these Spec.
 */
import { deepClone } from '../utils';

import logger from '../utils/logger';
import { isAnyListState } from './types';

const debug = logger('export markdown: ');
function escapeText(str: string) {
    return str.replace(/([^\\])\|/g, '$1\\|');
}

export interface IExportMarkdownOptions {
    listIndentation: number | string;
}

export default class ExportMarkdown {
    // Stack of currently-open list metas while serializing a tree (push on
    // descent into bullet/order/task list, pop on ascent). The serializer
    // reads `loose` / `marker` / `delimiter` / `start` from the top entry
    // to render the correct bullet, indentation, and tightness.
    private _listType: (
        | IBulletListState['meta']
        | IOrderListState['meta']
        | ITaskListState['meta']
    )[];

    private _isLooseParentList: boolean;
    private _listIndentation: string;
    private _listIndentationCount: number;

    constructor(
        {
            listIndentation,
        }: IExportMarkdownOptions = {
            listIndentation: 1,
        },
    ) {
        this._listType = []; // 'ul' or 'ol'
        // helper to translate the first tight item in a nested list
        this._isLooseParentList = true;

        // set and validate settings
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
        return this.convertStatesToMarkdown(states);
    }

    convertStatesToMarkdown(
        states: TState[],
        indent = '',
        listIndent = '',
    ): string {
        const result: string[] = [];
        // helper for CommonMark 264
        let lastListBullet = '';

        for (const state of states) {
            if (
                state.name !== 'order-list'
                && state.name !== 'bullet-list'
                && state.name !== 'task-list'
            ) {
                lastListBullet = '';
            }

            if (isAnyListState(state)) {
                lastListBullet = this._serializeListBlock(
                    state,
                    result,
                    indent,
                    listIndent,
                    lastListBullet,
                );
            }
            else if (state.name === 'list-item' || state.name === 'task-list-item') {
                this._serializeListItemBlock(state, result, indent, listIndent);
            }
            else {
                this._serializeSimpleBlock(state, result, indent);
            }
        }

        return result.join('');
    }

    private _serializeSimpleBlock(state: TState, result: string[], indent: string) {
        switch (state.name) {
            case 'frontmatter':
                result.push(this.serializeFrontMatter(state));
                break;

            case 'paragraph':

            case 'thematic-break':
                this.insertLineBreak(result, indent);
                result.push(this.serializeTextParagraph(state, indent));
                break;

            case 'atx-heading':
                this.insertLineBreak(result, indent);
                result.push(this.serializeAtxHeading(state, indent));
                break;

            case 'setext-heading':
                this.insertLineBreak(result, indent);
                result.push(this.serializeSetextHeading(state, indent));
                break;

            case 'code-block':
                this.insertLineBreak(result, indent);
                result.push(this.serializeCodeBlock(state, indent));
                break;

            case 'html-block':
                this.insertLineBreak(result, indent);
                result.push(this.serializeHtmlBlock(state, indent));
                break;

            case 'math-block':
                this.insertLineBreak(result, indent);
                result.push(this.serializeMathBlock(state, indent));
                break;

            case 'diagram':
                this.insertLineBreak(result, indent);
                result.push(this.serializeDiagramBlock(state, indent));
                break;

            case 'block-quote':
                this.insertLineBreak(result, indent);
                result.push(this.serializeBlockquote(state, indent));
                break;

            case 'table':
                this.insertLineBreak(result, indent);
                result.push(this.serializeTable(state, indent));
                break;

            case 'footnote':
                this.insertLineBreak(result, indent);
                result.push(this.serializeFootnote(state, indent));
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
    ): string {
        let insertNewLine = this._isLooseParentList;
        this._isLooseParentList = true;
        const { meta } = state;

        // Start a new list without separation due changing the bullet or ordered list delimiter starts a new list.
        const bulletMarkerOrDelimiter
            = 'delimiter' in meta ? meta.delimiter : meta.marker;

        if (lastListBullet && lastListBullet !== bulletMarkerOrDelimiter)
            insertNewLine = false;

        if (insertNewLine)
            this.insertLineBreak(result, indent);

        this._listType.push(deepClone(meta));
        result.push(this.serializeList(state, indent, listIndent));
        this._listType.pop();

        return bulletMarkerOrDelimiter;
    }

    private _serializeListItemBlock(
        state: IListItemState | ITaskListItemState,
        result: string[],
        indent: string,
        listIndent: string,
    ) {
        const { loose } = this._listType[this._listType.length - 1];

        // helper variable to correct the first tight item in a nested list
        this._isLooseParentList = loose;
        if (loose)
            this.insertLineBreak(result, indent);

        result.push(this.serializeListItem(state, indent + listIndent));
        this._isLooseParentList = true;
    }

    insertLineBreak(result: unknown[], indent: string) {
        if (!result.length)
            return;
        // Blank lines inside a list item should be empty, not carry the
        // item's indent as trailing whitespace. For blockquote-style indents
        // like `> ` we keep the `>` so the quote stays continuous — only
        // strip the trailing run of plain spaces.
        result.push(`${indent.replace(/ +$/, '')}\n`);
    }

    serializeFrontMatter(state: IFrontmatterState) {
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

    serializeTextParagraph(
        state: IParagraphState | IThematicBreakState,
        indent: string,
    ) {
        const { text } = state;
        const lines = text.split('\n');

        return `${lines.map(line => `${indent}${line}`).join('\n')}\n`;
    }

    serializeAtxHeading(state: IAtxHeadingState, indent: string) {
        const { text } = state;
        const match = text.match(/(#{1,6})(.*)/);

        const atxHeadingText = `${match?.[1]} ${match?.[2].trim()}`;

        return `${indent}${atxHeadingText}\n`;
    }

    serializeSetextHeading(state: ISetextHeadingState, indent: string) {
        const { text, meta } = state;
        const { underline } = meta;
        const lines = text.trim().split('\n');

        return (
            `${lines.map(line => `${indent}${line}`).join('\n')
            }\n${indent}${underline.trim()}\n`
        );
    }

    serializeCodeBlock(state: ICodeBlockState, indent: string) {
        const result = [];
        const { text, meta } = state;
        const textList = text.split('\n');
        const { type, lang } = meta;

        if (type === 'fenced') {
            result.push(`${indent}${lang ? `\`\`\`${lang}\n` : '```\n'}`);
            textList.forEach((text) => {
                result.push(`${indent}${text}\n`);
            });
            result.push(`${indent}\`\`\`\n`);
        }
        else {
            textList.forEach((text) => {
                result.push(`${indent}    ${text}\n`);
            });
        }

        return result.join('');
    }

    serializeHtmlBlock(state: IHtmlBlockState, indent: string) {
        const result = [];
        const { text } = state;
        const lines = text.split('\n');

        for (const line of lines)
            result.push(`${indent}${line}\n`);

        return result.join('');
    }

    serializeMathBlock(state: IMathBlockState, indent: string) {
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

    serializeDiagramBlock(state: IDiagramState, indent: string) {
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

    serializeBlockquote(state: IBlockQuoteState, indent: string) {
        const { children } = state;
        const newIndent = `${indent}> `;

        return this.convertStatesToMarkdown(children, newIndent);
    }

    serializeFootnote(state: IFootnoteBlockState, indent: string) {
        // Footnote definitions render as
        //   [^id]: first paragraph
        //
        //       continuation block indented by 4 spaces
        // i.e. the `[^id]: ` prefix sits on the first child's first line and
        // subsequent content (including blank lines between paragraphs) is
        // indented by four spaces past the surrounding `indent`.
        const { meta, children } = state;
        const innerIndent = `${indent}    `;
        const inner = this.convertStatesToMarkdown(children, innerIndent);
        const prefix = `${indent}[^${meta.identifier}]: `;
        // Strip the inner indent off the first non-empty line so the prefix
        // sits flush, leaving subsequent lines at the four-space indent.
        const stripped = inner.replace(innerIndent, '');
        return `${prefix}${stripped}`;
    }

    serializeTable(state: ITableState, indent: string) {
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
                    tableData[i][j].length + 2,
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
                            const raw = ` ${cell + ' '.repeat(columnWidth[j].width)}`;

                            return raw.substring(0, columnWidth[j].width);
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

    serializeList(
        state: IBulletListState | IOrderListState | ITaskListState,
        indent: string,
        listIndent: string,
    ) {
        const { children } = state;

        return this.convertStatesToMarkdown(children, indent, listIndent);
    }

    serializeListItem(
        state: IListItemState | ITaskListItemState,
        indent: string,
    ) {
        const result = [];
        const listInfo = this._listType[this._listType.length - 1];
        // `listInfo` is one of three list-meta shapes (bullet / order / task).
        // bullet & task carry `marker`; order carries `delimiter` + `start`.
        // We discriminate on presence of `marker` to pick the right fields.
        const marker = 'marker' in listInfo ? listInfo.marker : undefined;
        const delimiter = 'delimiter' in listInfo ? listInfo.delimiter : undefined;
        const isUnorderedList = !!marker;
        const { children, name } = state;
        let itemMarker;

        if (isUnorderedList) {
            itemMarker = marker ? `${marker} ` : '- ';
        }
        else if ('start' in listInfo) {
            // NOTE: GitHub and Bitbucket limit the list count to 99 but this is nowhere defined.
            //  We limit the number to 99 for Daring Fireball Markdown to prevent indentation issues.
            let n = listInfo.start;
            if ((this._listIndentation === 'dfm' && n > 99) || n > 999999999)
                n = 1;

            listInfo.start++;

            itemMarker = `${n}${delimiter || '.'} `;
        }
        else {
            itemMarker = '- ';
        }

        // Subsequent paragraph indentation
        const newIndent = indent + ' '.repeat(itemMarker.length);

        // New list indentation. We already added one space to the indentation
        let listIndent = '';
        const { _listIndentation: listIndentation } = this;
        if (listIndentation === 'dfm')
            listIndent = ' '.repeat(4 - itemMarker.length);
        else if (listIndentation === 'number')
            listIndent = ' '.repeat(this._listIndentationCount - 1);

        // TODO: Indent subsequent paragraphs by one tab. - not important
        //  Problem: "convertStatesToMarkdown" use "indent" in spaces to indent elements. How should
        //  we integrate tabs in block quotes and subsequent paragraphs and how to combine with spaces?
        //  I don't know how to combine tabs and spaces and it seems not specified, so work for another day.

        if (name === 'task-list-item')
            itemMarker += state.meta.checked ? '[x] ' : '[ ] ';

        result.push(`${indent}${itemMarker}`);
        result.push(
            this.convertStatesToMarkdown(children, newIndent, listIndent).substring(
                newIndent.length,
            ),
        );

        return result.join('');
    }
}
