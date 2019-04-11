/**
 * translate markdown format to content state used by Mark Text
 * there is some difference when parse loose list item and tight lsit item.
 * Both of them add a p block in li block, use the CSS style to distinguish loose and tight.
 */
import { Lexer } from '../parser/marked'
import ExportMarkdown from './exportMarkdown'
import TurndownService, { usePluginAddRules } from './turndownService'
import { loadLanguage } from '../prism/index'

// To be disabled rules when parse markdown, Because content state don't need to parse inline rules
import { CURSOR_DNA } from '../config'

const LINE_BREAKS_REG = /\n/

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
    const tokens = new Lexer({ disableInline: true }).lex(markdown)
    let token
    let block
    let value
    let parentList = [ rootState ]

    while ((token = tokens.shift())) {
      switch (token.type) {
        case 'frontmatter': {
          value = token.text
          block = this.createBlock('pre')
          const codeBlock = this.createBlock('code')
          value
            .replace(/^\s+/, '')
            .replace(/\s$/, '')
            .split(LINE_BREAKS_REG).forEach(line => {
              const codeLine = this.createBlock('span', line)
              codeLine.functionType = 'codeLine'
              codeLine.lang = 'yaml'
              this.appendChild(codeBlock, codeLine)
            })

          block.functionType = token.type
          block.lang = codeBlock.lang = 'yaml'
          this.codeBlocks.set(block.key, value)
          this.appendChild(block, codeBlock)
          this.appendChild(parentList[0], block)
          break
        }
        case 'hr': {
          value = '---'
          block = this.createBlock('hr', value)
          this.appendChild(parentList[0], block)
          break
        }
        case 'heading': {
          const { headingStyle, depth, text, marker } = token
          value = headingStyle === 'atx' ? '#'.repeat(+depth) + ` ${text}` : text
          block = this.createBlock(`h${depth}`, value)
          block.headingStyle = headingStyle
          if (marker) {
            block.marker = marker
          }

          this.appendChild(parentList[0], block)
          break
        }
        case 'multiplemath': {
          value = token.text
          block = this.createContainerBlock(token.type, value)
          this.appendChild(parentList[0], block)
          break
        }
        case 'code': {
          const { codeBlockStyle, text, lang: infostring = '' } = token

          // GH#697, markedjs#1387
          const lang = (infostring || '').match(/\S*/)[0]

          value = text
          if (value.endsWith('\n')) {
            value = value.replace(/\n+$/, '')
          }
          if (/mermaid|flowchart|vega-lite|sequence/.test(lang)) {
            block = this.createContainerBlock(lang, value)
            this.appendChild(parentList[0], block)
          } else {
            block = this.createBlock('pre')
            const codeBlock = this.createBlock('code')
            value.split(LINE_BREAKS_REG).forEach(line => {
              const codeLine = this.createBlock('span', line)
              codeLine.lang = lang
              codeLine.functionType = 'codeLine'
              this.appendChild(codeBlock, codeLine)
            })
            const inputBlock = this.createBlock('span', lang)
            if (lang) {
              loadLanguage(lang)
                .then(infoList => {
                  if (!Array.isArray(infoList)) return
                  // There are three status `loaded`, `noexist` and `cached`.
                  // if the status is `loaded`, indicated that it's a new loaded language
                  const needRender = infoList.some(({ status }) => status === 'loaded')
                  if (needRender) {
                    this.render()
                  }
                })
                .catch(err => {
                  // if no parameter provided, will cause error.
                  console.warn(err)
                })
            }
            inputBlock.functionType = 'languageInput'
            this.codeBlocks.set(block.key, value)
            block.functionType = codeBlockStyle === 'fenced' ? 'fencecode' : 'indentcode'
            block.lang = codeBlock.lang = lang
            this.appendChild(block, inputBlock)
            this.appendChild(block, codeBlock)
            this.appendChild(parentList[0], block)
          }
          break
        }
        case 'table': {
          const { header, align, cells } = token
          const table = this.createBlock('table')
          const thead = this.createBlock('thead')
          const tbody = this.createBlock('tbody')
          const theadRow = this.createBlock('tr')
          const restoreTableEscapeCharacters = text => {
            // NOTE: markedjs replaces all escaped "|" ("\|") characters inside a cell with "|".
            //       We have to re-escape the chraracter to not break the table.
            return text.replace(/\|/g, '\\|')
          }
          for (const headText of header) {
            const i = header.indexOf(headText)
            const th = this.createBlock('th', restoreTableEscapeCharacters(headText))
            Object.assign(th, { align: align[i] || '', column: i })
            this.appendChild(theadRow, th)
          }
          for (const row of cells) {
            const rowBlock = this.createBlock('tr')
            for (const cell of row) {
              const i = row.indexOf(cell)
              const td = this.createBlock('td', restoreTableEscapeCharacters(cell))
              Object.assign(td, { align: align[i] || '', column: i })
              this.appendChild(rowBlock, td)
            }
            this.appendChild(tbody, rowBlock)
          }
          Object.assign(table, { row: cells.length, column: header.length - 1 }) // set row and column
          block = this.createBlock('figure')
          block.functionType = 'table'
          this.appendChild(thead, theadRow)
          this.appendChild(block, table)
          this.appendChild(table, thead)
          this.appendChild(table, tbody)
          this.appendChild(parentList[0], block)
          break
        }
        case 'html': {
          const { text } = token
          block = this.createHtmlBlock(text.trim())
          this.appendChild(parentList[0], block)
          break
        }
        case 'text':
        case 'paragraph': {
          value = token.text
          block = this.createBlock('p')
          const lines = value.split(LINE_BREAKS_REG).map(line => this.createBlock('span', line))
          for (const line of lines) {
            this.appendChild(block, line)
          }
          this.appendChild(parentList[0], block)
          break
        }
        case 'blockquote_start': {
          block = this.createBlock('blockquote')
          this.appendChild(parentList[0], block)
          parentList.unshift(block)
          break
        }
        case 'blockquote_end': {
          parentList.shift()
          break
        }
        case 'list_start': {
          const { ordered, listType, start } = token
          block = this.createBlock(ordered === true ? 'ol' : 'ul')
          block.listType = listType
          if (listType === 'order') {
            block.start = /^\d+$/.test(start) ? start : 1
          }
          this.appendChild(parentList[0], block)
          parentList.unshift(block)
          break
        }
        case 'list_end': {
          parentList.shift()
          break
        }
        case 'loose_item_start':
        case 'list_item_start': {
          const { listItemType, bulletMarkerOrDelimiter, checked, type } = token
          block = this.createBlock('li')
          block.listItemType = checked !== undefined ? 'task' : listItemType
          block.bulletMarkerOrDelimiter = bulletMarkerOrDelimiter
          block.isLooseListItem = type === 'loose_item_start'
          if (checked !== undefined) {
            const input = this.createBlock('input')
            input.checked = checked
            this.appendChild(block, input)
          }
          this.appendChild(parentList[0], block)
          parentList.unshift(block)
          break
        }
        case 'list_item_end': {
          parentList.shift()
          break
        }
        case 'space': {
          break
        }
        default:
          console.warn(`Unknown type ${token.type}`)
          break
      }
    }

    return rootState.children.length ? rootState.children : [this.createBlockP()]
  }

  ContentState.prototype.htmlToMarkdown = function (html) {
    // turn html to markdown
    const { turndownConfig } = this
    const turndownService = new TurndownService(turndownConfig)
    usePluginAddRules(turndownService)
    // remove double `\\` in Math but I dont know why there are two '\' when paste. @jocs
    // fix #752, but I don't know why the &nbsp; vanlished.
    html = html.replace(/&nbsp;/g, ' ')
    const markdown = turndownService.turndown(html) // .replace(/(\\)\\/g, '$1')
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
    const listIndentation = this.listIndentation
    const markdown = new ExportMarkdown(blocks, listIndentation).generate()
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
              if (type === 'span' && functionType === 'codeLine') {
                const preBlock = this.getParent(this.getParent(block))
                const code = this.codeBlocks.get(preBlock.key)
                if (!code) return
                const offset = code.indexOf(CURSOR_DNA)
                if (offset > -1) {
                  const newCode = code.substring(0, offset) + code.substring(offset + CURSOR_DNA.length)
                  this.codeBlocks.set(preBlock.key, newCode)
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
    this.codeBlocks = new Map()
    this.blocks = this.markdownToState(markdown)
  }
}

export default importRegister
