/**
 * translate markdown format to content state used by Mark Text
 * there is some difference when parse loose list item and tight lsit item.
 * Both of them add a p block in li block, use the CSS style to distinguish loose and tight.
 */
import parse5 from 'parse5'
import marked from '../parser/marked'
import ExportMarkdown from './exportMarkdown'
import TurndownService, { usePluginAddRules } from './turndownService'

// To be disabled rules when parse markdown, Because content state don't need to parse inline rules
import { CURSOR_DNA, TABLE_TOOLS, BLOCK_TYPE7 } from '../config'

const LINE_BREAKS_REG = /\n/

const checkIsHTML = value => {
  const trimedValue = value.trim()
  const match = /^<([a-zA-Z\d-]+)(?=\s|>).*>/.exec(trimedValue)
  if (match && match[1]) {
    const tag = match[1]
    if (BLOCK_TYPE7.indexOf(tag) > -1) {
      return /^<([a-zA-Z\d-]+)(?=\s|>).*>\n/.test(trimedValue)
    }
    return true
  }
  return false
}

const chopHTML = value => {
  return value.trim().split(/\n{2,}/)
}

const importRegister = ContentState => {
  // turn markdown to blocks
  ContentState.prototype.markdownToState = function (markdown) {
    // mock a root block...
    const rootState = {
      key: null,
      type: 'root',
      text: '',
      parent: null,
      preSibling: null,
      nextSibling: null,
      children: []
    }

    const htmlText = marked(markdown, { disableInline: true })
    const domAst = parse5.parseFragment(htmlText)
    // console.log(markdown)
    // console.log(htmlText)
    // console.log(domAst)
    const childNodes = domAst.childNodes

    const getLangAndType = node => {
      let lang = ''
      let codeBlockStyle = ''
      if (node.nodeName === 'code') {
        const classAttr = node.attrs.filter(attr => attr.name === 'class')[0]
        if (classAttr && classAttr.value) {
          const { value } = classAttr
          const token = /lang-([^\s]+)/.exec(value)
          codeBlockStyle = /fenced-code-block/.test(value) ? 'fenced' : 'indented'
          lang = token ? token[1] : ''
        }
      }
      return { lang, codeBlockStyle }
    }

    const getPreFunctionType = node => {
      let type = 'code'
      const classAttr = node.attrs.filter(attr => attr.name === 'class')[0]
      if (classAttr && classAttr.value) {
        const { value } = classAttr
        if (/front-matter/.test(value)) type = 'frontmatter'
        if (/multiple-math/.test(value)) type = 'multiplemath'
      }
      return type
    }

    const getRowColumnCount = childNodes => {
      const THEAD_ROW_COUNT = 1
      const tbodyNode = childNodes.find(child => child.nodeName === 'tbody')
      const row = tbodyNode.childNodes.filter(child => child.nodeName === 'tr').length + THEAD_ROW_COUNT - 1
      const column = tbodyNode.childNodes
        .find(child => child.nodeName === 'tr').childNodes
        .filter(td => td.nodeName === 'td')
        .length - 1
      return { row, column } // zero base
    }

    const travel = (parent, childNodes) => {
      for (const child of childNodes) {
        let block
        let value

        switch (child.nodeName) {
          case 'th':
          case 'td':
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            const textValue = child.childNodes.length ? child.childNodes[0].value : ''
            const match = /\d/.exec(child.nodeName)
            value = match ? '#'.repeat(+match[0]) + ` ${textValue}` : textValue
            block = this.createBlock(child.nodeName, value)
            // handle heading
            if (match) {
              const headingStyle = child.attrs.find(attr => attr.name === 'class').value
              if (typeof headingStyle === 'string' && /atx|setext/.test(headingStyle)) {
                block.headingStyle = headingStyle
              }
            }
            // handle `th` and `td`
            if (child.nodeName === 'th' || child.nodeName === 'td') {
              const column = childNodes.filter(child => /th|td/.test(child.nodeName)).indexOf(child)
              let align = ''
              const styleAttr = child.attrs.filter(attr => attr.name === 'style')
              if (styleAttr.length) {
                const styleValue = styleAttr[0].value
                if (/text-align/.test(styleValue)) {
                  align = styleValue.split(':')[1]
                }
              }
              Object.assign(block, { column, align })
            }
            this.appendChild(parent, block)
            break

          case 'p':
            value = child.childNodes.length ? child.childNodes[0].value : ''
            if (checkIsHTML(value)) {
              travel(parent, child.childNodes)
            } else {
              block = this.createBlock('p')
              travel(block, child.childNodes)
              this.appendChild(parent, block)
            }
            break

          case 'table':
            const toolBar = this.createToolBar(TABLE_TOOLS, 'table')
            const table = this.createBlock('table')
            Object.assign(table, getRowColumnCount(child.childNodes)) // set row and column
            block = this.createBlock('figure')
            block.functionType = 'table'
            this.appendChild(block, toolBar)
            this.appendChild(block, table)
            this.appendChild(parent, block)
            travel(table, child.childNodes)
            break

          case 'tr':
          case 'tbody':
          case 'thead':
            block = this.createBlock(child.nodeName)
            this.appendChild(parent, block)
            travel(block, child.childNodes)
            break

          case 'hr':
            const initValue = '---'
            block = this.createBlock(child.nodeName, initValue)
            this.appendChild(parent, block)
            break

          case 'input':
            const isTaskListItemCheckbox = child.attrs.some(attr => attr.name === 'class' && attr.value === 'task-list-item-checkbox')
            const checked = child.attrs.some(attr => attr.name === 'checked' && attr.value === '')

            if (isTaskListItemCheckbox) {
              parent.listItemType = 'task' // double check
              block = this.createBlock('input')
              block.checked = checked
              this.appendChild(parent, block)
            }
            break

          case 'li':
            const isTask = child.attrs.some(attr => attr.name === 'class' && attr.value.includes('task-list-item'))
            const isLoose = child.attrs.some(attr => attr.name === 'class' && attr.value.includes('loose-list-item'))

            block = this.createBlock('li')
            block.listItemType = parent.type === 'ul' ? (isTask ? 'task' : 'bullet') : 'order'
            block.isLooseListItem = isLoose

            if (/task|bullet/.test(block.listItemType)) {
              const bulletListItemMarker = child.attrs.find(attr => attr.name === 'data-marker').value
              if (bulletListItemMarker) block.bulletListItemMarker = bulletListItemMarker
            }

            this.appendChild(parent, block)
            travel(block, child.childNodes)

            // fix #441 #451: if a list/task item is empty no paragraph is generated.
            if (child.childNodes.length === 0 ||
              (isTask && child.childNodes.length <= 2 && this.isFirstChild(this.getLastChild(block)))) {
              const paragraph = this.createBlock('p')
              const innerParagraph = this.createBlock('span')
              this.appendChild(paragraph, innerParagraph)
              this.appendChild(block, paragraph)
            }
            break

          case 'ul':
            const isTaskList = child.attrs.some(attr => attr.name === 'class' && attr.value === 'task-list')
            block = this.createBlock('ul')
            block.listType = isTaskList ? 'task' : 'bullet'
            travel(block, child.childNodes)
            this.appendChild(parent, block)
            break

          case 'ol':
            block = this.createBlock('ol')
            block.listType = 'order'
            child.attrs.forEach(attr => {
              block[attr.name] = attr.value
            })
            if (!block.start) {
              block.start = 1
            }
            travel(block, child.childNodes)
            this.appendChild(parent, block)
            break

          case 'blockquote':
            block = this.createBlock('blockquote')
            travel(block, child.childNodes)
            this.appendChild(parent, block)
            break

          case 'pre':
            const functionType = getPreFunctionType(child)
            if (functionType === 'frontmatter') {
              value = child.childNodes[0].value
              block = this.createBlock('pre')
              const lines = value.replace(/^\s+/, '').split(LINE_BREAKS_REG).map(line => this.createBlock('span', line))
              for (const line of lines) {
                line.functionType = functionType
                this.appendChild(block, line)
              }
              block.functionType = functionType
            } else if (functionType === 'multiplemath') {
              value = child.childNodes[0].value
              block = this.createMathBlock(value)
            } else if (functionType === 'code') {
              const codeNode = child.childNodes[0]
              const { lang, codeBlockStyle } = getLangAndType(codeNode)
              value = codeNode.childNodes[0].value

              if (value.endsWith('\n')) {
                value = value.replace(/\n+$/, '')
              }
              block = this.createBlock('pre', value)
              block.functionType = 'code'
              Object.assign(block, { lang, codeBlockStyle })
            }
            this.appendChild(parent, block)
            break

          case 'script':
            const code = child.childNodes.length ? child.childNodes[0].value : ''
            const fullCode = `<script>${code}</script>`
            block = this.createHtmlBlock(fullCode)
            this.appendChild(parent, block)
            break

          case '#text':
            const { parentNode } = child
            value = child.value

            if (/\S/.test(value)) {
              if (checkIsHTML(value) && /^(#document-fragment|pre|p)$/.test(parentNode.nodeName)) {
                const fragments = chopHTML(value)
                fragments.forEach(fragment => {
                  if (checkIsHTML(fragment)) {
                    // is html block
                    block = this.createHtmlBlock(fragment)
                    this.appendChild(parent, block)
                  } else {
                    // not html block
                    block = this.createBlockP(fragment)
                    this.appendChild(parent, block)
                  }
                })
              } else if (parentNode.nodeName === 'li') {
                block = this.createBlock('p')
                // fix: #153
                const lines = value.replace(/^\s+/, '').split(LINE_BREAKS_REG).map(line => this.createBlock('span', line))
                for (const line of lines) {
                  this.appendChild(block, line)
                }
                this.appendChild(parent, block)
              } else if (parentNode.nodeName === 'p') {
                const lines = value.split(LINE_BREAKS_REG).map(line => this.createBlock('span', line))
                for (const line of lines) {
                  this.appendChild(parent, line)
                }
              }
            }
            break

          default:
            if (child.tagName) {
              throw new Error(`unHandle node type ${child.tagName}`)
            }
            break
        }
      }
    }

    travel(rootState, childNodes)
    return rootState.children.length ? rootState.children : [this.createBlockP()]
  }

  ContentState.prototype.htmlToMarkdown = function (html) {
    // turn html to markdown
    const { turndownConfig } = this
    const turndownService = new TurndownService(turndownConfig)
    usePluginAddRules(turndownService)
    // remove double `\\` in Math but I dont know why there are two '\' when paste. @jocs
    const markdown = turndownService.turndown(html).replace(/(\\)\\/g, '$1')
    return markdown
  }

  // turn html to blocks
  ContentState.prototype.html2State = function (html) {
    const markdown = this.htmlToMarkdown(html)
    return this.markdownToState(markdown)
  }

  ContentState.prototype.addCursorToMarkdown = function (markdown, cursor) {
    const { ch, line } = cursor
    const lines = markdown.split('\n')
    const rawText = lines[line]
    lines[line] = rawText.substring(0, ch) + CURSOR_DNA + rawText.substring(ch)
    return lines.join('\n')
  }

  ContentState.prototype.getCodeMirrorCursor = function () {
    const blocks = this.getBlocks()
    const { start: { key, offset } } = this.cursor
    const block = this.getBlock(key)
    const { text } = block
    block.text = text.substring(0, offset) + CURSOR_DNA + text.substring(offset)
    const markdown = new ExportMarkdown(blocks).generate()
    const cursor = markdown.split('\n').reduce((acc, line, index) => {
      const ch = line.indexOf(CURSOR_DNA)
      if (ch > -1) {
        Object.assign(acc, { line: index, ch })
      }
      return acc
    }, {
      line: 0,
      ch: 0
    })
    // remove CURSOR_DNA
    block.text = text
    return cursor
  }

  ContentState.prototype.importCursor = function (cursor) {
    // set cursor
    const travel = blocks => {
      for (const block of blocks) {
        const { key, text, children, editable, type, functionType } = block
        if (text) {
          const offset = text.indexOf(CURSOR_DNA)
          if (offset > -1) {
            block.text = text.substring(0, offset) + text.substring(offset + CURSOR_DNA.length)
            if (editable) {
              this.cursor = {
                start: { key, offset },
                end: { key, offset }
              }
              // handle cursor in Math block, need to remove `CURSOR_DNA` in preview block
              if (type === 'span' && functionType === 'multiplemath') {
                const mathPreview = this.getNextSibling(this.getParent(block))
                const { math } = mathPreview
                const offset = math.indexOf(CURSOR_DNA)
                if (offset > -1) {
                  mathPreview.math = math.substring(0, offset) + math.substring(offset + CURSOR_DNA.length)
                }
              }
              return
            }
          }
        } else if (children.length) {
          travel(children)
        }
      }
    }
    if (cursor) {
      travel(this.blocks)
    } else {
      const lastBlock = this.getLastBlock()
      const key = lastBlock.key
      const offset = lastBlock.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    }
  }

  ContentState.prototype.importMarkdown = function (markdown) {
    // empty the blocks and codeBlocks
    this.codeBlocks = new Map()
    this.blocks = this.markdownToState(markdown)
  }
}

export default importRegister
