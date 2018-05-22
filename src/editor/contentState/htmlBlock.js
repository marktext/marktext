import createDOMPurify from 'dompurify'
import { escapeInBlockHtml } from '../utils'
import { VOID_HTML_TAGS, HTML_TAGS, HTML_TOOLS, DOMPURIFY_CONFIG } from '../config'

const HTML_BLOCK_REG = /^<([a-zA-Z\d-]+)(?=\s|>)[^<>]*?>$/

const DOMPurify = createDOMPurify(window)

const htmlBlock = ContentState => {
  ContentState.prototype.createToolBar = function (tools, toolBarType) {
    const toolBar = this.createBlock('div')
    toolBar.editable = false
    toolBar.toolBarType = toolBarType
    const ul = this.createBlock('ul')

    tools.forEach(tool => {
      const toolBlock = this.createBlock('li')
      const svgBlock = this.createBlock('svg')
      svgBlock.icon = tool.icon
      toolBlock.label = tool.label
      this.appendChild(toolBlock, svgBlock)
      this.appendChild(ul, toolBlock)
    })
    this.appendChild(toolBar, ul)
    return toolBar
  }

  ContentState.prototype.createCodeInHtml = function (code, selection) {
    const codeContainer = this.createBlock('div')
    codeContainer.functionType = 'html'
    const preview = this.createBlock('div')
    preview.editable = false
    preview.htmlContent = DOMPurify.sanitize(escapeInBlockHtml(code), DOMPURIFY_CONFIG)
    preview.functionType = 'preview'
    const codePre = this.createBlock('pre')
    codePre.lang = 'html'
    codePre.functionType = 'html'
    codePre.text = code
    if (selection) {
      codePre.selection = selection
    }
    this.appendChild(codeContainer, codePre)
    this.appendChild(codeContainer, preview)
    return codeContainer
  }

  ContentState.prototype.htmlToolBarClick = function (type) {
    const { start: { key } } = this.cursor
    const block = this.getBlock(key)
    const codeBlockContainer = this.getParent(block)
    const htmlBlock = this.getParent(codeBlockContainer)

    switch (type) {
      case 'delete':
        htmlBlock.type = 'p'
        htmlBlock.text = ''
        htmlBlock.children = []
        const emptyLine = this.createBlock('span')
        this.appendChild(htmlBlock, emptyLine)
        const key = emptyLine.key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.partialRender()
        break
    }
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
    block.text = code
    const toolBar = this.createToolBar(HTML_TOOLS, 'html')
    const htmlBlock = this.createCodeInHtml(code)
    this.appendChild(block, toolBar)
    this.appendChild(block, htmlBlock)
    return block
  }

  ContentState.prototype.initHtmlBlock = function (block, tagName) {
    const isVoidTag = VOID_HTML_TAGS.indexOf(tagName) > -1
    const { text } = block.children[0]
    const htmlContent = isVoidTag ? text : `${text}\n\n</${tagName}>`

    const pos = {
      line: isVoidTag ? 0 : 1,
      ch: isVoidTag ? text.length : 0
    }
    const range = {
      anchor: pos,
      head: pos
    }
    block.type = 'figure'
    block.functionType = 'html'
    block.text = htmlContent
    block.children = []
    const toolBar = this.createToolBar(HTML_TOOLS, 'html')
    const codeContainer = this.createCodeInHtml(htmlContent, range)
    this.appendChild(block, toolBar)
    this.appendChild(block, codeContainer)
    return codeContainer.children[0]
  }

  ContentState.prototype.updateHtmlBlock = function (block) {
    const { type } = block
    if (type !== 'li' && type !== 'p') return false
    const { text } = block.children[0]
    const match = HTML_BLOCK_REG.exec(text)
    const tagName = match && match[1] && HTML_TAGS.find(t => t === match[1])
    return VOID_HTML_TAGS.indexOf(tagName) === -1 && tagName ? this.initHtmlBlock(block, tagName) : false
  }
}

export default htmlBlock
