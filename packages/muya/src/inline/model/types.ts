export interface IHighlight {
    start: number;
    end: number;
    active: boolean | undefined;
}

export interface IReferenceDefinition {
    readonly href: string;
    readonly title: string;
}

export type Labels = ReadonlyMap<string, IReferenceDefinition>;

export type Rules = Record<string, RegExp>;

/** Block-relative UTF-16 offsets, with an exclusive end. */
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
        | MarkToken
        | InlineDiffToken
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
    // Owning sibling array; format operations splice this array in place.
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
    // Reading text is a prefix of raw; ignored paragraph-final whitespace remains in raw.
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

type LiteralToken = IBaseToken & {
    marker: string;
    content: string;
    backlash: string;
};

export type InlineCodeToken = LiteralToken & {
    type: 'inline_code';
    // The editable source excludes boundary padding; content holds normalized reading text.
    contentRange?: ITokenRange;
};
export type EmojiToken = LiteralToken & { type: 'emoji' };
export type InlineMathToken = LiteralToken & { type: 'inline_math' };
export type CodeEmojiMathToken = InlineCodeToken | EmojiToken | InlineMathToken;

export type DelToken = IBaseToken & {
    type: 'del';
    marker: string;
    children: Token[];
    backlash: string;
};

export type MarkToken = IBaseToken & {
    type: 'mark';
    marker: string;
    children: Token[];
    backlash: string;
};

export type InlineDiffToken = IBaseToken & {
    type: 'inline_diff';
    marker: string;
    content: string;
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
    // Raw description for editing and source offsets; attrs.alt is reader-facing text.
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
    attrs: { alt: string };
    isFullLink: boolean;
    // Raw description for editing and source offsets; attrs.alt is reader-facing text.
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
    content: string;
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
    isLink: boolean;
    marker: '<';
};

export type HTMLTagToken = IBaseToken & {
    type: 'html_tag';
    kind?: 'tag' | 'closing-tag' | 'comment' | 'processing-instruction' | 'declaration' | 'cdata';
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
    marker: string;
    lineBreak: string;
    // Retained for source offsets; CommonMark ignores indentation after a hard break.
    leadingSpaces: string;
    isAtEnd: boolean;
};

export type TailHeaderToken = IBaseToken & {
    type: 'tail_header';
    marker: string;
};
