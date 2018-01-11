const LINE_BREAKS = /\n/

class ExportMarkdown {
  constructor (blocks) {
    this.blocks = blocks
    this.listType = [] // 'ul' or 'ol'
  }

  generate () {
    return this.translateBlocks2Markdown(this.blocks)
  }

  translateBlocks2Markdown (blocks, indent = '') {
    const result = []
    const len = blocks.length
    let i

    for (i = 0; i < len; i++) {
      const block = blocks[i]
      switch (block.type) {
        case 'p':
        case 'hr':
          this.insertLineBreak(result, indent)
          result.push(this.normalizeParagraphText(block, indent))
          break

        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          this.insertLineBreak(result, indent)
          result.push(this.normalizeHeaderText(block, indent))
          break

        case 'li':
          this.insertLineBreak(result, indent)
          result.push(this.normalizeListItem(block, indent))
          break

        case 'ul':
          this.insertLineBreak(result, indent)
          this.listType.push({ type: 'ul' })
          result.push(this.normalizeList(block, indent))
          this.listType.pop()
          break

        case 'ol':
          this.insertLineBreak(result, indent)
          const listCount = block.start !== undefined ? block.start : 1
          this.listType.push({ type: 'ol', listCount })
          result.push(this.normalizeList(block, indent))
          this.listType.pop()
          break

        case 'pre':
          this.insertLineBreak(result, indent)
          result.push(this.normalizeCodeBlock(block, indent))
          break

        case 'blockquote':
          this.insertLineBreak(result, indent)
          result.push(this.normalizeBlockquote(block, indent))
          break
        default:
          console.log(block.type)
          break
      }
    }
    return result.join('')
  }

  insertLineBreak (result, indent) {
    if (result.length > 0) {
      if (/\S/.test(indent)) {
        result.push(`${indent}\n`)
      } else {
        result.push('\n')
      }
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
      if (block.isTask) {
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
