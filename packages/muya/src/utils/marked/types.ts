import type { MarkedToken, Tokens } from 'marked';

export interface ILexOption {
    footnote?: boolean;
    math?: boolean;
    isGitlabCompatibilityEnabled?: boolean;
    frontMatter?: boolean;
    superSubScript?: boolean;
}

export type Heading = Tokens.Heading & {
    headingStyle: 'setext' | 'atx';
    marker: string;
};

export type ListItemToken = Tokens.ListItem & {
    listItemType: 'order' | 'bullet' | 'task';
    bulletMarkerOrDelimiter: '.' | ')' | '*' | '+' | '-' | '';
};

export type ListToken = Tokens.List & {
    listType: 'order' | 'bullet' | 'task';
    items: ListItemToken[];
};

// Block-level tokens emitted by extensions (footnote, math, frontmatter)
// plus the synthetic block-end marker `markdownToState` injects to pop the
// parent stack when descending into block-quote / list / list-item / footnote.
export interface IFootnoteToken {
    type: 'footnote';
    raw: string;
    identifier: string;
    tokens: Tokens.Generic[];
}

export interface IMultipleMathToken {
    type: 'multiplemath';
    raw: string;
    text: string;
    displayMode: boolean;
    mathStyle: '' | 'gitlab';
}

export interface IFrontmatterToken {
    type: 'frontmatter';
    raw: string;
    text: string;
    style: '-' | '+' | ';' | '{';
    lang: 'yaml' | 'toml' | 'json';
}

export interface IBlockEndToken {
    type: 'block-end';
    tokenType: 'blockquote' | 'list' | 'list-item' | 'footnote';
}

// Tokens the lexer (lexBlock) emits. Replace marked's default
// heading/list/list-item with their muya-extended counterparts so the
// switch in `markdownToState` narrows to the extension fields directly.
// We use `MarkedToken` (the discriminated union) rather than `Token`
// (= MarkedToken | Tokens.Generic) so cases like `'table'` narrow cleanly
// to `Tokens.Table` instead of `Tokens.Table | Tokens.Generic` — the
// latter would poison field access with the Generic's `[index: string]: any`.
export type TLexedToken
    = | Exclude<MarkedToken, Tokens.Heading | Tokens.List | Tokens.ListItem>
        | Heading
        | ListToken
        | ListItemToken
        | IFootnoteToken
        | IMultipleMathToken
        | IFrontmatterToken;

// The working token stream `markdownToState` walks: lexer output plus the
// synthetic `block-end` markers it injects to pop the parent stack.
export type TBlockToken = TLexedToken | IBlockEndToken;
