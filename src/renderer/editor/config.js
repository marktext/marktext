import {
  getUniqueId
} from './utils.js'

const getNewParagraph = set => {
  return {
    parentType: null,
    id: getUniqueId(set),
    active: true, // boolean, 一个 viewModel 只可能有一个 blockType 为 true
    markedText: ' ',
    // h1~6/ p / ul / ol / tl: task list / blockCode / blockquote / hr /(p, blockCode, hr 不支持嵌套)
    paragraphType: 'p',
    cursorRange: [0, 0],
    sections: []
  }
}

const paragraphClassName = 'ag-1'

export {
  getNewParagraph,
  paragraphClassName
}
