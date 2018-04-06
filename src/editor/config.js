import { generateKeyHash, genUpper2LowerKeyHash, getIdWithoutSet } from './utils'
import htmlTags from 'html-tags'
import voidHtmlTags from 'html-tags/void'

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
  'AG_ACTIVE',
  'AG_EDITOR_ID',
  'AG_FLOAT_BOX_ID',
  'AG_FLOAT_BOX',
  'AG_SHOW_FLOAT_BOX',
  'AG_FLOAT_ITEM', // LI element
  'AG_FLOAT_ITEM_ACTIVE',
  'AG_FLOAT_ITEM_ICON', // icon wrapper in li
  'AG_EMOJI_MARKED_TEXT',
  'AG_CODE_BLOCK',
  'AG_HTML_BLOCK',
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
  'AG_EMOJI_MARKER',
  'AG_NOTEXT_LINK',
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
  'AG_MATH_MARKER',
  'AG_LOOSE_LIST_ITEM',
  'AG_TIGHT_LIST_ITEM'
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

export const CURSOR_DNA = getIdWithoutSet()

export const turndownConfig = {
  headingStyle: 'atx',
  bulletListMarker: '*',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**'
}

export const TABLE_TOOLS = [{
  label: 'table',
  icon: 'icon-table'
}, {
  label: 'left',
  icon: 'icon-alignleft'
}, {
  label: 'center',
  icon: 'icon-aligncenter'
}, {
  label: 'right',
  icon: 'icon-alignright'
}, {
  label: 'delete',
  icon: 'icon-del'
}]

export const HTML_TOOLS = [{
  label: 'delete',
  icon: 'icon-del'
}]
