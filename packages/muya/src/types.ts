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
    sequenceTheme: 'hand' | 'simple';
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
    /**
     * Resolve the OS clipboard to a local file path on paste.
     *
     * When the user pastes and the system clipboard holds a file (for
     * example an image copied from a file manager rather than image bytes),
     * the embedder resolves it to an absolute path. If this hook is provided
     * and returns a non-empty path with an image extension, muya inserts that
     * path as an inline image at the cursor instead of running the default
     * text/HTML paste. Return `''` to fall through to the normal paste flow.
     *
     * Ported from the legacy `@muyajs` `clipboardFilePath` option.
     */
    clipboardFilePath?: () => Promise<string>;
}

export type Nullable<T> = T | null | undefined | void;
