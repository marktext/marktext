import type { MarkedToken, Tokens } from 'marked';
import type { IGithubAlertToken } from './extensions/githubAlerts';
import type { IMultilineBlockquoteToken } from './extensions/multilineBlockquote';

export interface ILexOption {
    footnote?: boolean;
    texMathDollars?: boolean;
    texMathGfm?: boolean;
    texMathSingleBackslash?: boolean;
    texMathDoubleBackslash?: boolean;
    frontMatter?: boolean;
    superSubScript?: boolean;
    highlightSyntax?: boolean;
    inlineDiff?: boolean;
    multilineBlockquote?: boolean;
    githubAlerts?: boolean;
}

export type Heading = Tokens.Heading & {
    headingStyle: 'setext' | 'atx';
    marker: string;
};

export type ListItemToken = Tokens.ListItem & {
    listItemType: 'order' | 'bullet' | 'task';
    bulletMarkerOrDelimiter: '.' | ')' | '*' | '+' | '-' | '';
    orderMarker?: string;
};

export type ListToken = Tokens.List & {
    listType: 'order' | 'bullet' | 'task';
    items: ListItemToken[];
};

// Extension tokens and synthetic block-end markers widen marked’s token shapes.
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
    mathStyle: '' | 'gfm';
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
    tokenType: 'githubAlert' | 'blockquote' | 'multilineBlockquote' | 'list' | 'list-item' | 'footnote';
}

// Replace default heading/list/item variants so consumers can narrow to Muya extension fields.
export type TLexedToken
    = | Exclude<MarkedToken, Tokens.Heading | Tokens.List | Tokens.ListItem>
        | Heading
        | ListToken
        | ListItemToken
        | IFootnoteToken
        | IMultipleMathToken
        | IFrontmatterToken
        | IMultilineBlockquoteToken
        | IGithubAlertToken;

export type TBlockToken = TLexedToken | IBlockEndToken;
