import { generateKeyHash, genUpper2LowerKeyHash, getLongUniqueId } from './utils'
import htmlTags from 'html-tags'
import voidHtmlTags from 'html-tags/void'

// [0.25, 0.5, 1, 2, 4, 8] <—?—> [256M, 500M/768M, 1G/1000M, 2G, 4G, 8G]
// Electron 2.0.2 not support yet! So give a default value 4
export const DEVICE_MEMORY = navigator.deviceMemory || 4 // Get the divice memory number(Chrome >= 63)
export const UNDO_DEPTH = DEVICE_MEMORY >= 4 ? 100 : 50
export const HAS_TEXT_BLOCK_REG = /^(h\d|span|th|td|hr|pre)/i
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
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab'
])

export const LOWERCASE_TAGS = generateKeyHash([
  ...blockContainerElementNames, ...emptyElementNames, 'div'
])

export const CLASS_OR_ID = genUpper2LowerKeyHash([
  'mousetrap',
  'AG_GRAY',
  'AG_HIDE',
  'AG_WARN',
  'AG_PARAGRAPH', // => 'ag-paragraph'
  'AG_LINE',
  'AG_ACTIVE',
  'AG_EDITOR_ID',
  'AG_FLOAT_BOX_ID',
  'AG_FUNCTION_HTML',
  'AG_FLOAT_BOX',
  'AG_SHOW_FLOAT_BOX',
  'AG_FLOAT_ITEM', // LI element
  'AG_FLOAT_ITEM_ACTIVE',
  'AG_FLOAT_ITEM_ICON', // icon wrapper in li
  'AG_EMOJI_MARKED_TEXT',
  'AG_CODE_BLOCK',
  'AG_HTML_BLOCK',
  'AG_HTML_ESCAPE',
  'AG_FRONT_MATTER',
  'AG_FRONT_MATTER_LINE',
  'AG_MULTIPLE_MATH_LINE',
  'AG_CODEMIRROR_BLOCK',
  'AG_SHOW_PREVIEW',
  'AG_HTML_PREVIEW',
  'AG_LANGUAGE',
  'AG_LANGUAGE_INPUT',
  'AG_TEMP',
  'AG_FOCUS_MODE',
  'AG_LINK_IN_BRACKET',
  'AG_BACKLASH',
  'AG_BUG', // for remove bug
  'AG_IMAGE_MARKED_TEXT',
  'AG_IMAGE_FAIL',
  'AG_IMAGE_SRC',
  'AG_REMOVE',
  'AG_COPY_REMOVE',
  'AG_OUTPUT_REMOVE',
  'AG_EMOJI_MARKER',
  'AG_NOTEXT_LINK',
  'AG_LIST_ITEM',
  'AG_ORDER_LIST',
  'AG_ORDER_LIST_ITEM',
  'AG_BULLET_LIST',
  'AG_BULLET_LIST_ITEM',
  'AG_TASK_LIST',
  'AG_TASK_LIST_ITEM',
  'AG_TASK_LIST_ITEM_CHECKBOX',
  'AG_CHECKBOX_CHECKED',
  'AG_TOOL_BAR',
  'AG_SELECTION',
  'AG_HIGHLIGHT',
  'AG_MATH',
  'AG_MATH_TEXT',
  'AG_MATH_RENDER',
  'AG_MATH_ERROR',
  'AG_MATH_EMPTY',
  'AG_MATH_MARKER',
  'AG_MATH_PREVIEW',
  'AG_MULTIPLE_MATH_BLOCK',
  'AG_MULTIPLE_MATH',
  'AG_LOOSE_LIST_ITEM',
  'AG_TIGHT_LIST_ITEM',
  'AG_HTML_TAG',
  'AG_LINK',
  'AG_HARD_LINE_BREAK',
  'AG_SOFT_LINE_BREAK',
  'AG_INLINE_RULE',
  'AG_REFERENCE_LABEL',
  'AG_REFERENCE_TITLE',
  'AG_REFERENCE_MARKER',
  'AG_REFERENCE_LINK'
])

export const codeMirrorConfig = {
  // theme: 'railscasts',
  lineWrapping: true,
  autoCloseBrackets: true,
  lineWiseCopyCut: false,
  autoCloseTags: true,
  autofocus: true,
  tabSize: 2,
  extraKeys: {
    'Cmd-Z': false,
    'Cmd-Y': false
  }
}

export const DAED_REMOVE_SELECTOR = new Set([
  '.ag-image-marked-text::before',
  '.ag-image-marked-text.ag-image-fail::before',
  '.ag-hide',
  '.ag-gray',
  '.ag-warn'
])

export const htmlBeautifyConfig = {
  'indent_size': 2,
  'html': {
    'end_with_newline': false,
    'js': {
      'indent_size': 2
    },
    'css': {
      'indent_size': 2
    }
  },
  'css': {
    'indent_size': 1
  },
  'js': {
    'preserve-newlines': true
  }
}

export const CURSOR_DNA = getLongUniqueId()

export const DEFAULT_TURNDOWN_CONFIG = {
  headingStyle: 'atx', // setext or atx
  bulletListMarker: '-', // -, +, or *
  codeBlockStyle: 'fenced', // fenced or indented
  fence: '```', // ``` or ~~~
  emDelimiter: '*', // _ or *
  strongDelimiter: '**' // ** or __
}

export const FORMAT_MARKER_MAP = {
  'em': '*',
  'inline_code': '`',
  'strong': '**',
  'del': '~~'
}

export const FORMAT_TYPES = ['strong', 'em', 'del', 'inline_code', 'link', 'image']

export const punctuation = ['!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~']

export const TABLE_TOOLS = [{
  label: 'table',
  title: 'Resize Table',
  icon: 'icon-table'
}, {
  label: 'left',
  title: 'Align Left',
  icon: 'icon-alignleft'
}, {
  label: 'center',
  title: 'Align Center',
  icon: 'icon-aligncenter'
}, {
  label: 'right',
  title: 'Align Right',
  icon: 'icon-alignright'
}, {
  label: 'delete',
  title: 'Delete Table',
  icon: 'icon-del'
}]

export const HTML_TOOLS = [{
  label: 'delete',
  title: 'Delete HTML block',
  icon: 'icon-del'
}]

export const LINE_BREAK = '\n'

export const PREVIEW_DOMPURIFY_CONFIG = {
  FORBID_ATTR: ['style', 'class', 'contenteditable'],
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
