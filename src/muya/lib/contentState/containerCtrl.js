const FUNCTION_TYPE_LANG = {
  multiplemath: 'latex',
  flowchart: 'yaml',
  mermaid: 'yaml',
  sequence: 'yaml',
  plantuml: 'yaml',
  'vega-lite': 'yaml',
  html: 'markup'
}

const containerCtrl = ContentState => {
  ContentState.prototype.createContainerBlock = function (functionType, value = '', style = undefined) {
    const figureBlock = this.createBlock('figure', {
      functionType
    })

    if (functionType === 'multiplemath') {
      if (style === undefined) {
        figureBlock.mathStyle = this.isGitlabCompatibilityEnabled ? 'gitlab' : ''
      }
      figureBlock.mathStyle = style
    }

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

  ContentState.prototype.initContainerBlock = function (functionType, block, style = undefined) { // p block
    block.type = 'figure'
    block.functionType = functionType
    block.children = []

    if (functionType === 'multiplemath') {
      if (style === undefined) {
        block.mathStyle = this.isGitlabCompatibilityEnabled ? 'gitlab' : ''
      }
      block.mathStyle = style
    }

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
    const functionType = 'multiplemath'
    const { type } = block

    // TODO(GitLab): Allow "functionType" 'languageInput' to convert an existing
    //   code block into math block.
    if (type === 'span' && block.functionType === 'paragraphContent') {
      const isMathBlock = !!block.text.match(/^`{3,}math\s*/)
      if (isMathBlock) {
        const result = this.initContainerBlock(functionType, block, 'gitlab')
        if (result) {
          // Set cursor at the first line
          const { key } = result
          const offset = 0
          this.cursor = {
            start: { key, offset },
            end: { key, offset }
          }

          // Force render
          this.partialRender()
          return result
        }
      }
      return false
    } else if (type !== 'p') {
      return false
    }

    const { text } = block.children[0]
    return text.trim() === '$$' ? this.initContainerBlock(functionType, block, '') : false
  }
}

export default containerCtrl
