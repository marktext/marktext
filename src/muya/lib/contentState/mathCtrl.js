// import { CLASS_OR_ID } from '../config'
const LINE_BREAKS_REG = /\n/

const mathCtrl = ContentState => {
  ContentState.prototype.createMathBlock = function (value = '') {
    const FUNCTION_TYPE = 'multiplemath'
    const mathBlock = this.createBlock('figure')
    mathBlock.functionType = FUNCTION_TYPE
    const { preBlock, mathPreview } = this.createMathAndPreview(value)
    this.appendChild(mathBlock, preBlock)
    this.appendChild(mathBlock, mathPreview)
    this.codeBlocks.set(preBlock.key, value)
    return mathBlock
  }

  ContentState.prototype.createMathAndPreview = function (value = '') {
    const FUNCTION_TYPE = 'multiplemath'
    const preBlock = this.createBlock('pre')
    const codeBlock = this.createBlock('code')
    preBlock.functionType = FUNCTION_TYPE
    preBlock.lang = codeBlock.lang = 'latex'
    this.appendChild(preBlock, codeBlock)

    if (typeof value === 'string' && value) {
      value.replace(/^\s+/, '').split(LINE_BREAKS_REG).forEach(line => {
        const codeLine = this.createBlock('span', line)
        codeLine.functionType = 'codeLine'
        codeLine.lang = 'latex'
        this.appendChild(codeBlock, codeLine)
      })
    } else {
      const emptyLine = this.createBlock('span')
      emptyLine.functionType = 'codeLine'
      emptyLine.lang = 'latex'
      this.appendChild(codeBlock, emptyLine)
    }

    const mathPreview = this.createBlock('div', '', false)
    this.codeBlocks.set(preBlock.key, '')
    mathPreview.functionType = FUNCTION_TYPE

    return { preBlock, mathPreview }
  }

  ContentState.prototype.initMathBlock = function (block) { // p block
    const FUNCTION_TYPE = 'multiplemath'
    block.type = 'figure'
    block.functionType = FUNCTION_TYPE
    block.children = []

    const { preBlock, mathPreview } = this.createMathAndPreview()

    this.appendChild(block, preBlock)
    this.appendChild(block, mathPreview)
    return preBlock.children[0].children[0]
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
