const LINE_BREAKS_REG = /\n/
const FUNCTION_TYPE_LANG = {
  'multiplemath': 'latex',
  'flowchart': 'yaml',
  'mermaid': 'yaml',
  'sequence': 'yaml',
  'vega-lite': 'yaml'
}

const containerCtrl = ContentState => {
  ContentState.prototype.createContainerBlock = function (functionType, value = '') {
    const figureBlock = this.createBlock('figure')
    figureBlock.functionType = functionType
    const { preBlock, preview } = this.createPreAndPreview(functionType, value)
    this.appendChild(figureBlock, preBlock)
    this.appendChild(figureBlock, preview)
    this.codeBlocks.set(preBlock.key, value)
    return figureBlock
  }

  ContentState.prototype.createPreAndPreview = function (functionType, value = '') {
    const preBlock = this.createBlock('pre')
    const codeBlock = this.createBlock('code')
    preBlock.functionType = functionType
    preBlock.lang = codeBlock.lang = FUNCTION_TYPE_LANG[functionType]
    this.appendChild(preBlock, codeBlock)

    if (typeof value === 'string' && value) {
      value.replace(/^\s+/, '').split(LINE_BREAKS_REG).forEach(line => {
        const codeLine = this.createBlock('span', line)
        codeLine.functionType = 'codeLine'
        codeLine.lang = FUNCTION_TYPE_LANG[functionType]
        this.appendChild(codeBlock, codeLine)
      })
    } else {
      const emptyLine = this.createBlock('span')
      emptyLine.functionType = 'codeLine'
      emptyLine.lang = FUNCTION_TYPE_LANG[functionType]
      this.appendChild(codeBlock, emptyLine)
    }

    const preview = this.createBlock('div', '', false)
    this.codeBlocks.set(preBlock.key, '')
    preview.functionType = functionType

    return { preBlock, preview }
  }

  ContentState.prototype.initContainerBlock = function (functionType, block) { // p block
    block.type = 'figure'
    block.functionType = functionType
    block.children = []

    const { preBlock, preview } = this.createPreAndPreview(functionType)

    this.appendChild(block, preBlock)
    this.appendChild(block, preview)
    return preBlock.children[0].children[0]
  }

  ContentState.prototype.handleContainerBlockClick = function (figure) {
    const { id } = figure
    const mathBlock = this.getBlock(id)
    const preBlock = mathBlock.children[0]
    const firstLine = preBlock.children[0].children[0]

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
    const functionType = 'multiplemath'
    return text.trim() === '$$' ? this.initContainerBlock(functionType, block) : false
  }
}

export default containerCtrl
