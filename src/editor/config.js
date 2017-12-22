import { generateKeyHash, genUpper2LowerKeyHash } from './utils'

// export const markedSymbol = ['\\*', '\\-', '\\_', '\\!', '\\[', '\\]', '\\+',
//   '\\\\', '\\)', '\\(', '\\`', '\\{', '\\}', '\\#', '\\.']
/**
 * configs
 */
export const INLINE_RULES = ['autolink', 'backticks', 'emphasis', 'escape', 'image', 'link', 'strikethrough']

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
  'Backspace',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight'
])

export const LOWERCASE_TAGS = generateKeyHash([
  ...blockContainerElementNames, ...emptyElementNames, 'div'
])
/**
 * ALL className, id, attributes need has a `AG_` prefix,
 * element's id will has a `_ID` postfix,
 * attribute will has a `_ATTR` postfix.
 * className has no postfix.
 * example:
 *   genUpper2LowerKeyHash(['AG_GRAY'])
 *   => {
 *     'AG_GRAY': 'ag-gray'
 *   }
 */

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
  'AG_LANGUAGE',
  'AG_LANGUAGE_INPUT',
  'AG_TEMP',
  'AG_LINK_IN_BRACKET',
  'AG_BACKLASH',
  'AG_BUG', // for remove bug
  'AG_IMAGE_MARKED_TEXT',
  'AG_IMAGE_FAIL'
])

export const codeMirrorConfig = {
  autoCloseBrackets: true,
  autoCloseTags: true,
  autofocus: true,
  tabSize: 2,
  extraKeys: {
    'Cmd-Z': false,
    'Cmd-Y': false
  }
}
