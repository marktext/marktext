import {
  getUniqueId
} from './utils.js'

const getNewParagraph = set => {
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

const paragraphClassName = 'aganippe-paragraph'

const blockContainerElementNames = [
  // elements our editor generates
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'li', 'ol',
  // all other known block elements
  'address', 'article', 'aside', 'audio', 'canvas', 'dd', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'header', 'hgroup', 'main', 'nav',
  'noscript', 'output', 'section', 'video',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
]

const emptyElementNames = ['br', 'col', 'colgroup', 'hr', 'img', 'input', 'source', 'wbr']

const markedSymbol = ['*', '-', '_', '!', '[', ']']
// const vm = [
//   {
//     parentType: null,
//     id: 'ag-xxx',
//     active: true, // boolean, 一个 viewModel 只可能有一个 blockType 为 true
//     markedText: 'LUORAN**ransixi**',
//     paragraphType: 'ul',
//     // h1~6/ p / ul / ol / tl: task list / blockCode / blockquote / hr /(p, blockCode, hr 不支持嵌套)
//     cursorRange: [1, 2],
//     sections: [
//       {
//         id: 'ag-xer',
//         active: true,
//         parentType: 'ul',
//         paragraphType: 'p',
//         markedText: 'luoran**luoran**', // string not markdown
//         // active: true 才有光标
//         cursorRange: [1, 2] // 如果 cursorIndex[0] !== cursorIndex[1] 说明选择范围，如果相等，说明是光标位置。
//       }
//     ]
//   }
// ]
export {
  markedSymbol,
  getNewParagraph,
  paragraphClassName,
  emptyElementNames,
  blockContainerElementNames
}
