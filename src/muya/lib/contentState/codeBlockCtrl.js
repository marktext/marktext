import { loadLanguage } from '../prism/index'

const CODE_UPDATE_REP = /^`{3,}(.*)/

const codeBlockCtrl = ContentState => {
  ContentState.prototype.selectLanguage = function (paragraph, name) {
    const block = this.getBlock(paragraph.id)
    loadLanguage(name)
    if (block.functionType === 'languageInput') {
      block.text = name
      const preBlock = this.getParent(block)
      const nextSibling = this.getNextSibling(block)
      preBlock.lang = name
      preBlock.functionType = 'fencecode'
      nextSibling.lang = name
      nextSibling.children.forEach(c => (c.lang = name))
      const { key } = nextSibling.children[0]
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    } else {
      block.text = block.text.replace(/^(`+)([^`]+$)/g, `$1${name}`)
      this.codeBlockUpdate(block)
    }
    this.partialRender()
  }

  /**
   * [codeBlockUpdate if block updated to `pre` return true, else return false]
   */
  ContentState.prototype.codeBlockUpdate = function (block, code = '', lang) {
    if (block.type === 'span') {
      block = this.getParent(block)
    }
    // if it's not a p block, no need to update
    if (block.type !== 'p') return false
    // if p block's children are more than one, no need to update
    if (block.children.length !== 1) return false
    const { text } = block.children[0]
    const match = CODE_UPDATE_REP.exec(text)
    if (match || lang) {
      const codeBlock = this.createBlock('code')
      const firstLine = this.createBlock('span', code)
      const language = lang || (match ? match[1] : '')
      const inputBlock = this.createBlock('span', language)
      loadLanguage(language)
      inputBlock.functionType = 'languageInput'
      block.type = 'pre'
      block.functionType = 'fencecode'
      block.lang = language
      block.text = ''
      block.history = null
      block.children = []
      codeBlock.lang = language
      firstLine.lang = language
      firstLine.functionType = 'codeLine'
      this.appendChild(codeBlock, firstLine)
      this.appendChild(block, inputBlock)
      this.appendChild(block, codeBlock)
      const { key } = firstLine
      const offset = code.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return true
    }
    return false
  }
}

export default codeBlockCtrl
