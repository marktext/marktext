/* eslint-disable antfu/no-top-level-await */
import type { IMuyaOptions, TState } from '@muyajs/core';
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

import { DEFAULT_MARKDOWN } from './data';

import './style.css';

// ---------- Firefox Intl.Segmenter polyfill ----------

// eslint-disable-next-line no-restricted-syntax -- structural widening over the const Intl namespace; alternative is augmenting global Intl which leaks polyfill semantics into every consumer
const intlNs = Intl as unknown as { Segmenter?: typeof Intl.Segmenter };
if (!intlNs.Segmenter) {
    const polyfill = await import('intl-segmenter-polyfill/dist/bundled');
    intlNs.Segmenter = await polyfill.createIntlSegmenterPolyfill() as typeof Intl.Segmenter;
}

// ---------- ImageEditTool callbacks ----------

async function imagePathPicker() {
    return 'https://pics.ettoday.net/images/2253/d2253152.jpg';
}

async function imageAction() {
    return new Promise<string>((resolve) => {
        setTimeout(resolve, 3000, 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg');
    });
}

// ---------- Register UI plugins (once, applies to every Muya instance) ----------

Muya.use(EmojiSelector);
Muya.use(FootnoteTool);
Muya.use(InlineFormatToolbar);
Muya.use(ImageEditTool, { imagePathPicker, imageAction });
Muya.use(ImageToolBar);
Muya.use(ImageResizeBar);
Muya.use(CodeBlockLanguageSelector);
Muya.use(LinkTools, {
    jumpClick: (linkInfo: { href?: string } | null) => {
        const href = linkInfo?.href;
        if (href && /^https?:\/\//.test(href))
            window.open(href, '_blank', 'noopener,noreferrer');
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

// ---------- Mutable runtime state ----------

// Keys MUST match the `value` attributes in #language-select (examples/index.html).
const LOCALES = {
    'en': en,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'ja': ja,
    'ko': ko,
    'es': es,
    'fr': fr,
    'de': de,
    'pt': pt,
} as const;
type TLocaleKey = keyof typeof LOCALES;

let currentLocale: TLocaleKey = 'en';

// `satisfies` lets the literal stay structurally typed (Record<string,
// unknown>-like for the form-driven mutation below) while still failing
// to compile if a key or value drifts from IMuyaOptions.
const INITIAL_OPTIONS = {
    // Markdown extensions
    frontMatter: true,
    footnote: true,
    math: true,
    superSubScript: true,
    isGitlabCompatibilityEnabled: true,
    // Display
    codeBlockLineNumbers: true,
    focusMode: false,
    spellcheckEnabled: false,
    disableHtml: false,
    // Editing behavior
    autoPairBracket: true,
    autoPairMarkdownSyntax: true,
    autoPairQuote: true,
    autoCheck: false,
    autoMoveCheckedToEnd: false,
    // Misc
    preferLooseListItem: true,
    hideQuickInsertHint: false,
    hideLinkPopup: false,
    trimUnnecessaryCodeBlockEmptyLines: false,
    // Radios
    bulletListMarker: '-',
    orderListDelimiter: '.',
    frontmatterType: '-',
    // Selects
    mermaidTheme: 'default',
    vegaTheme: 'latimes',
    // Numbers
    fontSize: 16,
    lineHeight: 1.6,
    tabSize: 4,
    listIndentation: 1,
} satisfies Partial<IMuyaOptions>;

const currentOptions: Record<string, unknown> = { ...INITIAL_OPTIONS };

// ---------- Editor lifecycle ----------

function createEditor(container: HTMLElement, markdown: string): Muya {
    const m = new Muya(container, { markdown, ...currentOptions } as Partial<IMuyaOptions>);
    m.locale(LOCALES[currentLocale]);
    m.init();
    return m;
}

function bindEditorEvents(m: Muya) {
    m.on('json-change', () => {
        // eslint-disable-next-line no-console -- demo log for manual verification
        console.log('[muya] TOC:', m.getTOC());
    });
    m.on('focus', () => {
        // eslint-disable-next-line no-console -- demo log
        console.log('[muya] focus');
    });
    m.on('blur', () => {
        // eslint-disable-next-line no-console -- demo log
        console.log('[muya] blur');
    });
}

function freshEditorContainer(): HTMLElement {
    const fresh = document.createElement('div');
    fresh.id = 'editor';
    document.querySelector('.editor-container')!.appendChild(fresh);
    return fresh;
}

let muya = createEditor(document.querySelector('#editor')!, DEFAULT_MARKDOWN);
bindEditorEvents(muya);
window.muya = muya;

function rebuildEditor() {
    const md = muya.getMarkdown();
    muya.destroy();
    const next = createEditor(freshEditorContainer(), md);
    bindEditorEvents(next);
    muya = next;
    window.muya = muya;
}

// ---------- Sidebar wiring ----------

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

function wireSidebarToggle() {
    $<HTMLButtonElement>('#sidebar-toggle').addEventListener('click', () => {
        document.body.classList.toggle('sidebar-collapsed');
    });
}

function wireLocale() {
    const sel = $<HTMLSelectElement>('#language-select');
    sel.value = currentLocale;
    sel.addEventListener('change', (ev) => {
        const v = (ev.target as HTMLSelectElement).value as TLocaleKey;
        currentLocale = v;
        muya.locale(LOCALES[v]);
    });
}

function wireHistorySelection() {
    $<HTMLButtonElement>('#undo').addEventListener('click', () => muya.undo());
    $<HTMLButtonElement>('#redo').addEventListener('click', () => muya.redo());
    $<HTMLButtonElement>('#select-all').addEventListener('click', () => muya.selectAll());
    $<HTMLButtonElement>('#focus').addEventListener('click', () => muya.focus());
}

function wireFindReplace() {
    $<HTMLInputElement>('#search').addEventListener('input', (ev) => {
        muya.search((ev.target as HTMLInputElement).value, { isRegexp: true });
    });
    $<HTMLButtonElement>('#previous').addEventListener('click', () => muya.find('previous'));
    $<HTMLButtonElement>('#next').addEventListener('click', () => muya.find('next'));
    const replaceInput = $<HTMLInputElement>('#replace');
    $<HTMLButtonElement>('#single').addEventListener('click', () => {
        muya.replace(replaceInput.value, { isSingle: true, isRegexp: true });
    });
    $<HTMLButtonElement>('#all').addEventListener('click', () => {
        muya.replace(replaceInput.value, { isSingle: false, isRegexp: false });
    });
}

const MINIMAL_CONTENT: TState[] = [{ name: 'paragraph', text: 'foo bar' } as TState];

function wireContent() {
    $<HTMLButtonElement>('#set-content').addEventListener('click', () => {
        muya.setContent(MINIMAL_CONTENT);
    });
    $<HTMLButtonElement>('#reset-demo').addEventListener('click', () => {
        muya.setContent(DEFAULT_MARKDOWN, true);
    });
    $<HTMLButtonElement>('#clear-all').addEventListener('click', () => {
        muya.setContent('');
    });
}

function dump(text: string) {
    $<HTMLTextAreaElement>('#debug-out').value = text;
    // eslint-disable-next-line no-console -- demo: also echo to devtools
    console.log(text);
}

function wireDebug() {
    $<HTMLButtonElement>('#show-md').addEventListener('click', () => dump(muya.getMarkdown()));
    $<HTMLButtonElement>('#show-state').addEventListener('click', () => {
        dump(JSON.stringify(muya.getState(), null, 2));
    });
    $<HTMLButtonElement>('#show-toc').addEventListener('click', () => {
        dump(JSON.stringify(muya.getTOC(), null, 2));
    });
    $<HTMLButtonElement>('#export-html').addEventListener('click', async () => {
        const html = await new MarkdownToHtml(muya.getMarkdown()).generate();
        dump(html);
        // Use a Blob URL + noopener,noreferrer so the new tab cannot reach
        // back into this page via window.opener (reverse-tabnabbing) and
        // so the HTML is fetched as a real document instead of injected
        // via document.write into a same-origin opener-linked window.
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        // Release the Blob once the new tab has had a chance to load it.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
}

// ---------- Options form ----------

const RADIO_KEYS = ['bulletListMarker', 'orderListDelimiter', 'frontmatterType'] as const;

function syncOptionFormFromState() {
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-opt]').forEach((el) => {
        const key = (el as HTMLElement).dataset.opt!;
        const val = currentOptions[key];
        if (el instanceof HTMLInputElement && el.type === 'checkbox')
            el.checked = Boolean(val);
        else
            el.value = String(val ?? '');
    });
    for (const key of RADIO_KEYS) {
        const wanted = String(currentOptions[key]);
        document
            .querySelectorAll<HTMLInputElement>(`input[name="opt-${key}"]`)
            .forEach((el) => {
                el.checked = el.value === wanted;
            });
    }
}

function readOptionFromEvent(target: EventTarget | null) {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement))
        return;
    const dataKey = (target as HTMLElement).dataset.opt;
    if (dataKey) {
        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
            currentOptions[dataKey] = target.checked;
        }
        else if (target instanceof HTMLInputElement && target.type === 'number') {
            const num = Number.parseFloat(target.value);
            if (!Number.isNaN(num))
                currentOptions[dataKey] = num;
        }
        else { currentOptions[dataKey] = target.value; }
        return;
    }
    if (target instanceof HTMLInputElement && target.type === 'radio' && target.checked) {
        const radioKey = target.name.replace(/^opt-/, '');
        currentOptions[radioKey] = target.value;
    }
}

function wireOptions() {
    syncOptionFormFromState();
    const form = $<HTMLFormElement>('#options-form');
    form.addEventListener('change', ev => readOptionFromEvent(ev.target));
    form.addEventListener('input', ev => readOptionFromEvent(ev.target));
    $<HTMLButtonElement>('#apply-options').addEventListener('click', rebuildEditor);
}

// ---------- Boot ----------

wireSidebarToggle();
wireLocale();
wireHistorySelection();
wireFindReplace();
wireContent();
wireDebug();
wireOptions();
