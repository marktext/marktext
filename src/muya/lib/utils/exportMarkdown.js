/**
 * Hi contributors!
 *
 * Before you edit or update codes in this file,
 * make sure you have read this bellow:
 * Commonmark Spec: https://spec.commonmark.org/0.29/
 * and GitHub Flavored Markdown Spec: https://github.github.com/gfm/
 * The output markdown needs to obey the standards of the two Spec.
 */

class ExportMarkdown {
  constructor (blocks, listIndentation = 1) {
    this.blocks = blocks
    this.listType = [] // 'ul' or 'ol'
    // helper to translate the first tight item in a nested list
    this.isLooseParentList = true

    // set and validate settings
    this.listIndentation = 'number'
    if (listIndentation === 'dfm') {
      this.listIndentation = 'dfm'
      this.listIndentationCount = 4
    } else if (typeof listIndentation === 'number') {
      this.listIndentationCount = Math.min(Math.max(listIndentation, 1), 4)
    } else {
      this.listIndentationCount = 1
    }
  }

  generate () {
    return this.translateBlocks2Markdown(this.blocks)
  }

  translateBlocks2Markdown (blocks, indent = '', listIndent = '') {
    const result = []
    // helper for CommonMark 264
    let lastListBullet = ''

    for (const block of blocks) {
      if (block.type !== 'ul' && block.type !== 'ol') {
        lastListBullet = ''
      }

      switch (block.type) {
        case 'p':
        case 'hr': {
          this.insertLineBreak(result, indent)
          result.push(this.translateBlocks2Markdown(block.children, indent))
          break
        }
        case 'span': {
          result.push(this.normalizeParagraphText(block, indent))
          break
        }
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          this.insertLineBreak(result, indent)
          result.push(this.normalizeHeaderText(block, indent))
          break
        }
        case 'figure': {
          this.insertLineBreak(result, indent)
          switch (block.functionType) {
            case 'table': {
              const table = block.children[0]
              result.push(this.normalizeTable(table, indent))
              break
            }
            case 'html': {
              result.push(this.normalizeHTML(block, indent))
              break
            }
            case 'multiplemath': {
              result.push(this.normalizeMultipleMath(block, indent))
              break
            }
            case 'mermaid':
            case 'flowchart':
            case 'sequence':
            case 'vega-lite': {
              result.push(this.normalizeContainer(block, indent))
              break
            }
          }
          break
        }
        case 'li': {
          const insertNewLine = block.isLooseListItem

          // helper variable to correct the first tight item in a nested list
          this.isLooseParentList = insertNewLine
          if (insertNewLine) {
            this.insertLineBreak(result, indent)
          }
          result.push(this.normalizeListItem(block, indent + listIndent))
          this.isLooseParentList = true
          break
        }
        case 'ul': {
          let insertNewLine = this.isLooseParentList
          this.isLooseParentList = true

          // Start a new list without separation due changing the bullet or ordered list delimiter starts a new list.
          const { bulletMarkerOrDelimiter } = block.children[0]
          if (lastListBullet && lastListBullet !== bulletMarkerOrDelimiter) {
            insertNewLine = false
          }
          lastListBullet = bulletMarkerOrDelimiter
          if (insertNewLine) {
            this.insertLineBreak(result, indent)
          }

          this.listType.push({ type: 'ul' })
          result.push(this.normalizeList(block, indent, listIndent))
          this.listType.pop()
          break
        }
        case 'ol': {
          let insertNewLine = this.isLooseParentList
          this.isLooseParentList = true

          // Start a new list without separation due changing the bullet or ordered list delimiter starts a new list.
          const { bulletMarkerOrDelimiter } = block.children[0]
          if (lastListBullet && lastListBullet !== bulletMarkerOrDelimiter) {
            insertNewLine = false
          }
          lastListBullet = bulletMarkerOrDelimiter
          if (insertNewLine) {
            this.insertLineBreak(result, indent)
          }
          const listCount = block.start !== undefined ? block.start : 1
          this.listType.push({ type: 'ol', listCount })
          result.push(this.normalizeList(block, indent, listIndent))
          this.listType.pop()
          break
        }
        case 'pre': {
          this.insertLineBreak(result, indent)
          if (block.functionType === 'frontmatter') {
            result.push(this.normalizeFrontMatter(block, indent))
          } else {
            result.push(this.normalizeCodeBlock(block, indent))
          }
          break
        }
        case 'blockquote': {
          this.insertLineBreak(result, indent)
          result.push(this.normalizeBlockquote(block, indent))
          break
        }
        default: {
          console.log(block.type)
          break
        }
      }
    }
    return result.join('')
  }

  insertLineBreak (result, indent) {
    if (!result.length) return
    result.push(`${indent}\n`)
  }

  normalizeParagraphText (block, indent) {
    const { text } = block
    const lines = text.split('\n')
    return lines.map(line => `${indent}${line}`).join('\n') + '\n'
  }

  normalizeHeaderText (block, indent) {
    const { headingStyle, marker } = block
    const { text } = block.children[0]
    if (headingStyle === 'atx') {
      const match = text.match(/(#{1,6})(.*)/)
      const atxHeadingText = `${match[1]} ${match[2].trim()}`
      return `${indent}${atxHeadingText}\n`
    } else if (headingStyle === 'setext') {
      const lines = text.trim().split('\n')
      return lines.map(line => `${indent}${line}`).join('\n') + `\n${indent}${marker.trim()}\n`
    }
  }

  normalizeBlockquote (block, indent) {
    const { children } = block
    const newIndent = `${indent}> `
    return this.translateBlocks2Markdown(children, newIndent)
  }

  normalizeFrontMatter (block, indent) { // preBlock
    let startToken
    let endToken
    switch (block.lang) {
      case 'yaml':
        startToken = '---\n'
        endToken = '---\n'
        break
      case 'toml':
        startToken = '+++\n'
        endToken = '+++\n'
        break
      case 'json':
        if (block.style === ';') {
          startToken = ';;;\n'
          endToken = ';;;\n'
        } else {
          startToken = '{\n'
          endToken = '}\n'
        }
        break
    }

    const result = []
    result.push(startToken)
    for (const line of block.children[0].children) {
      result.push(`${line.text}\n`)
    }
    result.push(endToken)
    return result.join('')
  }

  normalizeMultipleMath (block, /* figure */ indent) {
    const result = []
    result.push(`${indent}$$\n`)
    for (const line of block.children[0].children[0].children) {
      result.push(`${indent}${line.text}\n`)
    }
    result.push(`${indent}$$\n`)
    return result.join('')
  }

  // `mermaid` `flowchart` `sequence` `vega-lite`
  normalizeContainer (block, indent) {
    const result = []
    const diagramType = block.children[0].functionType
    result.push('```' + diagramType + '\n')
    for (const line of block.children[0].children[0].children) {
      result.push(`${line.text}\n`)
    }
    result.push('```\n')
    return result.join('')
  }

  normalizeCodeBlock (block, indent) {
    const result = []
    const codeContent = block.children[1].children[0]
    const textList = codeContent.text.split('\n')
    const { functionType } = block
    if (functionType === 'fencecode') {
      result.push(`${indent}${block.lang ? '```' + block.lang + '\n' : '```\n'}`)
      textList.forEach(text => {
        result.push(`${indent}${text}\n`)
      })
      result.push(indent + '```\n')
    } else {
      textList.forEach(text => {
        result.push(`${indent}    ${text}\n`)
      })
    }

    return result.join('')
  }

  normalizeHTML (block, indent) { // figure
    const result = []
    const codeContentText = block.children[0].children[0].children[0].text
    const lines = codeContentText.split('\n')
    for (const line of lines) {
      result.push(`${indent}${line}\n`)
    }
    return result.join('')
  }

  normalizeTable (table, indent) {
    const result = []
    const { row, column } = table
    const tableData = []
    const tHeader = table.children[0]
    const tBody = table.children[1]
    const escapeText = str => {
      return str.replace(/([^\\])\|/g, '$1\\|')
    }

    tableData.push(tHeader.children[0].children.map(th => escapeText(th.text).trim()))
    if (tBody) {
      tBody.children.forEach(bodyRow => {
        tableData.push(bodyRow.children.map(td => escapeText(td.text).trim()))
      })
    }

    const columnWidth = tHeader.children[0].children.map(th => ({ width: 5, align: th.align }))

    let i
    let j

    for (i = 0; i <= row; i++) {
      for (j = 0; j <= column; j++) {
        columnWidth[j].width = Math.max(columnWidth[j].width, tableData[i][j].length + 2) // add 2, because have two space around text
      }
    }
    tableData.forEach((r, i) => {
      const rs = indent + '|' + r.map((cell, j) => {
        const raw = ` ${cell + ' '.repeat(columnWidth[j].width)}`
        return raw.substring(0, columnWidth[j].width)
      }).join('|') + '|'
      result.push(rs)
      if (i === 0) {
        const cutOff = indent + '|' + columnWidth.map(({ width, align }) => {
          let raw = '-'.repeat(width - 2)
          switch (align) {
            case 'left':
              raw = `:${raw} `
              break
            case 'center':
              raw = `:${raw}:`
              break
            case 'right':
              raw = ` ${raw}:`
              break
            default:
              raw = ` ${raw} `
              break
          }
          return raw
        }).join('|') + '|'
        result.push(cutOff)
      }
    })
    return result.join('\n') + '\n'
  }

  normalizeList (block, indent, listIndent) {
    const { children } = block
    return this.translateBlocks2Markdown(children, indent, listIndent)
  }

  normalizeListItem (block, indent) {
    const result = []
    const listInfo = this.listType[this.listType.length - 1]
    const isUnorderedList = listInfo.type === 'ul'
    let { children, bulletMarkerOrDelimiter } = block
    let itemMarker

    if (isUnorderedList) {
      itemMarker = bulletMarkerOrDelimiter ? `${bulletMarkerOrDelimiter} ` : '- '
    } else {
      // NOTE: GitHub and Bitbucket limit the list count to 99 but this is nowhere defined.
      //  We limit the number to 99 for Daring Fireball Markdown to prevent indentation issues.
      let n = listInfo.listCount
      if ((this.listIndentation === 'dfm' && n > 99) || n > 999999999) {
        n = 1
      }
      listInfo.listCount++

      const delimiter = bulletMarkerOrDelimiter || '.'
      itemMarker = `${n}${delimiter} `
    }

    // Subsequent paragraph indentation
    const newIndent = indent + ' '.repeat(itemMarker.length)

    // New list indentation. We already added one space to the indentation
    let listIndent = ''
    const { listIndentation } = this
    if (listIndentation === 'dfm') {
      listIndent = ' '.repeat(4 - itemMarker.length)
    } else if (listIndentation === 'number') {
      listIndent = ' '.repeat(this.listIndentationCount - 1)
    }

    // TODO: Indent subsequent paragraphs by one tab. - not important
    //  Problem: "translateBlocks2Markdown" use "indent" in spaces to indent elements. How should
    //  we integrate tabs in blockquotes and subsequent paragraphs and how to combine with spaces?
    //  I don't know how to combine tabs and spaces and it seems not specified, so work for another day.

    if (isUnorderedList && block.listItemType === 'task') {
      const firstChild = children[0]
      itemMarker += firstChild.checked ? '[x] ' : '[ ] '
      children = children.slice(1)
    }

    result.push(`${indent}${itemMarker}`)
    result.push(this.translateBlocks2Markdown(children, newIndent, listIndent).substring(newIndent.length))
    return result.join('')
  }
}

export default ExportMarkdown
