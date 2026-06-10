/* eslint-disable antfu/no-top-level-await */
import type { ILocale, IMuyaOptions, TState } from '@muyajs/core';
import {
    CodeBlockLanguageSelector,
    de,
    EmojiSelector,
    en,
    es,
    FootnoteTool,
    fr,
    ImageEditTool,
    ImageResizeBar,
    ImageToolBar,
    InlineFormatToolbar,
    ja,
    ko,
    LinkTools,
    MarkdownToHtml,
    Muya,
    ParagraphFrontButton,
    ParagraphFrontMenu,
    ParagraphQuickInsertMenu,
    PreviewToolBar,
    pt,
    TableChessboard,
    TableColumnToolbar,
    TableDragBar,
    TableRowColumMenu,
    zhCN,
    zhTW,
} from '@muyajs/core';
import './style.css';

// Intl.Segmenter polyfill — required on Firefox; harmless on Chromium.
// The DOM lib types `Intl` as a const namespace, so a structural cast is
// unavoidable for the existence check + assignment. Pull the unsafe
// boundary into one tightly-scoped helper so the rest of host/main.ts
// stays clean.
async function ensureIntlSegmenter(): Promise<void> {
    interface ISegmenterHolder { Segmenter?: typeof Intl.Segmenter }
    // eslint-disable-next-line no-restricted-syntax -- structural widening over the const Intl namespace; alternative is augmenting global Intl which leaks polyfill semantics into every consumer
    const holder = Intl as unknown as ISegmenterHolder;
    if (holder.Segmenter)
        return;
    const polyfill = await import('intl-segmenter-polyfill/dist/bundled');
    holder.Segmenter = await polyfill.createIntlSegmenterPolyfill() as typeof Intl.Segmenter;
}
await ensureIntlSegmenter();

// Deterministic mocks: specs assert these exact URLs / delays.
const PICKED_IMAGE_URL = 'https://example.test/picked-image.png';
const UPLOADED_IMAGE_URL = 'https://example.test/uploaded-image.png';
async function imagePathPicker() {
    return PICKED_IMAGE_URL;
}
async function imageAction() {
    return UPLOADED_IMAGE_URL;
}

// Record jumpClick invocations so specs can assert via window.__e2e.linkJumps.
const linkJumps: Array<{ href?: string }> = [];

Muya.use(EmojiSelector);
Muya.use(FootnoteTool);
Muya.use(InlineFormatToolbar);
Muya.use(ImageEditTool, { imagePathPicker, imageAction });
Muya.use(ImageToolBar);
Muya.use(ImageResizeBar);
Muya.use(CodeBlockLanguageSelector);
Muya.use(LinkTools, {
    jumpClick: (linkInfo: { href?: string } | null) => {
        linkJumps.push({ href: linkInfo?.href });
    },
});
Muya.use(ParagraphFrontButton);
Muya.use(ParagraphFrontMenu);
Muya.use(TableChessboard);
Muya.use(TableColumnToolbar);
Muya.use(ParagraphQuickInsertMenu);
Muya.use(TableDragBar);
Muya.use(TableRowColumMenu);
Muya.use(PreviewToolBar);

const INITIAL_MARKDOWN = `# Muya E2E

A paragraph with **bold**, *italic*, \`code\`, and a [link](https://example.com).

- item one
- item two
`;

// `satisfies` guards against silently-renamed option keys — if `IMuyaOptions`
// ever drops `footnote` or `codeBlockLineNumbers`, host fails to compile
// before specs go red. Same pattern as examples/src/main.ts:INITIAL_OPTIONS.
const HOST_OPTIONS = {
    footnote: true,
    codeBlockLineNumbers: true,
} satisfies Partial<IMuyaOptions>;

// `editor-container` parents the live `#editor` div. Phase 4 rebuilds
// destroy → re-create the editor under this parent (the destroy() call
// removes the previous #editor from the DOM, so we need a new node to
// host the next Muya).
const editorParent = document.querySelector<HTMLElement>('.editor-container')!;

function makeEditorNode(): HTMLElement {
    const node = document.createElement('div');
    node.id = 'editor';
    editorParent.appendChild(node);
    return node;
}

function bootMuya(container: HTMLElement, options: Partial<IMuyaOptions>): Muya {
    const next = new Muya(container, { markdown: INITIAL_MARKDOWN, ...options });
    next.locale(en);
    next.init();
    return next;
}

const initialContainer = document.querySelector<HTMLElement>('#editor')!;
let muya = bootMuya(initialContainer, HOST_OPTIONS);

window.muya = muya;
window.MarkdownToHtml = MarkdownToHtml;
window.__e2e = {
    linkJumps,
    INITIAL_MARKDOWN,
    PICKED_IMAGE_URL,
    UPLOADED_IMAGE_URL,
    rebuildMuya: (options: Partial<IMuyaOptions> = {}) => {
        muya.destroy();
        const fresh = makeEditorNode();
        muya = bootMuya(fresh, { ...HOST_OPTIONS, ...options });
        window.muya = muya;
    },
};

// Toolbar wiring (mirrors the buttons declared in index.html).
const $ = <T extends HTMLElement>(id: string): T => document.querySelector<T>(id)!;

// Keys MUST match the `value` attributes in #language-select (e2e/host/index.html).
const LOCALES: Record<string, ILocale> = {
    'en': en,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'ja': ja,
    'ko': ko,
    'es': es,
    'fr': fr,
    'de': de,
    'pt': pt,
};

$<HTMLSelectElement>('#language-select').addEventListener('change', (event) => {
    const locale = LOCALES[(event.target as HTMLSelectElement).value];
    if (locale)
        muya.locale(locale);
});

$<HTMLButtonElement>('#undo').addEventListener('click', () => muya.undo());
$<HTMLButtonElement>('#redo').addEventListener('click', () => muya.redo());

$<HTMLInputElement>('#search').addEventListener('input', (event) => {
    muya.search((event.target as HTMLInputElement).value, { isRegexp: false });
});
$<HTMLButtonElement>('#previous').addEventListener('click', () => muya.find('previous'));
$<HTMLButtonElement>('#next').addEventListener('click', () => muya.find('next'));

$<HTMLButtonElement>('#single').addEventListener('click', () => {
    muya.replace($<HTMLInputElement>('#replace').value, { isSingle: true, isRegexp: false });
});
$<HTMLButtonElement>('#all').addEventListener('click', () => {
    muya.replace($<HTMLInputElement>('#replace').value, { isSingle: false, isRegexp: false });
});

$<HTMLButtonElement>('#set-content').addEventListener('click', () => {
    muya.setContent([{ name: 'paragraph', text: 'set-content fired' }] as TState[]);
});
$<HTMLButtonElement>('#select-all').addEventListener('click', () => muya.selectAll());
