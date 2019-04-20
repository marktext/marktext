import { VOID_HTML_TAGS, HTML_TAGS } from '../config'
import { inlineRules } from '../parser/rules'

const HTML_BLOCK_REG = /^<([a-zA-Z\d-]+)(?=\s|>)[^<>]*?>$/
const LINE_BREAKS = /\n/

const htmlBlock = ContentState => {
  ContentState.prototype.createCodeInHtml = function (code) {
    const codeContainer = this.createBlock('div')
    codeContainer.functionType = 'html'
    const preview = this.createBlock('div', '', false)
    preview.functionType = 'preview'
    const preBlock = this.createBlock('pre')
    const codeBlock = this.createBlock('code')
    code.split(LINE_BREAKS).forEach(line => {
      const codeLine = this.createBlock('span', line)
      codeLine.functionType = 'codeLine'
      codeLine.lang = 'markup'
      this.appendChild(codeBlock, codeLine)
    })
    this.codeBlocks.set(preBlock.key, code)
    preBlock.lang = 'markup'
    codeBlock.lang = 'markup'
    preBlock.functionType = 'html'
    this.codeBlocks.set(preBlock.key, code)
    this.appendChild(preBlock, codeBlock)
    this.appendChild(codeContainer, preBlock)
    this.appendChild(codeContainer, preview)
    return codeContainer
  }

  ContentState.prototype.handleHtmlBlockClick = function (codeWrapper) {
    const id = codeWrapper.id
    const codeBlock = this.getBlock(id).children[0]
    const key = codeBlock.key
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
  }

  ContentState.prototype.createHtmlBlock = function (code) {
    const block = this.createBlock('figure')
    block.functionType = 'html'
    const htmlBlock = this.createCodeInHtml(code)
    this.appendChild(block, htmlBlock)
    return block
  }

  ContentState.prototype.initHtmlBlock = function (block) {
    let htmlContent = ''
    const text = block.type === 'p'
    ? block.children.map((child => {
        return child.text
      })).join('\n').trim()
    : block.text

    const matches = inlineRules.html_tag.exec(text)
    if (matches) {
      const tag = matches[3]
      const content = matches[4] || ''
      const openTag = matches[2]
      const closeTag = matches[5]
      const isVoidTag = VOID_HTML_TAGS.indexOf(tag) > -1
      if (closeTag) {
        htmlContent = text
      } else if (isVoidTag) {
        htmlContent = text
        if (content) {
          // TODO: @jocs notice user that the html is not valid.
          console.warn('Invalid html content.')
        }
      } else {
        htmlContent = `${openTag}\n${content}\n</${tag}>`
      }
    } else {
      htmlContent = `<div>\n${text}\n</div>`
    }

    block.type = 'figure'
    block.functionType = 'html'
    block.text = htmlContent
    block.children = []
    const codeContainer = this.createCodeInHtml(htmlContent)
    this.appendChild(block, codeContainer)
    return codeContainer.children[0] // preBlock
  }

  ContentState.prototype.updateHtmlBlock = function (block) {
    const { type } = block
    if (type !== 'li' && type !== 'p') return false
    const { text } = block.children[0]
    const match = HTML_BLOCK_REG.exec(text)
    const tagName = match && match[1] && HTML_TAGS.find(t => t === match[1])
    return VOID_HTML_TAGS.indexOf(tagName) === -1 && tagName ? this.initHtmlBlock(block) : false
  }
}

export default htmlBlock
