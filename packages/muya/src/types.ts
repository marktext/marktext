import type { TState } from './state/types';

export interface IMuyaOptions {
    fontSize: number;
    lineHeight: number;
    focusMode: boolean;
    trimUnnecessaryCodeBlockEmptyLines: boolean;
    preferLooseListItem: boolean;
    autoPairBracket: boolean;
    autoPairMarkdownSyntax: boolean;
    autoPairQuote: boolean;
    bulletListMarker: string;
    orderListDelimiter: string;
    tabSize: number;
    codeBlockLineNumbers: boolean;
    listIndentation: number;
    frontMatter: boolean;
    frontmatterType: string; // '-' | '+' | ';' | '{';
    mermaidTheme: string;
    vegaTheme: string;
    hideQuickInsertHint: boolean;
    hideLinkPopup: boolean;
    autoCheck: boolean;
    spellcheckEnabled: boolean;
    superSubScript: boolean;
    footnote: boolean;
    math: boolean;
    isGitlabCompatibilityEnabled: boolean;
    autoMoveCheckedToEnd: boolean;
    disableHtml: boolean;
    locale: {
        name: string;
        resource: {
            [key: string]: string;
        };
    };
    json?: TState[];
    markdown?: string;
}

export type Nullable<T> = T | null | undefined | void;
