import {
  getUniqueId
} from './utils.js'

export const getNewParagraph = set => {
  return {
    parentType: null,
    id: getUniqueId(set),
    active: true,
    markedText: '<br>',
    paragraphType: 'p',
    cursorRange: { right: 0, left: 0 },
    sections: []
  }
}

export const paragraphClassName = 'aganippe-paragraph'

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

export const markedSymbol = ['*', '-', '_', '!', '[', ']']
