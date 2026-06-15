/**
 * Single source of truth for DOM selectors used by E2E specs.
 *
 * If the editor's class names change (e.g. the .mu-* prefix or floating UI
 * data attributes), update them here — specs should never hard-code selectors.
 */

export const editor = {
    container: '#editor',
    root: '.mu-editor',
    // Editor root carries this class while focus mode is enabled (toggled by
    // `Muya#setFocusMode` / applied at construction for `focusMode: true`).
    focusModeRoot: '.mu-editor.mu-focus-mode',
    paragraph: '.mu-paragraph',
    atxHeading: '.mu-atx-heading',
    setextHeading: '.mu-setext-heading',
    // A Shift+Enter soft line break inside a Format leaf renders as a
    // `<span.mu-soft-line-break>` wrapping a literal `\n`. Source of truth:
    // packages/muya/src/inlineRenderer/renderer/softLineBreak.ts +
    // CLASS_NAMES.MU_SOFT_LINE_BREAK in packages/muya/src/config/index.ts.
    softLineBreak: '.mu-soft-line-break',
    blockQuote: '.mu-block-quote',
    bulletList: '.mu-bullet-list',
    orderList: '.mu-order-list',
    taskList: '.mu-task-list',
    taskListItem: '.mu-task-list-item',
    thematicBreak: '.mu-thematic-break',
    codeBlock: '.mu-code-block',
    fenceCode: '.mu-fence-code',
    // The leaf node that holds the actual code text inside a code block.
    // Prism highlight `<span class="token …">` runs are appended here.
    // Source of truth: packages/muya/src/block/content/codeBlockContent/index.ts
    // (classList pushes 'mu-codeblock-content').
    codeContent: '.mu-codeblock-content',
    languageInput: '.mu-language-input',
    table: 'table',
    tableCell: '.mu-table-cell',
    htmlBlock: '.mu-html-block',
    htmlPreview: '.mu-html-preview',
    // When `disableHtml: true`, the html-block wrapper carries an extra
    // class so syntax-highlight CSS knows not to render the preview. Source
    // of truth: packages/core/src/block/commonMark/html/index.ts.
    htmlDisabled: '.mu-disable-html-render',
    mathBlock: '.mu-math-block',
    mathRender: '.mu-math-render',
    // Inline-math wrapper. Carries `mu-hide` while the caret sits outside the
    // `$...$` token (KaTeX preview shown, source collapsed); the class drops
    // when the caret is inside, revealing the editable `.mu-math-text` source.
    inlineMath: '.mu-math',
    inlineMathText: '.mu-math > .mu-math-text',
    katex: '.katex',
    diagramBlock: '.mu-diagram-block',
    diagramContainer: '.mu-diagram-container',
    diagramPreview: '.mu-diagram-preview',
    // Error surface rendered into the diagram preview when the diagram
    // renderer throws (e.g. invalid mermaid syntax). Source of truth:
    // packages/core/src/block/extra/diagram/diagramPreview.ts (catch branch).
    diagramError: '.mu-diagram-error',
    image: '.mu-inline-image',
    // Inline image placeholder rendered when the image has no resolvable src
    // (e.g. `![]()` / `![alt]()`). Source of truth:
    // packages/muya/src/inlineRenderer/renderer/image.ts (the `else` branch
    // appends CLASS_NAMES.MU_EMPTY_IMAGE → `mu-empty-image`). Clicking it emits
    // `muya-image-selector` (selection/ImageSelection.ts) which opens the
    // ImageEditTool float.
    emptyImage: '.mu-inline-image.mu-empty-image',
    inlineFootnoteIdentifier: '.mu-inline-footnote-identifier',
    link: 'span.mu-link, a.mu-reference-link, a.mu-raw-html',
    // Frontmatter block (renders as a `<pre.mu-frontmatter>` wrapping a code block).
    frontmatter: '.mu-frontmatter',
    // Inline reference link / reference image — see PR-16 regression area.
    referenceLink: 'a.mu-reference-link',
    referenceImage: '.mu-image-marked-text',
    // Inline html tags wrap their children with `.mu-raw-html`. The tag itself
    // is the actual `<u>`, `<mark>`, `<sup>`, `<sub>` or `<ruby>` element.
    rawHtml: '.mu-raw-html',
} as const;

// Float root class names confirmed against the `const name = 'mu-...'` lines
// inside each plugin's index.ts.
export const floats = {
    inlineFormatToolbar: '.mu-format-picker',
    quickInsert: '.mu-quick-insert',
    paragraphFrontButton: '.mu-front-button-wrapper',
    paragraphFrontButtonInner: '.mu-front-button',
    paragraphFrontMenu: '.mu-front-menu',
    emojiPicker: '.mu-emoji-picker',
    linkTools: '.mu-link-tools',
    imageToolbar: '.mu-image-toolbar',
    imageEditTool: '.mu-image-selector',
    codeBlockLanguageSelector: '.mu-list-picker',
    tableColumnTools: '.mu-table-column-tools',
    tableRowColumMenu: '.mu-table-bar-tools',
    tableDragBar: '.mu-table-drag-bar',
    // The in-editor table grid dimension picker (TableChessboard). Shown when
    // the `/` quick-insert (or front-menu) "table" entry is chosen.
    tablePicker: '.mu-table-picker',
    // ImageResizeBar creates a `.mu-transformer` container and appends
    // `.bar.left` / `.bar.right` handles on click. These are not registered
    // through baseFloat (they're a bespoke `transformer` plugin) — keep
    // them under floats for spec discoverability.
    imageTransformer: '.mu-transformer',
    imageTransformerHandle: '.mu-transformer .bar',
    footnoteTool: '.mu-footnote-tool',
    previewToolBar: '.mu-preview-tools',
} as const;

/** Slash-menu item locator: `[data-label="atx-heading 1"]` etc. */
export function quickInsertItem(label: string): string {
    return `${floats.quickInsert} [data-label="${label}"]`;
}

/**
 * Table grid picker cell locator (zero-based row/column). Hovering and
 * clicking the `(row, column)` cell creates a `(row + 1) × (column + 1)`
 * table.
 */
export function tablePickerCell(row: number, column: number): string {
    return `${floats.tablePicker} span.mu-table-picker-cell[data-row="${row}"][data-column="${column}"]`;
}

export const toolbar = {
    undo: '#undo',
    redo: '#redo',
    search: '#search',
    previous: '#previous',
    next: '#next',
    replace: '#replace',
    single: '#single',
    all: '#all',
    setContent: '#set-content',
    selectAll: '#select-all',
    languageSelect: '#language-select',
} as const;
