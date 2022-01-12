/**
 * translate markdown format to content state used by MarkText
 * there is some difference when parse loose list item and tight lsit item.
 * Both of them add a p block in li block, use the CSS style to distinguish loose and tight.
 */
import StateRender from '../parser/render'
import { tokenizer } from '../parser'
import { getImageInfo } from '../utils'
import { Lexer } from '../parser/marked'
import ExportMarkdown from './exportMarkdown'
import TurndownService, { usePluginAddRules } from './turndownService'
import { loadLanguage } from '../prism/index'

// To be disabled rules when parse markdown, Because content state don't need to parse inline rules
import { CURSOR_ANCHOR_DNA, CURSOR_FOCUS_DNA } from '../config'

const languageLoaded = new Set()

// Just because turndown change `\n`(soft line break) to space, So we add `span.ag-soft-line-break` to workaround.
const turnSoftBreakToSpan = html => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<x-mt id="turn-root">${html}</x-mt>`,
    'text/html'
  )
  const root = doc.querySelector('#turn-root')
  const travel = childNodes => {
    for (const node of childNodes) {
      if (node.nodeType === 3 && node.parentNode.tagName !== 'CODE') {
        let startLen = 0
        let endLen = 0
        const text = node.nodeValue.replace(/^(\n+)/, (_, p) => {
          startLen = p.length
          return ''
        }).replace(/(\n+)$/, (_, p) => {
          endLen = p.length
          return ''
        })
        if (/\n/.test(text)) {
          const tokens = text.split('\n')
          const params = []
          let i = 0
          const len = tokens.length
          for (; i < len; i++) {
            let text = tokens[i]
            if (i === 0 && startLen !== 0) {
              text = '\n'.repeat(startLen) + text
            } else if (i === len - 1 && endLen !== 0) {
              text = text + '\n'.repeat(endLen)
            }
            params.push(document.createTextNode(text))
            if (i !== len - 1) {
              const softBreak = document.createElement('span')
              softBreak.classList.add('ag-soft-line-break')
              params.push(softBreak)
            }
          }
          node.replaceWith(...params)
        }
      } else if (node.nodeType === 1) {
        travel(node.childNodes)
      }
    }
  }
  travel(root.childNodes)
  return root.innerHTML.trim()
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
    const {
      footnote,
      isGitlabCompatibilityEnabled,
      superSubScript,
      trimUnnecessaryCodeBlockEmptyLines
    } = this.muya.options

    const tokens = new Lexer({
      disableInline: true,
      footnote,
      isGitlabCompatibilityEnabled,
      superSubScript
    }).lex(markdown)

    let token
    let block
    let value
    const parentList = [rootState]

    while ((token = tokens.shift())) {
      switch (token.type) {
        case 'frontmatter': {
          const { lang, style } = token
          value = token.text
            .replace(/^\s+/, '')
            .replace(/\s$/, '')
          block = this.createBlock('pre', {
            functionType: token.type,
            lang,
            style
          })

          const codeBlock = this.createBlock('code', {
            lang
          })

          const codeContent = this.createBlock('span', {
            text: value,
            lang,
            functionType: 'codeContent'
          })

          this.appendChild(codeBlock, codeContent)
          this.appendChild(block, codeBlock)
          this.appendChild(parentList[0], block)
          break
        }

        case 'hr': {
          value = token.marker
          block = this.createBlock('hr')
          const thematicBreakContent = this.createBlock('span', {
            text: value,
            functionType: 'thematicBreakLine'
          })
          this.appendChild(block, thematicBreakContent)
          this.appendChild(parentList[0], block)
          break
        }

        case 'heading': {
          const { headingStyle, depth, text, marker } = token
          value = headingStyle === 'atx' ? '#'.repeat(+depth) + ` ${text}` : text
          block = this.createBlock(`h${depth}`, {
            headingStyle
          })

          const headingContent = this.createBlock('span', {
            text: value,
            functionType: headingStyle === 'atx' ? 'atxLine' : 'paragraphContent'
          })

          this.appendChild(block, headingContent)

          if (marker) {
            block.marker = marker
          }

          this.appendChild(parentList[0], block)
          break
        }

        case 'multiplemath': {
          value = token.text
          block = this.createContainerBlock(token.type, value, token.mathStyle)
          this.appendChild(parentList[0], block)
          break
        }

        case 'code': {
          const { codeBlockStyle, text, lang: infostring = '' } = token

          // GH#697, markedjs#1387
          const lang = (infostring || '').match(/\S*/)[0]

          value = text
          // Fix: #1265.
          if (trimUnnecessaryCodeBlockEmptyLines && (value.endsWith('\n') || value.startsWith('\n'))) {
            value = value.replace(/\n+$/, '')
              .replace(/^\n+/, '')
          }
          if (/mermaid|flowchart|vega-lite|sequence|plantuml/.test(lang)) {
            block = this.createContainerBlock(lang, value)
            this.appendChild(parentList[0], block)
          } else {
            block = this.createBlock('pre', {
              functionType: codeBlockStyle === 'fenced' ? 'fencecode' : 'indentcode',
              lang
            })
            const codeBlock = this.createBlock('code', {
              lang
            })
            const codeContent = this.createBlock('span', {
              text: value,
              lang,
              functionType: 'codeContent'
            })
            const inputBlock = this.createBlock('span', {
              text: lang,
              functionType: 'languageInput'
            })
            if (lang && !languageLoaded.has(lang)) {
              languageLoaded.add(lang)
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

            this.appendChild(codeBlock, codeContent)
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
          let i
          let j
          const headerLen = header.length
          for (i = 0; i < headerLen; i++) {
            const headText = header[i]
            const th = this.createBlock('th', {
              align: align[i] || '',
              column: i
            })
            const cellContent = this.createBlock('span', {
              text: restoreTableEscapeCharacters(headText),
              functionType: 'cellContent'
            })
            this.appendChild(th, cellContent)
            this.appendChild(theadRow, th)
          }
          const rowLen = cells.length
          for (i = 0; i < rowLen; i++) {
            const rowBlock = this.createBlock('tr')
            const rowContents = cells[i]
            const colLen = rowContents.length
            for (j = 0; j < colLen; j++) {
              const cell = rowContents[j]
              const td = this.createBlock('td', {
                align: align[j] || '',
                column: j
              })
              const cellContent = this.createBlock('span', {
                text: restoreTableEscapeCharacters(cell),
                functionType: 'cellContent'
              })

              this.appendChild(td, cellContent)
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
          if (tbody.children.length) {
            this.appendChild(table, tbody)
          }
          this.appendChild(parentList[0], block)
          break
        }

        case 'html': {
          const text = token.text.trim()
          // TODO: Treat html block which only contains one img as paragraph, we maybe add image block in the future.
          const isSingleImage = /^<img[^<>]+>$/.test(text)
          if (isSingleImage) {
            block = this.createBlock('p')
            const contentBlock = this.createBlock('span', {
              text
            })
            this.appendChild(block, contentBlock)
            this.appendChild(parentList[0], block)
          } else {
            block = this.createHtmlBlock(text)
            this.appendChild(parentList[0], block)
          }
          break
        }

        case 'text': {
          value = token.text
          while (tokens[0].type === 'text') {
            token = tokens.shift()
            value += `\n${token.text}`
          }
          block = this.createBlock('p')
          const contentBlock = this.createBlock('span', {
            text: value
          })
          this.appendChild(block, contentBlock)
          this.appendChild(parentList[0], block)
          break
        }

        case 'toc':
        case 'paragraph': {
          value = token.text
          block = this.createBlock('p')
          const contentBlock = this.createBlock('span', {
            text: value
          })
          this.appendChild(block, contentBlock)
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
          // Fix #1735 the blockquote maybe empty.
          if (parentList[0].children.length === 0) {
            const paragraphBlock = this.createBlockP()
            this.appendChild(parentList[0], paragraphBlock)
          }
          parentList.shift()
          break
        }

        case 'footnote_start': {
          block = this.createBlock('figure', {
            functionType: 'footnote'
          })
          const identifierInput = this.createBlock('span', {
            text: token.identifier,
            functionType: 'footnoteInput'
          })
          this.appendChild(block, identifierInput)
          this.appendChild(parentList[0], block)
          parentList.unshift(block)
          break
        }

        case 'footnote_end': {
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
          block = this.createBlock('li', {
            listItemType: checked !== undefined ? 'task' : listItemType,
            bulletMarkerOrDelimiter,
            isLooseListItem: type === 'loose_item_start'
          })

          if (checked !== undefined) {
            const input = this.createBlock('input', {
              checked
            })

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

  ContentState.prototype.htmlToMarkdown = function (html, keeps = []) {
    // turn html to markdown
    const { turndownConfig } = this
    const turndownService = new TurndownService(turndownConfig)
    usePluginAddRules(turndownService, keeps)

    // fix #752, but I don't know why the &nbsp; vanlished.
    html = html.replace(/<span>&nbsp;<\/span>/g, String.fromCharCode(160))

    html = turnSoftBreakToSpan(html)
    const markdown = turndownService.turndown(html)

    return markdown
  }

  // turn html to blocks
  ContentState.prototype.html2State = function (html) {
    const markdown = this.htmlToMarkdown(html, ['ruby', 'rt', 'u', 'br'])
    return this.markdownToState(markdown)
  }

  ContentState.prototype.getCodeMirrorCursor = function () {
    const blocks = this.getBlocks()
    const { anchor, focus } = this.cursor
    const anchorBlock = this.getBlock(anchor.key)
    const focusBlock = this.getBlock(focus.key)
    const { text: anchorText } = anchorBlock
    const { text: focusText } = focusBlock
    if (anchor.key === focus.key) {
      const minOffset = Math.min(anchor.offset, focus.offset)
      const maxOffset = Math.max(anchor.offset, focus.offset)
      const firstTextPart = anchorText.substring(0, minOffset)
      const secondTextPart = anchorText.substring(minOffset, maxOffset)
      const thirdTextPart = anchorText.substring(maxOffset)
      anchorBlock.text = firstTextPart +
        (anchor.offset <= focus.offset ? CURSOR_ANCHOR_DNA : CURSOR_FOCUS_DNA) +
        secondTextPart +
        (anchor.offset <= focus.offset ? CURSOR_FOCUS_DNA : CURSOR_ANCHOR_DNA) +
        thirdTextPart
    } else {
      anchorBlock.text = anchorText.substring(0, anchor.offset) + CURSOR_ANCHOR_DNA + anchorText.substring(anchor.offset)
      focusBlock.text = focusText.substring(0, focus.offset) + CURSOR_FOCUS_DNA + focusText.substring(focus.offset)
    }

    const { isGitlabCompatibilityEnabled, listIndentation } = this
    const markdown = new ExportMarkdown(blocks, listIndentation, isGitlabCompatibilityEnabled).generate()
    const cursor = markdown.split('\n').reduce((acc, line, index) => {
      const ach = line.indexOf(CURSOR_ANCHOR_DNA)
      const fch = line.indexOf(CURSOR_FOCUS_DNA)
      if (ach > -1 && fch > -1) {
        if (ach <= fch) {
          Object.assign(acc.anchor, { line: index, ch: ach })
          Object.assign(acc.focus, { line: index, ch: fch - CURSOR_ANCHOR_DNA.length })
        } else {
          Object.assign(acc.focus, { line: index, ch: fch })
          Object.assign(acc.anchor, { line: index, ch: ach - CURSOR_FOCUS_DNA.length })
        }
      } else if (ach > -1) {
        Object.assign(acc.anchor, { line: index, ch: ach })
      } else if (fch > -1) {
        Object.assign(acc.focus, { line: index, ch: fch })
      }
      return acc
    }, {
      anchor: {
        line: 0,
        ch: 0
      },
      focus: {
        line: 0,
        ch: 0
      }
    })
    // remove CURSOR_FOCUS_DNA and CURSOR_ANCHOR_DNA
    anchorBlock.text = anchorText
    focusBlock.text = focusText
    return cursor
  }

  ContentState.prototype.addCursorToMarkdown = function (markdown, cursor) {
    const { anchor, focus } = cursor
    if (!anchor || !focus) {
      return
    }
    const lines = markdown.split('\n')
    const anchorText = lines[anchor.line]
    const focusText = lines[focus.line]
    if (!anchorText || !focusText) {
      return {
        markdown: lines.join('\n'),
        isValid: false
      }
    }
    if (anchor.line === focus.line) {
      const minOffset = Math.min(anchor.ch, focus.ch)
      const maxOffset = Math.max(anchor.ch, focus.ch)
      const firstTextPart = anchorText.substring(0, minOffset)
      const secondTextPart = anchorText.substring(minOffset, maxOffset)
      const thirdTextPart = anchorText.substring(maxOffset)
      lines[anchor.line] = firstTextPart +
        (anchor.ch <= focus.ch ? CURSOR_ANCHOR_DNA : CURSOR_FOCUS_DNA) +
        secondTextPart +
        (anchor.ch <= focus.ch ? CURSOR_FOCUS_DNA : CURSOR_ANCHOR_DNA) +
        thirdTextPart
    } else {
      lines[anchor.line] = anchorText.substring(0, anchor.ch) + CURSOR_ANCHOR_DNA + anchorText.substring(anchor.ch)
      lines[focus.line] = focusText.substring(0, focus.ch) + CURSOR_FOCUS_DNA + focusText.substring(focus.ch)
    }

    return {
      markdown: lines.join('\n'),
      isValid: true
    }
  }

  ContentState.prototype.importCursor = function (hasCursor) {
    // set cursor
    const cursor = {
      anchor: null,
      focus: null
    }

    let count = 0

    const travel = blocks => {
      for (const block of blocks) {
        let { key, text, children, editable } = block
        if (text) {
          const offset = text.indexOf(CURSOR_ANCHOR_DNA)
          if (offset > -1) {
            block.text = text.substring(0, offset) + text.substring(offset + CURSOR_ANCHOR_DNA.length)
            text = block.text
            count++
            if (editable) {
              cursor.anchor = { key, offset }
            }
          }
          const focusOffset = text.indexOf(CURSOR_FOCUS_DNA)
          if (focusOffset > -1) {
            block.text = text.substring(0, focusOffset) + text.substring(focusOffset + CURSOR_FOCUS_DNA.length)
            count++
            if (editable) {
              cursor.focus = { key, offset: focusOffset }
            }
          }
          if (count === 2) {
            break
          }
        } else if (children.length) {
          travel(children)
        }
      }
    }
    if (hasCursor) {
      travel(this.blocks)
    } else {
      const lastBlock = this.getLastBlock()
      const key = lastBlock.key
      const offset = lastBlock.text.length
      cursor.anchor = { key, offset }
      cursor.focus = { key, offset }
    }
    if (cursor.anchor && cursor.focus) {
      this.cursor = cursor
    }
  }

  ContentState.prototype.importMarkdown = function (markdown) {
    this.blocks = this.markdownToState(markdown)
  }

  ContentState.prototype.extractImages = function (markdown) {
    const results = new Set()
    const blocks = this.markdownToState(markdown)
    const render = new StateRender(this.muya)
    render.collectLabels(blocks)

    const travelToken = token => {
      const { type, attrs, children, tag, label, backlash } = token
      if (/reference_image|image/.test(type) || type === 'html_tag' && tag === 'img') {
        if ((type === 'image' || type === 'html_tag') && attrs.src) {
          results.add(attrs.src)
        } else {
          const rawSrc = label + backlash.second
          if (render.labels.has((rawSrc).toLowerCase())) {
            const { href } = render.labels.get(rawSrc.toLowerCase())
            const { src } = getImageInfo(href)
            if (src) {
              results.add(src)
            }
          }
        }
      } else if (children && children.length) {
        for (const child of children) {
          travelToken(child)
        }
      }
    }

    const travel = block => {
      const { text, children, type, functionType } = block
      if (children.length) {
        for (const b of children) {
          travel(b)
        }
      } else if (text && type === 'span' && /paragraphContent|atxLine|cellContent/.test(functionType)) {
        const tokens = tokenizer(text, [], false, render.labels)
        for (const token of tokens) {
          travelToken(token)
        }
      }
    }

    for (const block of blocks) {
      travel(block)
    }

    return Array.from(results)
  }
}

export default importRegister
