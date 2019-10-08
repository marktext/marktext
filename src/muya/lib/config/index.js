import { generateKeyHash, genUpper2LowerKeyHash, getLongUniqueId } from '../utils'
import htmlTags from 'html-tags'
import voidHtmlTags from 'html-tags/void'

// [0.25, 0.5, 1, 2, 4, 8] <—?—> [256M, 500M/768M, 1G/1000M, 2G, 4G, 8G]
// Electron 2.0.2 not support yet! So give a default value 4
export const DEVICE_MEMORY = navigator.deviceMemory || 4 // Get the divice memory number(Chrome >= 63)
export const UNDO_DEPTH = DEVICE_MEMORY >= 4 ? 100 : 50
export const HAS_TEXT_BLOCK_REG = /^(span|th|td)/i
export const VOID_HTML_TAGS = voidHtmlTags
export const HTML_TAGS = htmlTags
// TYPE1 ~ TYPE7 according to https://github.github.com/gfm/#html-blocks
export const BLOCK_TYPE1 = [
  'script', 'pre', 'style'
]

export const BLOCK_TYPE2_REG = /^<!--(?=\s).*\s+-->$/

export const BLOCK_TYPE6 = [
  'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body', 'caption', 'center', 'col', 'colgroup', 'dd',
  'details', 'dialog', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame', 'frameset',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu',
  'menuitem', 'meta', 'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'section', 'source', 'summary', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul'
]

export const BLOCK_TYPE7 = htmlTags.filter(tag => {
  return !BLOCK_TYPE1.find(t => t === tag) && !BLOCK_TYPE6.find(t => t === tag)
})

export const IMAGE_EXT_REG = /\.(jpeg|jpg|png|gif|svg|webp)(?=\?|$)/i

export const PARAGRAPH_TYPES = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li', 'figure']

export const blockContainerElementNames = [
  // elements our editor generates
  ...PARAGRAPH_TYPES,
  // all other known block elements
  'address', 'article', 'aside', 'audio', 'canvas', 'dd', 'dl', 'dt', 'fieldset',
  'figcaption', 'footer', 'form', 'header', 'hgroup', 'main', 'nav',
  'noscript', 'output', 'section', 'video',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
]

export const emptyElementNames = ['br', 'col', 'colgroup', 'hr', 'img', 'input', 'source', 'wbr']

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
  'Escape'
])

export const LOWERCASE_TAGS = generateKeyHash([
  ...blockContainerElementNames, ...emptyElementNames, 'div'
])

export const CLASS_OR_ID = genUpper2LowerKeyHash([
  'AG_ACTIVE',
  'AG_AUTO_LINK',
  'AG_AUTO_LINK_EXTENSION',
  'AG_BACKLASH',
  'AG_BUG',
  'AG_BULLET_LIST',
  'AG_BULLET_LIST_ITEM',
  'AG_CHECKBOX_CHECKED',
  'AG_CONTAINER_BLOCK',
  'AG_CONTAINER_PREVIEW',
  'AG_CONTAINER_ICON',
  'AG_COPY_REMOVE',
  'AG_EDITOR_ID',
  'AG_EMOJI_MARKED_TEXT',
  'AG_EMOJI_MARKER',
  'AG_EMPTY',
  'AG_FENCE_CODE',
  'AG_FLOWCHART',
  'AG_FOCUS_MODE',
  'AG_FRONT_MATTER',
  'AG_FRONT_ICON',
  'AG_GRAY',
  'AG_HARD_LINE_BREAK',
  'AG_HARD_LINE_BREAK_SPACE',
  'AG_LINE_END',
  'AG_HEADER_TIGHT_SPACE',
  'AG_HIDE',
  'AG_HIGHLIGHT',
  'AG_HTML_BLOCK',
  'AG_HTML_ESCAPE',
  'AG_HTML_PREVIEW',
  'AG_HTML_TAG',
  'AG_IMAGE_FAIL',
  'AG_IMAGE_BUTTONS',
  'AG_IMAGE_LOADING',
  'AG_EMPTY_IMAGE',
  'AG_IMAGE_MARKED_TEXT',
  'AG_IMAGE_SRC',
  'AG_IMAGE_CONTAINER',
  'AG_INLINE_IMAGE',
  'AG_IMAGE_SUCCESS',
  'AG_IMAGE_UPLOADING',
  'AG_INLINE_IMAGE_SELECTED',
  'AG_INLINE_IMAGE_IS_EDIT',
  'AG_INDENT_CODE',
  'AG_INLINE_RULE',
  'AG_LANGUAGE',
  'AG_LANGUAGE_INPUT',
  'AG_LINK',
  'AG_LINK_IN_BRACKET',
  'AG_LIST_ITEM',
  'AG_LOOSE_LIST_ITEM',
  'AG_MATH',
  'AG_MATH_TEXT',
  'AG_MATH_RENDER',
  'AG_RUBY',
  'AG_RUBY_TEXT',
  'AG_RUBY_RENDER',
  'AG_SELECTED',
  'AG_SOFT_LINE_BREAK',
  'AG_MATH_ERROR',
  'AG_MATH_MARKER',
  'AG_MATH_RENDER',
  'AG_MATH_TEXT',
  'AG_MERMAID',
  'AG_MULTIPLE_MATH',
  'AG_NOTEXT_LINK',
  'AG_ORDER_LIST',
  'AG_ORDER_LIST_ITEM',
  'AG_OUTPUT_REMOVE',
  'AG_PARAGRAPH',
  'AG_RAW_HTML',
  'AG_REFERENCE_LABEL',
  'AG_REFERENCE_LINK',
  'AG_REFERENCE_MARKER',
  'AG_REFERENCE_TITLE',
  'AG_REMOVE',
  'AG_RUBY',
  'AG_RUBY_RENDER',
  'AG_RUBY_TEXT',
  'AG_SELECTION',
  'AG_SEQUENCE',
  'AG_SHOW_PREVIEW',
  'AG_SOFT_LINE_BREAK',
  'AG_TASK_LIST',
  'AG_TASK_LIST_ITEM',
  'AG_TASK_LIST_ITEM_CHECKBOX',
  'AG_TIGHT_LIST_ITEM',
  'AG_TOOL_BAR',
  'AG_VEGA_LITE',
  'AG_WARN'
])

export const DAED_REMOVE_SELECTOR = new Set([
  '.ag-image-marked-text::before',
  '.ag-image-marked-text.ag-image-fail::before',
  '.ag-hide',
  '.ag-gray',
  '.ag-warn'
])

export const CURSOR_ANCHOR_DNA = getLongUniqueId()
export const CURSOR_FOCUS_DNA = getLongUniqueId()

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
  blankReplacement (content, node, options) {
    if (node && node.classList.contains('ag-soft-line-break')) {
      return LINE_BREAK
    } else if (node && node.classList.contains('ag-hard-line-break')) {
      return '  ' + LINE_BREAK
    } else if (node && node.classList.contains('ag-hard-line-break-sapce')) {
      return ''
    } else {
      return node.isBlock ? '\n\n' : ''
    }
  }
}

export const FORMAT_MARKER_MAP = {
  em: '*',
  inline_code: '`',
  strong: '**',
  del: '~~',
  inline_math: '$',
  u: {
    open: '<u>',
    close: '</u>'
  },
  sub: {
    open: '<sub>',
    close: '</sub>'
  },
  sup: {
    open: '<sup>',
    close: '</sup>'
  }
}

export const FORMAT_TYPES = ['strong', 'em', 'del', 'inline_code', 'link', 'image', 'inline_math']

export const LINE_BREAK = '\n'

export const PREVIEW_DOMPURIFY_CONFIG = {
  // do not forbit `class` because `code` element use class to present language
  FORBID_ATTR: ['style', 'contenteditable'],
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: {
    html: true,
    svg: true,
    svgFilters: true,
    mathMl: true
  }
}

export const EXPORT_DOMPURIFY_CONFIG = {
  FORBID_ATTR: ['contenteditable'],
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: {
    html: true,
    svg: true,
    svgFilters: true,
    mathMl: true
  }
}

export const MUYA_DEFAULT_OPTION = {
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
  // bullet/list marker width + listIndentation, tab or Daring Fireball Markdown (4 spaces) --> list indentation
  listIndentation: 1,
  frontmatterType: '-',
  sequenceTheme: 'hand', // hand or simple
  mermaidTheme: 'default', // dark / forest / default
  vegaTheme: 'latimes', // excel / ggplot2 / quartz / vox / fivethirtyeight / dark / latimes
  hideQuickInsertHint: false,
  // transform the image to local folder, cloud or just return the local path
  imageAction: null,
  // Call Electron open dialog or input element type is file.
  imagePathPicker: null,
  clipboardFilePath: () => {},
  // image path auto completed when you input in image selector.
  imagePathAutoComplete: () => []
}

// export const DIAGRAM_TEMPLATE = {
//   'mermaid': `graph LR;\nYou-->|Mark Text|Me;`
// }

export const isInElectron = window && window.process && window.process.type === 'renderer'
export const isOsx = window && window.navigator && /Mac/.test(window.navigator.platform)
export const isWin = window && window.navigator.userAgent && /win32|wow32|win64|wow64/i.test(window.navigator.userAgent)
// http[s] (domain or IPv4 or localhost or IPv6) [port] /not-white-space
export const URL_REG = /^http(s)?:\/\/([a-z0-9\-._~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(:[0-9]{1,5})?\/[\S]+/i
// The smallest transparent gif base64 image.
// export const SMALLEST_BASE64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
// export const isIOS = /(?:iPhone|iPad|iPod|iOS)/i.test(window.navigator.userAgent)
export const defaultSearchOption = {
  isCaseSensitive: false,
  isWholeWord: false,
  isRegexp: false,
  selectHighlight: false,
  highlightIndex: -1
}
