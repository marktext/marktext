const HEADING_REG = /^h[1-6]$/

const getHeadingLevel = (block) => {
  return HEADING_REG.test(block.type) ? Number(block.type.slice(1)) : -1
}

const getFirstTextBlock = (block) => {
  if (!block) return null
  if (typeof block.text === 'string') return block

  for (const child of block.children) {
    const textBlock = getFirstTextBlock(child)
    if (textBlock) return textBlock
  }

  return null
}

const foldCtrl = (ContentState) => {
  ContentState.prototype.isHeadingBlock = function(block) {
    return !!block && HEADING_REG.test(block.type)
  }

  ContentState.prototype.isHeadingFolded = function(block) {
    return this.isHeadingBlock(block) && this.foldedHeadings.has(block.key)
  }

  ContentState.prototype.getSectionBlocks = function(heading) {
    const level = getHeadingLevel(heading)
    const sectionBlocks = []
    let block = this.getBlock(heading.nextSibling)

    while (block) {
      const blockLevel = getHeadingLevel(block)
      if (blockLevel > 0 && blockLevel <= level) {
        break
      }

      sectionBlocks.push(block)
      block = this.getBlock(block.nextSibling)
    }

    return sectionBlocks
  }

  ContentState.prototype.getFoldHeadingForBlock = function(block) {
    if (!block) return null

    const outmostBlock = block.parent ? this.findOutMostBlock(block) : block
    let heading = this.getBlock(outmostBlock.preSibling)

    while (heading) {
      if (this.isHeadingFolded(heading) && this.getSectionBlocks(heading).includes(outmostBlock)) {
        return heading
      }

      heading = this.getBlock(heading.preSibling)
    }

    return null
  }

  ContentState.prototype.isBlockHiddenByFold = function(block) {
    if (!block) return false

    const outmostBlock = block.parent ? this.findOutMostBlock(block) : block
    return outmostBlock === block && !!this.getFoldHeadingForBlock(outmostBlock)
  }

  ContentState.prototype.moveCursorToHeading = function(heading) {
    const textBlock = getFirstTextBlock(heading)
    if (!textBlock) return

    this.cursor = {
      noHistory: true,
      start: {
        key: textBlock.key,
        offset: 0
      },
      end: {
        key: textBlock.key,
        offset: 0
      },
      isEdit: false
    }
  }

  ContentState.prototype.ensureCursorVisible = function() {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start ? start.key : null)
    const endBlock = this.getBlock(end ? end.key : null)
    const startHeading = this.getFoldHeadingForBlock(startBlock)
    const endHeading = this.getFoldHeadingForBlock(endBlock)

    if (startHeading || endHeading) {
      this.moveCursorToHeading(startHeading || endHeading)
    }
  }

  ContentState.prototype.unfoldBlock = function(block) {
    let heading = this.getFoldHeadingForBlock(block)
    let didUnfold = false

    while (heading) {
      this.foldedHeadings.delete(heading.key)
      didUnfold = true
      heading = this.getFoldHeadingForBlock(heading)
    }

    return didUnfold
  }

  ContentState.prototype.unfoldBlockByKey = function(key) {
    const block = this.getBlock(key)
    const didUnfold = this.unfoldBlock(block)

    if (didUnfold) {
      this.render(false)
    }

    return didUnfold
  }

  ContentState.prototype.toggleHeadingFold = function(heading) {
    if (!this.isHeadingBlock(heading)) return

    if (this.isHeadingFolded(heading)) {
      this.foldedHeadings.delete(heading.key)
    } else {
      this.foldedHeadings.add(heading.key)
      this.ensureCursorVisible()
    }

    this.render()
  }

  ContentState.prototype.foldAllHeadings = function() {
    for (const block of this.blocks) {
      if (this.isHeadingBlock(block)) {
        this.foldedHeadings.add(block.key)
      }
    }

    this.ensureCursorVisible()
    this.render()
  }

  ContentState.prototype.unfoldAllHeadings = function() {
    this.foldedHeadings.clear()
    this.render()
  }

  ContentState.prototype.clearHeadingFolds = function() {
    this.foldedHeadings.clear()
  }
}

export default foldCtrl
