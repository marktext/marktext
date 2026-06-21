import htmlTags, { voidHtmlTags } from 'html-tags';
import { en } from '../locales/en';

export const VOID_HTML_TAGS = voidHtmlTags;
export const HTML_TAGS = htmlTags;
export const BLOCK_DOM_PROPERTY = '__MUYA_BLOCK__';

/**
 * [genUpper2LowerKeyHash generate constants map hash, the value is lowercase of the key,
 * also translate `_` to `-`]
 */
function genUpper2LowerKeyHash(keys: string[]): Record<string, string> {
    return keys.reduce((acc, key) => {
        const value = key.toLowerCase().replace(/_/g, '-');

        return Object.assign(acc, { [key]: value });
    }, {});
}

/**
 * generate constants map, the value is the key.
 */
function generateKeyHash(keys: string[]): Record<string, string> {
    return keys.reduce((acc, key) => {
        return Object.assign(acc, { [key]: key });
    }, {});
}

interface ITag {
    open: string;
    close: string;
}

export const FORMAT_MARKER_MAP: Record<string, string> = {
    em: '*',
    inline_code: '`',
    strong: '**',
    del: '~~',
    inline_math: '$',
};

export const FORMAT_TAG_MAP: Record<string, ITag> = {
    u: {
        open: '<u>',
        close: '</u>',
    },
    sub: {
        open: '<sub>',
        close: '</sub>',
    },
    sup: {
        open: '<sup>',
        close: '</sup>',
    },
    mark: {
        open: '<mark>',
        close: '</mark>',
    },
};

export const FORMAT_TYPES = [
    'strong',
    'em',
    'del',
    'inline_code',
    'link',
    'image',
    'inline_math',
];

export const PARAGRAPH_STATE = {
    name: 'paragraph',
    text: 'paragraph example',
};

export const THEMATIC_BREAK_STATE = {
    name: 'thematic-break',
    text: '---',
};

export const EVENT_KEYS = generateKeyHash([
    'Enter',
    'Backspace',
    'Space',
    'Delete',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Tab',
    'Escape',
]);

// TODO remove unused classnames after muya stable.
export const CLASS_NAMES = genUpper2LowerKeyHash([
    'MU_EDITOR',
    'MU_ACTIVE',
    'MU_AUTO_LINK',
    'MU_AUTO_LINK_EXTENSION',
    'MU_BACKLASH',
    'MU_BUG',
    'MU_BULLET_LIST',
    'MU_BULLET_LIST_ITEM',
    'MU_CHECKBOX_CHECKED',
    'MU_CONTAINER_BLOCK',
    'MU_CONTAINER_PREVIEW',
    'MU_CONTAINER_ICON',
    'MU_COPY_HEADER_LINK',
    'MU_COPY_REMOVE',
    'MU_DISABLE_HTML_RENDER',
    'MU_EMOJI_MARKED_TEXT',
    'MU_EMOJI_MARKER',
    'MU_EMPTY',
    'MU_FENCE_CODE',
    'MU_FOCUS_MODE',
    'MU_FRONT_MATTER',
    'MU_FRONT_ICON',
    'MU_GRAY',
    'MU_HARD_LINE_BREAK',
    'MU_HARD_LINE_BREAK_SPACE',
    'MU_LINE_END',
    'MU_HEADER_TIGHT_SPACE',
    'MU_HIDE',
    'MU_HIDE_SPELLING_MARKS',
    'MU_HIGHLIGHT',
    'MU_HTML_BLOCK',
    'MU_HTML_ESCAPE',
    'MU_HTML_ESCAPE_MARKER',
    'MU_HTML_PREVIEW',
    'MU_HTML_TAG',
    'MU_IMAGE_FAIL',
    'MU_IMAGE_BUTTONS',
    'MU_IMAGE_LOADING',
    'MU_EMPTY_IMAGE',
    'MU_IMAGE_MARKED_TEXT',
    'MU_IMAGE_SRC',
    'MU_IMAGE_CONTAINER',
    'MU_INLINE_IMAGE',
    'MU_IMAGE_SUCCESS',
    'MU_IMAGE_UPLOADING',
    'MU_INLINE_IMAGE_SELECTED',
    'MU_INLINE_IMAGE_IS_EDIT',
    'MU_SMALL_IMAGE',
    'MU_INDENT_CODE',
    'MU_FOOTNOTE',
    'MU_FOOTNOTE_INPUT',
    'MU_FOOTNOTE_BACKLINK',
    'MU_INLINE_FOOTNOTE_IDENTIFIER',
    'MU_INLINE_RULE',
    'MU_LANGUAGE',
    'MU_LANGUAGE_INPUT',
    'MU_LINK',
    'MU_LINK_IN_BRACKET',
    'MU_LIST_ITEM',
    'MU_LOOSE_LIST_ITEM',
    'MU_MATH',
    'MU_MATH_TEXT',
    'MU_MATH_RENDER',
    'MU_RUBY',
    'MU_RUBY_TEXT',
    'MU_RUBY_RENDER',
    'MU_SELECTED',
    'MU_SOFT_LINE_BREAK',
    'MU_MATH_ERROR',
    'MU_MATH_MARKER',
    'MU_MATH_RENDER',
    'MU_MATH_TEXT',
    'MU_MERMAID',
    'MU_MULTIPLE_MATH',
    'MU_NO_TEXT_LINK',
    'MU_ORDER_LIST',
    'MU_ORDER_LIST_ITEM',
    'MU_OUTPUT_REMOVE',
    'MU_PARAGRAPH',
    'MU_RAW_HTML',
    'MU_REFERENCE_LABEL',
    'MU_REFERENCE_LINK',
    'MU_REFERENCE_MARKER',
    'MU_REFERENCE_TITLE',
    'MU_REMOVE',
    'MU_RUBY',
    'MU_RUBY_RENDER',
    'MU_RUBY_TEXT',
    'MU_SELECTION',
    'MU_SHOW_PREVIEW',
    'MU_SOFT_LINE_BREAK',
    'MU_TABLE_CELL_SELECTED',
    'MU_TABLE_CELL_BORDER_TOP',
    'MU_TABLE_CELL_BORDER_RIGHT',
    'MU_TABLE_CELL_BORDER_BOTTOM',
    'MU_TABLE_CELL_BORDER_LEFT',
    'MU_TASK_LIST',
    'MU_TASK_LIST_ITEM',
    'MU_TASK_LIST_ITEM_CHECKBOX',
    'MU_TIGHT_LIST_ITEM',
    'MU_TOOL_BAR',
    'MU_VEGA_LITE',
    'MU_WARN',
    'MU_SHOW_QUICK_INSERT_HINT',
]);

export const PARAGRAPH_TYPES = [
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'ul',
    'ol',
    'li',
    'figure',
];

export const BLOCK_TYPE6 = [
    'address',
    'article',
    'aside',
    'base',
    'basefont',
    'blockquote',
    'body',
    'caption',
    'center',
    'col',
    'colgroup',
    'dd',
    'details',
    'dialog',
    'dir',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'frame',
    'frameset',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hr',
    'html',
    'iframe',
    'legend',
    'li',
    'link',
    'main',
    'menu',
    'menuitem',
    'meta',
    'nav',
    'noframes',
    'ol',
    'optgroup',
    'option',
    'p',
    'param',
    'section',
    'source',
    'summary',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'title',
    'tr',
    'track',
    'ul',
];

export const BRACKET_HASH: Record<string, string> = {
    '{': '}',
    '[': ']',
    '(': ')',
    '*': '*',
    '_': '_',
    '"': '"',
    '\'': '\'',
    '$': '$',
    '~': '~',
};

export const BACK_HASH: Record<string, string> = {
    '}': '{',
    ']': '[',
    ')': '(',
    '*': '*',
    '_': '_',
    '"': '"',
    '\'': '\'',
    '$': '$',
    '~': '~',
};

export const MUYA_DEFAULT_OPTIONS = {
    fontSize: 16,
    lineHeight: 1.6,
    focusMode: false,
    markdown: '',
    // Whether to trim the beginning and ending empty line in code block when open markdown.
    trimUnnecessaryCodeBlockEmptyLines: false,
    preferLooseListItem: true,
    autoPairBracket: true,
    autoPairMarkdownSyntax: true,
    autoPairQuote: true,
    bulletListMarker: '-',
    orderListDelimiter: '.',
    tabSize: 4,
    codeBlockLineNumbers: false,
    // bullet/list marker width + listIndentation, tab or Daring Fireball Markdown (4 spaces) --> list indentation
    listIndentation: 1,
    frontmatterType: '-',
    mermaidTheme: 'default', // dark / forest / default
    vegaTheme: 'latimes', // excel / ggplot2 / quartz / vox / fivethirtyeight / dark / latimes
    plantumlServer: 'https://www.plantuml.com/plantuml',
    sequenceTheme: 'hand' as 'hand' | 'simple', // hand / simple
    hideQuickInsertHint: false,
    hideLinkPopup: false,
    autoCheck: false,
    // Whether we should set spellcheck attribute on our container to highlight misspelled words.
    // NOTE: The browser is not able to correct misspelled words words without a custom
    // implementation like in MarkText.
    spellcheckEnabled: false,
    // Hide the native spelling squiggle via CSS while keeping `spellcheckEnabled`
    // (and thus the native checker + right-click suggestions) active. Independent
    // of `spellcheckEnabled`.
    spellcheckHideMarks: false,
    // Markdown extensions
    frontMatter: true, // Whether to support frontmatter.
    superSubScript: true,
    footnote: false,
    // Whether math block is supported.
    math: true,
    isGitlabCompatibilityEnabled: true,
    // Move checked task list item to the end of task list.
    autoMoveCheckedToEnd: false,
    // Whether HTML rendering is disabled or not.
    disableHtml: false,
    locale: en,
};

export const punctuation = [
    '!',
    '"',
    '#',
    '$',
    '%',
    '&',
    '\'',
    '(',
    ')',
    '*',
    '+',
    ',',
    '-',
    '.',
    '/',
    ':',
    ';',
    '<',
    '=',
    '>',
    '?',
    '@',
    '[',
    '\\',
    ']',
    '^',
    '_',
    '`',
    '{',
    '|',
    '}',
    '~',
];
// Electron detection (kept for reference; renderer-process check).
export const IMAGE_EXT_REG = /\.(jpeg|jpg|png|gif|svg|webp)(?=\?|$)/i;
export const isFirefox
    = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');
export const isOsx
    = typeof window !== 'undefined'
        && window.navigator
        && /Mac/.test(window.navigator.userAgent);
export const isWin
    = typeof window !== 'undefined'
        && window.navigator
        && /win32|wow32|win64|wow64/i.test(window.navigator.userAgent);
// http[s] (domain or IPv4 or localhost or IPv6) [port] /not-white-space
export const URL_REG
    = /^http(s)?:\/\/([\w\-.~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(:\d{1,5})?\/\S+/i;
// A fully-formed base64/percent-encoded image data URL, e.g.
// `data:image/png;base64,iVBORw0KGg...`. A bare `data:image/` prefix is not
// treated as a safe-to-embed source.
export const DATA_URL_REG
    = /^data:image\/[\w+-]+(?:;[\w-]+=[\w-]+|;base64)*,[a-zA-Z0-9+/]+={0,2}$/;
export const PREVIEW_DOMPURIFY_CONFIG = {
    // do not forbid `class` because `code` element use class to present language.
    // `style` is allowed (matching EXPORT_DOMPURIFY_CONFIG) so inline-styled HTML
    // blocks render the same in the editor as on export; DOMPurify still
    // sanitizes the style values themselves.
    FORBID_ATTR: ['contenteditable'],
    ALLOW_DATA_ATTR: false,
    USE_PROFILES: {
        html: true,
        svg: true,
        svgFilters: true,
        mathMl: false,
    },
    RETURN_TRUSTED_TYPE: false,
};
export const EXPORT_DOMPURIFY_CONFIG = {
    FORBID_ATTR: ['contenteditable'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['data-align'],
    USE_PROFILES: {
        html: true,
        svg: true,
        svgFilters: true,
        mathMl: false,
    },
    RETURN_TRUSTED_TYPE: false,
    // Allow "file" protocol to export images on Windows (#1997).
    ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};
export const DEFAULT_SEARCH_OPTIONS = {
    isCaseSensitive: false,
    isWholeWord: false,
    isRegexp: false,
    selectHighlight: false,
    highlightIndex: -1,
};

export const LINE_BREAK = '\n';

export const DEFAULT_TURNDOWN_CONFIG = {
    headingStyle: 'atx', // setext or atx
    hr: '---',
    bulletListMarker: '-', // -, +, or *
    codeBlockStyle: 'fenced', // fenced or indented
    fence: '```', // ``` or ~~~
    emDelimiter: '*', // _ or *
    strongDelimiter: '**', // ** or __
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    blankReplacement(
        _content: unknown,
        // Turndown passes its internal node object: a real DOM Element
        // plus the augmented `isBlock` flag the library adds when walking.
        node: Element & { isBlock?: boolean },
        _options: unknown,
    ) {
        if (node && node.classList.contains(CLASS_NAMES.MU_SOFT_LINE_BREAK))
            return LINE_BREAK;
        else if (node && node.classList.contains(CLASS_NAMES.MU_HARD_LINE_BREAK))
            return `  ${LINE_BREAK}`;
        else if (node && node.classList.contains(CLASS_NAMES.MU_HARD_LINE_BREAK_SPACE))
            return '';
        else
            return node.isBlock ? '\n\n' : '';
    },
};
