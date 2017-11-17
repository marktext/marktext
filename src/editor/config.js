// helps functions
const generateKeyHash = keys => {
  return keys.reduce((acc, key) => {
    return Object.assign(acc, { [key]: key })
  }, {})
}

/**
 * configs
 */
export const paragraphClassName = 'aganippe-paragraph'

export const activeClassName = 'aganippe-active'

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

export const EDITOR_ATTR_NAME = 'aganippe-editor-element'

export const EDITOR_ID = 'write'

export const FLOAT_BOX_ID = 'ag-float-emoji-box'

export const FLOAT_BOX_CLASSNAME = 'ag-float-emoji-box'

export const SHOW_EMOJI_BOX = 'ag-float-emoji-box-show'

export const EMOJI_ITEM = 'ag-emoji-item'

export const EMOJI_ITEM_ACTIVE = 'ag-emoji-active'

export const EMOJI_ICON = 'ag-emoji-item-icon'

export const INLINE_EMOJI = 'ag-inline-emoji'

export const EMOJI_MARKED_TEXT = 'ag-emoji-marked-text'

// export const markedSymbol = ['*', '-', '_', '!', '[', ']']
