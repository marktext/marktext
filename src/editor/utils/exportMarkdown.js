/**
 * Before you edit or update codes in this file, make sure you have read the
 * Commonmark Spec: http://spec.commonmark.org/0.28/
 * and GitHub Flavored Markdown Spec: https://github.github.com/gfm/
 * The output markdown needs to obey the standards of the two Spec.
 */
const LINE_BREAKS = /\n/

class ExportMarkdown {
  constructor (blocks) {
    this.blocks = blocks
    this.listType = [] // 'ul' or 'ol'
    // helper to translate the first tight item in a nested list
    this.isLooseParentList = true
  }

  generate () {
    return this.translateBlocks2Markdown(this.blocks)
  }

  translateBlocks2Markdown (blocks, indent = '') {
    const result = []

    for (const block of blocks) {
      switch (block.type) {
        case 'p':
        case 'hr':
          this.insertLineBreak(result, indent, true)
          result.push(this.normalizeParagraphText(block, indent))
          break

        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          this.insertLineBreak(result, indent, true)
          result.push(this.normalizeHeaderText(block, indent))
          break

        case 'figure':
          this.insertLineBreak(result, indent, true)
          const table = block.children[1]
          result.push(this.normalizeTable(table, indent))
          break

        case 'li': {
          const insertNewLine = block.isLooseListItem

          // helper variable to correct the first tight item in a nested list
          this.isLooseParentList = insertNewLine

          this.insertLineBreak(result, indent, insertNewLine)
          result.push(this.normalizeListItem(block, indent))
          this.isLooseParentList = true
          break
        }

        case 'ul': {
          const insertNewLine = this.isLooseParentList
          this.isLooseParentList = true

          this.insertLineBreak(result, indent, insertNewLine)
          this.listType.push({ type: 'ul' })
          result.push(this.normalizeList(block, indent))
          this.listType.pop()
          break
        }

        case 'ol': {
          const insertNewLine = this.isLooseParentList
          this.isLooseParentList = true

          this.insertLineBreak(result, indent, insertNewLine)
          const listCount = block.start !== undefined ? block.start : 1
          this.listType.push({ type: 'ol', listCount })
          result.push(this.normalizeList(block, indent))
          this.listType.pop()
          break
        }

        case 'pre':
          this.insertLineBreak(result, indent, true)
          result.push(this.normalizeCodeBlock(block, indent))
          break

        case 'blockquote':
          this.insertLineBreak(result, indent, true)
          result.push(this.normalizeBlockquote(block, indent))
          break
        default:
          console.log(block.type)
          break
      }
    }
    return result.join('')
  }

  insertLineBreak (result, indent, insertNewLine) {
    if (!result.length) return
    const newLine = insertNewLine ? '\n' : ''
    if (/\S/.test(indent)) {
      result.push(`${indent}${newLine}`)
    } else if (insertNewLine) {
      result.push(newLine)
    }
  }

  normalizeParagraphText (block, indent) {
    return `${indent}${block.text}\n`
  }

  normalizeHeaderText (block, indent) {
    const match = block.text.match(/(#{1,6})(.*)/)
    const text = `${match[1]} ${match[2].trim()}`
    return `${indent}${text}\n`
  }

  normalizeBlockquote (block, indent) {
    const { children } = block
    const newIndent = `${indent}> `
    return this.translateBlocks2Markdown(children, newIndent)
  }

  normalizeCodeBlock (block, indent) {
    const result = []
    const textList = block.text.split(LINE_BREAKS)
    result.push(`${indent}${block.lang ? '```' + block.lang + '\n' : '```\n'}`)

    textList.forEach(text => {
      result.push(`${indent}${text}\n`)
    })
    result.push(indent + '```\n')
    return result.join('')
  }

  normalizeTable (table, indent) {
    const result = []
    const { row, column } = table
    const tableData = []
    const tHeader = table.children[0]

    const tBody = table.children[1]
    tableData.push(tHeader.children[0].children.map(th => th.text.trim()))
    tBody.children.forEach(bodyRow => {
      tableData.push(bodyRow.children.map(td => td.text.trim()))
    })

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

  normalizeList (block, indent) {
    const { children } = block
    return this.translateBlocks2Markdown(children, indent)
  }

  normalizeListItem (block, indent) {
    const result = []
    const listInfo = this.listType[this.listType.length - 1]
    let { children } = block
    let itemMarker

    if (listInfo.type === 'ul') {
      itemMarker = '- '
      if (block.listItemType === 'task') {
        const firstChild = children[0]
        itemMarker += firstChild.checked ? '[x] ' : '[ ] '
        children = children.slice(1)
      }
    } else {
      itemMarker = `${listInfo.listCount++}. `
    }

    const newIndent = indent + ' '.repeat(itemMarker.length)

    result.push(`${indent}${itemMarker}`)
    result.push(this.translateBlocks2Markdown(children, newIndent).substring(newIndent.length))

    return result.join('')
  }
}

export default ExportMarkdown
