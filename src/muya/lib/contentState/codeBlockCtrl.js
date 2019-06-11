import { loadLanguage } from '../prism/index'
import selection from '../selection'

const CODE_UPDATE_REP = /^`{3,}(.*)/

const codeBlockCtrl = ContentState => {
  /**
  * check edit language
  */
  ContentState.prototype.checkEditLanguage = function () {
    const { start } = selection.getCursorRange()
    if (!start) {
      return { lang: '', paragraph: null }
    }
    const startBlock = this.getBlock(start.key)
    const paragraph = document.querySelector(`#${start.key}`)
    let lang = ''
    const { text } = startBlock
    if (startBlock.type === 'span') {
      if (startBlock.functionType === 'languageInput') {
        lang = text.trim()
      } else if (startBlock.functionType === 'paragraphContent') {
        const token = text.match(/(^`{3,})([^`]+)/)
        if (token) {
          const len = token[1].length
          if (start.offset >= len) {
            lang = token[2].trim()
          }
        }
      }
    }
    return { lang, paragraph }
  }

  ContentState.prototype.selectLanguage = function (paragraph, lang) {
    const block = this.getBlock(paragraph.id)
    this.updateCodeLanguage(block, lang)
  }

  /**
   * Update the code block language or creates a new code block.
   *
   * @param block Language-input block or paragraph
   * @param lang Language identifier
   */
  ContentState.prototype.updateCodeLanguage = function (block, lang) {
    loadLanguage(lang)
    if (block.functionType === 'languageInput') {
      const preBlock = this.getParent(block)
      const nextSibling = this.getNextSibling(block)

      // Only update code language if necessary
      if (block.text !== lang || preBlock.text !== lang || nextSibling.text !== lang) {
        block.text = lang
        preBlock.lang = lang
        preBlock.functionType = 'fencecode'
        nextSibling.lang = lang
        nextSibling.children.forEach(c => (c.lang = lang))
      }

      // Set cursor at the first line
      const { key } = nextSibling.children[0]
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    } else {
      block.text = block.text.replace(/^(`+)([^`]+$)/g, `$1${lang}`)
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
      const firstLine = this.createBlock('span', { text: code })
      const language = lang || (match ? match[1] : '')
      const inputBlock = this.createBlock('span', { text: language })
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
