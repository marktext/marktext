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
    plantumlServer: string;
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
     */
    clipboardFilePath?: () => Promise<string>;
    /**
     * Read the OS clipboard's plain text for "Paste as Plain Text".
     *
     * The embedder supplies this because Chromium removed programmatic
     * clipboard reads via `document.execCommand('paste')`, and a sandboxed
     * renderer cannot reach the system clipboard directly. Electron embedders
     * typically wire this to an IPC bridge over the native `clipboard` module.
     * When omitted, muya falls back to `navigator.clipboard.readText()`.
     */
    clipboardText?: () => Promise<string>;
    /**
     * Persist an image per the embedder's insert preference (copy into the
     * document's assets folder, upload to an image host, or keep the path) and
     * resolve to the src that should be written into the document.
     *
     * Invoked on paste — both when a clipboard FILE path is resolved and when
     * an in-memory bitmap is read from `clipboardData` — by the image-edit
     * toolbar, and by the drag-and-drop image handler, so a dropped local image
     * file is persisted exactly like one inserted through the toolbar. `src` is
     * an absolute local path (or a `data:` URL for a freshly pasted bitmap).
     * Returning the original `src` keeps the path as-is; omitting the hook uses
     * the raw `src` verbatim.
     */
    imageAction?: (state: IImageActionState) => Promise<string>;
    /**
     * Resolve a dropped `File` to a local filesystem path.
     *
     * The DnD `DataTransfer` exposes a `File` object but not its on-disk
     * path; only the embedder (e.g. Electron's `webUtils.getPathForFile`)
     * can resolve it. Provide this hook to enable dropping a local image
     * file into the document. Return `''` when no path is available.
     */
    getPathForFile?: (file: File) => string;
}

/**
 * Image descriptor passed to {@link IMuyaOptions.imageAction}. Mirrors the
 * `{ src, alt, title }` shape used by the image-edit toolbar.
 */
export interface IImageActionState {
    /** Image source — an absolute local path or a `data:` URL for a bitmap. */
    src: string;
    /** Image alt text. */
    alt: string;
    /** Image title. */
    title: string;
}

export type Nullable<T> = T | null | undefined | void;
