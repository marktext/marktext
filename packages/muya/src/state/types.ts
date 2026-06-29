export interface IParagraphState {
    name: 'paragraph';
    text: string;
}

export interface IAtxHeadingState {
    name: 'atx-heading';
    meta: {
        level: number;
    };
    text: string;
}

export interface ISetextHeadingState {
    name: 'setext-heading';
    meta: {
        level: number;
        underline: string; // "===" | "---";
    };
    text: string;
}

export interface IThematicBreakState {
    name: 'thematic-break';
    text: string;
}

export interface ICodeBlockState {
    name: 'code-block';
    meta: {
        type: string; // "indented" | "fenced";
        lang: string;
        fenceLength?: number;
    };
    text: string;
}

export interface IHtmlBlockState {
    name: 'html-block';
    text: string;
}

/**
 * @deprecated Reference definitions are stored as paragraph state nodes whose
 * `text` is the raw `[label]: url "title"` line (matches marktext's
 * "definition is paragraph text" model). `InlineRenderer.collectReferenceDefinitions`
 * regex-scans paragraphs to build the labels Map. This interface is unused
 * across the codebase and exists only for legacy type compatibility; remove
 * in v0.3.
 */
export interface ILinkReferenceDefinitionState {
    name: 'link-reference-definition';
    text: string;
}

export interface IBlockQuoteState {
    name: 'block-quote';
    children: TState[];
}

export interface IListItemState {
    name: 'list-item';
    children: TState[];
}

export interface IOrderListState {
    name: 'order-list';
    meta: {
        start: number;
        loose: boolean;
        delimiter: string; // "." | ")";
    };
    children: IListItemState[];
}

export interface IBulletListState {
    name: 'bullet-list';
    meta: {
        marker: string; // "-" | "+" | "*";
        loose: boolean;
    };
    children: IListItemState[];
}

export interface ITableRowState {
    name: 'table.row';
    children: ITableCellState[];
}

export interface ITableCellMeta {
    align: string; // 'none' | 'left' | 'center' | 'right';
}

export interface ITableCellState {
    name: 'table.cell';
    meta: ITableCellMeta;
    text: string;
}

export interface ITableState {
    name: 'table';
    children: ITableRowState[];
}

export interface ITaskListItemMeta {
    checked: boolean;
}

export interface ITaskListItemState {
    name: 'task-list-item';
    meta: ITaskListItemMeta;
    children: TState[];
}

export interface ITaskListMeta {
    marker: string; // "-" | "+" | "*";
    loose: boolean;
}

export interface ITaskListState {
    name: 'task-list';
    meta: ITaskListMeta;
    children: ITaskListItemState[];
}

export interface IMathMeta {
    mathStyle: string; // "" | "gitlab";
}

export interface IMathBlockState {
    name: 'math-block';
    meta: IMathMeta;
    text: string;
}

export interface IFrontmatterMeta {
    lang: string; // "yaml" | "toml" | "json";
    style: string; //  "-" | "+" | ";" | "{";
}

export interface IFrontmatterState {
    name: 'frontmatter';
    meta: IFrontmatterMeta;
    text: string;
}

export interface IDiagramMeta {
    lang: string; // 'yaml' | 'json';
    type: 'mermaid' | 'plantuml' | 'vega-lite' | 'flowchart' | 'sequence';
}

export interface IDiagramState {
    name: 'diagram';
    meta: IDiagramMeta;
    text: string;
}

export interface IFootnoteBlockMeta {
    identifier: string;
}

export interface IFootnoteBlockState {
    name: 'footnote';
    meta: IFootnoteBlockMeta;
    children: TState[];
}

export type TLeafState
    = | IParagraphState
        | IAtxHeadingState
        | ISetextHeadingState
        | IThematicBreakState
        | ICodeBlockState
        | IHtmlBlockState
        | ILinkReferenceDefinitionState
        | IMathBlockState
        | IFrontmatterState
        | IDiagramState
        | ITableCellState;

export type TContainerState
    = | IBlockQuoteState
        | IOrderListState
        | IBulletListState
        | ITableState
        | ITaskListState
        | ITaskListItemState
        | IListItemState
        | ITableRowState
        | IFootnoteBlockState;

export type TState = TLeafState | TContainerState;

export type CodeContentState = ICodeBlockState | IHtmlBlockState | IDiagramState | IMathBlockState | IFrontmatterState;

// Discriminated-union type guards. `TState` is keyed by `name`, so consumers can
// narrow without `as I<X>State` casts. Use `isStateOfName(state, 'atx-heading')`
// for ad-hoc narrowing or the per-name shorthands.
export function isStateOfName<N extends TState['name']>(
    state: TState,
    name: N,
): state is Extract<TState, { name: N }> {
    return state.name === name;
}

export const isParagraphState = (s: TState): s is IParagraphState => s.name === 'paragraph';
export const isAtxHeadingState = (s: TState): s is IAtxHeadingState => s.name === 'atx-heading';
export const isSetextHeadingState = (s: TState): s is ISetextHeadingState => s.name === 'setext-heading';
export const isThematicBreakState = (s: TState): s is IThematicBreakState => s.name === 'thematic-break';
export const isCodeBlockState = (s: TState): s is ICodeBlockState => s.name === 'code-block';
export const isHtmlBlockState = (s: TState): s is IHtmlBlockState => s.name === 'html-block';
export const isLinkReferenceDefinitionState = (s: TState): s is ILinkReferenceDefinitionState => s.name === 'link-reference-definition';
export const isMathBlockState = (s: TState): s is IMathBlockState => s.name === 'math-block';
export const isFrontmatterState = (s: TState): s is IFrontmatterState => s.name === 'frontmatter';
export const isDiagramState = (s: TState): s is IDiagramState => s.name === 'diagram';
export const isTableCellState = (s: TState): s is ITableCellState => s.name === 'table.cell';

export const isBlockQuoteState = (s: TState): s is IBlockQuoteState => s.name === 'block-quote';
export const isOrderListState = (s: TState): s is IOrderListState => s.name === 'order-list';
export const isBulletListState = (s: TState): s is IBulletListState => s.name === 'bullet-list';
export const isTableState = (s: TState): s is ITableState => s.name === 'table';
export const isTaskListState = (s: TState): s is ITaskListState => s.name === 'task-list';
export const isTaskListItemState = (s: TState): s is ITaskListItemState => s.name === 'task-list-item';
export const isListItemState = (s: TState): s is IListItemState => s.name === 'list-item';
export const isTableRowState = (s: TState): s is ITableRowState => s.name === 'table.row';
export const isFootnoteBlockState = (s: TState): s is IFootnoteBlockState => s.name === 'footnote';

export function isAnyListState(s: TState): s is IOrderListState | IBulletListState | ITaskListState {
    return s.name === 'order-list' || s.name === 'bullet-list' || s.name === 'task-list';
}

export interface ITurnoverOptions {
    headingStyle: 'atx' | 'setext'; // setext or atx
    hr: '---';
    bulletListMarker: '-' | '+' | '*'; // -, +, or *
    codeBlockStyle: 'fenced' | 'indented'; // fenced or indented
    fence: '```' | '~~~'; // ``` or ~~~
    emDelimiter: '*' | '_'; // _ or *
    strongDelimiter: '**' | '__'; // ** or __
    linkStyle: 'inlined';
    linkReferenceStyle: 'full';
    blankReplacement: (content: unknown, node: unknown, options: unknown) => string;
}
