import type { h } from 'snabbdom';
import type Format from '../block/base/format';
import type { ICursor } from '../selection/types';

export type H = typeof h;

export interface ISyntaxRenderOptions {
    h: H;
    cursor: ICursor;
    block: Format;
    token: Token;
    outerClass?: string;
}

export interface IHighlight {
    start: number;
    end: number;
    active: boolean | undefined;
}

export type Labels = Map<
    string,
    {
        href: string;
        title: string;
    }
>;

export type Rules = Record<string, RegExp>;

export interface ITokenizerFacOptions {
    superSubScript: boolean;
    footnote: boolean;
}

export interface ITokenizerOptions {
    highlights?: IHighlight[];
    hasBeginRules?: boolean;
    labels?: Labels;
    options?: ITokenizerFacOptions;
}

export interface ITokenRange {
    start: number;
    end: number;
}

export type Token
    = | BeginRuleToken
        | ReferenceDefinitionToken
        | TextToken
        | BacklashToken
        | StrongEmToken
        | CodeEmojiMathToken
        | DelToken
        | SuperSubScriptToken
        | FootnoteIdentifierToken
        | ImageToken
        | LinkToken
        | ReferenceLinkToken
        | ReferenceImageToken
        | HTMLEscapeToken
        | AutoLinkExtensionToken
        | AutoLinkToken
        | HTMLTagToken
        | SoftLineBreakToken
        | HardLineBreakToken
        | TailHeaderToken;

export interface IBaseToken {
    raw: string;
    parent: Token[];
    range: ITokenRange;
    highlights?: IHighlight[];
}

export type BeginRuleToken = IBaseToken & {
    type: 'header' | 'hr' | 'code_fence' | 'multiple_math';
    marker: string;
    content: string;
    backlash: string;
};

export type ReferenceDefinitionToken = IBaseToken & {
    type: 'reference_definition';
    leftBracket: string;
    label: string;
    backlash: string;
    rightBracket: string;
    leftHrefMarker: string;
    href: string;
    rightHrefMarker: string;
    leftTitleSpace: string;
    titleMarker: string;
    title: string;
    rightTitleSpace: string;
};

export type TextToken = IBaseToken & {
    type: 'text';
    content: string;
};

export type BacklashToken = IBaseToken & {
    type: 'backlash';
    marker: string;
    content: string;
};

export type StrongEmToken = IBaseToken & {
    type: 'strong' | 'em';
    marker: string;
    children: Token[];
    backlash: string;
};

export type CodeEmojiMathToken = IBaseToken & {
    type: 'inline_code' | 'emoji' | 'inline_math';
    marker: string;
    content: string;
    backlash: string;
};

export type DelToken = IBaseToken & {
    type: 'del';
    marker: string;
    children: Token[];
    backlash: string;
};

export type SuperSubScriptToken = IBaseToken & {
    type: 'super_sub_script';
    marker: string;
    content: string;
};

export type FootnoteIdentifierToken = IBaseToken & {
    type: 'footnote_identifier';
    marker: string;
    content: string;
};

export type ImageToken = IBaseToken & {
    type: 'image';
    marker: string;
    srcAndTitle: string;
    attrs: {
        src: string;
        title: string;
        alt: string;
        [key: string]: string;
    };
    src: string;
    title: string;
    alt: string;
    backlash: {
        first: string;
        second: string;
    };
};

export type LinkToken = IBaseToken & {
    type: 'link';
    marker: string;
    hrefAndTitle: string;
    href: string;
    title: string;
    anchor: string;
    children: Token[];
    backlash: {
        first: string;
        second: string;
    };
};

export type ReferenceLinkToken = IBaseToken & {
    type: 'reference_link';
    isFullLink: boolean;
    anchor: string;
    backlash: {
        first: string;
        second: string;
    };
    label: string;
    children: Token[];
};

export type ReferenceImageToken = IBaseToken & {
    type: 'reference_image';
    isFullLink: boolean;
    alt: string;
    backlash: {
        first: string;
        second: string;
    };
    label: string;
};

export type HTMLEscapeToken = IBaseToken & {
    type: 'html_escape';
    escapeCharacter: string;
};

export type AutoLinkExtensionToken = IBaseToken & {
    type: 'auto_link_extension';
    www: string;
    url: string;
    email: string;
    linkType: 'www' | 'url' | 'email';
};

export type AutoLinkToken = IBaseToken & {
    type: 'auto_link';
    href: string;
    email: string;
    isLink: boolean; // It is a link or email.
    marker: '<';
};

export type HTMLTagToken = IBaseToken & {
    type: 'html_tag';
    tag: string;
    openTag: string;
    attrs: Record<string, string | null>;
    closeTag?: string;
    content?: string;
    children?: Token[];
};

export type SoftLineBreakToken = IBaseToken & {
    type: 'soft_line_break';
    lineBreak: string;
    isAtEnd: boolean;
};

export type HardLineBreakToken = IBaseToken & {
    type: 'hard_line_break';
    spaces: string; // The space in hard line break
    lineBreak: string; // \n
    isAtEnd: boolean;
};

export type TailHeaderToken = IBaseToken & {
    type: 'tail_header';
    marker: string;
};
