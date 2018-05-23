// import { CLASS_OR_ID } from '../config'
const mathCtrl = ContentState => {
  ContentState.prototype.initMathBlock = function (block) { // p block
    // const textArea = this.createBlock('pre')
    // const emptyLine = this.createBlock('span')
    // this.appendChild(textArea, emptyLine)
  }

  ContentState.prototype.updateMathBlock = function (block) {
    const { type } = block
    if (type !== 'p') return false
    const { text } = block.children[0]
    return text.trim() === '$$' ? this.initMathBlock(block) : false
  }
}

export default mathCtrl
