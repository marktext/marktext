// Clipboard copy mode. Drives how `copyHandler` fills the `text/html` and
// `text/plain` slots: `NORMAL` writes markdown source to text/plain, the
// `COPY_AS_*` variants are toggled by the matching `copyAs*()` methods, and
// `COPY_CODE_CONTENT` copies a code block's raw text verbatim.
export enum CopyType {
    NORMAL = 'normal',
    COPY_AS_MARKDOWN = 'copyAsMarkdown',
    COPY_AS_HTML = 'copyAsHtml',
    COPY_AS_RICH = 'copyAsRich',
    COPY_CODE_CONTENT = 'copyCodeContent',
}

// Clipboard paste mode. `PASTE_AS_PLAIN_TEXT` (toggled by `pasteAsPlainText()`)
// forces a paste through the plain-text path instead of the HTML converter.
export enum PasteType {
    NORMAL = 'normal',
    PASTE_AS_PLAIN_TEXT = 'pasteAsPlainText',
}
