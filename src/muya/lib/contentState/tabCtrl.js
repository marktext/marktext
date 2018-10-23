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

  ContentState.prototype.isUnindentableListItem = function (block) {
    const parent = this.getParent(block)
    const listItem = this.getParent(parent)
    const list = this.getParent(listItem)
    const listParent = this.getParent(list)
    if (!this.isCollapse()) return false
    if (listParent && listParent.type === 'li') {
      return !list.preSibling ? 'REPLACEMENT' : 'INDENT'
    }
    return false
  }

  ContentState.prototype.isIndentableListItem = function () {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const parent = this.getParent(startBlock)
    if (parent.type !== 'p' || !parent.parent) {
      return false
    }

    const listItem = this.getParent(parent)
    if (listItem.type !== 'li' || start.key !== end.key || start.offset !== end.offset) {
      return false
    }

    // Now we know it's a list item. Check whether we can indent the list item.
    const list = this.getParent(listItem)
    return list && /ol|ul/.test(list.type) && listItem.preSibling
  }

  ContentState.prototype.unindentListItem = function (block, type) {
    const pBlock = this.getParent(block)
    const listItem = this.getParent(pBlock)
    const list = this.getParent(listItem)
    const listParent = this.getParent(list)
    if (type === 'REPLACEMENT') {
      this.insertBefore(pBlock, list)
      if (this.isOnlyChild(listItem)) {
        this.removeBlock(list)
      } else {
        this.removeBlock(listItem)
      }
    } else if (type === 'INDENT') {
      if (list.children.length === 1) {
        this.removeBlock(list)
      } else {
        const newList = this.createBlock(list.type)
        let target = this.getNextSibling(listItem)
        while (target) {
          this.appendChild(newList, target)
          let temp = target
          target = this.getNextSibling(target)
          this.removeBlock(temp, list)
        }

        if (newList.children.length) this.appendChild(listItem, newList)
        this.removeBlock(listItem, list)
        if (!list.children.length) {
          this.removeBlock(list)
        }
      }
      this.insertAfter(listItem, listParent)
      let target = this.getNextSibling(list)
      while (target) {
        this.appendChild(listItem, target)
        this.removeBlock(target, listParent)
        target = this.getNextSibling(target)
      }
    }

    return this.partialRender()
  }

  ContentState.prototype.indentListItem = function () {
    const { start } = this.cursor
    const startBlock = this.getBlock(start.key)
    const parent = this.getParent(startBlock)
    const listItem = this.getParent(parent)
    const list = this.getParent(listItem)
    const prevListItem = this.getPreSibling(listItem)

    this.removeBlock(listItem)

    // Search for a list in previous block
    let newList = this.getLastChild(prevListItem)
    if (!newList || !/ol|ul/.test(newList.type)) {
      newList = this.createBlock(list.type)
      this.appendChild(prevListItem, newList)
    }

    // Update item type only if we insert into an existing list
    if (newList.children.length !== 0) {
      listItem.isLooseListItem = newList.children[0].isLooseListItem
    }

    this.appendChild(newList, listItem)
    return this.partialRender()
  }

  ContentState.prototype.insertTab = function () {
    const tabSize = this.tabSize
    const tabCharacter = String.fromCharCode(160).repeat(tabSize)
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    if (start.key === end.key && start.offset === end.offset) {
      startBlock.text = startBlock.text.substring(0, start.offset) +
        tabCharacter + endBlock.text.substring(end.offset)
      const key = start.key
      const offset = start.offset + tabCharacter.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.partialRender()
    }
  }

  ContentState.prototype.tabHandler = function (event) {
    // disable tab focus
    event.preventDefault()

    const { start, end } = selection.getCursorRange()
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)

    if (event.shiftKey) {
      const unindentType = this.isUnindentableListItem(startBlock)
      if (unindentType) {
        this.unindentListItem(startBlock, unindentType)
      }
      return
    }

    let nextCell
    if (start.key === end.key && /th|td/.test(startBlock.type)) {
      nextCell = this.findNextCell(startBlock)
    } else if (/th|td/.test(endBlock.type)) {
      nextCell = endBlock
    }
    if (nextCell) {
      const key = nextCell.key
      const textLength = nextCell.text.length
      this.cursor = {
        start: { key, offset: 0 },
        end: { key, offset: textLength }
      }

      return this.partialRender()
    }

    if (this.isIndentableListItem()) {
      return this.indentListItem()
    }
    return this.insertTab()
  }
}

export default tabCtrl
