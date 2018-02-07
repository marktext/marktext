import selection from '../selection'

const tabCtrl = ContentState => {
  ContentState.prototype.findNextCell = function (block) {
    if (!(/td|th/.test(block.type))) throw new Error('only th and td can have next cell')
    const nextSibling = this.getBlock(block.nextSibling)
    const parent = this.getBlock(block.parent)
    const tbOrTh = this.getBlock(parent.parent)
    if (nextSibling) {
      return nextSibling
    } else {
      if (parent.nextSibling) {
        const nextRow = this.getBlock(parent.nextSibling)
        return nextRow.children[0]
      } else if (tbOrTh.type === 'thead') {
        const tBody = this.getBlock(tbOrTh.nextSibling)
        if (tBody.children.length) {
          return tBody.children[0].children[0]
        }
      }
    }
    return false
  }

  ContentState.prototype.tabHandler = function (event) {
    const { start, end } = selection.getCursorRange()
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    let nextCell
    if (start.key === end.key && /th|td/.test(startBlock.type)) {
      nextCell = this.findNextCell(startBlock)
    } else if (/th|td/.test(endBlock.type)) {
      nextCell = endBlock
    }
    if (nextCell) {
      event.preventDefault()
      const key = nextCell.key
      const textLength = nextCell.text.length
      this.cursor = {
        start: { key, offset: 0 },
        end: { key, offset: textLength }
      }
      this.render()
    }
  }
}

export default tabCtrl
