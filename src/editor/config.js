import { generateKeyHash, genUpper2LowerKeyHash } from './utils'

/**
 * configs
 */

export const blockContainerElementNames = [
  // elements our editor generates
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'li', 'ol',
  // all other known block elements
  'address', 'article', 'aside', 'audio', 'canvas', 'dd', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'header', 'hgroup', 'main', 'nav',
  'noscript', 'output', 'section', 'video',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
]

export const emptyElementNames = ['br', 'col', 'colgroup', 'hr', 'img', 'input', 'source', 'wbr']

export const EVENT_KEYS = generateKeyHash([
  'Enter',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight'
])

export const LOWERCASE_TAGS = generateKeyHash([
  ...blockContainerElementNames, ...emptyElementNames, 'div'
])
/**
 * ALL classname, id, attributes need has a `AG_` prefix,
 * element id will has a `_ID` postfix,
 * attribute will has a `_ATTR` postfix.
 * classname has no postfix.
 */
export const CLASS_OR_ID = genUpper2LowerKeyHash([
  'AG_PARAGRAPH', // => 'ag-paragraph'
  'AG_ACTIVE',
  'AG_EDITOR_ATTR',
  'AG_EDITOR_ID',
  'AG_EMOJI_BOX_ID',
  'AG_EMOJI_BOX',
  'AG_SHOW_EMOJI_BOX',
  'AG_EMOJI_ITEM', // LI element
  'AG_EMOJI_ITEM_ACTIVE',
  'AG_EMOJI_ITEM_ICON', // icon wrapper in li
  'AG_EMOJI_MARKED_TEXT'
])

export const paragraphClassName = 'aganippe-paragraph'
export const activeClassName = 'aganippe-active'
export const EDITOR_ATTR_NAME = 'aganippe-editor-element'
export const EDITOR_ID = 'write'
export const FLOAT_BOX_ID = 'ag-float-emoji-box'
export const FLOAT_BOX_CLASSNAME = 'ag-float-emoji-box'
export const SHOW_EMOJI_BOX = 'ag-float-emoji-box-show'
export const EMOJI_ITEM = 'ag-emoji-item'
export const EMOJI_ITEM_ACTIVE = 'ag-emoji-active'
export const EMOJI_ICON = 'ag-emoji-item-icon'
export const EMOJI_MARKED_TEXT = 'ag-emoji-marked-text'

// export const markedSymbol = ['*', '-', '_', '!', '[', ']']
