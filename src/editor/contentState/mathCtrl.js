// import { CLASS_OR_ID } from '../config'
const LINE_BREAKS_REG = /\n/

const mathCtrl = ContentState => {
  ContentState.prototype.createMathBlock = function (value = '') {
    const FUNCTION_TYPE = 'multiplemath'
    const mathBlock = this.createBlock('figure')
    const textArea = this.createBlock('pre')
    const mathPreview = this.createBlock('div', '', false)
    if (typeof value === 'string' && value) {
      const lines = value.replace(/^\s+/, '').split(LINE_BREAKS_REG).map(line => this.createBlock('span', line))
      for (const line of lines) {
        line.functionType = FUNCTION_TYPE
        this.appendChild(textArea, line)
      }
    } else {
      const emptyLine = this.createBlock('span')
      emptyLine.functionType = FUNCTION_TYPE
      this.appendChild(textArea, emptyLine)
    }

    mathBlock.functionType = textArea.functionType = mathPreview.functionType = FUNCTION_TYPE
    mathPreview.math = value
    this.appendChild(mathBlock, textArea)
    this.appendChild(mathBlock, mathPreview)
    return mathBlock
  }

  ContentState.prototype.initMathBlock = function (block) { // p block
    const FUNCTION_TYPE = 'multiplemath'
    const textArea = this.createBlock('pre')
    const emptyLine = this.createBlock('span')
    textArea.functionType = emptyLine.functionType = FUNCTION_TYPE
    this.appendChild(textArea, emptyLine)
    block.type = 'figure'
    block.functionType = FUNCTION_TYPE
    block.children = []

    const mathPreview = this.createBlock('div', '', false)
    mathPreview.math = ''
    mathPreview.functionType = FUNCTION_TYPE

    this.appendChild(block, textArea)
    this.appendChild(block, mathPreview)
    return emptyLine
  }

  ContentState.prototype.handleMathBlockClick = function (mathFigure) {
    const { id } = mathFigure
    const mathBlock = this.getBlock(id)
    const textAreaBlock = mathBlock.children[0]
    const firstLine = textAreaBlock.children[0]
    const { key } = firstLine
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
  }

  ContentState.prototype.updateMathBlock = function (block) {
    const { type } = block
    if (type !== 'p') return false
    const { text } = block.children[0]
    return text.trim() === '$$' ? this.initMathBlock(block) : false
  }
}

export default mathCtrl
