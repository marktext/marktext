const FUNCTION_TYPE_LANG = {
  multiplemath: 'latex',
  flowchart: 'yaml',
  mermaid: 'yaml',
  sequence: 'yaml',
  'vega-lite': 'yaml',
  html: 'markup'
}

const containerCtrl = ContentState => {
  ContentState.prototype.createContainerBlock = function (functionType, value = '') {
    const figureBlock = this.createBlock('figure', {
      functionType
    })

    const { preBlock, preview } = this.createPreAndPreview(functionType, value)
    this.appendChild(figureBlock, preBlock)
    this.appendChild(figureBlock, preview)
    return figureBlock
  }

  ContentState.prototype.createPreAndPreview = function (functionType, value = '') {
    const lang = FUNCTION_TYPE_LANG[functionType]
    const preBlock = this.createBlock('pre', {
      functionType,
      lang
    })
    const codeBlock = this.createBlock('code', {
      lang
    })

    this.appendChild(preBlock, codeBlock)

    if (typeof value === 'string' && value) {
      value = value.replace(/^\s+/, '')
      const codeContent = this.createBlock('span', {
        text: value,
        lang,
        functionType: 'codeContent'
      })
      this.appendChild(codeBlock, codeContent)
    } else {
      const emptyCodeContent = this.createBlock('span', {
        functionType: 'codeContent',
        lang
      })

      this.appendChild(codeBlock, emptyCodeContent)
    }

    const preview = this.createBlock('div', {
      editable: false,
      functionType
    })

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

  ContentState.prototype.handleContainerBlockClick = function (figureEle) {
    const { id } = figureEle
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
