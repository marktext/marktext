const LINE_BREAKS = /\n/

class ExportMarkdown {
  constructor (blocks) {
    this.blocks = blocks
    this.listType = [] // 'ul' or 'ol'
    this.blockquoteType = []
  }

  generate () {
    this.addDepth2Block(this.blocks, 0)
    return this.translateBlocks2Markdown(this.blocks, 0)
  }

  translateBlocks2Markdown (blocks, inLen) {
    const result = []
    const len = blocks.length
    const indent = ' '.repeat(inLen)
    let i
    for (i = 0; i < len; i++) {
      const block = blocks[i]
      switch (block.type) {
        case 'p':
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
          this.blockquoteType.push({ type: 'blockquote' })
          result.push(this.normalizeBlockquote(block, indent))
          this.blockquoteType.pop()
          break
      }
    }
    console.log(result)
    return result.join('')
  }

  insertLineBreak (result, indent) {
    if (result.length > 0) {
      const depth = this.blockquoteType.length
      const blockquotePrefix = depth ? `${'>'.repeat(depth)} ` : ''
      result.push(blockquotePrefix ? `${indent}${blockquotePrefix}\n` : '\n')
    }
  }

  insertBlockquotePrefix (text, indent) {
    const depth = this.blockquoteType.length
    const blockquotePrefix = depth ? `${'> '.repeat(depth)}` : ''
    return `${indent}${blockquotePrefix}${text}\n`
  }

  normalizeHeaderText (block, indent) {
    const match = block.text.match(/(#{1,6})(.*)/)
    const text = `${match[1]} ${match[2].trim()}`
    return this.insertBlockquotePrefix(text, indent)
  }

  normalizeParagraphText (block, indent) {
    return this.insertBlockquotePrefix(block.text, indent)
  }

  normalizeBlockquote (block, indent) {
    const { children } = block
    return this.translateBlocks2Markdown(children, indent.length)
  }

  normalizeCodeBlock (block, indent) {
    const result = []
    const textList = block.text.split(LINE_BREAKS)
    result.push(this.insertBlockquotePrefix(block.lang ? '```' + block.lang : '```', indent))

    textList.forEach(text => {
      result.push(this.insertBlockquotePrefix(text, indent))
    })
    result.push(this.insertBlockquotePrefix('```', indent))
    return result.join('')
  }

  normalizeList (block, indent) {
    const { children } = block
    return this.translateBlocks2Markdown(children, indent.length)
  }

  normalizeListItem (block, indent) {
    const result = []
    const listInfo = this.listType[this.listType.length - 1]
    const itemMarker = listInfo.type === 'ul' ? '- ' : `${listInfo.listCount++}. `
    const { children } = block

    result.push(`${indent}${itemMarker}`)
    result.push(this.translateBlocks2Markdown(children, indent.length + itemMarker.length).trimLeft())

    return result.join('')
  }

  addDepth2Block (blocks, initDepth) {
    const len = blocks.length
    let i

    for (i = 0; i < len; i++) {
      const block = blocks[i]
      block.depth = initDepth
      const { children } = block
      if (children.length) {
        this.addDepth2Block(children, initDepth + 1)
      }
    }
  }
}

export default ExportMarkdown
